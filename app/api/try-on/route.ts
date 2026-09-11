import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

  const { data } = await supabaseAdmin
    .from("api_rate_limits")
    .select("count, window_start")
    .eq("key", key)
    .maybeSingle();

  const now = Date.now();

  if (!data || now - new Date(data.window_start).getTime() > windowMs) {
    await supabaseAdmin.from("api_rate_limits").upsert({
      key,
      count: 1,
      window_start: new Date().toISOString(),
    });

    return true;
  }

  if (data.count >= maxRequests) {
    return false;
  }

  await supabaseAdmin
    .from("api_rate_limits")
    .update({
      count: data.count + 1,
    })
    .eq("key", key);

  return true;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return "unknown";
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const allowed = await checkRateLimit(
      `tryon:${ip}`,
      20,
      1440
    );

    if (!allowed) {
      return Response.json(
        {
          error:
            "Đã đạt giới hạn sử dụng hôm nay. Vui lòng thử lại vào ngày mai.",
        },
        { status: 429 }
      );
    }

    // Nhận đúng dữ liệu từ live-tryon/page.tsx
    const {
      image,
      colorHex,
      colorName,
      style,
    } = await request.json();

    if (!image) {
      return Response.json(
        {
          error: "Không có ảnh bàn tay.",
        },
        { status: 400 }
      );
    }

    const handResponse = await fetch(image);
    const handBlob = await handResponse.blob();

    const handFile = new File(
      [handBlob],
      "hand.jpg",
      {
        type: handBlob.type || "image/jpeg",
      }
    );

    let stylePrompt = "";

    if (style === "plain") {
      stylePrompt =
        "Use a plain solid nail color with no nail art.";
    }

    if (style === "light") {
      stylePrompt =
        "Use a simple elegant nail style with very light minimal decoration.";
    }

    if (style === "detailed") {
      stylePrompt =
        "Use a more detailed elegant salon nail design while keeping the selected color as the main color.";
    }

    const editedImage = await openai.images.edit({
      model: "gpt-image-2",
      image: handFile,
      quality: "low",
      size: "1024x1024",

      prompt: `
Edit the fingernails in this hand photo.

Selected nail color:
${colorName}
Color hex:
${colorHex}

${stylePrompt}

Keep the original:
- hand
- fingers
- skin tone
- hand position
- lighting
- background

Only modify the fingernails.

Make all nails realistic, clean, glossy and salon-quality.
Do not change the shape or appearance of the person's hand.
      `,
    });

    const imageBase64 =
      editedImage.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error(
        "OpenAI did not return an image."
      );
    }

    const resultImage =
      `data:image/png;base64,${imageBase64}`;

    // "image" khớp với page.tsx của bạn
    return Response.json({
      image: resultImage,
    });

  } catch (error) {
    console.error(
      "TRY-ON API ERROR:",
      error
    );

    return Response.json(
      {
        error: "Không thể tạo ảnh thử nail.",
      },
      {
        status: 500,
      }
    );
  }
}