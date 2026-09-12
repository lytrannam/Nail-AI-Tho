"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { QRCodeSVG } from "qrcode.react";
import { translations, Language } from "../../lib/translations";

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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function ProfilePage() {
  const [lang, setLang] = useState<Language>("vi");
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [verified, setVerified] = useState(false);

  const t = translations[lang] as any;

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

      const { data, error } = await supabase
        .from("tech_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
      }

      if (data) {
        const profile = data as TechProfile;
        setUsername(profile.username || "");
        setDisplayName(profile.display_name || "");
        setAvatarUrl(profile.avatar_url);
        setBio(profile.bio || "");
        setInstagramUrl(profile.instagram_url || "");
        setTiktokUrl(profile.tiktok_url || "");
        setFacebookUrl(profile.facebook_url || "");
        setIsPublic(profile.is_public);
        setVerified(profile.verified);
      } else {
        const emailPrefix = user.email?.split("@")[0] || "";
        setUsername(slugify(emailPrefix));
      }

      setLoading(false);
    };

    init();
  }, []);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setErrorMsg("");

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { uploadImage } = await import("../../lib/uploadImage");
      const url = await uploadImage(base64);
      if (url) setAvatarUrl(url);
    } catch (err) {
      console.error(err);
      setErrorMsg(t.profileAvatarError);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    const cleanUsername = slugify(username);
    if (!cleanUsername) {
      setErrorMsg(t.profileUsernameRequired);
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMsg("");

    const { error } = await supabase.from("tech_profiles").upsert(
      {
        user_id: userId,
        username: cleanUsername,
        display_name: displayName || null,
        avatar_url: avatarUrl,
        bio: bio || null,
        instagram_url: instagramUrl || null,
        tiktok_url: tiktokUrl || null,
        facebook_url: facebookUrl || null,
        is_public: isPublic,
      },
      { onConflict: "user_id" }
    );

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        setErrorMsg(t.profileUsernameTaken);
      } else {
        console.error(error);
        setErrorMsg(t.profileSaveError);
      }
      return;
    }

    setUsername(cleanUsername);
    setMessage(t.profileSavedMessage);
  };

  if (!authChecked || loading) {
    return (
      <main style={{ padding: "40px 20px", fontFamily: "Arial, sans-serif" }}>
        <p>Loading... / Đang tải...</p>
      </main>
    );
  }

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/u/${slugify(username)}`
      : "";

  return (
    <main
      style={{
        padding: "48px 20px",
        fontFamily: "var(--font-body)",
        position: "relative",
        maxWidth: "640px",
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

      <h1 style={{ fontSize: "30px", marginTop: "20px" }}>{t.profileTitle}</h1>
      <p style={{ color: "var(--foreground-soft)", marginTop: "8px" }}>{t.profileSubtitle}</p>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "18px",
          padding: "24px",
          marginTop: "24px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "var(--accent-soft)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "24px" }}>🙂</span>
            )}
          </div>
          <div>
            <label
              style={{
                display: "inline-block",
                padding: "8px 16px",
                borderRadius: "999px",
                border: "1px solid var(--border)",
                background: "var(--background)",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              {avatarUploading ? t.profileUploading : t.profileChangeAvatar}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={avatarUploading}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>

        <div style={{ marginTop: "24px" }}>
          <label style={{ fontSize: "13px", color: "var(--foreground-soft)" }}>
            {t.profileDisplayNameLabel}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t.profileDisplayNamePlaceholder}
            style={inputStyle}
          />
        </div>

        <div style={{ marginTop: "16px" }}>
          <label style={{ fontSize: "13px", color: "var(--foreground-soft)" }}>
            {t.profileUsernameLabel}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ten-cua-ban"
            style={inputStyle}
          />
        </div>

        <div style={{ marginTop: "16px" }}>
          <label style={{ fontSize: "13px", color: "var(--foreground-soft)" }}>{t.profileBioLabel}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t.profileBioPlaceholder}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <h3 style={{ marginTop: "28px", fontSize: "16px" }}>{t.profileSocialHeading}</h3>
        <p style={{ fontSize: "12px", color: "var(--foreground-soft)", marginTop: "2px" }}>
          {t.profileSocialOptionalNote}
        </p>

        <div style={{ marginTop: "12px" }}>
          <label style={{ fontSize: "13px", color: "var(--foreground-soft)" }}>Instagram</label>
          <input
            type="text"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://instagram.com/..."
            style={inputStyle}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <label style={{ fontSize: "13px", color: "var(--foreground-soft)" }}>TikTok</label>
          <input
            type="text"
            value={tiktokUrl}
            onChange={(e) => setTiktokUrl(e.target.value)}
            placeholder="https://tiktok.com/@..."
            style={inputStyle}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <label style={{ fontSize: "13px", color: "var(--foreground-soft)" }}>Facebook</label>
          <input
            type="text"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            placeholder="https://facebook.com/..."
            style={inputStyle}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "16px 18px",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
        }}
      >
        <div>
          <div style={{ fontWeight: 600 }}>
            {isPublic ? t.profilePublicOn : t.profilePublicOff}
          </div>
          <div style={{ fontSize: "12px", color: "var(--foreground-soft)", marginTop: "2px" }}>
            {isPublic ? t.profilePublicOnDesc : t.profilePublicOffDesc}
          </div>
        </div>
        <label style={{ position: "relative", display: "inline-block", width: "46px", height: "26px" }}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "999px",
              background: isPublic ? "var(--accent)" : "#ccc",
              transition: "background 0.2s",
              cursor: "pointer",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: "3px",
              left: isPublic ? "23px" : "3px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "white",
              transition: "left 0.2s",
              pointerEvents: "none",
            }}
          />
        </label>
      </div>

      {username && isPublic && (
        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "12px", color: "var(--foreground-soft)" }}>
            {t.profileLinkPreview}: <strong>{publicUrl}</strong>
          </p>
          <div
            style={{
              marginTop: "12px",
              padding: "16px",
              background: "white",
              borderRadius: "12px",
              display: "inline-block",
              border: "1px solid var(--border)",
            }}
          >
            <QRCodeSVG value={publicUrl} size={140} />
          </div>
        </div>
      )}

      {verified && (
        <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--accent)" }}>
          ✓ {t.profileVerifiedBadge}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: "24px",
          width: "100%",
          padding: "14px 0",
          borderRadius: "12px",
          border: "none",
          background: "var(--accent)",
          color: "white",
          fontSize: "15px",
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
          boxShadow: "0 4px 14px rgba(255,45,120,0.3)",
        }}
      >
        {saving ? t.profileSaving : t.profileSaveButton}
      </button>

      {message && <p style={{ color: "var(--accent)", fontWeight: 600, marginTop: "12px" }}>{message}</p>}
      {errorMsg && <p style={{ color: "#c0392b", fontWeight: 600, marginTop: "12px" }}>{errorMsg}</p>}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "6px",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: "14px",
  fontFamily: "var(--font-body)",
};
