"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { translations, Language } from "../../../lib/translations";

type TechProfile = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  is_public: boolean;
  verified: boolean;
};

type PortfolioItem = {
  id: number;
  image_url: string;
  style: string | null;
  color: string | null;
  difficulty: string | null;
};

type DifficultyFilter = "all" | "easy" | "medium" | "hard";

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [lang, setLang] = useState<Language>("vi");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TechProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");

  const t = translations[lang] as any;

  useEffect(() => {
    const load = async () => {
      const { data: profileData } = await supabase
        .from("tech_profiles")
        .select("user_id, username, display_name, avatar_url, bio, instagram_url, tiktok_url, facebook_url, is_public, verified")
        .eq("username", username)
        .eq("is_public", true)
        .maybeSingle();

      if (!profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData as TechProfile);

      supabase.rpc("increment_profile_views", { p_username: username });

      const { data: portfolioData } = await supabase
        .from("portfolio")
        .select("id, image_url, style, color, difficulty")
        .eq("user_id", profileData.user_id)
        .order("created_at", { ascending: false });

      setPortfolio(portfolioData || []);
      setLoading(false);
    };

    load();
  }, [username]);

  const filteredPortfolio = portfolio.filter((item) => {
    if (difficultyFilter === "all") return true;
    return item.difficulty === difficultyFilter;
  });

  const handlePickDesign = (imageUrl: string) => {
    if (!profile) return;
    const url = `/?salon=${profile.user_id}&designImage=${encodeURIComponent(imageUrl)}`;
    window.location.href = url;
  };

  if (loading) {
    return (
      <main style={{ padding: "40px 20px", fontFamily: "Arial, sans-serif" }}>
        <p>Loading... / Đang tải...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main style={{ padding: "48px 20px", fontFamily: "var(--font-body)", textAlign: "center" }}>
        <p style={{ color: "var(--foreground-soft)" }}>{t.uNotFoundOrPrivate}</p>
      </main>
    );
  }

  const filterOptions: { id: DifficultyFilter; label: string }[] = [
    { id: "all", label: t.uFilterAll },
    { id: "easy", label: t.uFilterEasy },
    { id: "medium", label: t.uFilterMedium },
    { id: "hard", label: t.uFilterHard },
  ];

  return (
    <main
      style={{
        padding: "48px 20px",
        fontFamily: "var(--font-body)",
        maxWidth: "640px",
        margin: "0 auto",
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

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <div
          style={{
            width: "96px",
            height: "96px",
            borderRadius: "50%",
            background: "var(--accent-soft)",
            margin: "0 auto",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.display_name || profile.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: "32px" }}>🙂</span>
          )}
        </div>

        <h1 style={{ fontSize: "24px", marginTop: "14px" }}>
          {profile.display_name || profile.username}
          {profile.verified && <span style={{ color: "var(--accent)", marginLeft: "6px" }}>✓</span>}
        </h1>

        {profile.bio && (
          <p style={{ color: "var(--foreground-soft)", marginTop: "6px", fontSize: "14px" }}>{profile.bio}</p>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: "14px", marginTop: "16px" }}>
          {profile.instagram_url && (
            <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" style={socialLinkStyle}>
              Instagram
            </a>
          )}
          {profile.tiktok_url && (
            <a href={profile.tiktok_url} target="_blank" rel="noopener noreferrer" style={socialLinkStyle}>
              TikTok
            </a>
          )}
          {profile.facebook_url && (
            <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer" style={socialLinkStyle}>
              Facebook
            </a>
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <button
          type="button"
          onClick={() => {
            window.location.href = `/?salon=${profile.user_id}`;
          }}
          style={{
            padding: "14px 28px",
            borderRadius: "999px",
            border: "none",
            background: "var(--accent)",
            color: "white",
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(255,45,120,0.3)",
          }}
        >
          {lang === "vi" ? "Thử mẫu của tôi ngay" : "Try my designs now"}
        </button>
      </div>

      <h2 style={{ marginTop: "40px", fontSize: "18px" }}>{t.uPortfolioHeading}</h2>

      {portfolio.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDifficultyFilter(opt.id)}
              style={{
                padding: "6px 14px",
                borderRadius: "999px",
                fontSize: "13px",
                cursor: "pointer",
                border:
                  difficultyFilter === opt.id
                    ? "2px solid var(--accent)"
                    : "1px solid var(--border)",
                background: difficultyFilter === opt.id ? "var(--accent-soft)" : "var(--surface)",
                color: "var(--foreground)",
                fontWeight: difficultyFilter === opt.id ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <p style={{ fontSize: "12px", color: "var(--foreground-soft)", marginTop: "10px" }}>
        {lang === "vi" ? "Bấm vào 1 ảnh để mang mẫu đó về thử trên tay bạn." : "Tap a photo to bring that design home and try it on your hand."}
      </p>

      {filteredPortfolio.length === 0 ? (
        <p style={{ color: "var(--foreground-soft)", marginTop: "10px" }}>{t.uNoPortfolio}</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          {filteredPortfolio.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handlePickDesign(item.image_url)}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url}
                alt="Portfolio"
                style={{ width: "100%", display: "block", objectFit: "cover", aspectRatio: "1 / 1" }}
              />
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

const socialLinkStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: "999px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--foreground)",
  fontSize: "13px",
  textDecoration: "none",
};