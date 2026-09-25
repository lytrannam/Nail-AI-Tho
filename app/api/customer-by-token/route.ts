import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    throw new Error("rate_limit_infra_error");
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
      throw new Error("rate_limit_infra_error");
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
    throw new Error("rate_limit_infra_error");
  }

  return true;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);

    // Gioi han 30 lan tra cuu/IP/gio - du cho 1 khach that mo link nhieu lan,
    // nhung chan duoc viec do mo hang loat token de "do mo" trung.
    const allowed = await checkRateLimit(`customer-token:${ip}`, 30, 60);

    if (!allowed) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu, vui lòng thử lại sau." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .select("id, tryon_used, visit_count, total_spent, user_id")
      .eq("session_token", token)
      .single();

    if (error || !customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const { data: loyaltySettings, error: loyaltyError } = await supabaseAdmin
      .from("loyalty_settings")
      .select("enabled, visits_required, amount_required, discount_percent")
      .eq("user_id", customer.user_id)
      .maybeSingle();

    if (loyaltyError && loyaltyError.code !== "42P01") {
      console.error("[customer-by-token] Cannot load loyalty settings.");
    }

    return NextResponse.json({
      customer,
      loyaltySettings: loyaltyError ? null : loyaltySettings,
    });
  } catch (error) {
    console.error("customer-by-token error:", error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
