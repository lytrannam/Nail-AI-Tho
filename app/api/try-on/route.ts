import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { image, designImage } = await request.json();

    const handResponse = await fetch(image);
const handBlob = await handResponse.blob();

const designResponse = await fetch(designImage);
const designBlob = await designResponse.blob();
const handFile = new File([handBlob], "hand.png", { type: "image/png" });
const designFile = new File([designBlob], "design.png", { type: "image/png" });
const editedImage = await openai.images.edit({
  model: "gpt-image-2",
  image: [handFile, designFile],
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
