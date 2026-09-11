"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { translations, Language } from "../../../lib/translations";

type TechProfile = {
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
};

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [lang, setLang] = useState<Language>("vi");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TechProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  const t = translations[lang] as any;

  useEffect(() => {
    const load = async () => {
      const { data: profileData } = await supabase
        .from("tech_profiles")
        .select("username, display_name, avatar_url, bio, instagram_url, tiktok_url, facebook_url, is_public, verified")
        .eq("username", username)
        .eq("is_public", true)
        .maybeSingle();

      if (!profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData as TechProfile);

      const { data: portfolioData } = await supabase
        .from("portfolio")
        .select("id, image_url")
        .eq(
          "user_id",
          (
            await supabase
              .from("tech_profiles")
              .select("user_id")
              .eq("username", username)
              .single()
          ).data?.user_id
        )
        .order("created_at", { ascending: false });

      setPortfolio(portfolioData || []);
      setLoading(false);
    };

    load();
  }, [username]);

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

      <h2 style={{ marginTop: "40px", fontSize: "18px" }}>{t.uPortfolioHeading}</h2>

      {portfolio.length === 0 ? (
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
          {portfolio.map((item) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.id}
              src={item.image_url}
              alt="Portfolio"
              style={{ width: "100%", borderRadius: "12px", objectFit: "cover", aspectRatio: "1 / 1" }}
            />
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