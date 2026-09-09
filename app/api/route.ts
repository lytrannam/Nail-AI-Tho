import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { image, customerId } = await request.json();

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

    // Luôn hiển thị đúng 4 ảnh: tối đa 2 ảnh thật (portfolio của thợ) + phần còn
    // lại là ảnh AI tạo mới, để luôn có tổng cộng 4 ảnh cho khách chọn.
    const REAL_SLOTS = 2;
    const TOTAL_SLOTS = 4;

    let realMatches: { image_url: string; style: string | null }[] = [];

    if (customerId) {
      const { data: customerRow } = await supabaseAdmin
        .from("customers")
        .select("user_id")
        .eq("id", customerId)
        .single();

      const salonUserId = customerRow?.user_id;

      if (salonUserId) {
        // Vòng 1: khớp cả tông da và undertone
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

        // Vòng 2: nếu chưa đủ, nới lỏng chỉ theo tông da
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

        // Vòng 3: nếu vẫn chưa có gì, lấy ảnh portfolio mới nhất bất kể tag
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

    // Số ảnh AI cần tạo = phần còn thiếu để đủ tổng 4 ảnh
    const aiSlotsNeeded = TOTAL_SLOTS - realMatches.length;

    const aiImages = await Promise.all(
      Array.from({ length: aiSlotsNeeded }).map(async (_, i) => {
        const designNumber = i + 1;
        const generated = await openai.images.generate({
          model: "gpt-image-2",
          prompt: `
Create ONE professional nail art reference image.

Use ONLY nail design concept number ${designNumber} from this analysis:

${resultText}

Requirements:
- Show only ONE nail design concept.
- Match the colors, nail shape, and patterns from concept ${designNumber}.
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