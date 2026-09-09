"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";

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
          body: JSON.stringify({ imageUrl, userId }),
        });

        const data = await res.json();
        if (!data.error) successCount++;
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
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
        position: "relative",
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

      <h1>{t.portfolioTitle}</h1>
      <p>{t.portfolioSubtitle}</p>

      <div
        style={{
          background: "#f0f7ff",
          color: "#1a1a1a",
          border: "1px solid #cfe3ff",
          borderRadius: "12px",
          padding: "18px 20px",
          margin: "20px 0",
          maxWidth: "600px",
          fontSize: "14px",
          lineHeight: "1.7",
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
        <span>{t.portfolioConfirmLabel}</span>
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

      {uploading && <p>{t.portfolioUploading}</p>}
      {message && <p>{message}</p>}

      <h2 style={{ marginTop: "40px" }}>
        {t.portfolioSavedHeading} ({portfolio.length})
      </h2>
      <p style={{ fontSize: "13px", color: "#888", marginTop: "-8px" }}>
        {t.portfolioSortNote}
      </p>

      {[1, 2, 3, 4, 5, 6, null].map((tone) => {
        const group = portfolio.filter((item) => item.skin_tone_group === tone);
        if (group.length === 0) return null;

        return (
          <div key={tone ?? "unknown"} style={{ marginTop: "28px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>
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
                    border: "1px solid #ddd",
                    borderRadius: "12px",
                    padding: "8px",
                    position: "relative",
                  }}
                >
                  <img
                    src={item.image_url}
                    alt="Portfolio"
                    style={{ width: "100%", borderRadius: "8px" }}
                  />
                  <div style={{ fontSize: "13px", marginTop: "6px" }}>
                    {item.style || "—"} {item.color ? `· ${item.color}` : ""}
                  </div>
                  {item.difficulty && (
                    <div style={{ fontSize: "12px", color: "#888" }}>
                      {t.portfolioDifficultyLabel}: {difficultyLabel(item.difficulty)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    style={{
                      marginTop: "8px",
                      width: "100%",
                      padding: "6px",
                      fontSize: "13px",
                      cursor: "pointer",
                      background: "#fff0f0",
                      border: "1px solid #f5c2c2",
                      borderRadius: "6px",
                      color: "#c0392b",
                    }}
                  >
                    {t.portfolioDeleteButton}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </main>
  );
}