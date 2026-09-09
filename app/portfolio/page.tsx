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
  const [confirmedOwnWork, setConfirmedOwnWork] = useState(false);
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

    if (!confirmedOwnWork) {
      alert("Vui lòng tick xác nhận đây là ảnh thật bạn đã tự làm trước khi tải lên.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

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
          body: JSON.stringify({ imageUrl, userId }),
        });

        const data = await res.json();
        if (!data.error) successCount++;
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

      <div
        style={{
          background: "#f0f7ff",
          border: "1px solid #cfe3ff",
          borderRadius: "12px",
          padding: "18px 20px",
          margin: "20px 0",
          maxWidth: "600px",
          fontSize: "14px",
          lineHeight: "1.7",
        }}
      >
        <strong>Cách dùng nhanh:</strong>
        <ol style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
          <li>Tick vào ô xác nhận bên dưới.</li>
          <li>
            Bấm ô chọn ảnh, chọn <strong>nhiều ảnh cùng lúc</strong> (giữ Ctrl
            hoặc Shift khi chọn trên máy tính, hoặc chọn nhiều ảnh trên điện
            thoại).
          </li>
          <li>
            Đợi vài giây để AI tự phân tích và gắn tag từng ảnh — không cần
            làm gì thêm.
          </li>
          <li>
            Muốn tải 500 ảnh, cứ chọn 20–50 ảnh mỗi lần, lặp lại nhiều lần cho
            đến khi đủ — không giới hạn số lần tải.
          </li>
        </ol>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          marginTop: "20px",
          maxWidth: "500px",
          fontSize: "14px",
          lineHeight: "1.5",
        }}
      >
        <input
          type="checkbox"
          checked={confirmedOwnWork}
          onChange={(e) => setConfirmedOwnWork(e.target.checked)}
          style={{ marginTop: "3px" }}
        />
        <span>
          Tôi xác nhận đây là ảnh thật tôi đã tự làm cho khách, không phải ảnh
          sưu tầm từ nguồn khác.
        </span>
      </label>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        disabled={uploading || !confirmedOwnWork}
        style={{ marginTop: "14px" }}
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