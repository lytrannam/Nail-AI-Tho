"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";

type Mode = "login" | "signup";

// Danh sach cac ten mien email "dung 1 lan" pho bien nhat, hay bi loi dung
// de tao nhieu tai khoan ao lach gioi han dung thu. Danh sach nay khong the
// day du 100%, nhung chan duoc phan lon truong hop de gap nhat.
const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "throwawaymail.com",
  "getnada.com",
  "trashmail.com",
  "sharklasers.com",
  "fakeinbox.com",
  "maildrop.cc",
];

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [lang, setLang] = useState<Language>("vi");

  const t = translations[lang];

  const login = async () => {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/customers");
  };

  const signUp = async () => {
    setError("");

    // Chan email dung 1 lan NGAY TU DAU, truoc khi goi Supabase - tiet kiem
    // 1 luot goi API khong can thiet, va bao loi ngay lap tuc cho nguoi dung.
    if (isDisposableEmail(email)) {
      setError(
        lang === "vi"
          ? "Vui lòng dùng địa chỉ email thật (không dùng email tạm thời)."
          : "Please use a real email address (temporary/disposable emails are not allowed)."
      );
      return;
    }

    setLoading(true);
    setSignupSuccess(false);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSignupSuccess(true);
  };

  const handleSubmit = () => {
    if (mode === "login") {
      login();
    } else {
      signUp();
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setSignupSuccess(false);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
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

      <div
        style={{
          maxWidth: "400px",
          width: "100%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "22px",
          padding: "36px 30px",
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "6px" }}>💅</div>
        <h1 style={{ fontSize: "24px" }}>{t.appTitle}</h1>
        <h2 style={{ fontSize: "16px", fontWeight: 500, color: "var(--foreground-soft)", marginTop: "6px", marginBottom: "24px" }}>
          {mode === "login" ? t.loginHeading : t.loginSignupHeading}
        </h2>

        {signupSuccess ? (
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "14px",
              background: "var(--accent-soft)",
              color: "var(--foreground)",
              fontSize: "14px",
              lineHeight: "1.6",
              marginBottom: "16px",
            }}
          >
            {t.loginSignupSuccessMessage}
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder={t.loginEmailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                marginBottom: "12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                boxSizing: "border-box",
              }}
            />

            <input
              type="password"
              placeholder={t.loginPasswordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                marginBottom: "18px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                boxSizing: "border-box",
              }}
            />

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                cursor: "pointer",
                borderRadius: "999px",
                border: "none",
                background: "var(--accent)",
                color: "white",
                fontWeight: 600,
                fontSize: "16px",
                boxShadow: "0 4px 14px rgba(255,45,120,0.3)",
              }}
            >
              {mode === "login"
                ? loading
                  ? t.loginLoggingIn
                  : t.loginButton
                : loading
                ? t.loginSigningUp
                : t.loginSignupButton}
            </button>

            {error && (
              <p style={{ marginTop: "16px", color: "var(--accent-dark)", fontSize: "14px" }}>
                {error}
              </p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={switchMode}
          style={{
            marginTop: "20px",
            background: "none",
            border: "none",
            color: "var(--accent)",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {mode === "login" ? t.loginSwitchToSignup : t.loginSwitchToLogin}
        </button>
      </div>
    </main>
  );
}