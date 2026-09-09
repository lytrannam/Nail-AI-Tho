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
        padding: "30px",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
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

      <button
        type="button"
        onClick={() => {
          window.location.href = "/customers";
        }}
        style={{
          padding: "10px 16px",
          marginBottom: "20px",
          cursor: "pointer",
        }}
      >
        {t.smBack}
      </button>

      <h1>{t.sqTitle}</h1>
      <p style={{ color: "#c0392b", fontWeight: "bold" }}>{t.sqWarning}</p>

      <div
        ref={qrRef}
        style={{
          display: "inline-block",
          padding: "20px",
          background: "white",
          borderRadius: "16px",
          marginTop: "20px",
        }}
      >
        {staffUrl && <QRCodeCanvas value={staffUrl} size={220} />}
      </div>

      <div style={{ marginTop: "20px" }}>
        <button
          type="button"
          onClick={downloadQr}
          style={{
            padding: "12px 20px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {t.sqDownloadButton}
        </button>
      </div>

      <p style={{ marginTop: "20px", color: "#666", wordBreak: "break-all" }}>
        {t.sqLinkLabel.replace("{url}", staffUrl)}
      </p>
    </main>
  );
}