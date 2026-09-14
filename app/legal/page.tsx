"use client";

import { useState } from "react";

type Lang = "vi" | "en";

const CONTENT_VI = {
  title: "Điều khoản sử dụng & Quyền riêng tư",
  updated: "Cập nhật lần cuối: Tháng 9, 2026",
  intro:
    "AL Nail AI hiện đang trong giai đoạn thử nghiệm. Trang này giải thích đơn giản, dễ hiểu về cách chúng tôi sử dụng thông tin của bạn.",
  sections: [
    {
      title: "Chúng tôi thu thập gì?",
      body: "Ảnh bàn tay bạn tải lên hoặc chụp qua camera; tên, số điện thoại, email (nếu bạn cung cấp); ảnh Portfolio do thợ tải lên.",
    },
    {
      title: "Chúng tôi dùng thông tin đó để làm gì?",
      body: "Ảnh tay được gửi tới OpenAI (bên thứ ba cung cấp công nghệ AI) để phân tích và tạo mẫu nail thử nghiệm. Thông tin liên hệ được lưu để thợ/tiệm liên lạc, nhắc lịch quay lại, và lưu lịch sử mẫu bạn đã chọn.",
    },
    {
      title: "Chúng tôi KHÔNG làm gì?",
      body: "Chúng tôi không bán thông tin của bạn cho bên thứ ba, không dùng cho mục đích quảng cáo ngoài phạm vi app.",
    },
    {
      title: "Bạn có quyền gì?",
      body: "Bạn có thể yêu cầu xóa dữ liệu của mình bất cứ lúc nào bằng cách liên hệ email bên dưới.",
    },
    {
      title: "Lưu ý về kết quả AI",
      body: "Đây là công cụ xem thử, mang tính minh họa. Màu sắc/kết quả thực tế khi làm nail có thể chênh lệch nhẹ so với ảnh AI tạo ra, tùy sơn/vật liệu tiệm đang có.",
    },
    {
      title: "Liên hệ",
      body: "Mọi thắc mắc về dữ liệu, vui lòng liên hệ: lytrannam82@gmail.com",
    },
  ],
};

const CONTENT_EN = {
  title: "Terms of Use & Privacy",
  updated: "Last updated: September 2026",
  intro:
    "AL Nail AI is currently in a testing phase. This page explains, in plain language, how we handle your information.",
  sections: [
    {
      title: "What we collect",
      body: "Hand photos you upload or capture via camera; your name, phone number, email (if provided); portfolio photos uploaded by techs.",
    },
    {
      title: "How we use it",
      body: "Hand photos are sent to OpenAI (a third-party AI provider) to analyze and generate preview nail designs. Contact information is stored so the tech/salon can reach you, send reminders, and keep a history of designs you've chosen.",
    },
    {
      title: "What we don't do",
      body: "We do not sell your information to third parties or use it for advertising outside the app.",
    },
    {
      title: "Your rights",
      body: "You can request deletion of your data at any time by contacting the email below.",
    },
    {
      title: "About AI results",
      body: "This is a preview/illustration tool. Actual nail results may differ slightly from the AI-generated image depending on the salon's available products.",
    },
    {
      title: "Contact",
      body: "For any data questions, please contact: lytrannam82@gmail.com",
    },
  ],
};

export default function LegalPage() {
  const [lang, setLang] = useState<Lang>("vi");
  const content = lang === "vi" ? CONTENT_VI : CONTENT_EN;

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
        🌐 {lang === "vi" ? "English" : "Tiếng Việt"}
      </button>

      <h1 style={{ fontSize: "26px", marginTop: "20px" }}>{content.title}</h1>
      <p style={{ color: "var(--foreground-soft)", fontSize: "13px", marginTop: "6px" }}>
        {content.updated}
      </p>
      <p style={{ color: "var(--foreground-soft)", marginTop: "16px", lineHeight: "1.6" }}>
        {content.intro}
      </p>

      <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {content.sections.map((s, i) => (
          <div
            key={i}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "18px 20px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >
            <h2 style={{ fontSize: "16px", marginBottom: "6px" }}>{s.title}</h2>
            <p style={{ fontSize: "14px", color: "var(--foreground-soft)", lineHeight: "1.6", margin: 0 }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: "12px", color: "var(--foreground-soft)", marginTop: "28px", fontStyle: "italic" }}>
        {lang === "vi"
          ? "Lưu ý: đây là bản rút gọn cho giai đoạn thử nghiệm, không thay thế tư vấn pháp lý chuyên nghiệp."
          : "Note: this is a simplified version for the testing phase, not a substitute for professional legal advice."}
      </p>
    </main>
  );
}