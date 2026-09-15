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

export default function HelpPage() {
  const [lang, setLang] = useState<Lang>("vi");
  const sections = lang === "vi" ? SECTIONS_VI : SECTIONS_EN;

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
          ? "Cần hỗ trợ thêm? Liên hệ trực tiếp qua email đã đăng ký tài khoản."
          : "Need more help? Contact us via the email you used to sign up."}
      </div>
    </main>
  );
}