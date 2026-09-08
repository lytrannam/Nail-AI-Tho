import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return Response.json({ error: "Thiếu ảnh." }, { status: 400 });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Nhìn ảnh mẫu nail thật này và trả lời DUY NHẤT bằng JSON, không thêm chữ nào khác, đúng format:
{"skin_tone_group": <số 1-6>, "undertone": "<warm|cool|neutral>", "shape": "<hình dáng móng>", "style": "<phong cách, vd: French, ombre, chrome>", "color": "<màu chính>", "material": "<chất liệu/kỹ thuật, vd: gel, bột, 3D>", "difficulty": "<easy|medium|hard>"}`,
            },
            { type: "input_image", image_url: imageUrl, detail: "auto" },
          ],
        },
      ],
    });

    let tags: Record<string, unknown> = {};
    try {
      tags = JSON.parse(response.output_text);
    } catch {
      tags = {};
    }

    return Response.json({ tags });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Không thể gắn tag cho ảnh." },
      { status: 500 }
    );
  }
}