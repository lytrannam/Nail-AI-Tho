"use client";

import ProArtwork from "../components/ProArtwork";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";
import QRCode from "qrcode";

type PortfolioItem = {
  id: number;
  image_url: string;
  style: string | null;
  color: string | null;
  skin_tone_group: number | null;
  difficulty: string | null;
};

const DIFFICULTY_RANK: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

function sortPortfolio(items: PortfolioItem[]): PortfolioItem[] {
  return [...items].sort((a, b) => {
    const toneA = a.skin_tone_group ?? 999;
    const toneB = b.skin_tone_group ?? 999;
    if (toneA !== toneB) return toneA - toneB;

    const diffA = DIFFICULTY_RANK[a.difficulty ?? ""] ?? 99;
    const diffB = DIFFICULTY_RANK[b.difficulty ?? ""] ?? 99;
    return diffA - diffB;
  });
}

export default function PortfolioPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmedOwnWork, setConfirmedOwnWork] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [lang, setLang] = useState<Language>("vi");
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [techUsername, setTechUsername] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);

  const t = translations[lang];

  const difficultyLabel = (difficulty: string | null) => {
    if (difficulty === "easy") return t.difficultyEasy;
    if (difficulty === "medium") return t.difficultyMedium;
    if (difficulty === "hard") return t.difficultyHard;
    return difficulty;
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUserId(user.id);
      setAuthChecked(true);

      const { data } = await supabase
        .from("portfolio")
        .select("id, image_url, style, color, skin_tone_group, difficulty")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setPortfolio(sortPortfolio(data || []));
      const { data: profileData } = await supabase
        .from("tech_profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();

      setTechUsername(profileData?.username || null);
    };

    init();
  }, []);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !userId) return;

    if (!confirmedOwnWork) {
      alert(t.portfolioConfirmAlert);
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
    setMessage(
      t.portfolioUploadedMessage
        .replace("{success}", String(successCount))
        .replace("{total}", String(files.length))
    );

    const { data } = await supabase
      .from("portfolio")
      .select("id, image_url, style, color, skin_tone_group, difficulty")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setPortfolio(sortPortfolio(data || []));

    if (fileInput.current) fileInput.current.value = "";
  };

  const handleShare = async (item: PortfolioItem) => {
    if (!techUsername) {
      alert(t.shareNoProfile);
      return;
    }

    setSharingId(item.id);

    try {
      const profileUrl = `${window.location.origin}/u/${techUsername}`;

      const baseImage = new Image();
      baseImage.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        baseImage.onload = () => resolve();
        baseImage.onerror = reject;
        baseImage.src = item.image_url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = baseImage.naturalWidth;
      canvas.height = baseImage.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");

      ctx.drawImage(baseImage, 0, 0);

      const qrSize = Math.round(canvas.width * 0.18);
      const qrDataUrl = await QRCode.toDataURL(profileUrl, { width: qrSize, margin: 1 });
      const qrImage = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = reject;
        qrImage.src = qrDataUrl;
      });

      const qrMargin = Math.round(canvas.width * 0.03);
      const qrX = canvas.width - qrSize - qrMargin;
      const qrY = canvas.height - qrSize - qrMargin;

      ctx.fillStyle = "white";
      ctx.fillRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12);
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      const fontSize = Math.max(16, Math.round(canvas.width * 0.032));
      ctx.font = `600 ${fontSize}px Arial`;
      const label = "Made with AL Nail AI";
      const textWidth = ctx.measureText(label).width;
      const padX = 16;
      const padY = 9;
      const boxHeight = fontSize + padY * 2;
      const boxY = canvas.height - boxHeight - qrMargin;

      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(qrMargin, boxY, textWidth + padX * 2, boxHeight);

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.textBaseline = "middle";
      ctx.fillText(label, qrMargin + padX, boxY + boxHeight / 2);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("export failed");

      const file = new File([blob], "al-nail-ai-design.jpg", { type: "image/jpeg" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "AL Nail AI",
        });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "al-nail-ai-design.jpg";
        link.click();
      }
    } catch (err) {
      console.error(err);
      alert(t.shareError);
    } finally {
      setSharingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm(t.portfolioDeleteConfirm);
    if (!confirmed) return;

    const { error } = await supabase.from("portfolio").delete().eq("id", id);

    if (error) {
      alert(t.portfolioDeleteError);
      console.error(error);
      return;
    }

    setPortfolio((prev) => prev.filter((item) => item.id !== id));
  };

  if (!authChecked) {
    return (
      <main style={{ padding: "40px 20px", fontFamily: "Arial, sans-serif" }}>
        <p>Loading... / Đang tải...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "48px 20px",
        fontFamily: "var(--font-body)",
        position: "relative",
        maxWidth: "980px",
        margin: "0 auto",
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

      <button
        type="button"
        onClick={() => {
          window.location.href = "/customers";
        }}
        style={{
          padding: "8px 16px",
          cursor: "pointer",
          borderRadius: "999px",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
          fontSize: "14px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        ← {lang === "vi" ? "Quay lại" : "Back"}
      </button>

      <ProArtwork variant="portfolio" lang={lang} />
      <h1 style={{ fontSize: "30px", marginTop: "20px" }}>{t.portfolioTitle}</h1>
      <p style={{ color: "var(--foreground-soft)", marginTop: "8px" }}>{t.portfolioSubtitle}</p>

      <div
        style={{
          background: "var(--surface)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderLeft: "4px solid var(--gold)",
          borderRadius: "16px",
          padding: "20px 22px",
          margin: "22px 0",
          maxWidth: "600px",
          fontSize: "14px",
          lineHeight: "1.7",
          boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
        }}
      >
        <strong>{t.portfolioGuideTitle}</strong>
        <ol style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
          <li>{t.portfolioGuideStep1}</li>
          <li>{t.portfolioGuideStep2}</li>
          <li>{t.portfolioGuideStep3}</li>
          <li>{t.portfolioGuideStep4}</li>
        </ol>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          marginTop: "24px",
          maxWidth: "500px",
          fontSize: "14px",
          lineHeight: "1.5",
          color: "var(--foreground)",
        }}
      >
        <input
          type="checkbox"
          checked={confirmedOwnWork}
          onChange={(e) => setConfirmedOwnWork(e.target.checked)}
          style={{ marginTop: "3px", accentColor: "var(--accent)" }}
        />
        <span>{t.portfolioConfirmLabel}</span>
      </label>

      <div style={{ marginTop: "16px" }}>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          disabled={uploading || !confirmedOwnWork}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        />
      </div>

      {uploading && <p style={{ color: "var(--foreground-soft)" }}>{t.portfolioUploading}</p>}
      {message && <p style={{ color: "var(--accent)", fontWeight: 600 }}>{message}</p>}

      <h2 style={{ marginTop: "44px", fontSize: "22px" }}>
        {t.portfolioSavedHeading} ({portfolio.length})
      </h2>
      <p style={{ fontSize: "13px", color: "var(--foreground-soft)", marginTop: "4px" }}>
        {t.portfolioSortNote}
      </p>

      {[1, 2, 3, 4, 5, 6, null].map((tone) => {
        const group = portfolio.filter((item) => item.skin_tone_group === tone);
        if (group.length === 0) return null;

        return (
          <div key={tone ?? "unknown"} style={{ marginTop: "28px" }}>
            <h3
              style={{
                fontSize: "16px",
                marginBottom: "12px",
                display: "inline-block",
                padding: "4px 14px",
                borderRadius: "999px",
                background: "var(--accent-soft)",
                color: "var(--accent-dark)",
              }}
            >
              {tone ? `${t.portfolioToneLabel} ${tone}` : t.portfolioUnknownTone}{" "}
              ({group.length})
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "14px",
              }}
            >
              {group.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "16px",
                    padding: "10px",
                    position: "relative",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                  }}
                >
                  <img
                    src={item.image_url}
                    alt="Portfolio"
                    onClick={() => { setEnlargedImage(item.image_url); setZoom(1); }}
                    style={{ width: "100%", borderRadius: "10px", cursor: "pointer" }}
                  />
                  <div style={{ fontSize: "13px", marginTop: "8px", color: "var(--foreground)" }}>
                    {item.style || "—"} {item.color ? `· ${item.color}` : ""}
                  </div>
                  {item.difficulty && (
                    <div style={{ fontSize: "12px", color: "var(--foreground-soft)" }}>
                      {t.portfolioDifficultyLabel}: {difficultyLabel(item.difficulty)}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={() => handleShare(item)}
                      disabled={sharingId === item.id}
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: "13px",
                        cursor: sharingId === item.id ? "not-allowed" : "pointer",
                        background: "var(--accent)",
                        border: "none",
                        borderRadius: "999px",
                        color: "white",
                        fontWeight: 600,
                        opacity: sharingId === item.id ? 0.6 : 1,
                      }}
                    >
                      {sharingId === item.id ? t.sharing : t.shareButton}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      style={{
                        flex: 1,
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
                      {t.portfolioDeleteButton}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {enlargedImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
            overflow: "auto",
          }}
        >
          <img
            src={enlargedImage}
            alt="Portfolio enlarged"
            style={{
              maxWidth: zoom === 1 ? "100%" : "none",
              maxHeight: zoom === 1 ? "80vh" : "none",
              width: zoom === 1 ? "auto" : `${zoom * 100}%`,
              borderRadius: "12px",
              boxShadow: "0 4px 30px rgba(0,0,0,0.5)",
              transition: "width 0.2s, max-width 0.2s",
            }}
          />

          <div
            style={{
              position: "fixed",
              bottom: "24px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "10px",
              background: "white",
              borderRadius: "30px",
              padding: "8px 14px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "none",
                background: "#f0f0f0",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              style={{
                padding: "0 12px",
                borderRadius: "18px",
                border: "none",
                background: "#f0f0f0",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "none",
                background: "#f0f0f0",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={() => setEnlargedImage(null)}
            style={{
              position: "fixed",
              top: "20px",
              right: "20px",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "none",
              background: "white",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </main>
  );
}
