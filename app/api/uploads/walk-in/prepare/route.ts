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

// TAM THOI - chan doan production, se go bo o commit tiep theo sau khi xac
// dinh nguyen nhan that. Khong doi logic/response o bat ky nhanh nao, chi
// doc them "error" da co san trong ket qua Supabase (truoc day bi bo qua)
// va ghi log da phan loai. Khong log salonRef, IP, username, user_id,
// batchId, token, signedUrl, path, hay bat ky gia tri tu request/env nao.
// Khong bao gio ghi nguyen van message/details/hint/cause - chi doc noi bo
// de phan loai thanh 1 trong so nhan co dinh.
type DiagnosticErrorInternal = {
  code?: string;
  status?: number;
  message?: string;
  details?: string;
  hint?: string;
  causeCode?: string;
  causeMessage?: string;
};

type DiagnosticErrorLabel =
  | "fetch_failed"
  | "connection_refused"
  | "dns_not_found"
  | "connection_timed_out"
  | "socket_closed"
  | "tls_certificate"
  | "aggregate_error"
  | "invalid_api_key"
  | "jwt_error"
  | "invalid_url"
  | "unknown";

type DiagnosticErrorSummary = {
  category: DiagnosticErrorLabel;
  code: string;
  status: string;
};

function extractDiagnosticError(error: unknown): DiagnosticErrorInternal | undefined {
  if (!error || typeof error !== "object") return undefined;

  const candidate = error as {
    code?: unknown;
    status?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    cause?: unknown;
  };

  const cause =
    candidate.cause && typeof candidate.cause === "object"
      ? (candidate.cause as { code?: unknown; message?: unknown })
      : undefined;

  return {
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    status: typeof candidate.status === "number" ? candidate.status : undefined,
    message: typeof candidate.message === "string" ? candidate.message : undefined,
    details: typeof candidate.details === "string" ? candidate.details : undefined,
    hint: typeof candidate.hint === "string" ? candidate.hint : undefined,
    causeCode: cause && typeof cause.code === "string" ? cause.code : undefined,
    causeMessage: cause && typeof cause.message === "string" ? cause.message : undefined,
  };
}

// Ghep cac truong noi bo (chi trong bo nho, khong log) roi so khop tu khoa
// de tra ve DUNG 1 nhan co dinh. Khong bao gio tra ve chuoi da ghep.
function classifyDiagnosticError(error: DiagnosticErrorInternal): DiagnosticErrorLabel {
  const combined = [
    error.code,
    error.message,
    error.details,
    error.hint,
    error.causeCode,
    error.causeMessage,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();

  if (combined.includes("enotfound") || combined.includes("getaddrinfo")) {
    return "dns_not_found";
  }
  if (combined.includes("econnrefused")) {
    return "connection_refused";
  }
  if (
    combined.includes("etimedout") ||
    combined.includes("timeout") ||
    combined.includes("timed out")
  ) {
    return "connection_timed_out";
  }
  if (
    combined.includes("socket hang up") ||
    combined.includes("socket closed") ||
    combined.includes("econnreset") ||
    combined.includes("connection reset") ||
    combined.includes("network socket disconnected")
  ) {
    return "socket_closed";
  }
  if (
    combined.includes("certificate") ||
    combined.includes("self signed") ||
    combined.includes("unable to verify") ||
    combined.includes("tls") ||
    combined.includes("ssl")
  ) {
    return "tls_certificate";
  }
  if (combined.includes("aggregateerror")) {
    return "aggregate_error";
  }
  if (combined.includes("invalid api key")) {
    return "invalid_api_key";
  }
  if (combined.includes("invalid jwt") || combined.includes("jwt expired")) {
    return "jwt_error";
  }
  if (combined.includes("invalid url")) {
    return "invalid_url";
  }
  if (combined.includes("fetch failed")) {
    return "fetch_failed";
  }

  return "unknown";
}

// Chuan hoa code truoc khi log: rong -> "empty" (phan biet voi thieu hoan
// toan), dung dinh dang ky tu an toan (chu/so/gach ngang/gach duoi, toi da
// 64 ky tu) -> giu nguyen, con lai -> "redacted" de khong lo chuoi la.
function sanitizeDiagnosticCode(code: string | undefined): string {
  if (code === undefined) return "unknown";
  if (code.length === 0) return "empty";

  return /^[a-zA-Z0-9_-]{1,64}$/.test(code) ? code : "redacted";
}

function summarizeDiagnosticError(
  error: DiagnosticErrorInternal
): DiagnosticErrorSummary {
  return {
    category: classifyDiagnosticError(error),
    code: sanitizeDiagnosticCode(error.code),
    status: error.status !== undefined ? String(error.status) : "unknown",
  };
}

function logDiagnosticStep(
  requestId: string,
  step: string,
  durationMs: number,
  error?: DiagnosticErrorInternal
): void {
  if (error) {
    const summary = summarizeDiagnosticError(error);
    console.error(
      `[walkin-prepare-diagnostic] id=${requestId} step=${step} durationMs=${durationMs} errorCategory=${summary.category} errorCode=${summary.code} errorStatus=${summary.status}`
    );
  } else {
    console.log(
      `[walkin-prepare-diagnostic] id=${requestId} step=${step} durationMs=${durationMs} status=ok`
    );
  }
}

// TAM THOI - quan sat loi mang THAT truoc khi postgrest-js lam phang
// cau truc "cause" thanh PostgrestError (co the chuyen 1 phan noi dung
// sang chuoi "details", nhung mat cau truc cause/errors[] co the duyet
// duoc). diagnosticFetch chi quan sat va PHAI throw lai dung loi ban
// dau, khong thay doi response/hanh vi. Duyet loi long nhau (cause,
// AggregateError.errors[]) voi gioi han do sau va so phan tu, chong
// vong lap bang WeakSet. Khong log URL/host/header/body/salonRef/IP/
// token/path.
const SAFE_RAW_ERROR_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNRESET",
  "ABORT_ERR",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

function collectDiagnosticStrings(
  error: unknown,
  depth: number,
  visited: WeakSet<object>,
  maxElements: number,
  acc: string[],
  nodesVisited: { count: number } = { count: 0 }
): void {
  const maxNodes = 8;

  if (depth > 3) return;
  if (acc.length >= maxElements) return;
  if (nodesVisited.count >= maxNodes) return;
  if (!error || typeof error !== "object") return;
  if (visited.has(error)) return;

  visited.add(error);
  nodesVisited.count += 1;

  const candidate = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    cause?: unknown;
    errors?: unknown;
  };

  if (typeof candidate.name === "string" && acc.length < maxElements) {
    acc.push(candidate.name);
  }

  if (typeof candidate.message === "string" && acc.length < maxElements) {
    acc.push(candidate.message);
  }

  if (typeof candidate.code === "string" && acc.length < maxElements) {
    acc.push(candidate.code);
  }

  if (Array.isArray(candidate.errors)) {
    for (const subError of candidate.errors.slice(0, maxNodes)) {
      if (acc.length >= maxElements) break;
      if (nodesVisited.count >= maxNodes) break;

      collectDiagnosticStrings(
        subError,
        depth + 1,
        visited,
        maxElements,
        acc,
        nodesVisited
      );
    }
  }

  if (
    candidate.cause !== undefined &&
    acc.length < maxElements &&
    nodesVisited.count < maxNodes
  ) {
    collectDiagnosticStrings(
      candidate.cause,
      depth + 1,
      visited,
      maxElements,
      acc,
      nodesVisited
    );
  }
}

// Dung lai chinh xac 11 nhan da duyet truoc do - khong them nhan moi, chi
// doi nguon du lieu tu "candidate.message/details/hint" (bi mat cau truc
// cause khi postgrest-js lam phang) sang "chuoi thu thap truc tiep tu cay
// loi goc, truoc khi bi lam phang".
function classifyRawFetchError(error: unknown): DiagnosticErrorLabel {
  const collected: string[] = [];
  collectDiagnosticStrings(error, 0, new WeakSet<object>(), 8, collected);
  const combined = collected.join(" ").toLowerCase();

  if (combined.includes("enotfound") || combined.includes("getaddrinfo")) {
    return "dns_not_found";
  }
  if (combined.includes("econnrefused")) {
    return "connection_refused";
  }
  if (
    combined.includes("etimedout") ||
    combined.includes("timeout") ||
    combined.includes("timed out")
  ) {
    return "connection_timed_out";
  }
  if (
    combined.includes("socket hang up") ||
    combined.includes("socket closed") ||
    combined.includes("econnreset") ||
    combined.includes("connection reset") ||
    combined.includes("network socket disconnected")
  ) {
    return "socket_closed";
  }
  if (
    combined.includes("certificate") ||
    combined.includes("self signed") ||
    combined.includes("unable to verify") ||
    combined.includes("tls") ||
    combined.includes("ssl")
  ) {
    return "tls_certificate";
  }
  if (combined.includes("aggregateerror")) {
    return "aggregate_error";
  }
  if (combined.includes("invalid api key")) {
    return "invalid_api_key";
  }
  if (combined.includes("invalid jwt") || combined.includes("jwt expired")) {
    return "jwt_error";
  }
  if (combined.includes("invalid url")) {
    return "invalid_url";
  }
  if (combined.includes("fetch failed")) {
    return "fetch_failed";
  }

  return "unknown";
}

// Tim code an toan trong cay loi (goc, cause, errors[]) voi gioi han do
// sau/so node/chong vong lap giong collectDiagnosticStrings. CHI tra ve
// code neu khop dung allowlist co dinh - khong bao gio tra nguyen van
// code tuy y tu loi that.
function findSaferRawErrorCode(
  error: unknown,
  depth: number,
  visited: WeakSet<object>,
  nodesVisited: { count: number }
): string | undefined {
  const maxNodes = 8;

  if (depth > 3) return undefined;
  if (nodesVisited.count >= maxNodes) return undefined;
  if (!error || typeof error !== "object") return undefined;
  if (visited.has(error)) return undefined;

  visited.add(error);
  nodesVisited.count += 1;

  const candidate = error as {
    code?: unknown;
    cause?: unknown;
    errors?: unknown;
  };

  if (
    typeof candidate.code === "string" &&
    SAFE_RAW_ERROR_CODES.has(candidate.code)
  ) {
    return candidate.code;
  }

  if (Array.isArray(candidate.errors)) {
    for (const subError of candidate.errors.slice(0, maxNodes)) {
      if (nodesVisited.count >= maxNodes) break;

      const found = findSaferRawErrorCode(
        subError,
        depth + 1,
        visited,
        nodesVisited
      );

      if (found !== undefined) {
        return found;
      }
    }
  }

  if (candidate.cause !== undefined && nodesVisited.count < maxNodes) {
    return findSaferRawErrorCode(
      candidate.cause,
      depth + 1,
      visited,
      nodesVisited
    );
  }

  return undefined;
}

function extractSafeRawErrorCode(error: unknown): string {
  return (
    findSaferRawErrorCode(
      error,
      0,
      new WeakSet<object>(),
      { count: 0 }
    ) ?? "unknown"
  );
}

// originalFetch duoc giu tham chieu TRUOC khi dinh nghia diagnosticFetch,
// nen than ham ben duoi khong the tu goi lai chinh no - khong de quy.
function createDiagnosticFetch(requestId: string): typeof fetch {
  const originalFetch = globalThis.fetch.bind(globalThis);

  return async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const start = Date.now();
    let response: Response;

    try {
      response = await originalFetch(input, init);
    } catch (error: unknown) {
      try {
        const category = classifyRawFetchError(error);
        const code = extractSafeRawErrorCode(error);

        console.error(
          `[walkin-prepare-diagnostic] id=${requestId} step=rawFetch durationMs=${Date.now() - start} outcome=network_error errorCategory=${category} errorCode=${code}`
        );
      } catch {
        // Diagnostic logging must never replace the original error.
      }

      throw error;
    }

    try {
      console.log(
        `[walkin-prepare-diagnostic] id=${requestId} step=rawFetch durationMs=${Date.now() - start} outcome=${response.ok ? "http_ok" : "http_error"} httpStatus=${response.status}`
      );
    } catch {
      // Diagnostic logging must never lose a valid Response.
    }

    return response;
  };
}

export async function POST(request: Request) {
  const diagnosticRequestId = crypto.randomUUID();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: "Service temporarily unavailable." },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    global: { fetch: createDiagnosticFetch(diagnosticRequestId) },
  });

  // Cung Postgres-backed rate limiter dung o try-on/route.ts (ham long ben
  // trong de dung chung 1 the hien supabaseAdmin qua closure, tranh loi
  // typing khi truyen SupabaseClient generic qua tham so ham).
  // Ghi chu: doc-roi-ghi khong nguyen tu (co the sai lech nhe duoi tai dong
  // thoi cao), va fail-open neu Supabase loi (coi nhu duoc phep). Day la
  // gioi han bao ve muc co ban, khong phai co che chong spam tuyet doi.
  async function checkRateLimit(
    key: string,
    maxRequests: number,
    windowMinutes: number,
    diagnosticLabel: string
  ): Promise<boolean> {
    const windowMs = windowMinutes * 60 * 1000;

    const selectStart = Date.now();
    const { data, error: selectError } = await supabaseAdmin
      .from("api_rate_limits")
      .select("count, window_start")
      .eq("key", key)
      .maybeSingle();

    logDiagnosticStep(
      diagnosticRequestId,
      `rateLimitSelect:${diagnosticLabel}`,
      Date.now() - selectStart,
      extractDiagnosticError(selectError)
    );

    const now = Date.now();

    if (
      !data ||
      now - new Date(data.window_start).getTime() > windowMs
    ) {
      const upsertStart = Date.now();

      const { error: upsertError } = await supabaseAdmin
        .from("api_rate_limits")
        .upsert({
          key,
          count: 1,
          window_start: new Date().toISOString(),
        });

      logDiagnosticStep(
        diagnosticRequestId,
        `rateLimitReset:${diagnosticLabel}`,
        Date.now() - upsertStart,
        extractDiagnosticError(upsertError)
      );

      return true;
    }

    if (data.count >= maxRequests) {
      return false;
    }

    const updateStart = Date.now();

    const { error: updateError } = await supabaseAdmin
      .from("api_rate_limits")
      .update({
        count: data.count + 1,
      })
      .eq("key", key);

    logDiagnosticStep(
      diagnosticRequestId,
      `rateLimitIncrement:${diagnosticLabel}`,
      Date.now() - updateStart,
      extractDiagnosticError(updateError)
    );

    return true;
  }

  async function resolveTechProfileUserId(
    salonRef: string
  ): Promise<string | null> {
    if (UUID_PATTERN.test(salonRef)) {
      const userIdStepStart = Date.now();

      const { data, error: userIdError } = await supabaseAdmin
        .from("tech_profiles")
        .select("user_id")
        .eq("user_id", salonRef)
        .maybeSingle();

      const userIdOutcome = userIdError
        ? "error"
        : data?.user_id
          ? "found"
          : "not_found";

      logDiagnosticStep(
        diagnosticRequestId,
        `resolveByUserId:${userIdOutcome}`,
        Date.now() - userIdStepStart,
        extractDiagnosticError(userIdError)
      );

      if (data?.user_id) {
        return data.user_id as string;
      }
    }

    const usernameStepStart = Date.now();

    const { data, error: usernameError } = await supabaseAdmin
      .from("tech_profiles")
      .select("user_id")
      .eq("username", salonRef)
      .maybeSingle();

    const usernameOutcome = usernameError
      ? "error"
      : data?.user_id
        ? "found"
        : "not_found";

    logDiagnosticStep(
      diagnosticRequestId,
      `resolveByUsername:${usernameOutcome}`,
      Date.now() - usernameStepStart,
      extractDiagnosticError(usernameError)
    );

    return (data?.user_id as string | undefined) ?? null;
  }

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
    "ip"
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
    "user"
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

    const uploadStepStart = Date.now();

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    logDiagnosticStep(
      diagnosticRequestId,
      `createSignedUploadUrl:${index}`,
      Date.now() - uploadStepStart,
      extractDiagnosticError(error)
    );

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

  return Response.json({
    batchId,
    uploads,
  });
}