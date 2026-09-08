"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type PortfolioItem = {
  id: number;
  image_url: string;
  style: string | null;
  color: string | null;
};

export default function PortfolioPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserId(user.id);

      const { data } = await supabase
        .from("portfolio")
        .select("id, image_url, style, color")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setPortfolio(data || []);
    };

    init();
  }, []);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !userId) return;

    setUploading(true);
    setMessage("");

    const { uploadImage } = await import("../../lib/uploadImage");

    let successCount = 0;

    for (const file of Array.from(files)) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const imageUrl = await uploadImage(base64);
        if (!imageUrl) continue;

        const res = await fetch("/api/portfolio-tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl }),
        });

        const data = await res.json();
        if (data.error) continue;

        const tags = data.tags || {};

        const { error: insertError } = await supabase.from("portfolio").insert({
          user_id: userId,
          image_url: imageUrl,
          skin_tone_group: tags.skin_tone_group ?? null,
          undertone: tags.undertone ?? null,
          shape: tags.shape ?? null,
          style: tags.style ?? null,
          color: tags.color ?? null,
          material: tags.material ?? null,
          difficulty: tags.difficulty ?? null,
        });

        if (!insertError) successCount++;
        else console.error(insertError);
      } catch (error) {
        console.error(error);
      }
    }

    setUploading(false);
    setMessage(`Đã thêm ${successCount}/${files.length} ảnh vào portfolio.`);

    const { data } = await supabase
      .from("portfolio")
      .select("id, image_url, style, color")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setPortfolio(data || []);

    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <main style={{ padding: "40px 20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Portfolio — Tác phẩm thật của bạn</h1>
      <p>
        Tải lên ảnh các mẫu nail bạn đã thực sự làm. AI sẽ tự động gắn tag để
        dùng khi gợi ý cho khách sau này.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        disabled={uploading}
        style={{ marginTop: "20px" }}
      />

      {uploading && <p>Đang tải lên và gắn tag, vui lòng đợi...</p>}
      {message && <p>{message}</p>}

      <h2 style={{ marginTop: "40px" }}>Đã lưu ({portfolio.length})</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
          marginTop: "16px",
        }}
      >
        {portfolio.map((item: PortfolioItem) => (
          <div
            key={item.id}
            style={{ border: "1px solid #ddd", borderRadius: "12px", padding: "8px" }}
          >
            <img
              src={item.image_url}
              alt="Portfolio"
              style={{ width: "100%", borderRadius: "8px" }}
            />
            <div style={{ fontSize: "13px", marginTop: "6px" }}>
              {item.style || "—"} {item.color ? `· ${item.color}` : ""}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}