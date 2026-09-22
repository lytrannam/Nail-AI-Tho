import { createClient } from "@supabase/supabase-js";

const BUCKET = "walk-in-designs";
const MAX_COUNT = 4;
const SALON_REF_MAX_LENGTH = 50;
const SALON_REF_PATTERN = /^[a-zA-Z0-9-]{1,50}$/;
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const PREPARE_IP_LIMIT = 10;
const PREPARE_IP_WINDOW_MINUTES = 60;
const PREPARE_USER_LIMIT = 30;
const PREPARE_USER_WINDOW_MINUTES = 60;

const SERVICE_UNAVAILABLE_BODY = { error: "Service temporarily unavailable." };

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return "unknown";
}

// Loi ha tang: Supabase/Postgres/Storage tra error, hoac mot buoc trong POST
// nem exception khong mong doi. Duoc bat mot lan duy nhat o cuoi POST va
// luon tra ve 503 co dinh. Khong bao gio duoc dung cho loi nghiep vu hop le
// (400/404/409/422/429), cac nhanh do van return truc tiep nhu cu.
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

// Danh sach dong ma loi Postgres/PostgREST duoc phep hien trong log. Ma loi
// khong nam trong danh sach nay se KHONG duoc ghi (bo han truong do), khong
// dung "other"/"redacted" de tranh ro ri thong tin bat ngo qua viec quan sat
// gia tri xuat hien. Danh sach nay chi phuc vu quan sat/debug, khong anh
// huong quyet dinh tra 503.
const ALLOWED_LOG_ERROR_CODES = new Set([
  "23505", // unique_violation
  "57014", // query_canceled
  "53300", // too_many_connections
  "55P03", // lock_not_available
  "08006", // connection_failure
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
]);

// Logger toi thieu, vinh vien: chi ghi ten route co dinh, ten buoc co dinh,
// httpStatus dang so, va errorCode CHI KHI khop dung allowlist o tren. Khong
// bao gio ghi message/details/hint/stack/URL/header/key/salonRef/IP/user_id/
// batchId/path. Loi khi logging khong duoc lam thay doi ket qua xu ly.
function logRouteError(step: string, httpStatus: number, rawCode?: string): void {
  try {
    const code =
      typeof rawCode === "string" && ALLOWED_LOG_ERROR_CODES.has(rawCode)
        ? rawCode
        : undefined;

    const suffix = code ? ` errorCode=${code}` : "";

    console.error(
      `[walkin-prepare] step=${step} httpStatus=${httpStatus}${suffix}`
    );
  } catch {
    // Logging khong bao gio duoc lam hong response.
  }
}

// Kiem tra cau hinh truoc khi goi mang: URL/key phai ton tai, URL phai phan
// tich duoc va la https, key/URL khong duoc chua ky tu dieu khien hoac
// khoang trang o dau/cuoi, va phai dung thu tao header apikey/Authorization
// trong bo nho (khong ghi gia tri). Muc dich: phat hien key/URL hong NGAY,
// thay vi de request treo ~7 giay trong postgrest-js retry roi moi loi.
function assertSupabaseConfigUsable(url: string, key: string): void {
  const hasControlChar = (value: string) => /[\x00-\x1F\x7F]/.test(value);
  const hasEdgeWhitespace = (value: string) => value !== value.trim();

  if (hasControlChar(key) || hasEdgeWhitespace(key)) {
    throw new InfraUnavailableError("configCheck");
  }

  if (hasControlChar(url) || hasEdgeWhitespace(url)) {
    throw new InfraUnavailableError("configCheck");
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new InfraUnavailableError("configCheck");
  }

  if (parsed.protocol !== "https:") {
    throw new InfraUnavailableError("configCheck");
  }

  try {
    const headers = new Headers();
    headers.set("apikey", key);
    headers.set("Authorization", `Bearer ${key}`);
  } catch {
    throw new InfraUnavailableError("configCheck");
  }
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    logRouteError("configCheck", 503);
    return Response.json(SERVICE_UNAVAILABLE_BODY, { status: 503 });
  }

  try {
    assertSupabaseConfigUsable(supabaseUrl, serviceRoleKey);
  } catch {
    logRouteError("configCheck", 503);
    return Response.json(SERVICE_UNAVAILABLE_BODY, { status: 503 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Rate limiter Postgres-backed dung chung voi finalize. Doc-roi-ghi khong
  // nguyen tu (co the sai lech nhe duoi tai dong thoi cao) - gioi han bao ve
  // muc co ban, khong phai co che chong spam tuyet doi. Loi Supabase o buoc
  // nao cung fail-closed: nem InfraUnavailableError thay vi coi nhu duoc
  // phep, vi truoc day fail-open lam gioi han mat tac dung khi Supabase loi.
  async function checkRateLimit(
    key: string,
    maxRequests: number,
    windowMinutes: number,
    step: string
  ): Promise<boolean> {
    const windowMs = windowMinutes * 60 * 1000;

    const { data, error: selectError } = await supabaseAdmin
      .from("api_rate_limits")
      .select("count, window_start")
      .eq("key", key)
      .maybeSingle();

    if (selectError) {
      throw new InfraUnavailableError(step, selectError.code);
    }

    const now = Date.now();

    if (
      !data ||
      now - new Date(data.window_start).getTime() > windowMs
    ) {
      const { error: upsertError } = await supabaseAdmin
        .from("api_rate_limits")
        .upsert({
          key,
          count: 1,
          window_start: new Date().toISOString(),
        });

      if (upsertError) {
        throw new InfraUnavailableError(step, upsertError.code);
      }

      return true;
    }

    if (data.count >= maxRequests) {
      return false;
    }

    const { error: updateError } = await supabaseAdmin
      .from("api_rate_limits")
      .update({
        count: data.count + 1,
      })
      .eq("key", key);

    if (updateError) {
      throw new InfraUnavailableError(step, updateError.code);
    }

    return true;
  }

  // Tra thu theo user_id (neu salonRef dang UUID) roi theo username. Chi
  // duoc tra ve null (dan toi 404 "khong tim thay tho") khi CA HAI truy van
  // deu THANH CONG ma khong co dong nao. Loi truy van o buoc nao cung nem
  // InfraUnavailableError (503) - khong duoc coi loi nhu "khong tim thay".
  async function resolveTechProfileUserId(
    salonRef: string
  ): Promise<string | null> {
    if (UUID_PATTERN.test(salonRef)) {
      const { data, error: userIdError } = await supabaseAdmin
        .from("tech_profiles")
        .select("user_id")
        .eq("user_id", salonRef)
        .maybeSingle();

      if (userIdError) {
        throw new InfraUnavailableError("resolveByUserId", userIdError.code);
      }

      if (data?.user_id) {
        return data.user_id as string;
      }
    }

    const { data, error: usernameError } = await supabaseAdmin
      .from("tech_profiles")
      .select("user_id")
      .eq("username", salonRef)
      .maybeSingle();

    if (usernameError) {
      throw new InfraUnavailableError("resolveByUsername", usernameError.code);
    }

    return (data?.user_id as string | undefined) ?? null;
  }

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { salonRef, count } = body as {
      salonRef?: unknown;
      count?: unknown;
    };

    if (typeof salonRef !== "string") {
      return Response.json(
        { error: "Missing or invalid salonRef." },
        { status: 400 }
      );
    }

    const trimmedSalonRef = salonRef.trim();

    if (
      trimmedSalonRef.length === 0 ||
      trimmedSalonRef.length > SALON_REF_MAX_LENGTH ||
      !SALON_REF_PATTERN.test(trimmedSalonRef)
    ) {
      return Response.json(
        { error: "Invalid salonRef." },
        { status: 400 }
      );
    }

    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > MAX_COUNT
    ) {
      return Response.json(
        { error: "Invalid count." },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);

    const ipAllowed = await checkRateLimit(
      `walkin-prepare:ip:${ip}`,
      PREPARE_IP_LIMIT,
      PREPARE_IP_WINDOW_MINUTES,
      "rateLimitIp"
    );

    if (!ipAllowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const resolvedUserId = await resolveTechProfileUserId(trimmedSalonRef);

    if (!resolvedUserId) {
      return Response.json(
        { error: "Salon not found." },
        { status: 404 }
      );
    }

    const userAllowed = await checkRateLimit(
      `walkin-prepare:user:${resolvedUserId}`,
      PREPARE_USER_LIMIT,
      PREPARE_USER_WINDOW_MINUTES,
      "rateLimitUser"
    );

    if (!userAllowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const batchId = crypto.randomUUID();

    if (count === 0) {
      return Response.json({
        batchId,
        uploads: [],
      });
    }

    const uploads: {
      path: string;
      signedUrl: string;
      token: string;
    }[] = [];

    for (let index = 0; index < count; index++) {
      const path = `walk-in/${resolvedUserId}/${batchId}/${index}-${crypto.randomUUID()}.jpg`;

      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data) {
        throw new InfraUnavailableError(
          "createSignedUploadUrl",
          error?.name
        );
      }

      uploads.push({
        path: data.path,
        signedUrl: data.signedUrl,
        token: data.token,
      });
    }

    return Response.json({
      batchId,
      uploads,
    });
  } catch (caught) {
    if (caught instanceof InfraUnavailableError) {
      logRouteError(caught.step, 503, caught.code);
    } else {
      logRouteError("unexpected", 503);
    }

    return Response.json(SERVICE_UNAVAILABLE_BODY, { status: 503 });
  }
}