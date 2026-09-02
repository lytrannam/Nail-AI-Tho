"use client";

import { useRef, useState } from "react";

export default function Page() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
const [designImage, setDesignImage] = useState<string | null>(null);
const [selectedDesign, setSelectedDesign] = useState<number | null>(null);
const [tryOnImage, setTryOnImage] = useState<string | null>(null);
const [tryOnLoading, setTryOnLoading] = useState(false);
  const handleImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = () => {
        setImage(reader.result as string);
        setResult("");
        setSelectedDesign(null);
        setDesignImage(null);
        setTryOnImage(null);

      };

      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    setLoading(true);
    setResult("");
    setDesignImage(null);
    setSelectedDesign(null);
    setTryOnImage(null);

    try {
      const response = await fetch("/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể phân tích ảnh");
      }

      setResult(data.result);
      setDesignImage(data.designImage);
    } catch (error) {
      setResult("⚠️ AI chưa thể tạo gợi ý lúc này. Vui lòng thử lại sau.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
const tryOnNails = async () => {
  if (!image || !designImage) return;
setTryOnLoading(true);
try{
  setTryOnImage(null);

  const response = await fetch("/api/try-on", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image,
      designImage,
    }),
    
  });
  const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || "Không thể thử mẫu");
}

setTryOnImage(data.tryOnImage);
} finally {
  setTryOnLoading(false);
}
};
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
     <div style={{ marginBottom: "30px" }}>
  <div style={{ fontSize: "42px", marginBottom: "8px" }}>💅</div>

  <h1 style={{ margin: "0 0 8px" }}>
    AL NAIL AI
  </h1>

  <p style={{ fontSize: "18px", margin: "0 0 20px" }}>
    Trợ lý AI chọn nail dành riêng cho bạn
  </p>

  <div
    style={{
      maxWidth: "600px",
      margin: "0 auto",
      padding: "18px",
      borderRadius: "16px",
      background: "#f7f7f7",
      lineHeight: "1.6",
    }}
  >
    📷 Chụp rõ cả bàn tay dưới ánh sáng tự nhiên, không dùng filter và không che móng.
    <br />
    ✨ AI sẽ phân tích tông da, gợi ý màu phù hợp và tạo 3 mẫu nail dành cho bạn.
  </div>
</div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleImage}
      />

      <button
        onClick={() => fileInput.current?.click()}
        style={{
          padding: "16px 28px",
          borderRadius: "14px",
          border: "none",
          fontSize: "18px",
          cursor: "pointer",
          margin: "10px",
        }}
      >
        📸 Chụp hoặc chọn ảnh bàn tay
      </button>

      {image && (
        <div style={{ marginTop: "30px" }}>
          <h2>Ảnh bàn tay của khách</h2>

          <img
            src={image}
            alt="Ảnh khách hàng"
            style={{
              maxWidth: "90%",
              width: "350px",
              borderRadius: "18px",
            }}
          />

          <br />

          <button
            onClick={analyzeImage}
            disabled={loading}
            style={{
              padding: "16px 28px",
              borderRadius: "14px",
              border: "none",
              fontSize: "18px",
              cursor: "pointer",
              marginTop: "20px",
            }}
          >
            {loading ? "✨ AI đang phân tích & tạo mẫu..." : "✨ Xem gợi ý Nail AI"}
          </button>
        </div>
      )}

      {result && (
        <div
          style={{
            margin: "30px auto",
            maxWidth: "600px",
         textAlign: "left",
            padding: "20px",
            borderRadius: "18px",
          }}
        >
          <h2>✨ Gợi ý cho khách</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{result}</p>
          {designImage && selectedDesign === null && (
  <div style={{ marginTop: "25px" }}>
    <h2>💅 3 mẫu Nail phù hợp với bạn</h2>
    <p>3 mẫu nail được AI thiết kế dựa trên tông da của bạn</p>
    <img
      src={designImage}
      alt="3 mẫu nail design do AI đề xuất"
      style={{
        width: "100%",
        maxWidth: "600px",
        borderRadius: "18px",
        marginTop: "15px",
      }}
      />
      <button
      onClick={tryOnNails}
      disabled={tryOnLoading}
  type="button"
  style={{
    marginTop: "18px",
    padding: "12px 20px",
    borderRadius: "10px",
    cursor: "pointer",
  }}>

   {tryOnLoading ? "AI đang thử mẫu lên tay..." : "Thử mẫu lên bàn tay"}
</button>
{tryOnImage && (
  <div style={{ marginTop: "25px" }}>
    <h2>Mẫu thử trên bàn tay của bạn</h2>

    <img
      src={tryOnImage}
      alt="Mẫu nail thử trên bàn tay"
      style={{
        width: "100%",
        maxWidth: "600px",
        borderRadius: "18px",
        marginTop: "15px",
      }}
    />
  </div>
)}
  </div>
)}
        </div>
      )}
    </main>
  );
}   