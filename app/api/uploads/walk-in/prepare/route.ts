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

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return "unknown";
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: "Service temporarily unavailable." },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Cung Postgres-backed rate limiter dung o try-on/route.ts (ham long ben
  // trong de dung chung 1 the hien supabaseAdmin qua closure, tranh loi
  // typing khi truyen SupabaseClient generic qua tham so ham).
  // Ghi chu: doc-roi-ghi khong nguyen tu (co the sai lech nhe duoi tai dong
  // thoi cao), va fail-open neu Supabase loi (coi nhu duoc phep). Day la
  // gioi han bao ve muc co ban, khong phai co che chong spam tuyet doi.
  async function checkRateLimit(
    key: string,
    maxRequests: number,
    windowMinutes: number
  ): Promise<boolean> {
    const windowMs = windowMinutes * 60 * 1000;

    const { data } = await supabaseAdmin
      .from("api_rate_limits")
      .select("count, window_start")
      .eq("key", key)
      .maybeSingle();

    const now = Date.now();

    if (!data || now - new Date(data.window_start).getTime() > windowMs) {
      await supabaseAdmin.from("api_rate_limits").upsert({
        key,
        count: 1,
        window_start: new Date().toISOString(),
      });

      return true;
    }

    if (data.count >= maxRequests) {
      return false;
    }

    await supabaseAdmin
      .from("api_rate_limits")
      .update({
        count: data.count + 1,
      })
      .eq("key", key);

    return true;
  }

  async function resolveTechProfileUserId(
    salonRef: string
  ): Promise<string | null> {
    if (UUID_PATTERN.test(salonRef)) {
      const { data } = await supabaseAdmin
        .from("tech_profiles")
        .select("user_id")
        .eq("user_id", salonRef)
        .maybeSingle();

      if (data?.user_id) {
        return data.user_id as string;
      }
    }

    const { data } = await supabaseAdmin
      .from("tech_profiles")
      .select("user_id")
      .eq("username", salonRef)
      .maybeSingle();

    return (data?.user_id as string | undefined) ?? null;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { salonRef, count } = body as { salonRef?: unknown; count?: unknown };

  if (typeof salonRef !== "string") {
    return Response.json({ error: "Missing or invalid salonRef." }, { status: 400 });
  }

  const trimmedSalonRef = salonRef.trim();

  if (
    trimmedSalonRef.length === 0 ||
    trimmedSalonRef.length > SALON_REF_MAX_LENGTH ||
    !SALON_REF_PATTERN.test(trimmedSalonRef)
  ) {
    return Response.json({ error: "Invalid salonRef." }, { status: 400 });
  }

  if (
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > MAX_COUNT
  ) {
    return Response.json({ error: "Invalid count." }, { status: 400 });
  }

  const ip = getClientIp(request);

  const ipAllowed = await checkRateLimit(
    `walkin-prepare:ip:${ip}`,
    PREPARE_IP_LIMIT,
    PREPARE_IP_WINDOW_MINUTES
  );

  if (!ipAllowed) {
    return Response.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const resolvedUserId = await resolveTechProfileUserId(trimmedSalonRef);

  if (!resolvedUserId) {
    return Response.json({ error: "Salon not found." }, { status: 404 });
  }

  const userAllowed = await checkRateLimit(
    `walkin-prepare:user:${resolvedUserId}`,
    PREPARE_USER_LIMIT,
    PREPARE_USER_WINDOW_MINUTES
  );

  if (!userAllowed) {
    return Response.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const batchId = crypto.randomUUID();

  if (count === 0) {
    return Response.json({ batchId, uploads: [] });
  }

  const uploads: { path: string; signedUrl: string; token: string }[] = [];

  for (let index = 0; index < count; index++) {
    const path = `walk-in/${resolvedUserId}/${batchId}/${index}-${crypto.randomUUID()}.jpg`;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return Response.json(
        { error: "Could not prepare upload." },
        { status: 500 }
      );
    }

    uploads.push({
      path: data.path,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  }

  return Response.json({ batchId, uploads });
}