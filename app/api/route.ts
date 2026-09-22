import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Giới hạn số lần gọi AI theo địa chỉ mạng (IP), để tránh bị lạm dụng tốn tiền.
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
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Tra user_id cua tho tu salonRef (co the la username hoac chinh user_id),
// khong con dua vao customerId (de/doan duoc) de suy ra tho. Loi Supabase o
// day chi khien phan "anh that trong portfolio" bi bo qua, khong lam hong
// toan bo tinh nang phan tich AI.
async function resolveTechProfileUserId(salonRef: string): Promise<string | null> {
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

  if (error) return null;

  return (data?.user_id as string | undefined) ?? null;
}
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // Tối đa 20 lần phân tích ảnh mỗi IP mỗi 24 giờ.
    const allowed = await checkRateLimit(`analyze:${ip}`, 20, 1440);

    if (!allowed) {
      return Response.json(
        {
          error:
            "Đã đạt giới hạn sử dụng hôm nay. Vui lòng thử lại vào ngày mai hoặc liên hệ tiệm để được hỗ trợ.",
        },
        { status: 429 }
      );
    }

    const { image, salonRef } = await request.json();

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Hãy phân tích bàn tay trong ảnh và trả lời ngắn gọn, dễ hiểu cho khách tiệm nail.

1. Tông da:
- Mô tả tông da và undertone trong 1-2 câu.

2. Màu sơn phù hợp:
- Đề xuất từ 3 đến 5 màu.
- Với mỗi màu, ghi:
  • Tên màu
  • Vì sao màu này hợp với da khách
- Mỗi màu chỉ giải thích 1 câu ngắn.

3. Nail design:
- Đề xuất đúng 4 mẫu design.
- QUAN TRỌNG: 4 mẫu này BẮT BUỘC phải khác biệt rõ rệt với nhau, không được
  có 2 mẫu nào giống hoặc gần giống nhau. Hãy làm theo đúng 4 mức độ sau,
  mỗi mẫu 1 mức, không lặp lại:
  • Mẫu 1: Đơn giản, trơn màu hoặc rất ít họa tiết.
  • Mẫu 2: Vừa phải, có 1 chi tiết nhỏ (ví dụ 1 hoa văn đơn giản hoặc ombre nhẹ).
  • Mẫu 3: Cầu kỳ hơn, có họa tiết rõ rệt (hoa, đường nét, 3D nhẹ...).
  • Mẫu 4: Đặc biệt/nổi bật (chrome, glitter, hoặc phối nhiều màu).
- Với mỗi mẫu, ghi:
  • Tên design
  • Màu chính
  • Họa tiết
  • Kiểu dáng móng
  • Vì sao hợp với khách

Viết rõ ràng, thân thiện, không dài dòng.
Không dùng từ ngữ quá kỹ thuật.
Ưu tiên nội dung để khách đọc nhanh và dễ quyết định.

Cuối cùng, thêm đúng 1 dòng cuối theo format chính xác này (không markdown, không giải thích thêm):
TAGS: skin_tone_group=<số 1-6>; undertone=<warm|cool|neutral>`,
            },
            {
              type: "input_image",
              image_url: image,
              detail: "auto",
            },
          ],
        },
      ],
    });

    const rawText = response.output_text;

    const tagsMatch = rawText.match(
      /TAGS:\s*skin_tone_group=(\d+);\s*undertone=(\w+)/i
    );
    const resultText = rawText.replace(/TAGS:[^\n]*/i, "").trim();

    const skinToneGroup = tagsMatch ? Number(tagsMatch[1]) : null;
    const undertone = tagsMatch ? tagsMatch[2].toLowerCase() : null;

    const REAL_SLOTS = 2;
    const TOTAL_SLOTS = 4;

    let realMatches: { image_url: string; style: string | null }[] = [];

    if (typeof salonRef === "string" && salonRef.trim().length > 0) {
      const salonUserId = await resolveTechProfileUserId(salonRef.trim());

      if (salonUserId) {
        if (skinToneGroup && undertone) {
          const { data } = await supabaseAdmin
            .from("portfolio")
            .select("image_url, style")
            .eq("user_id", salonUserId)
            .gte("skin_tone_group", skinToneGroup - 1)
            .lte("skin_tone_group", skinToneGroup + 1)
            .eq("undertone", undertone)
            .order("created_at", { ascending: false })
            .limit(REAL_SLOTS);

          if (data) realMatches = data;
        }

        if (realMatches.length < REAL_SLOTS && skinToneGroup) {
          const { data } = await supabaseAdmin
            .from("portfolio")
            .select("image_url, style")
            .eq("user_id", salonUserId)
            .gte("skin_tone_group", skinToneGroup - 1)
            .lte("skin_tone_group", skinToneGroup + 1)
            .order("created_at", { ascending: false })
            .limit(REAL_SLOTS - realMatches.length);

          if (data) {
            const existingUrls = new Set(realMatches.map((m) => m.image_url));
            realMatches = [
              ...realMatches,
              ...data.filter((d) => !existingUrls.has(d.image_url)),
            ];
          }
        }

        if (realMatches.length === 0) {
          const { data } = await supabaseAdmin
            .from("portfolio")
            .select("image_url, style")
            .eq("user_id", salonUserId)
            .order("created_at", { ascending: false })
            .limit(REAL_SLOTS);

          if (data) realMatches = data;
        }
      }
    }

    const aiSlotsNeeded = TOTAL_SLOTS - realMatches.length;

    // Bat dau danh so tu ngay sau so luong anh THAT da co, de moi anh AI van
    // ung voi dung 1 "muc do" rieng biet trong 4 muc do da yeu cau AI phan tich
    // (don gian / vua / cau ky / dac biet), tranh trung muc do voi nhau.
    const startDesignNumber = realMatches.length + 1;

    const aiImages = await Promise.all(
      Array.from({ length: aiSlotsNeeded }).map(async (_, i) => {
        const designNumber = startDesignNumber + i;
        const generated = await openai.images.generate({
          model: "gpt-image-2",
          prompt: `
Create ONE professional nail art reference image.

Use ONLY nail design concept number ${designNumber} from this analysis:

${resultText}

Requirements:
- Show only ONE nail design concept: concept number ${designNumber} specifically.
- Match the colors, nail shape, and patterns described for concept ${designNumber}.
- This design MUST look clearly and visibly different in complexity and style
  from any other concept number in the analysis above. If concept ${designNumber}
  is described as simple/plain, keep it genuinely plain with no pattern. If it
  is described as detailed or special (glitter, chrome, floral, etc.), make
  that feature clearly visible and prominent, not subtle.
- Realistic salon-quality nails.
- Clean and beautiful hand pose.
- No text, labels, or logos.
- Focus on the nails and nail art.
- Keep the skin tone natural.
`,
          size: "1024x1024",
          quality: "low",
        });

        const base64 = generated.data?.[0]?.b64_json;
        return base64 ? `data:image/png;base64,${base64}` : null;
      })
    );

    const designImages: string[] = [
      ...realMatches.map((m) => m.image_url),
      ...aiImages.filter((img): img is string => img !== null),
    ];

    const designSources: ("real" | "ai")[] = [
      ...realMatches.map(() => "real" as const),
      ...aiImages.filter((img) => img !== null).map(() => "ai" as const),
    ];

    return Response.json({
      result: resultText,
      designImages,
      designSources,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Không thể phân tích ảnh." },
      { status: 500 }
    );
  }
}