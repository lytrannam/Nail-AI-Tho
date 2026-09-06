"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { translations, Language } from "../lib/translations";

function PageContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId");
  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [designImages, setDesignImages] = useState<string[]>([]);
  const [designImage, setDesignImage] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<number | null>(null);
  const [tryOnImage, setTryOnImage] = useState<string | null>(null);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnError, setTryOnError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [lang, setLang] = useState<Language>("en");

  const t = translations[lang];

  const saveSelectedDesign = async (index: number, imageUrl: string) => {
    if (!customerId) return;

    const { error } = await supabase
      .from("customers")
      .update({
        selected_design: `Mẫu ${index + 1}`,
        selected_design_image: imageUrl,
      })
      .eq("id", Number(customerId));

    if (error) {
      console.error(error);
      alert("Không thể lưu mẫu nail đã chọn.");
    }
    if (!error) {
      setSaveMessage(t.savedMessage);
    }
  };

  const handleImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = () => {
        setImage(reader.result as string);
        setResult("");
        setSelectedDesign(null);
        setDesignImage(null);
        setDesignImages([]);
        setTryOnImage(null);
        setTryOnError("");
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
    setTryOnError("");

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
      setDesignImages(data.designImages || []);
      setDesignImage(data.designImages?.[0] || null);
      setSelectedDesign(0);

      if (customerId && data.designImages?.length > 0) {
        const { uploadImage } = await import("../lib/uploadImage");
        const uploadedUrls = await Promise.all(
          data.designImages.map((img: string) => uploadImage(img))
        );
        const validUrls = uploadedUrls.filter((url) => url !== null);

        await supabase
          .from("customers")
          .update({ all_design_images: validUrls })
          .eq("id", Number(customerId));
      }
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
    try {
      setTryOnImage(null);
      setTryOnError("");

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
    } catch (error) {
      console.error(error);
      setTryOnError(t.tryOnError);
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
      <button
        type="button"
        onClick={() => setLang(lang === "en" ? "vi" : "en")}
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          padding: "8px 14px",
          cursor: "pointer",
          borderRadius: "8px",
          border: "1px solid #ccc",
          background: "white",
        }}
      >
        🌐 {t.switchLang}
      </button>

      {customerId && (
        <button
          type="button"
          onClick={() => {
            window.location.href = `/customer-details?id=${customerId}`;
          }}
          style={{
            padding: "10px 16px",
            marginBottom: "20px",
            cursor: "pointer",
          }}
        >
          {t.backToProfile}
        </button>
      )}
      {saveMessage && (
        <p style={{ marginBottom: "20px" }}>
          {saveMessage}
        </p>
      )}
      <div style={{ marginBottom: "30px" }}>
        <div style={{ fontSize: "42px", marginBottom: "8px" }}>💅</div>

        <h1 style={{ margin: "0 0 8px" }}>{t.appTitle}</h1>

        <p style={{ fontSize: "18px", margin: "0 0 20px" }}>
          {t.appSubtitle}
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
          {t.instructions}
          <br />
          {t.aiExplain}
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
        {t.chooseOrTakePhoto}
      </button>

      {image && (
        <div style={{ marginTop: "30px" }}>
          <h2>{t.yourHandPhoto}</h2>

          <img
            src={image}
            alt={t.yourHandPhoto}
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
            {loading ? t.analyzing : t.viewSuggestions}
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
          <h2>{t.suggestionsTitle}</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{result}</p>
          {designImages.length > 0 && (
            <div style={{ marginTop: "25px" }}>
              <h2>{t.chooseDesignTitle}</h2>
              <p style={{ fontSize: "13px", color: "#888", marginTop: "4px" }}>
                {t.disclaimerDesign}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "15px",
                  marginTop: "15px",
                }}
              >
                {designImages.map((img, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setSelectedDesign(index);
                      saveSelectedDesign(index, img);
                      setDesignImage(img);
                      setTryOnImage(null);
                      setTryOnError("");
                    }}
                    style={{
                      padding: "10px",
                      borderRadius: "16px",
                      cursor: "pointer",
                      border:
                        selectedDesign === index
                          ? "3px solid black"
                          : "1px solid #ccc",
                      background: "white",
                    }}
                  >
                    <img
                      src={img}
                      alt={`${t.design} ${index + 1}`}
                      style={{
                        width: "100%",
                        borderRadius: "12px",
                      }}
                    />

                    <div style={{ marginTop: "8px", fontWeight: "bold" }}>
                      {t.design} {index + 1}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={tryOnNails}
            disabled={tryOnLoading || !designImage || !image}
            type="button"
            style={{
              marginTop: "18px",
              padding: "12px 20px",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            {tryOnLoading ? t.tryOnLoading : t.tryOnButton}
          </button>
          {tryOnImage && (
            <div style={{ marginTop: "25px" }}>
              <h2>{t.tryOnResultTitle}</h2>

              <img
                src={tryOnImage}
                alt={t.tryOnResultTitle}
                style={{
                  width: "100%",
                  maxWidth: "600px",
                  borderRadius: "18px",
                  marginTop: "15px",
                }}
              />
            </div>
          )}
          {tryOnError && (
            <p style={{ marginTop: "15px", color: "red" }}>
              {tryOnError}
            </p>
          )}
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: "40px 20px", textAlign: "center" }}>Loading...</main>}>
      <PageContent />
    </Suspense>
  );
}