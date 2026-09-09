"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";

export default function StaffQrPage() {
  const qrRef = useRef<HTMLDivElement>(null);
  const [staffUrl, setStaffUrl] = useState("");
  const [lang, setLang] = useState<Language>("vi");

  const t = translations[lang];

  useEffect(() => {
    const buildUrl = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setStaffUrl(`${window.location.origin}/staff-login?salon=${user.id}`);
      }
    };
    buildUrl();
  }, []);

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "ma-qr-thoi.png";
    link.click();
  };

  return (
    <main
      style={{
        padding: "48px 20px",
        fontFamily: "var(--font-body)",
        textAlign: "center",
        position: "relative",
        maxWidth: "600px",
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
          padding: "10px 18px",
          marginBottom: "20px",
          cursor: "pointer",
          borderRadius: "999px",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
          fontSize: "14px",
        }}
      >
        {t.smBack}
      </button>

      <h1 style={{ fontSize: "26px" }}>{t.sqTitle}</h1>
      <p
        style={{
          color: "var(--accent-dark)",
          fontWeight: 600,
          marginTop: "10px",
          fontSize: "14px",
        }}
      >
        {t.sqWarning}
      </p>

      <div
        ref={qrRef}
        style={{
          display: "inline-block",
          padding: "24px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          marginTop: "22px",
        }}
      >
        {staffUrl && <QRCodeCanvas value={staffUrl} size={220} />}
      </div>

      <div style={{ marginTop: "22px" }}>
        <button
          type="button"
          onClick={downloadQr}
          style={{
            padding: "14px 24px",
            cursor: "pointer",
            fontWeight: 600,
            borderRadius: "999px",
            border: "none",
            background: "var(--accent)",
            color: "white",
          }}
        >
          {t.sqDownloadButton}
        </button>
      </div>

      <p
        style={{
          marginTop: "22px",
          color: "var(--foreground-soft)",
          wordBreak: "break-all",
          fontSize: "13px",
        }}
      >
        {t.sqLinkLabel.replace("{url}", staffUrl)}
      </p>
    </main>
  );
}