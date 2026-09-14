"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { translations, Language } from "../lib/translations";

type TryOnResult = {
  designIndex: number;
  image: string;
};

const MAX_TRYON_PER_VISIT = 2;

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
  const [tryOnResults, setTryOnResults] = useState<TryOnResult[]>([]);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnError, setTryOnError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [lang, setLang] = useState<Language>("en");
  const [tryOnCount, setTryOnCount] = useState(0);

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
        // Neu khach nay da tung dung tryon_used=true tu truoc (du lieu cu, chi
        // luu 1 lan dung/chua), coi nhu da het luot de an toan chi phi, khong
        // biet chinh xac ho da dung bao nhieu lan truoc do.
        setTryOnCount(data.tryon_used ? MAX_TRYON_PER_VISIT : 0);
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
        // Anh tay moi hoan toan -> xoa het ket qua thu cu, bat dau lai tu dau
        setTryOnResults([]);
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
    setTryOnResults([]);
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
          data.designSources || data.designImages.map(() => "ai");

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
    if (!image || !designImage || selectedDesign === null) return;
    if (tryOnCount >= MAX_TRYON_PER_VISIT) return;

    setTryOnLoading(true);
    try {
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

      const newResultImage = data.tryOnImage || data.image;

      // Them ket qua moi vao danh sach, KHONG xoa ket qua cu (de khach so sanh)
      setTryOnResults((prev) => [
        ...prev,
        { designIndex: selectedDesign, image: newResultImage },
      ]);

      const newCount = tryOnCount + 1;
      setTryOnCount(newCount);

      if (customerId && newResultImage) {
        const { uploadImage } = await import("../lib/uploadImage");
        const uploadedTryOnUrl = await uploadImage(newResultImage);
        if (uploadedTryOnUrl) {
          await supabase
            .from("customers")
            .update({
              tryon_image: uploadedTryOnUrl,
              tryon_used: newCount >= MAX_TRYON_PER_VISIT,
            })
            .eq("id", customerId);
        }
      }
    } catch (error) {
      console.error(error);
      setTryOnError(t.tryOnError);
    } finally {
      setTryOnLoading(false);
    }
  };

  const removeTryOnResult = (index: number) => {
    setTryOnResults((prev) => prev.filter((_, i) => i !== index));
    // Luu y: xoa khoi man hinh khong hoan lai luot da dung, vi AI da chay va
    // ton chi phi roi. tryOnCount giu nguyen.
  };

  const saveAsWalkIn = async () => {
    if (!walkInName.trim() || !walkInPhone.trim()) {
      alert("Vui lòng nhập tên và số điện thoại.");
      return;
    }

    setWalkInSaving(true);

    const { data: userData } = await supabase.auth.getUser();
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
        padding: "48px 20px",
        textAlign: "center",
        fontFamily: "var(--font-body)",
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={() => setLang(lang === "en" ? "vi" : "en")}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          padding: "8px 16px",
          cursor: "pointer",
          borderRadius: "999px",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
          fontSize: "14px",
        }}
      >
        🌐 {t.switchLang}
      </button>

      {saveMessage && (
        <p style={{ marginBottom: "20px", color: "var(--accent)", fontWeight: 600 }}>
          {saveMessage}
        </p>
      )}

      {loyaltyInfo?.enabled && (
        <div
          style={{
            maxWidth: "500px",
            margin: "0 auto 24px",
            padding: "16px 18px",
            borderRadius: "14px",
            background: "var(--accent-soft)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
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

      <div style={{ marginBottom: "36px" }}>
        <div style={{ fontSize: "46px", marginBottom: "10px" }}>💅</div>
        <h1 style={{ fontSize: "34px", marginBottom: "10px", letterSpacing: "-0.01em" }}>
          {t.appTitle}
        </h1>
        <p style={{ fontSize: "17px", color: "var(--foreground-soft)", margin: "0 0 22px" }}>
          {t.appSubtitle}
        </p>

        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "20px 22px",
            borderRadius: "18px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderLeft: "4px solid var(--accent)",
            lineHeight: "1.7",
            textAlign: "left",
            color: "var(--foreground)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
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
          padding: "18px 32px",
          borderRadius: "999px",
          border: "none",
          fontSize: "17px",
          fontWeight: 600,
          cursor: "pointer",
          margin: "10px",
          background: "var(--accent)",
          color: "white",
          boxShadow: "0 6px 20px rgba(255,45,120,0.3)",
        }}
      >
        {t.chooseOrTakePhoto}
      </button>

      {image && (
        <div style={{ marginTop: "34px" }}>
          <h2 style={{ fontSize: "22px", marginBottom: "14px" }}>{t.yourHandPhoto}</h2>
          <img
            src={image}
            alt={t.yourHandPhoto}
            style={{
              maxWidth: "90%",
              width: "350px",
              borderRadius: "20px",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <br />
          <button
            onClick={analyzeImage}
            disabled={loading}
            style={{
              padding: "18px 32px",
              borderRadius: "999px",
              border: "none",
              fontSize: "17px",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: "24px",
              background: loading ? "var(--foreground-soft)" : "var(--accent)",
              color: "white",
              boxShadow: loading ? "none" : "0 6px 20px rgba(255,45,120,0.3)",
            }}
          >
            {loading ? t.analyzing : t.viewSuggestions}
          </button>
        </div>
      )}

      {result && (
        <div
          style={{
            margin: "36px auto",
            maxWidth: "600px",
            textAlign: "left",
            padding: "26px",
            borderRadius: "20px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ fontSize: "22px", marginBottom: "10px" }}>{t.suggestionsTitle}</h2>
          <p style={{ whiteSpace: "pre-wrap", color: "var(--foreground)", lineHeight: "1.6" }}>
            {result}
          </p>

          {designImages.length > 0 && (
            <div style={{ marginTop: "28px" }}>
              <h2 style={{ fontSize: "20px", marginBottom: "4px" }}>{t.chooseDesignTitle}</h2>
              <p style={{ fontSize: "13px", color: "var(--foreground-soft)", marginTop: "4px" }}>
                {t.disclaimerDesign}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginTop: "16px",
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
                      setTryOnError("");
                      // KHONG xoa tryOnResults o day nua - giu lai de khach so sanh
                    }}
                    style={{
                      padding: "10px",
                      borderRadius: "18px",
                      cursor: "pointer",
                      border:
                        selectedDesign === index
                          ? "3px solid var(--accent)"
                          : "1px solid var(--border)",
                      background: "var(--surface)",
                      boxShadow:
                        selectedDesign === index
                          ? "0 4px 16px rgba(255,45,120,0.18)"
                          : "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                  >
                    <img
                      src={img}
                      alt={`${t.design} ${index + 1}`}
                      style={{ width: "100%", borderRadius: "12px" }}
                    />
                    <div style={{ marginTop: "8px", fontWeight: 600, color: "var(--foreground)" }}>
                      {t.design} {index + 1}
                    </div>
                    {designSources[index] === "real" && (
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          color: "var(--gold)",
                          fontWeight: 600,
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
            disabled={tryOnLoading || !designImage || !image || tryOnCount >= MAX_TRYON_PER_VISIT}
            type="button"
            style={{
              marginTop: "22px",
              padding: "14px 24px",
              borderRadius: "999px",
              border: "1px solid var(--gold)",
              background: "transparent",
              color: "var(--gold)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tryOnLoading ? t.tryOnLoading : t.tryOnButton}
          </button>
          <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--foreground-soft)" }}>
            {lang === "vi"
              ? `Đã dùng ${tryOnCount}/${MAX_TRYON_PER_VISIT} lượt thử cho lần ghé này.`
              : `Used ${tryOnCount}/${MAX_TRYON_PER_VISIT} try-ons for this visit.`}
          </p>
          {tryOnCount >= MAX_TRYON_PER_VISIT && (
            <p style={{ marginTop: "4px", color: "var(--foreground-soft)", fontSize: "14px" }}>
              {lang === "vi"
                ? "Bạn đã dùng hết lượt thử miễn phí cho lần ghé này."
                : "You've used all your free try-ons for this visit."}
            </p>
          )}

          {tryOnResults.length > 0 && (
            <div style={{ marginTop: "28px" }}>
              <h2 style={{ fontSize: "20px", marginBottom: "14px" }}>{t.tryOnResultTitle}</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    tryOnResults.length > 1 ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr",
                  gap: "16px",
                }}
              >
                {tryOnResults.map((res, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "18px",
                      padding: "10px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        marginBottom: "8px",
                        color: "var(--foreground-soft)",
                      }}
                    >
                      {t.design} {res.designIndex + 1}
                    </div>
                    <img
                      src={res.image}
                      alt={t.tryOnResultTitle}
                      style={{
                        width: "100%",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeTryOnResult(i)}
                      style={{
                        marginTop: "10px",
                        width: "100%",
                        padding: "8px",
                        fontSize: "13px",
                        cursor: "pointer",
                        background: "transparent",
                        border: "1px solid var(--accent)",
                        borderRadius: "999px",
                        color: "var(--accent)",
                        fontWeight: 600,
                      }}
                    >
                      {lang === "vi" ? "Xóa ảnh này" : "Delete this"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tryOnError && (
            <p style={{ marginTop: "15px", color: "var(--accent-dark)" }}>{tryOnError}</p>
          )}

          {!customerId && designImages.length > 0 && !walkInSaved && (
            <div
              style={{
                marginTop: "32px",
                padding: "22px",
                background: "var(--accent-soft)",
                borderRadius: "18px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
              }}
            >
              <h3 style={{ fontSize: "18px", marginBottom: "12px" }}>
                Save this design — I want it!
              </h3>
              <input
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  marginBottom: "10px",
                  boxSizing: "border-box",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}
              />
              <input
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                placeholder="Phone number"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  marginBottom: "10px",
                  boxSizing: "border-box",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}
              />
              <button
                type="button"
                onClick={saveAsWalkIn}
                disabled={walkInSaving}
                style={{
                  padding: "14px 22px",
                  cursor: "pointer",
                  fontWeight: 600,
                  borderRadius: "999px",
                  border: "none",
                  background: "var(--accent)",
                  color: "white",
                }}
              >
                {walkInSaving ? "Saving..." : "Save & show to technician"}
              </button>
            </div>
          )}

          {walkInSaved && (
            <p style={{ marginTop: "20px", fontWeight: 600, color: "var(--accent)" }}>
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
