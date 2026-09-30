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
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit_atomic", {
    p_key: key,
    p_max: maxRequests,
    p_window_minutes: windowMinutes,
  });

  if (error) {
    throw new Error("rate_limit_infra_error");
  }

  return data === true;
}

function isAllowedPortfolioImageUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    parsed.hostname === "rxptwdxbxlxcuxjzuvfr.supabase.co" &&
    parsed.pathname.startsWith("/storage/v1/object/public/nail-designs/")
  );
}

export async function POST(request: Request) {
  try {
    // BUOC 1: Xac minh nguoi goi THUC SU da dang nhap (khong tin client)
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return Response.json(
        { error: "Bạn cần đăng nhập để dùng tính năng này." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return Response.json(
        { error: "Phiên đăng nhập không hợp lệ." },
        { status: 401 }
      );
    }

    // Toi da 100 lan gan tag/tho/ngay.
    const allowed = await checkRateLimit(`portfolio-tag:${user.id}`, 100, 1440);

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

    if (!isAllowedPortfolioImageUrl(imageUrl)) {
      return Response.json({ error: "Ảnh không hợp lệ." }, { status: 400 });
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