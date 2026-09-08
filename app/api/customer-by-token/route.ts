import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
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

    const { data: loyaltySettings } = await supabaseAdmin
      .from("loyalty_settings")
      .select("enabled, visits_required, amount_required, discount_percent")
      .eq("user_id", customer.user_id)
      .maybeSingle();

    return NextResponse.json({
      customer,
      loyaltySettings,
    });
  } catch (error) {
    console.error("customer-by-token error:", error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}