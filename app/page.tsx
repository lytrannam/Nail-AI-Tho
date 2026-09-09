"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { translations, Language } from "../lib/translations";

function PageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [designImages, setDesignImages] = useState<string[]>([]);
  const [designSources, setDesignSources] = useState<("real" | "ai")[]>([]);
  const [designImage, setDesignImage] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<number | null>(null);
  const [tryOnImage, setTryOnImage] = useState<string | null>(null);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnError, setTryOnError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [lang, setLang] = useState<Language>("en");
  const [tryonUsed, setTryonUsed] = useState(false);

  // Khách đã có hồ sơ (nhận diện qua token) hay khách vãng lai (chưa có)
  const [customerId, setCustomerId] = useState<number | null>(null);
    const [loyaltyInfo, setLoyaltyInfo] = useState<{
    enabled: boolean;
    visitsRequired: number;
    amountRequired: number;
    discountPercent: number;
    currentVisits: number;
    currentSpent: number;
  } | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInSaving, setWalkInSaving] = useState(false);
  const [walkInSaved, setWalkInSaved] = useState(false);

  const t = translations[lang];

  useEffect(() => {
  const loadByToken = async () => {
    if (!token) return;

    try {
      const response = await fetch(
        `/api/customer-by-token?token=${encodeURIComponent(token)}`
      );

      const result = await response.json();

      if (!response.ok || !result.customer) {
        console.error("Không tìm thấy khách:", result);
        return;
      }

      const data = result.customer;

      setCustomerId(data.id);
      setTryonUsed(data.tryon_used || false);
     
    } catch (error) {
      console.error("Lỗi đọc token:", error);
    }
  };

  loadByToken();
}, [token]);

  const saveSelectedDesign = async (index: number, imageUrl: string) => {
    if (!customerId) return;

    const { error } = await supabase
      .from("customers")
      .update({
        selected_design: `Mẫu ${index + 1}`,
        selected_design_image: imageUrl,
      })
      .eq("id", customerId);

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
        setDesignSources([]);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, customerId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể phân tích ảnh");
      }

      setResult(data.result);
      setDesignImages(data.designImages || []);
      setDesignSources(
        data.designSources || (data.designImages || []).map(() => "ai" as const)
      );
      setDesignImage(data.designImages?.[0] || null);
      setSelectedDesign(0);

      if (customerId && data.designImages?.length > 0) {
        const { uploadImage } = await import("../lib/uploadImage");
        const sources: ("real" | "ai")[] =
          data.designSources || data.designImages.map(() => "ai" as const);

        // Ảnh "real" đã là link có sẵn (portfolio thật) — chỉ upload ảnh "ai" (dạng base64)
        const uploadedUrls = await Promise.all(
          data.designImages.map((img: string, idx: number) =>
            sources[idx] === "real" ? Promise.resolve(img) : uploadImage(img)
          )
        );
        const validUrls = uploadedUrls.filter((url) => url !== null);

        await supabase
          .from("customers")
          .update({ all_design_images: validUrls })
          .eq("id", customerId);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, designImage }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể thử mẫu");
      }

      setTryOnImage(data.tryOnImage);

      if (customerId && data.tryOnImage) {
        const { uploadImage } = await import("../lib/uploadImage");
        const uploadedTryOnUrl = await uploadImage(data.tryOnImage);
        if (uploadedTryOnUrl) {
          await supabase
            .from("customers")
            .update({ tryon_image: uploadedTryOnUrl, tryon_used: true })
            .eq("id", customerId);
          setTryonUsed(true);
        }
      }
    } catch (error) {
      console.error(error);
      setTryOnError(t.tryOnError);
    } finally {
      setTryOnLoading(false);
    }
  };

  // Khách vãng lai bấm "Lưu mẫu, tôi muốn làm" — tạo hồ sơ tại chỗ
  const saveAsWalkIn = async () => {
    if (!walkInName.trim() || !walkInPhone.trim()) {
      alert("Vui lòng nhập tên và số điện thoại.");
      return;
    }

    setWalkInSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    // Với khách vãng lai chưa đăng nhập, cần biết tiệm nào — lấy qua salon param nếu có
    const salonParam = searchParams.get("salon");

    const newToken =
      Math.random().toString(36).slice(2) + Date.now().toString(36);

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: walkInName.trim(),
        phone: walkInPhone.trim(),
        user_id: salonParam || userData?.user?.id,
        session_token: newToken,
        selected_design: selectedDesign !== null ? `Mẫu ${selectedDesign + 1}` : null,
        selected_design_image: designImage,
        all_design_images: designImages,
      })
      .select("id")
      .single();

    setWalkInSaving(false);

    if (error) {
      console.error(error);
      alert("Không thể lưu thông tin. Vui lòng thử lại.");
      return;
    }

    setCustomerId(data.id);
    setWalkInSaved(true);
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

      {saveMessage && <p style={{ marginBottom: "20px" }}>{saveMessage}</p>}
      {loyaltyInfo?.enabled && (
        <div
          style={{
            maxWidth: "500px",
            margin: "0 auto 20px",
            padding: "14px",
            borderRadius: "12px",
            background: "#fff3cd",
            border: "1px solid #ffe08a",
          }}
        >
          {loyaltyInfo.currentVisits >= loyaltyInfo.visitsRequired ||
          loyaltyInfo.currentSpent >= loyaltyInfo.amountRequired ? (
            <strong>
              🎉 You've earned {loyaltyInfo.discountPercent}% off your next visit!
            </strong>
          ) : (
            <span>
              🎁 Loyalty progress: {loyaltyInfo.currentVisits}/
              {loyaltyInfo.visitsRequired} visits — get{" "}
              {loyaltyInfo.discountPercent}% off when you reach the goal!
            </span>
          )}
        </div>
      )}

      <div style={{ marginBottom: "30px" }}>
        <div style={{ fontSize: "42px", marginBottom: "8px" }}>💅</div>
        <h1 style={{ margin: "0 0 8px" }}>{t.appTitle}</h1>
        <p style={{ fontSize: "18px", margin: "0 0 20px" }}>{t.appSubtitle}</p>

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
            style={{ maxWidth: "90%", width: "350px", borderRadius: "18px" }}
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
                      if (customerId) saveSelectedDesign(index, img);
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
                      style={{ width: "100%", borderRadius: "12px" }}
                    />
                    <div style={{ marginTop: "8px", fontWeight: "bold" }}>
                      {t.design} {index + 1}
                    </div>
                    {designSources[index] === "real" && (
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          color: "#0a7d32",
                          fontWeight: "bold",
                        }}
                      >
                        ✓ Thợ đã từng làm mẫu này
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={tryOnNails}
            disabled={tryOnLoading || !designImage || !image || tryonUsed}
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
          {tryonUsed && !tryOnImage && (
            <p style={{ marginTop: "10px", color: "#888", fontSize: "14px" }}>
              You've used your free try-on for this visit.
            </p>
          )}

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
            <p style={{ marginTop: "15px", color: "red" }}>{tryOnError}</p>
          )}

          {/* Khách vãng lai chưa có hồ sơ — hiện form lưu thông tin */}
          {!customerId && designImages.length > 0 && !walkInSaved && (
            <div
              style={{
                marginTop: "30px",
                padding: "20px",
                background: "#f7f7f7",
                borderRadius: "16px",
              }}
            >
              <h3>Save this design — I want it!</h3>
              <input
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: "100%",
                  padding: "12px",
                  marginBottom: "10px",
                  boxSizing: "border-box",
                }}
              />
              <input
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                placeholder="Phone number"
                style={{
                  width: "100%",
                  padding: "12px",
                  marginBottom: "10px",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={saveAsWalkIn}
                disabled={walkInSaving}
                style={{
                  padding: "12px 20px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {walkInSaving ? "Saving..." : "Save & show to technician"}
                </button>
            </div>
          )}

          {walkInSaved && (
            <p
              style={{
                marginTop: "20px",
                fontWeight: "bold",
              }}
            >
              ✅ Information saved successfully.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}