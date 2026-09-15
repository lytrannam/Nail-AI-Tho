"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

type Lang = "vi" | "en";

export default function InvitePage() {
  const [lang, setLang] = useState<Lang>("vi");
  const [loginUrl, setLoginUrl] = useState("");

  useEffect(() => {
    // Lay dung domain hien tai (localhost luc test, hoac domain that luc deploy)
    setLoginUrl(`${window.location.origin}/login`);
  }, []);

  return (
    <main
      style={{
        padding: "48px 20px",
        fontFamily: "var(--font-body)",
        position: "relative",
        maxWidth: "480px",
        margin: "0 auto",
        textAlign: "center",
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
        🌐 {lang === "vi" ? "English" : "Tiếng Việt"}
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

      <div style={{ fontSize: "40px", marginTop: "24px" }}>💅</div>
      <h1 style={{ fontSize: "24px", marginTop: "8px" }}>AL Nail AI</h1>
      <p style={{ color: "var(--foreground-soft)", marginTop: "10px", lineHeight: "1.6" }}>
        {lang === "vi"
          ? "In mã QR này ra dán ở tiệm. Bất kỳ thợ nào quét vào cũng sẽ mở thẳng trang đăng ký tài khoản riêng của họ."
          : "Print this QR code and post it at your salon. Any tech who scans it will go straight to their own account sign-up page."}
      </p>

      {loginUrl && (
        <div
          style={{
            marginTop: "28px",
            padding: "24px",
            background: "white",
            borderRadius: "20px",
            display: "inline-block",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <QRCodeSVG value={loginUrl} size={220} />
        </div>
      )}

      <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--foreground-soft)" }}>
        {loginUrl}
      </p>

      <div
        style={{
          marginTop: "28px",
          padding: "16px 18px",
          borderRadius: "14px",
          background: "var(--accent-soft)",
          fontSize: "13px",
          color: "var(--foreground)",
          textAlign: "left",
          lineHeight: "1.7",
        }}
      >
        {lang === "vi" ? (
          <>
            <strong>Lưu ý:</strong> Mỗi thợ cần tự tạo tài khoản riêng (email + mật khẩu
            của họ). Đây không phải mã QR "dùng chung" — mỗi người quét vào sẽ tự đăng
            ký tài khoản độc lập của mình.
          </>
        ) : (
          <>
            <strong>Note:</strong> Each tech needs to create their own account (their
            own email + password). This is not a "shared" QR code — everyone who scans
            it registers their own independent account.
          </>
        )}
      </div>
    </main>
  );
}