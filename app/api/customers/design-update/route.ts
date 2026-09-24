import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class InfraUnavailableError extends Error {
  readonly step: string;
  readonly code?: string;

  constructor(step: string, code?: string) {
    super("infra_unavailable");
    this.name = "InfraUnavailableError";
    this.step = step;
    this.code = code;
  }
}

const SERVICE_UNAVAILABLE_BODY = { error: "Service temporarily unavailable." };

function logRouteError(step: string, httpStatus: number, rawCode?: string): void {
  try {
    const suffix = rawCode ? ` errorCode=${rawCode}` : "";
    console.error(`[design-update] step=${step} httpStatus=${httpStatus}${suffix}`);
  } catch {
    // Logging khong bao gio duoc lam hong response.
  }
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMinutes: number
): Promise<boolean> {
  const windowMs = windowMinutes * 60 * 1000;

  const { data, error: selectError } = await supabaseAdmin
    .from("api_rate_limits")
    .select("count, window_start")
    .eq("key", key)
    .maybeSingle();

  if (selectError) {
    throw new InfraUnavailableError("checkRateLimit", selectError.code);
  }

  const now = Date.now();

  if (!data || now - new Date(data.window_start).getTime() > windowMs) {
    const { error: upsertError } = await supabaseAdmin
      .from("api_rate_limits")
      .upsert({ key, count: 1, window_start: new Date().toISOString() });

    if (upsertError) {
      throw new InfraUnavailableError("checkRateLimit", upsertError.code);
    }

    return true;
  }

  if (data.count >= maxRequests) {
    return false;
  }

  const { error: updateError } = await supabaseAdmin
    .from("api_rate_limits")
    .update({ count: data.count + 1 })
    .eq("key", key);

  if (updateError) {
    throw new InfraUnavailableError("checkRateLimit", updateError.code);
  }

  return true;
}

function isValidCustomerId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

// Xac thuc quyen sua: client phai gui dung token (session_token that cua
// khach do), khong chi customerId (so nguyen doan duoc). Tra ve true chi khi
// token khop dung voi session_token luu trong DB cho dung customerId nay.
async function verifyCustomerToken(
  customerId: number,
  token: unknown
): Promise<boolean> {
  if (typeof token !== "string" || token.trim().length === 0) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("session_token")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw new InfraUnavailableError("verifyCustomerToken", error.code);
  }

  if (!data || typeof data.session_token !== "string") {
    return false;
  }

  return data.session_token === token;
}

async function uploadBase64Image(base64Image: string): Promise<string> {
  const match = base64Image.match(/^data:image\/(png|jpeg);base64,(.+)$/);

  if (!match) {
    throw new InfraUnavailableError("uploadBase64Image", "invalid_format");
  }

  const mimeSubtype = match[1];
  const base64Data = match[2];

  let byteArray: Uint8Array;

  try {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    byteArray = new Uint8Array(byteNumbers);
  } catch {
    throw new InfraUnavailableError("uploadBase64Image", "invalid_base64");
  }

  if (byteArray.length === 0 || byteArray.length > 5_000_000) {
    throw new InfraUnavailableError("uploadBase64Image", "invalid_size");
  }

  const fileName = `design-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${mimeSubtype}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("nail-designs")
    .upload(fileName, byteArray, { contentType: `image/${mimeSubtype}` });

  if (uploadError) {
    throw new InfraUnavailableError("uploadBase64Image", uploadError.name);
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from("nail-designs")
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const allowed = await checkRateLimit(`design-update:${ip}`, 60, 60);

    if (!allowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { customerId, token, kind } = body ?? {};

    if (!isValidCustomerId(customerId)) {
      return Response.json({ error: "Invalid customerId." }, { status: 400 });
    }

    const authorized = await verifyCustomerToken(customerId, token);

    if (!authorized) {
      return Response.json(
        { error: "Not authorized to update this record." },
        { status: 403 }
      );
    }

    if (kind === "all_design_images") {
      const { images, sources } = body;

      if (
        !Array.isArray(images) ||
        images.length === 0 ||
        images.length > 4 ||
        !Array.isArray(sources) ||
        sources.length !== images.length
      ) {
        return Response.json({ error: "Invalid images." }, { status: 400 });
      }

      const uploaded = await Promise.all(
        images.map((img: unknown, idx: number) => {
          if (typeof img !== "string") {
            throw new InfraUnavailableError("allDesignImages", "invalid_item");
          }
          return sources[idx] === "real" ? img : uploadBase64Image(img);
        })
      );

      const { error } = await supabaseAdmin
        .from("customers")
        .update({ all_design_images: uploaded })
        .eq("id", customerId);

      if (error) {
        throw new InfraUnavailableError("updateAllDesignImages", error.code);
      }

      return Response.json({ success: true, urls: uploaded });
    }

    if (kind === "selected_design") {
      const { index, image } = body;

      if (
        typeof index !== "number" ||
        !Number.isInteger(index) ||
        index < 0 ||
        typeof image !== "string"
      ) {
        return Response.json({ error: "Invalid selection." }, { status: 400 });
      }

      const isDataUrl = image.startsWith("data:image/");
      const finalUrl = isDataUrl ? await uploadBase64Image(image) : image;

      const { error } = await supabaseAdmin
        .from("customers")
        .update({
          selected_design: `Mẫu ${index + 1}`,
          selected_design_image: finalUrl,
        })
        .eq("id", customerId);

      if (error) {
        throw new InfraUnavailableError("updateSelectedDesign", error.code);
      }

      return Response.json({ success: true, url: finalUrl });
    }

    if (kind === "tryon_image") {
      const { image, used } = body;

      if (typeof image !== "string") {
        return Response.json({ error: "Invalid image." }, { status: 400 });
      }

      const finalUrl = await uploadBase64Image(image);

      const { error } = await supabaseAdmin
        .from("customers")
        .update({ tryon_image: finalUrl, tryon_used: !!used })
        .eq("id", customerId);

      if (error) {
        throw new InfraUnavailableError("updateTryonImage", error.code);
      }

      return Response.json({ success: true, url: finalUrl });
    }

    return Response.json({ error: "Invalid kind." }, { status: 400 });
  } catch (caught) {
    if (caught instanceof InfraUnavailableError) {
      logRouteError(caught.step, 503, caught.code);
      return Response.json(SERVICE_UNAVAILABLE_BODY, { status: 503 });
    }

    logRouteError("unexpected", 500);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
