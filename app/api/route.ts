 
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { image } = await request.json();

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
- Đề xuất đúng 3 mẫu design.
- Với mỗi mẫu, ghi:
  • Tên design
  • Màu chính
  • Họa tiết
  • Kiểu dáng móng
  • Vì sao hợp với khách

Viết rõ ràng, thân thiện, không dài dòng.
Không dùng từ ngữ quá kỹ thuật.
Ưu tiên nội dung để khách đọc nhanh và dễ quyết định.`
            },
            {
              type: "input_image",
              image_url: image,
              detail:"auto"
            },
          ],
        },
      ],
    });
const designImages = await Promise.all(
  [1, 2, 3].map(async (designNumber) => {
    const generated = await openai.images.generate({
      model: "gpt-image-2",
      prompt: `
Create ONE professional nail art reference image.

Use ONLY nail design concept number ${designNumber} from this analysis:

${response.output_text}

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

    return base64
      ? `data:image/png;base64,${base64}`
      : null;
  })
);

return Response.json({
  result: response.output_text,
  designImages,
});

 
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Không thể phân tích ảnh." },
      { status: 500 }
    );
  }
}
