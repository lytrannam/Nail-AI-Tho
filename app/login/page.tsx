"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "6px" }}>💅</div>
        <h1 style={{ fontSize: "24px" }}>{t.appTitle}</h1>
        <h2 style={{ fontSize: "16px", fontWeight: 500, color: "var(--foreground-soft)", marginTop: "6px", marginBottom: "24px" }}>
          {t.loginHeading}
        </h2>

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
          onClick={login}
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
          }}
        >
          {loading ? t.loginLoggingIn : t.loginButton}
        </button>

        {error && (
          <p style={{ marginTop: "16px", color: "var(--accent-dark)", fontSize: "14px" }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}