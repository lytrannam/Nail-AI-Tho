"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../../lib/supabase";


export default function QrPage() {
  const qrRef = useRef<HTMLDivElement>(null);
const [salonUrl, setSalonUrl] = useState("");

useEffect(() => {
  setSalonUrl(window.location.origin);
}, []);

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "ma-qr-tiem-nail.png";
    link.click();
  };

  return (
    <main
      style={{
        padding: "30px",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
      }}
    >
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
        ← Quay lại danh sách khách
      </button>

      <h1>Mã QR cho tiệm</h1>
      <p>In mã này ra và dán tại quầy để khách quét vào app.</p>

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
        <QRCodeCanvas value={salonUrl} size={220} />
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
          ⬇️ Tải mã QR về
        </button>
      </div>

      <p style={{ marginTop: "20px", color: "#666" }}>
        Link đang trỏ tới: {salonUrl}
      </p>
    </main>
  );
}