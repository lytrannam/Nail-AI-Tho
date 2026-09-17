"use client";

import { useProLanguage } from "../../lib/pro-language";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { translations } from "../../lib/translations";

export default function LoyaltySettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [visitsRequired, setVisitsRequired] = useState(5);
  const [amountRequired, setAmountRequired] = useState(150);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useProLanguage();

  const t = translations[lang];

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
      alert(t.lsSaveError);
      return;
    }

    alert(t.lsSaveSuccess);
  };

  if (loading) {
    return (
      <main className="pro-legacy" style={{ padding: "40px 20px", color: "var(--foreground-soft)" }}>
        {t.lsLoading}
      </main>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    boxSizing: "border-box",
  };

  return (
    <main className="pro-legacy"
      style={{
        padding: "48px 20px",
        fontFamily: "var(--font-body)",
        position: "relative",
        maxWidth: "550px",
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
        🌐 {t.switchLang}
      </button>

      <button
        type="button"
        onClick={() => {
          window.location.href = "/customers";
        }}
        style={{
          padding: "10px 18px",
          marginBottom: "20px",
          cursor: "pointer",
          borderRadius: "999px",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
          fontSize: "14px",
        }}
      >
        {t.smBack}
      </button>

      <h1 style={{ fontSize: "26px" }}>{t.lsTitle}</h1>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "24px",
          borderRadius: "20px",
          marginTop: "22px",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: "20px", height: "20px", accentColor: "var(--accent)" }}
          />
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{t.lsEnableLabel}</span>
        </label>

        {enabled && (
          <>
            <p style={{ color: "var(--foreground-soft)", marginBottom: "16px", fontSize: "14px" }}>
              {t.lsConditionNote}
            </p>

            <label style={{ display: "block", marginBottom: "14px", fontSize: "14px", color: "var(--foreground)" }}>
              {t.lsVisitsLabel}
              <input
                type="number"
                value={visitsRequired}
                onChange={(e) => setVisitsRequired(Number(e.target.value))}
                style={inputStyle}
              />
            </label>

            <label style={{ display: "block", marginBottom: "14px", fontSize: "14px", color: "var(--foreground)" }}>
              {t.lsAmountLabel}
              <input
                type="number"
                value={amountRequired}
                onChange={(e) => setAmountRequired(Number(e.target.value))}
                style={inputStyle}
              />
            </label>

            <label style={{ display: "block", marginBottom: "14px", fontSize: "14px", color: "var(--foreground)" }}>
              {t.lsDiscountLabel}
              <input
                type="number"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
          </>
        )}

        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          style={{
            padding: "12px 22px",
            cursor: "pointer",
            fontWeight: 600,
            marginTop: "10px",
            borderRadius: "999px",
            border: "none",
            background: "var(--accent)",
            color: "white",
          }}
        >
          {saving ? t.lsSaving : t.lsSaveButton}
        </button>
      </div>
    </main>
  );
}