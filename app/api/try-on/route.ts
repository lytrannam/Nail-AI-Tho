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
    .update({ count: data.count + 1 })
    .eq("key", key);

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

    // Tối đa 20 lần thử mẫu lên tay mỗi IP mỗi 24 giờ.
    const allowed = await checkRateLimit(`tryon:${ip}`, 20, 1440);

    if (!allowed) {
      return Response.json(
        {
          error:
            "Đã đạt giới hạn sử dụng hôm nay. Vui lòng thử lại vào ngày mai hoặc liên hệ tiệm để được hỗ trợ.",
        },
        { status: 429 }
      );
    }

    const { image, designImage } = await request.json();

    const handResponse = await fetch(image);
    const handBlob = await handResponse.blob();

    const designResponse = await fetch(designImage);
    const designBlob = await designResponse.blob();
    const handFile = new File([handBlob], "hand.png", { type: handBlob.type || "image/png" });
    const designFile = new File([designBlob], "design.png", { type: designBlob.type || "image/png" });
    const editedImage = await openai.images.edit({
      model: "gpt-image-2",
      image: [handFile, designFile],
      quality: "low",
      size: "1024x1024",
      prompt:
        "Apply the nail art design from the reference image onto the fingernails of the hand photo. Keep the original hand, skin tone, fingers, lighting, background, and hand position unchanged. Only change the fingernails. Make the nail design realistic and salon-quality.",
    });
    const imageBase64 = editedImage.data?.[0]?.b64_json;

    return Response.json({
      tryOnImage: imageBase64
        ? `data:image/png;base64,${imageBase64}`
        : null,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Không thể thử mẫu lên bàn tay." },
      { status: 500 }
    );
  }
}