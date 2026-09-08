"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../../lib/supabase";

export default function StaffQrPage() {
  const qrRef = useRef<HTMLDivElement>(null);
  const [staffUrl, setStaffUrl] = useState("");

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

      <h1>Mã QR cho thợ</h1>
      <p style={{ color: "#c0392b", fontWeight: "bold" }}>
        ⚠️ Không dán mã này ở khu vực khách nhìn thấy. Chỉ để trong khu vực làm việc của thợ.
      </p>

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
          ⬇️ Tải mã QR về
        </button>
      </div>

      <p style={{ marginTop: "20px", color: "#666", wordBreak: "break-all" }}>
        Link đang trỏ tới: {staffUrl}
      </p>
    </main>
  );
}