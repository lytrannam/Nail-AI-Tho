import { supabase } from "./supabase";

// Nhận vào 1 ảnh dạng base64 (data:image/png;base64,...)
// Upload lên Supabase Storage, trả về link ảnh thật (https://...)
export async function uploadImage(base64Image: string): Promise<string | null> {
  try {
    // Tách phần dữ liệu thật ra khỏi phần "data:image/png;base64,"
    const base64Data = base64Image.split(",")[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/png" });

    const fileName = `design-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.png`;

    const { error } = await supabase.storage
      .from("nail-designs")
      .upload(fileName, blob, { contentType: "image/png" });

    if (error) {
      console.error("Lỗi upload ảnh:", error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("nail-designs")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("Lỗi xử lý ảnh:", error);
    return null;
  }
}