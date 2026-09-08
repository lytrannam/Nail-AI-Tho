"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoyaltySettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [visitsRequired, setVisitsRequired] = useState(5);
  const [amountRequired, setAmountRequired] = useState(150);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setEnabled(data.enabled);
        setVisitsRequired(data.visits_required);
        setAmountRequired(data.amount_required);
        setDiscountPercent(data.discount_percent);
      }
      setLoading(false);
    };

    loadSettings();
  }, []);

  const saveSettings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setSaving(true);

    const { error } = await supabase.from("loyalty_settings").upsert({
      user_id: user.id,
      enabled,
      visits_required: visitsRequired,
      amount_required: amountRequired,
      discount_percent: discountPercent,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Không thể lưu cài đặt.");
      return;
    }

    alert("Đã lưu cài đặt điểm thưởng.");
  };

  if (loading) {
    return <main style={{ padding: "30px" }}>Đang tải...</main>;
  }

  return (
    <main style={{ padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <button
        type="button"
        onClick={() => {
          window.location.href = "/customers";
        }}
        style={{ padding: "10px 16px", marginBottom: "20px", cursor: "pointer" }}
      >
        ← Quay lại danh sách khách
      </button>

      <h1>Cài đặt điểm thưởng</h1>

      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "16px",
          marginTop: "20px",
          maxWidth: "450px",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: "20px", height: "20px" }}
          />
          <span style={{ fontWeight: "bold" }}>Bật chương trình điểm thưởng</span>
        </label>

        {enabled && (
          <>
            <p style={{ color: "#666", marginBottom: "15px" }}>
              Khách đạt <strong>1 trong 2</strong> điều kiện dưới đây sẽ được giảm giá:
            </p>

            <label style={{ display: "block", marginBottom: "12px" }}>
              Số lần ghé cần đạt
              <input
                type="number"
                value={visitsRequired}
                onChange={(e) => setVisitsRequired(Number(e.target.value))}
                style={{ width: "100%", padding: "10px", marginTop: "4px" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: "12px" }}>
              Hoặc tổng chi tiêu cần đạt ($)
              <input
                type="number"
                value={amountRequired}
                onChange={(e) => setAmountRequired(Number(e.target.value))}
                style={{ width: "100%", padding: "10px", marginTop: "4px" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: "12px" }}>
              Phần trăm giảm giá (%)
              <input
                type="number"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                style={{ width: "100%", padding: "10px", marginTop: "4px" }}
              />
            </label>
          </>
        )}

        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          style={{
            padding: "12px 20px",
            cursor: "pointer",
            fontWeight: "bold",
            marginTop: "10px",
          }}
        >
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
      </div>
    </main>
  );
}