import { createClient } from "@supabase/supabase-js";

const BUCKET = "walk-in-designs";
const ALLOWED_REUSED_STORAGE_BUCKETS = ["nail-designs"];

const SALON_REF_MAX_LENGTH = 50;
const SALON_REF_PATTERN = /^[a-zA-Z0-9-]{1,50}$/;
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const UPLOADED_FILENAME_PATTERN =
  /^[0-9]+-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.jpg$/;
const PHONE_PATTERN = /^[0-9+\-\s()]{1,20}$/;

const NAME_MAX_LENGTH = 100;
const PHONE_MAX_LENGTH = 20;
const MAX_IMAGES = 4;
const MIN_FILE_BYTES = 1;
const MAX_FILE_BYTES = 1_500_000;

const FINALIZE_IP_LIMIT = 10;
const FINALIZE_IP_WINDOW_MINUTES = 60;
const FINALIZE_USER_LIMIT = 20;
const FINALIZE_USER_WINDOW_MINUTES = 60;
const FINALIZE_BATCH_LIMIT = 5;
const FINALIZE_BATCH_WINDOW_MINUTES = 60;

const SERVICE_UNAVAILABLE_BODY = { error: "Service temporarily unavailable." };

type UploadedImage = { kind: "uploaded"; path: string };
type ReusedImage = { kind: "reused"; url: string };
type FinalizeImage = UploadedImage | ReusedImage;
type ExistingCustomer = { id: number; user_id: string };

// Loi ha tang: Supabase/Postgres/Storage tra error, hoac mot buoc nem
// exception khong mong doi. Duoc bat mot lan duy nhat o cuoi POST va luon
// tra ve 503 co dinh. KHONG duoc dung cho loi noi dung anh, loi validate
// dau vao, hay xung dot session_token hop le (400/404/409/422/429) - cac
// nhanh do van return truc tiep nhu cu.
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
// ngoai danh sach nay se KHONG duoc ghi (bo han truong do). Danh sach nay
// chi phuc vu quan sat/debug, khong anh huong quyet dinh tra 503.
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
// batchId/path/ten khach/so dien thoai. Loi khi logging khong duoc lam thay
// doi ket qua xu ly.
function logRouteError(step: string, httpStatus: number, rawCode?: string): void {
  try {
    const code =
      typeof rawCode === "string" && ALLOWED_LOG_ERROR_CODES.has(rawCode)
        ? rawCode
        : undefined;

    const suffix = code ? ` errorCode=${code}` : "";

    console.error(
      `[walkin-finalize] step=${step} httpStatus=${httpStatus}${suffix}`
    );
  } catch {
    // Logging khong bao gio duoc lam hong response.
  }
}

// Kiem tra cau hinh truoc khi goi mang: URL/key phai ton tai, URL phai phan
// tich duoc va la https, key/URL khong duoc chua ky tu dieu khien hoac
// khoang trang o dau/cuoi, va phai dung thu tao header apikey/Authorization
// trong bo nho (khong ghi gia tri). Phat hien key/URL hong NGAY thay vi de
// request treo trong postgrest-js retry roi moi loi.
function assertSupabaseConfigUsable(url: string, key: string): void {
  const hasControlChar = (value: string) => /[\x00-\x1F\x7F]/.test(value);
  const hasEdgeWhitespace = (value: string) => value !== value.trim();

  if (hasControlChar(key) || hasEdgeWhitespace(key)) {
    throw new InfraUnavailableError("configCheck");
  }

  if (hasControlChar(url) || hasEdgeWhitespace(url)) {
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

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return "unknown";
}

function isValidUploadedPath(
  path: unknown,
  resolvedUserId: string,
  batchId: string
): path is string {
  if (typeof path !== "string") return false;
  if (path.includes("..") || path.includes("\\")) return false;

  const segments = path.split("/");

  if (segments.length !== 4) return false;
  if (segments.some((segment) => segment.length === 0)) return false;

  const [prefix, userSegment, batchSegment, filename] = segments;

  if (prefix !== "walk-in") return false;
  if (userSegment !== resolvedUserId) return false;
  if (batchSegment !== batchId) return false;
  if (!UPLOADED_FILENAME_PATTERN.test(filename)) return false;

  return true;
}

function hasAllowedReusedStructure(
  rawUrl: unknown,
  expectedHost: string
): rawUrl is string {
  if (typeof rawUrl !== "string") return false;

  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.hostname !== expectedHost) return false;

  const match = parsed.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\//);

  if (!match) return false;
  if (!ALLOWED_REUSED_STORAGE_BUCKETS.includes(match[1])) return false;

  return true;
}

function isValidCustomerId(id: unknown): id is number {
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    logRouteError("configCheck", 503);
    return Response.json(SERVICE_UNAVAILABLE_BODY, { status: 503 });
  }

  let expectedHost: string;

  try {
    expectedHost = new URL(supabaseUrl).hostname;
  } catch {
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

  // Rate limiter Postgres-backed dung chung voi prepare. Loi Supabase o buoc
  // nao cung fail-closed: nem InfraUnavailableError thay vi coi nhu duoc
  // phep (fail-open cu lam gioi han mat tac dung khi Supabase loi).
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

    if (!data || now - new Date(data.window_start).getTime() > windowMs) {
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

  // Chi duoc tra ve null (dan toi 404 "khong tim thay tho") khi CA HAI truy
  // van deu THANH CONG ma khong co dong nao. Loi truy van o buoc nao cung
  // nem InfraUnavailableError (503).
  async function resolveTechProfileUserId(salonRef: string): Promise<string | null> {
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

  // Chi duoc tra ve false (dan toi 422 "anh khong hop le") khi truy van
  // THANH CONG ma khong tim thay dong so huu khop. Loi truy van nem
  // InfraUnavailableError (503) - khong duoc coi loi nhu "khong so huu".
  async function isOwnedPortfolioImage(
    url: string,
    resolvedUserId: string
  ): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from("portfolio")
      .select("id")
      .eq("image_url", url)
      .eq("user_id", resolvedUserId)
      .maybeSingle();

    if (error) {
      throw new InfraUnavailableError("portfolioOwnership", error.code);
    }

    return data !== null;
  }

  // Tra ban ghi hien co theo batchId. Tra ve:
  //  - { found: true, record } neu tim thay va query thanh cong
  //  - { found: false, record: null } neu query thanh cong nhung khong co dong nao
  //  - { found: false, record: null, queryFailed: true } neu chinh cau query loi
  // Phan biet ro "khong tim thay" voi "query loi" de moi noi goi ham nay deu
  // co the fail-closed dung cach, thay vi coi loi tam thoi nhu "khong tim thay"
  // roi tiep tuc insert.
  async function findExistingCustomerByBatch(batchId: string): Promise<{
    found: boolean;
    record: ExistingCustomer | null;
    queryFailed?: boolean;
    errorCode?: string;
  }> {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("id, user_id")
      .eq("session_token", batchId)
      .maybeSingle();

    if (error) {
      return { found: false, record: null, queryFailed: true, errorCode: error.code };
    }

    if (!data) {
      return { found: false, record: null };
    }

    return { found: true, record: data as ExistingCustomer };
  }

  async function cleanupUploadedForBatch(
    images: FinalizeImage[],
    resolvedUserId: string,
    batchId: string
  ): Promise<void> {
    const pathsToRemove = images
      .filter((image): image is UploadedImage => image.kind === "uploaded")
      .map((image) => image.path)
      .filter((path) => isValidUploadedPath(path, resolvedUserId, batchId));

    if (pathsToRemove.length === 0) return;

    try {
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove(pathsToRemove);

      if (error) {
        logRouteError("cleanupUploadedForBatch", 200);
      }
    } catch {
      logRouteError("cleanupUploadedForBatch", 200);
    }
  }

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const {
      salonRef,
      name,
      phone,
      batchId,
      images: rawImages,
      selectedIndex,
    } = body as {
      salonRef?: unknown;
      name?: unknown;
      phone?: unknown;
      batchId?: unknown;
      images?: unknown;
      selectedIndex?: unknown;
    };

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

    if (typeof name !== "string") {
      return Response.json({ error: "Missing or invalid name." }, { status: 400 });
    }

    const trimmedName = name.trim();

    if (trimmedName.length === 0 || trimmedName.length > NAME_MAX_LENGTH) {
      return Response.json({ error: "Invalid name." }, { status: 400 });
    }

    let trimmedPhone: string | null = null;

    if (phone !== undefined && phone !== null && phone !== "") {
      if (typeof phone !== "string") {
        return Response.json({ error: "Invalid phone." }, { status: 400 });
      }

      const candidate = phone.trim();

      if (candidate.length > PHONE_MAX_LENGTH || !PHONE_PATTERN.test(candidate)) {
        return Response.json({ error: "Invalid phone." }, { status: 400 });
      }

      trimmedPhone = candidate;
    }

    if (typeof batchId !== "string" || !UUID_PATTERN.test(batchId)) {
      return Response.json({ error: "Invalid batchId." }, { status: 400 });
    }

    if (!Array.isArray(rawImages) || rawImages.length === 0 || rawImages.length > MAX_IMAGES) {
      return Response.json({ error: "Invalid images." }, { status: 400 });
    }

    const images: FinalizeImage[] = [];

    for (const item of rawImages) {
      if (typeof item !== "object" || item === null) {
        return Response.json({ error: "Invalid images." }, { status: 400 });
      }

      const candidate = item as { kind?: unknown; path?: unknown; url?: unknown };

      if (candidate.kind === "uploaded" && typeof candidate.path === "string") {
        images.push({ kind: "uploaded", path: candidate.path });
      } else if (candidate.kind === "reused" && typeof candidate.url === "string") {
        images.push({ kind: "reused", url: candidate.url });
      } else {
        return Response.json({ error: "Invalid images." }, { status: 400 });
      }
    }

    if (
      typeof selectedIndex !== "number" ||
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= images.length
    ) {
      return Response.json({ error: "Invalid selectedIndex." }, { status: 400 });
    }

    const ip = getClientIp(request);

    const ipAllowed = await checkRateLimit(
      `walkin-finalize:ip:${ip}`,
      FINALIZE_IP_LIMIT,
      FINALIZE_IP_WINDOW_MINUTES,
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
      return Response.json({ error: "Salon not found." }, { status: 404 });
    }

    const userAllowed = await checkRateLimit(
      `walkin-finalize:user:${resolvedUserId}`,
      FINALIZE_USER_LIMIT,
      FINALIZE_USER_WINDOW_MINUTES,
      "rateLimitUser"
    );

    if (!userAllowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const batchAllowed = await checkRateLimit(
      `walkin-finalize:batch:${batchId}`,
      FINALIZE_BATCH_LIMIT,
      FINALIZE_BATCH_WINDOW_MINUTES,
      "rateLimitBatch"
    );

    if (!batchAllowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const earlyExisting = await findExistingCustomerByBatch(batchId);

    if (earlyExisting.queryFailed) {
      throw new InfraUnavailableError("findExistingCustomerByBatch", earlyExisting.errorCode);
    }

    if (earlyExisting.found && earlyExisting.record) {
      if (earlyExisting.record.user_id === resolvedUserId) {
        if (!isValidCustomerId(earlyExisting.record.id)) {
          throw new InfraUnavailableError("findExistingCustomerByBatch");
        }

        return Response.json({ success: true, customerId: earlyExisting.record.id });
      }

      return Response.json({ error: "Request could not be completed." }, { status: 409 });
    }

    const allImages: string[] = [];

    for (const image of images) {
      if (image.kind === "uploaded") {
        if (!isValidUploadedPath(image.path, resolvedUserId, batchId)) {
          await cleanupUploadedForBatch(images, resolvedUserId, batchId);
          return Response.json({ error: "Invalid image reference." }, { status: 422 });
        }

        const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
          .from(BUCKET)
          .download(image.path);

        // Storage khong tra ma loi may doc duoc tin cay de tach "object
        // khong ton tai" (khach chua thuc su upload) voi loi ha tang that.
        // Giu nguyen 422 nhu ban goc cho nhanh nay - chua co bang chung de
        // doi sang 503 ma khong lam sai loi that su la "anh khong hop le".
        if (downloadError || !fileBlob) {
          await cleanupUploadedForBatch(images, resolvedUserId, batchId);
          return Response.json({ error: "Image could not be verified." }, { status: 422 });
        }

        const arrayBuffer = await fileBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length < MIN_FILE_BYTES || buffer.length > MAX_FILE_BYTES) {
          await cleanupUploadedForBatch(images, resolvedUserId, batchId);
          return Response.json({ error: "Image could not be verified." }, { status: 422 });
        }

        const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

        if (!isJpeg) {
          await cleanupUploadedForBatch(images, resolvedUserId, batchId);
          return Response.json({ error: "Image could not be verified." }, { status: 422 });
        }

        if (fileBlob.type && fileBlob.type !== "image/jpeg") {
          await cleanupUploadedForBatch(images, resolvedUserId, batchId);
          return Response.json({ error: "Image could not be verified." }, { status: 422 });
        }

        const { data: publicUrlData } = supabaseAdmin.storage
          .from(BUCKET)
          .getPublicUrl(image.path);

        allImages.push(publicUrlData.publicUrl);
      } else {
        if (!hasAllowedReusedStructure(image.url, expectedHost)) {
          await cleanupUploadedForBatch(images, resolvedUserId, batchId);
          return Response.json({ error: "Invalid image reference." }, { status: 422 });
        }

        const isOwned = await isOwnedPortfolioImage(image.url, resolvedUserId);

        if (!isOwned) {
          await cleanupUploadedForBatch(images, resolvedUserId, batchId);
          return Response.json({ error: "Invalid image reference." }, { status: 422 });
        }

        allImages.push(image.url);
      }
    }

    const selectedDesignImage = allImages[selectedIndex];

    const { data: insertedRow, error: insertError } = await supabaseAdmin
      .from("customers")
      .insert({
        user_id: resolvedUserId,
        name: trimmedName,
        phone: trimmedPhone,
        selected_design_image: selectedDesignImage,
        all_design_images: allImages,
        session_token: batchId,
      })
      .select("id")
      .single();

    if (insertError) {
      const isSessionTokenConflict =
        insertError.code === "23505" &&
        typeof insertError.message === "string" &&
        insertError.message.includes("customers_session_token_key");

      if (isSessionTokenConflict) {
        // 23505 nghia la co the 1 request song song da insert thanh cong
        // ban ghi nay va dang tham chieu chinh cac Storage object cua batch
        // nay. TUYET DOI KHONG cleanup trong bat ky nhanh nao duoi day, ke
        // ca khi khong tim thay ban ghi hoac query lai gap loi.
        const retry = await findExistingCustomerByBatch(batchId);

        if (retry.queryFailed) {
          logRouteError("findExistingCustomerByBatch", 503, retry.errorCode);
          return Response.json(SERVICE_UNAVAILABLE_BODY, { status: 503 });
        }

        if (retry.found && retry.record && retry.record.user_id === resolvedUserId) {
          if (!isValidCustomerId(retry.record.id)) {
            logRouteError("findExistingCustomerByBatch", 503);
            return Response.json(SERVICE_UNAVAILABLE_BODY, { status: 503 });
          }

          return Response.json({ success: true, customerId: retry.record.id });
        }

        return Response.json({ error: "Request could not be completed." }, { status: 409 });
      }

      // Loi that, khong phai 23505: path da duoc xac minh thuoc dung
      // resolvedUserId/batchId truoc do, an toan de cleanup.
      await cleanupUploadedForBatch(images, resolvedUserId, batchId);
      throw new InfraUnavailableError("insertCustomer", insertError.code);
    }

    if (!isValidCustomerId(insertedRow?.id)) {
      // Insert co the da thanh cong that (row ton tai) nhung khong lay duoc
      // id hop le o day - KHONG cleanup vi ban ghi co the dang ton tai va
      // tham chieu dung cac object nay. Lan goi lai cung batchId se di vao
      // nhanh replay o dau ham va lay lai duoc customerId.
      throw new InfraUnavailableError("insertCustomer");
    }

    return Response.json({ success: true, customerId: insertedRow.id });
  } catch (caught) {
    if (caught instanceof InfraUnavailableError) {
      logRouteError(caught.step, 503, caught.code);
    } else {
      logRouteError("unexpected", 503);
    }

    return Response.json(SERVICE_UNAVAILABLE_BODY, { status: 503 });
  }
}