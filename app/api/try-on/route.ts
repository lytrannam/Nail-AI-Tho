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

async function urlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Cannot load reference image");
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const allowed = await checkRateLimit(`tryon:${ip}`, 20, 1440);

    if (!allowed) {
      return Response.json(
        {
          error:
            "Đã đạt giới hạn sử dụng hôm nay. Vui lòng thử lại vào ngày mai.",
        },
        { status: 429 }
      );
    }

    // Nhan du lieu tu CA HAI luong goi:
    // - Trang chu (chon 1 trong cac mau AI de xuat): gui "designImage"
    // - Live Camera (chon mau/kieu co san): gui "colorHex", "colorName", "style"
    const { image, designImage, colorHex, colorName, style } =
      await request.json();

    if (!image) {
      return Response.json(
        {
          error: "Không có ảnh bàn tay.",
        },
        { status: 400 }
      );
    }

    const handFile = await urlToFile(image, "hand.jpg");

    let editedImage;

    if (designImage) {
      // ---- LUONG 1: TRANG CHU - ghep mau da chon (designImage) len tay that ----
      const designFile = await urlToFile(designImage, "design.jpg");

      editedImage = await openai.images.edit({
        model: "gpt-image-2",
        image: [handFile, designFile],
        quality: "low",
        size: "1024x1024",
        prompt: `
The first image shows a real hand. The second image shows a reference nail
design (color, pattern, and style).

Apply the exact nail color, pattern, and style shown in the second reference
image onto every fingernail of the hand in the first image.

IMPORTANT — apply this to EVERY SINGLE fingernail visible in the first photo,
with no exceptions: thumb, index, middle, ring, and pinky must all receive the
same design, evenly and consistently. Do not skip, miss, or leave any nail in
its original/natural state.

Keep each nail's original size, shape, and boundary exactly as in the first
photo — only change its color/pattern, do not resize or reshape any nail.

Keep the original from the first photo:
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
    } else {
      // ---- LUONG 2: LIVE CAMERA - to mau/kieu co san (colorHex/style) ----
      let stylePrompt = "";

      if (style === "solid" || style === "plain") {
        stylePrompt =
          "Use a plain, solid, glossy nail polish color with no nail art or pattern.";
      }

      if (style === "light") {
        stylePrompt =
          "Use a simple elegant nail style with very light minimal decoration.";
      }

      if (style === "detailed") {
        stylePrompt =
          "Use a more detailed elegant salon nail design while keeping the selected color as the main color.";
      }

      if (style === "chrome") {
        stylePrompt =
          "Use a chrome / mirror-finish nail polish effect: a highly reflective, metallic, glossy shine across every nail, like a mirror.";
      }

      if (style === "glitter") {
        stylePrompt =
          "Use a glitter nail polish effect: fine sparkling glitter particles evenly scattered across every nail, catching the light.";
      }

      if (style === "french") {
        stylePrompt =
          "Use a classic French manicure: a natural nude/pink base color on the main nail bed, with a clean white tip painted only at the very end (free edge) of each nail.";
      }

      editedImage = await openai.images.edit({
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

IMPORTANT — apply this to EVERY SINGLE fingernail visible in the photo, with no
exceptions: thumb, index, middle, ring, and pinky must all receive the exact
same nail color and style, evenly and consistently. Do not skip, miss, leave
unfinished, or leave any nail in its original/natural state — every visible
nail must be fully and identically edited. Pay special attention to the thumb
nail and any nail that is partially turned or at an angle — they must be
edited just as completely as the nails facing the camera directly.

Keep each nail's original size, shape, and boundary exactly as in the photo —
only change its color/finish, do not resize, extend, or reshape any nail.

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
    }

    const imageBase64 = editedImage.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("OpenAI did not return an image.");
    }

    const resultImage = `data:image/png;base64,${imageBase64}`;

    if (new TextEncoder().encode(resultImage).length > 4000000) {
      return Response.json({ error: "Ảnh kết quả quá lớn. Vui lòng thử lại với ảnh bàn tay đơn giản hơn." }, { status: 413 });
    }
    return Response.json({
      image: resultImage,
    });
  } catch (error) {
    console.error("TRY-ON API ERROR:", error);

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