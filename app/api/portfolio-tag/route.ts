import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Giong het co che gioi han da dung o app/api/route.ts va app/api/try-on/route.ts
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

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // Toi da 30 lan gan tag/IP/ngay - rong rai hon 2 API kia mot chut vi
    // day la tinh nang cho THO dung (upload nhieu anh Portfolio lien tuc
    // la binh thuong), nhung van co gioi han de chan lam dung.
    const allowed = await checkRateLimit(`portfolio-tag:${ip}`, 30, 1440);

    if (!allowed) {
      return Response.json(
        {
          error:
            "Đã đạt giới hạn sử dụng hôm nay. Vui lòng thử lại vào ngày mai.",
        },
        { status: 429 }
      );
    }

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