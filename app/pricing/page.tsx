"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

type Lang = "vi" | "en";
type PlanId = "individual" | "salon";

export default function PricingPage() {
  const [lang, setLang] = useState<Lang>("vi");
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const openForm = (plan: PlanId) => {
    setSelectedPlan(plan);
    setSubmitted(false);
    setError("");
  };

  const submitInterest = async () => {
    if (!email.trim()) {
      setError(lang === "vi" ? "Vui lòng nhập email." : "Please enter your email.");
      return;
    }

    setSubmitting(true);
    setError("");

    const { data: userData } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from("pricing_interest").insert({
      email: email.trim(),
      phone: phone.trim() || null,
      plan_interested: selectedPlan,
      user_id: userData?.user?.id || null,
    });

    setSubmitting(false);

    if (insertError) {
      console.error(insertError);
      setError(lang === "vi" ? "Có lỗi xảy ra, thử lại nhé." : "Something went wrong, please try again.");
      return;
    }

    setSubmitted(true);
  };

  const individualFeatures =
    lang === "vi"
      ? [
          "Live Camera Try-On không giới hạn",
          "Portfolio không giới hạn ảnh",
          "Trang cá nhân công khai + mã QR",
          "Chia sẻ ảnh có watermark + QR",
          "Dashboard số liệu (lượt xem, khách mới)",
          "Dùng thử 14 ngày, tối đa 30 ảnh AI Final",
        ]
      : [
          "Unlimited Live Camera Try-On",
          "Unlimited Portfolio photos",
          "Public profile page + QR code",
          "Share photos with watermark + QR",
          "Dashboard stats (views, new customers)",
          "14-day free trial, up to 30 AI Final images",
        ];

  const salonFeatures =
    lang === "vi"
      ? [
          "Tất cả tính năng của gói Thợ cá nhân",
          "Giá ưu đãi hơn khi đăng ký nhiều thợ",
          "Quản lý nhiều thợ trong 1 tiệm (đang phát triển)",
          "Ưu tiên hỗ trợ",
        ]
      : [
          "Everything in the Individual plan",
          "Discounted rate per tech for multiple signups",
          "Manage multiple techs under one salon (in development)",
          "Priority support",
        ];

  return (
    <main
      style={{
        padding: "48px 20px",
        fontFamily: "var(--font-body)",
        position: "relative",
        maxWidth: "900px",
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

      <div style={{ textAlign: "center", marginTop: "24px", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "30px" }}>
          {lang === "vi" ? "Gói dịch vụ" : "Plans & Pricing"}
        </h1>
        <p style={{ color: "var(--foreground-soft)", marginTop: "8px" }}>
          {lang === "vi"
            ? "Chúng tôi đang trong giai đoạn thử nghiệm. Đăng ký quan tâm để được ưu tiên khi ra mắt chính thức."
            : "We're currently in testing phase. Register your interest to get priority access at launch."}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
        }}
      >
        {/* GOI THO CA NHAN */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            padding: "28px 24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ fontSize: "18px" }}>{lang === "vi" ? "Thợ cá nhân" : "Individual Tech"}</h2>
          <div style={{ fontSize: "34px", fontWeight: 700, marginTop: "8px", color: "var(--accent)" }}>
            $9.99
            <span style={{ fontSize: "15px", fontWeight: 400, color: "var(--foreground-soft)" }}>
              {lang === "vi" ? "/tháng" : "/month"}
            </span>
          </div>

          <ul style={{ marginTop: "20px", paddingLeft: "20px", fontSize: "14px", lineHeight: "1.9", color: "var(--foreground)" }}>
            {individualFeatures.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => openForm("individual")}
            style={{
              marginTop: "20px",
              width: "100%",
              padding: "14px 0",
              borderRadius: "999px",
              border: "none",
              background: "var(--accent)",
              color: "white",
              fontWeight: 600,
              fontSize: "15px",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(255,45,120,0.3)",
            }}
          >
            {lang === "vi" ? "Đăng ký quan tâm" : "Register Interest"}
          </button>
        </div>

        {/* GOI SALON */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            padding: "28px 24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ fontSize: "18px" }}>{lang === "vi" ? "Salon nhiều thợ" : "Salon (Multi-Tech)"}</h2>
          <div style={{ fontSize: "34px", fontWeight: 700, marginTop: "8px", color: "var(--accent)" }}>
            $6.99–7.99
            <span style={{ fontSize: "15px", fontWeight: 400, color: "var(--foreground-soft)" }}>
              {lang === "vi" ? "/thợ/tháng" : "/tech/month"}
            </span>
          </div>

          <ul style={{ marginTop: "20px", paddingLeft: "20px", fontSize: "14px", lineHeight: "1.9", color: "var(--foreground)" }}>
            {salonFeatures.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => openForm("salon")}
            style={{
              marginTop: "20px",
              width: "100%",
              padding: "14px 0",
              borderRadius: "999px",
              border: "1px solid var(--accent)",
              background: "transparent",
              color: "var(--accent)",
              fontWeight: 600,
              fontSize: "15px",
              cursor: "pointer",
            }}
          >
            {lang === "vi" ? "Đăng ký quan tâm" : "Register Interest"}
          </button>
        </div>
      </div>

      {selectedPlan && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
          onClick={() => setSelectedPlan(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              borderRadius: "20px",
              padding: "28px",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
          >
            {submitted ? (
              <>
                <h3 style={{ fontSize: "18px" }}>
                  {lang === "vi" ? "Cảm ơn bạn!" : "Thank you!"}
                </h3>
                <p style={{ color: "var(--foreground-soft)", marginTop: "10px", fontSize: "14px" }}>
                  {lang === "vi"
                    ? "Chúng tôi đã ghi nhận sự quan tâm của bạn. Sẽ liên hệ khi có gói chính thức."
                    : "We've noted your interest. We'll reach out when the official plan launches."}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  style={{
                    marginTop: "16px",
                    width: "100%",
                    padding: "12px 0",
                    borderRadius: "999px",
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                    cursor: "pointer",
                  }}
                >
                  {lang === "vi" ? "Đóng" : "Close"}
                </button>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: "18px" }}>
                  {lang === "vi" ? "Đăng ký quan tâm" : "Register Interest"}
                </h3>
                <p style={{ color: "var(--foreground-soft)", fontSize: "13px", marginTop: "6px" }}>
                  {selectedPlan === "individual"
                    ? lang === "vi" ? "Gói Thợ cá nhân" : "Individual Tech plan"
                    : lang === "vi" ? "Gói Salon nhiều thợ" : "Salon plan"}
                </p>

                <input
                  type="email"
                  placeholder={lang === "vi" ? "Email của bạn" : "Your email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    marginTop: "16px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="tel"
                  placeholder={lang === "vi" ? "Số điện thoại (không bắt buộc)" : "Phone (optional)"}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    marginTop: "10px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    boxSizing: "border-box",
                  }}
                />

                {error && (
                  <p style={{ color: "#c0392b", fontSize: "13px", marginTop: "10px" }}>{error}</p>
                )}

                <button
                  type="button"
                  onClick={submitInterest}
                  disabled={submitting}
                  style={{
                    marginTop: "16px",
                    width: "100%",
                    padding: "14px 0",
                    borderRadius: "999px",
                    border: "none",
                    background: "var(--accent)",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {submitting
                    ? lang === "vi" ? "Đang gửi..." : "Submitting..."
                    : lang === "vi" ? "Gửi" : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  style={{
                    marginTop: "8px",
                    width: "100%",
                    padding: "10px 0",
                    borderRadius: "999px",
                    border: "none",
                    background: "transparent",
                    color: "var(--foreground-soft)",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  {lang === "vi" ? "Hủy" : "Cancel"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}