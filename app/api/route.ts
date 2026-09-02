 
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
const designImage = await openai.images.generate({
  model: "gpt-image-2",
  prompt: `
Create one professional nail art reference image based exactly on this analysis:

${response.output_text}

Requirements:
- Show exactly 3 different nail design concepts in one image.
- Each concept must match the colors, nail shape, and patterns described in the analysis.
- Realistic salon-quality nails.
- Clean and beautiful hand poses.
- Clear separation between the 3 concepts.
- No text, no labels, no logos.
- Focus on the nails and nail art.
- Keep the skin tone natural and consistent.
`,
  size: "1024x1024",
  quality:"low",
});

const imageBase64 = designImage.data?.[0]?.b64_json;
return Response.json({
  result: response.output_text,
  designImage: imageBase64
    ? `data:image/png;base64,${imageBase64}`
    : null,
});
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Không thể phân tích ảnh." },
      { status: 500 }
    );
  }
}
