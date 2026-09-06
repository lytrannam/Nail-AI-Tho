"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

function StaffLoginContent() {
  const searchParams = useSearchParams();
  const salonId = searchParams.get("salon");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  const handleClear = () => {
    setPin("");
    setError("");
  };

  const handleLogin = async (fullPin: string) => {
    if (!salonId) {
      setError("Thiếu thông tin tiệm. Vui lòng quét lại mã QR.");
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("staff")
      .select("id, name, is_active")
      .eq("user_id", salonId)
      .eq("pin_code", fullPin)
      .single();

    setLoading(false);

    if (fetchError || !data) {
      setError("Mã PIN không đúng.");
      setPin("");
      return;
    }

    if (!data.is_active) {
      setError("Tài khoản đã bị khóa. Liên hệ chủ tiệm.");
      setPin("");
      return;
    }

    // Lưu thông tin thợ vào trình duyệt để dùng ở trang tiếp theo
    sessionStorage.setItem("staff_id", String(data.id));
    sessionStorage.setItem("staff_name", data.name);
    sessionStorage.setItem("salon_id", salonId);

    window.location.href = "/staff-work";
  };

  // Tự động đăng nhập khi đủ 4 số
  if (pin.length === 4 && !loading) {
    handleLogin(pin);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
        background: "#fafafa",
        padding: "20px",
      }}
    >
      <div style={{ fontSize: "48px", marginBottom: "10px" }}>💅</div>
      <h1 style={{ marginBottom: "30px" }}>Nhập mã PIN của bạn</h1>

      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: "50px",
              height: "60px",
              border: "2px solid #333",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
            }}
          >
            {pin[i] ? "●" : ""}
          </div>
        ))}
      </div>

      {error && (
        <p style={{ color: "red", fontSize: "18px", marginBottom: "10px" }}>
          {error}
        </p>
      )}

      {loading && <p style={{ fontSize: "18px" }}>Đang kiểm tra...</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "14px",
          marginTop: "20px",
        }}
      >
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            style={{
              width: "80px",
              height: "80px",
              fontSize: "32px",
              borderRadius: "50%",
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer",
            }}
          >
            {digit}
          </button>
        ))}
        <div />
        <button
          type="button"
          onClick={() => handleDigit("0")}
          style={{
            width: "80px",
            height: "80px",
            fontSize: "32px",
            borderRadius: "50%",
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
          }}
        >
          0
        </button>
        <button
          type="button"
          onClick={handleClear}
          style={{
            width: "80px",
            height: "80px",
            fontSize: "20px",
            borderRadius: "50%",
            border: "1px solid #ccc",
            background: "#eee",
            cursor: "pointer",
          }}
        >
          Xóa
        </button>
      </div>
    </main>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<main style={{ padding: "40px" }}>Đang tải...</main>}>
      <StaffLoginContent />
    </Suspense>
  );
}