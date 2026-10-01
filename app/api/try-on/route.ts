export const maxDuration = 60;
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const GLOBAL_TRYON_MAX_PER_DAY = 40;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMinutes: number
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit_atomic", {
    p_key: key,
    p_max: maxRequests,
    p_window_minutes: windowMinutes,
  });

  if (error) {
    throw new Error("rate_limit_infra_error");
  }

  return data === true;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return "unknown";
}

const ALLOWED_STORAGE_HOSTS = new Set([
  "rxptwdxbxlxcuxjzuvfr.supabase.co",
]);
const ALLOWED_STORAGE_PATH_PREFIX = "/storage/v1/object/public/nail-designs/";

function isAllowedExternalImageUrl(raw: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (!ALLOWED_STORAGE_HOSTS.has(parsed.hostname)) return false;
  if (!parsed.pathname.startsWith(ALLOWED_STORAGE_PATH_PREFIX)) return false;

  return true;
}

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function resolveTechUserId(salonRef: string): Promise<string | null> {
  if (UUID_PATTERN.test(salonRef)) {
    const { data, error } = await supabaseAdmin
      .from("tech_profiles")
      .select("user_id")
      .eq("user_id", salonRef)
      .maybeSingle();

    if (!error && data?.user_id) {
      return data.user_id as string;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("tech_profiles")
    .select("user_id")
    .eq("username", salonRef)
    .maybeSingle();

  if (error || !data?.user_id) return null;

  return data.user_id as string;
}

const DEFAULT_ANALYZE_LIMIT = 10;
const DEFAULT_TRYON_LIMIT = 6;

async function getActiveAiLimits(
  userId: string
): Promise<{ analyzeLimit: number; tryonLimit: number }> {
  const { data, error } = await supabaseAdmin
    .from("tech_plans")
    .select("plan, trial_ends_at, pro_expires_at, monthly_analyze_limit, monthly_tryon_limit")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { analyzeLimit: DEFAULT_ANALYZE_LIMIT, tryonLimit: DEFAULT_TRYON_LIMIT };
  }

  const now = Date.now();
  let active = true;

  if (data.plan === "trial" && data.trial_ends_at && new Date(data.trial_ends_at).getTime() < now) {
    active = false;
  }
  if (data.plan === "pro" && data.pro_expires_at && new Date(data.pro_expires_at).getTime() < now) {
    active = false;
  }

  if (!active) {
    return { analyzeLimit: DEFAULT_ANALYZE_LIMIT, tryonLimit: DEFAULT_TRYON_LIMIT };
  }

  return {
    analyzeLimit: data.monthly_analyze_limit,
    tryonLimit: data.monthly_tryon_limit,
  };
}

async function urlToFile(
  url: string,
  filename: string,
  options: { allowExternal: boolean }
): Promise<File> {
  const isDataUrl = url.startsWith("data:image/");

  if (!isDataUrl) {
    if (!options.allowExternal || !isAllowedExternalImageUrl(url)) {
      throw new Error("Unsupported image source.");
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
    });

    if (!response.ok) throw new Error("Cannot load reference image");

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      throw new Error("Unsupported image source.");
    }

    const blob = await response.blob();

    if (blob.size <= 0 || blob.size > 5_000_000) {
      throw new Error("Image too large or invalid.");
    }

    return new File([blob], filename, { type: blob.type || "image/jpeg" });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const allowed = await checkRateLimit(`tryon:${ip}`, 20, 1440);

    if (!allowed) {
      return Response.json(
        {
          error:
            "Đã đạt giới hạn sử dụng hôm nay. Vui lòng thử lại vào ngày mai.",
        },
        { status: 429 }
      );
    }

    const globalAllowed = await checkRateLimit(
      "global:tryon",
      GLOBAL_TRYON_MAX_PER_DAY,
      1440
    );
    if (!globalAllowed) {
      return Response.json(
        {
          error:
            "AI đang tạm nghỉ hôm nay / AI is resting for today, please try again tomorrow.",
        },
        { status: 429 }
      );
    }

    // Nhan du lieu tu CA HAI luong goi:
    // - Trang chu (chon 1 trong cac mau AI de xuat): gui "designImage"
    // - Live Camera (chon mau/kieu co san): gui "colorHex", "colorName", "style"
    const { image, designImage, colorHex, colorName, style, salonRef } =
      await request.json();

    if (!image) {
      return Response.json(
        {
          error: "Không có ảnh bàn tay.",
        },
        { status: 400 }
      );
    }

    if (typeof salonRef === "string" && salonRef.trim().length > 0) {
      const techUserId = await resolveTechUserId(salonRef.trim());

      if (techUserId) {
        const limits = await getActiveAiLimits(techUserId);
        const { data: usageAllowed, error: usageError } = await supabaseAdmin.rpc(
          "check_and_bump_ai_usage",
          {
            p_user_id: techUserId,
            p_kind: "tryon",
            p_limit: limits.tryonLimit,
          }
        );

        if (usageError) {
          throw new Error("ai_usage_infra_error");
        }

        if (usageAllowed !== true) {
          return Response.json(
            {
              error:
                "Thợ đã dùng hết lượt thử mẫu AI miễn phí tháng này. Nâng cấp Pro để tiếp tục. / This tech has used all free AI try-on credits this month. Upgrade to Pro to continue.",
            },
            { status: 429 }
          );
        }
      }
    }

    const handFile = await urlToFile(image, "hand.jpg", { allowExternal: false });

    let editedImage;

    if (designImage) {
      // ---- LUONG 1: TRANG CHU - ghep mau da chon (designImage) len tay that ----
      const designFile = await urlToFile(designImage, "design.jpg", { allowExternal: true });

      editedImage = await openai.images.edit({
        model: "gpt-image-2",
        image: [handFile, designFile],
        quality: "low",
        size: "1024x1024",
        prompt: `
The first image shows a real hand. The second image shows a reference nail
design (color, pattern, and style).

Apply the exact nail color, pattern, and style shown in the second reference
image onto every fingernail of the hand in the first image.

IMPORTANT — apply this to EVERY SINGLE fingernail visible in the first photo,
with no exceptions: thumb, index, middle, ring, and pinky must all receive the
same design, evenly and consistently. Do not skip, miss, or leave any nail in
its original/natural state.

Keep each nail's original size, shape, and boundary exactly as in the first
photo — only change its color/pattern, do not resize or reshape any nail.

Keep the original from the first photo:
- hand
- fingers
- skin tone
- hand position
- lighting
- background

Only modify the fingernails.

Make all nails realistic, clean, glossy and salon-quality.
Do not change the shape or appearance of the person's hand.
        `,
      });
    } else {
      // ---- LUONG 2: LIVE CAMERA - to mau/kieu co san (colorHex/style) ----
      let stylePrompt = "";

      if (style === "solid" || style === "plain") {
        stylePrompt =
          "Use a plain, solid, glossy nail polish color with no nail art or pattern.";
      }

      if (style === "light") {
        stylePrompt =
          "Use a simple elegant nail style with very light minimal decoration.";
      }

      if (style === "detailed") {
        stylePrompt =
          "Use a more detailed elegant salon nail design while keeping the selected color as the main color.";
      }

      if (style === "chrome") {
        stylePrompt =
          "Use a chrome / mirror-finish nail polish effect: a highly reflective, metallic, glossy shine across every nail, like a mirror.";
      }

      if (style === "glitter") {
        stylePrompt =
          "Use a glitter nail polish effect: fine sparkling glitter particles evenly scattered across every nail, catching the light.";
      }

      if (style === "french") {
        stylePrompt =
          "Use a classic French manicure: a natural nude/pink base color on the main nail bed, with a clean white tip painted only at the very end (free edge) of each nail.";
      }

      editedImage = await openai.images.edit({
        model: "gpt-image-2",
        image: handFile,
        quality: "low",
        size: "1024x1024",
        prompt: `
Edit the fingernails in this hand photo.

Selected nail color:
${colorName}
Color hex:
${colorHex}

${stylePrompt}

IMPORTANT — apply this to EVERY SINGLE fingernail visible in the photo, with no
exceptions: thumb, index, middle, ring, and pinky must all receive the exact
same nail color and style, evenly and consistently. Do not skip, miss, leave
unfinished, or leave any nail in its original/natural state — every visible
nail must be fully and identically edited. Pay special attention to the thumb
nail and any nail that is partially turned or at an angle — they must be
edited just as completely as the nails facing the camera directly.

Keep each nail's original size, shape, and boundary exactly as in the photo —
only change its color/finish, do not resize, extend, or reshape any nail.

Keep the original:
- hand
- fingers
- skin tone
- hand position
- lighting
- background

Only modify the fingernails.

Make all nails realistic, clean, glossy and salon-quality.
Do not change the shape or appearance of the person's hand.
        `,
      });
    }

    const imageBase64 = editedImage.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("OpenAI did not return an image.");
    }

    const resultImage = `data:image/png;base64,${imageBase64}`;

    if (new TextEncoder().encode(resultImage).length > 4000000) {
      return Response.json({ error: "Ảnh kết quả quá lớn. Vui lòng thử lại với ảnh bàn tay đơn giản hơn." }, { status: 413 });
    }
    return Response.json({
      image: resultImage,
    });
  } catch (error) {
    console.error("TRY-ON API ERROR:", error);

    return Response.json(
      {
        error: "Không thể tạo ảnh thử nail.",
      },
      {
        status: 500,
      }
    );
  }
}