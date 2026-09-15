"use client";

import { useState } from "react";

type Lang = "vi" | "en";

const SECTIONS_VI = [
  {
    title: "0. Đăng ký & Dùng thử",
    text: "Tạo tài khoản bằng email + mật khẩu tại trang Đăng nhập. Sau khi đăng ký, kiểm tra email (cả mục Spam) để xác nhận trước khi đăng nhập lần đầu. Hiện app đang trong giai đoạn thử nghiệm miễn phí hoàn toàn. Xem trang Nâng cấp để biết các gói dự kiến trong tương lai.",
  },
  {
    title: "1. Khách của tôi",
    text: "Lưu tên, số điện thoại, email khách. Bấm vào tên khách để xem chi tiết lịch sử làm nail. Hệ thống tự nhắc khi khách quá 3 tuần chưa quay lại.",
  },
  {
    title: "2. Portfolio",
    text: "Tải ảnh những bộ nail bạn đã làm lên đây. AI sẽ tự phân loại theo tông da và độ khó, giúp gợi ý đúng mẫu cho khách mới sau này. Có thể bấm 'Chia sẻ' trên mỗi ảnh để đăng lên mạng xã hội (tự thêm mã QR + watermark).",
  },
  {
    title: "3. Hồ sơ cá nhân",
    text: "Đặt tên hiển thị, ảnh đại diện, link mạng xã hội. Bật 'Công khai' để có 1 trang cá nhân + mã QR riêng cho khách quét vào xem toàn bộ Portfolio của bạn.",
  },
  {
    title: "4. Live Camera Try-On",
    text: "Đưa tay khách vào camera, chọn 1 trong các màu/kiểu có sẵn để xem thử ngay lập tức (không tốn phí). Khi khách ưng ý, bấm 'Chọn mẫu này, làm ảnh đẹp' để AI tạo 1 ảnh thật đẹp, chân thực.",
  },
  {
    title: "5. Trang chủ (khách tự chọn mẫu)",
    text: "Khách tự chụp tay, AI gợi ý 4 mẫu phù hợp tông da. Khách chọn 1 mẫu và có thể thử lên tay tối đa 2 lần để so sánh trước khi quyết định.",
  },
  {
    title: "6. Mời thợ mới",
    text: "Vào mục 'Mã QR mời thợ' để lấy mã QR in dán tại tiệm. Mỗi thợ quét mã sẽ tự tạo tài khoản riêng của mình (không dùng chung tài khoản).",
  },
];

const SECTIONS_EN = [
  {
    title: "0. Sign Up & Free Trial",
    text: "Create an account with email + password on the Sign In page. After registering, check your email (including Spam) to confirm before your first login. The app is currently in a completely free testing phase. See the Pricing page for planned future plans.",
  },
  {
    title: "1. My Customers",
    text: "Store customer names, phone numbers, and emails. Tap a name to view their visit history. The app automatically flags customers who haven't returned in 3+ weeks.",
  },
  {
    title: "2. Portfolio",
    text: "Upload photos of nails you've done. AI automatically tags them by skin tone and difficulty, helping suggest the right designs to new customers later. Tap 'Share' on any photo to post it on social media (auto-adds a QR code + watermark).",
  },
  {
    title: "3. Profile",
    text: "Set your display name, avatar, and social links. Turn on 'Public' to get your own profile page + QR code for customers to scan and browse your full portfolio.",
  },
  {
    title: "4. Live Camera Try-On",
    text: "Point the camera at the customer's hand and pick from the available colors/styles to preview instantly (no cost). Once they like one, tap 'Pick this design, make it pretty' to generate one polished, realistic AI photo.",
  },
  {
    title: "5. Home page (customer self-service)",
    text: "Customers photograph their own hand and AI suggests 4 designs matching their skin tone. They can try up to 2 designs on their hand to compare before deciding.",
  },
  {
    title: "6. Invite new techs",
    text: "Go to 'Invite QR' to get a printable QR code for your salon. Any tech who scans it creates their own independent account (no shared accounts).",
  },
];

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export default function HelpPage() {
  const [lang, setLang] = useState<Lang>("vi");
  const sections = lang === "vi" ? SECTIONS_VI : SECTIONS_EN;

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);

  const askQuestion = async () => {
    const q = question.trim();
    if (!q || asking) return;

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setAsking(true);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, lang }),
      });
      const data = await res.json();

      const answer =
        data.answer ||
        data.error ||
        (lang === "vi" ? "Không thể trả lời lúc này." : "Could not answer right now.");

      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: lang === "vi" ? "Có lỗi xảy ra, thử lại nhé." : "Something went wrong, try again.",
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

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

      <h1 style={{ fontSize: "30px", marginTop: "20px" }}>
        {lang === "vi" ? "❓ Trợ giúp & Hướng dẫn" : "❓ Help & Support"}
      </h1>
      <p style={{ color: "var(--foreground-soft)", marginTop: "8px" }}>
        {lang === "vi"
          ? "Tổng quan các tính năng chính của AL Nail AI."
          : "Overview of AL Nail AI's main features."}
      </p>

      {/* KHUNG CHAT AI */}
      <div
        style={{
          marginTop: "28px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "18px",
          padding: "20px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
        }}
      >
        <h2 style={{ fontSize: "16px", marginBottom: "10px" }}>
          🤖 {lang === "vi" ? "Hỏi trợ lý AI" : "Ask the AI assistant"}
        </h2>

        {messages.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: "14px",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  background: m.role === "user" ? "var(--accent)" : "var(--background)",
                  color: m.role === "user" ? "white" : "var(--foreground)",
                }}
              >
                {m.text}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") askQuestion();
            }}
            placeholder={
              lang === "vi" ? "Ví dụ: Sao camera không mở được?" : "e.g. Why won't the camera open?"
            }
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "999px",
              border: "1px solid var(--border)",
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            onClick={askQuestion}
            disabled={asking}
            style={{
              padding: "10px 18px",
              borderRadius: "999px",
              border: "none",
              background: "var(--accent)",
              color: "white",
              fontWeight: 600,
              cursor: asking ? "not-allowed" : "pointer",
              opacity: asking ? 0.6 : 1,
              fontSize: "13px",
            }}
          >
            {asking ? (lang === "vi" ? "..." : "...") : lang === "vi" ? "Hỏi" : "Ask"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {sections.map((s, i) => (
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
              {s.text}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "28px",
          padding: "18px 20px",
          borderRadius: "16px",
          background: "var(--accent-soft)",
          fontSize: "14px",
          color: "var(--foreground)",
        }}
      >
        {lang === "vi"
          ? "AI trả lời không giải quyết được vấn đề? Liên hệ trực tiếp: lytrannam82@gmail.com"
          : "AI couldn't solve it? Contact us directly: lytrannam82@gmail.com"}
      </div>
    </main>
  );
}