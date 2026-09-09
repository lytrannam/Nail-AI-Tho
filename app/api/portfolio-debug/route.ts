import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Route chỉ để kiểm tra, KHÔNG gọi OpenAI, KHÔNG tốn tiền AI.
// Dùng: localhost:3000/api/portfolio-debug?customerId=5
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");

  if (!customerId) {
    return Response.json({ error: "Thiếu customerId trên URL" }, { status: 400 });
  }

  const { data: customerRow, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("user_id")
    .eq("id", customerId)
    .single();

  const salonUserId = customerRow?.user_id;

  const { data: allPortfolioForSalon, error: portfolioError } = salonUserId
    ? await supabaseAdmin
        .from("portfolio")
        .select("id, user_id, skin_tone_group, undertone, style")
        .eq("user_id", salonUserId)
    : { data: null, error: null };

  return Response.json({
    customerId,
    customerError,
    customerRow,
    salonUserId,
    portfolioError,
    allPortfolioForSalon,
  });
}