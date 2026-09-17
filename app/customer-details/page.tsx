"use client";

import { useProLanguage } from "../../lib/pro-language";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { translations } from "../../lib/translations";

type CustomerData = {
  id: string;
  name: string;
  phone: string;
  nail_history: string | null;
};

function CustomerDetailsContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("id");
  const [lang, setLang] = useProLanguage();

  const [customer, setCustomer] = useState<CustomerData | null>(null);

  const [nailHistory, setNailHistory] = useState("");
  const [newNailHistory, setNewNailHistory] = useState("");
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState("");
  const [selectedDesignImage, setSelectedDesignImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const t = translations[lang];

  useEffect(() => {
    const loadCustomer = async () => {
      if (!customerId) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert(t.cdSessionExpired);
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, nail_history, selected_design, selected_design_image, last_visit, session_token")
        .eq("id", customerId)
        .single();

      if (error) {
        alert(t.cdLoadError.replace("{error}", error.message));
        return;
      }

      if (data) {
        setCustomer(data);
        setNailHistory(data.nail_history || "");
        setSelectedDesign(data.selected_design || "");
        setSelectedDesignImage(data.selected_design_image || null);
        setLastVisit(data.last_visit || null);
        setSessionToken(data.session_token || null);
      }
    };

    loadCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const saveNailHistory = async () => {
    if (!customerId) return;

    setSaving(true);

    const { error } = await supabase
      .from("customers")
      .update({
        nail_history: newNailHistory
          ? `${nailHistory}\n${new Date().toLocaleDateString()} - ${newNailHistory}`.trim()
          : nailHistory,
        last_visit: new Date().toISOString(),
      })
      .eq("id", customerId);

    setSaving(false);

    if (error) {
      alert(t.cdSaveHistoryError);
      return;
    }

    alert(t.cdSaveHistorySuccess);
    const updatedHistory = newNailHistory
      ? `${nailHistory}\n${new Date().toLocaleDateString()} - ${newNailHistory}`.trim()
      : nailHistory;

    setNailHistory(updatedHistory);
    setNewNailHistory("");
    setLastVisit(new Date().toISOString());
  };

  return (
    <main className="pro-legacy"
      style={{
        padding: "48px 20px",
        fontFamily: "var(--font-body)",
        position: "relative",
        maxWidth: "700px",
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

      <h1 style={{ fontSize: "28px" }}>{t.cdTitle}</h1>

      {!customer ? (
        <p style={{ color: "var(--foreground-soft)", marginTop: "16px" }}>{t.cdLoading}</p>
      ) : (
        <div>
          <h2 style={{ fontSize: "22px", marginTop: "20px" }}>{customer.name}</h2>
          {lastVisit && (
            <p style={{ color: "var(--foreground-soft)", marginTop: "6px" }}>
              {t.cdLastVisit}
              {new Date(lastVisit).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US")}
            </p>
          )}
          <p style={{ color: "var(--foreground-soft)" }}>
            {t.cdPhone}
            {customer.phone || t.cdNoPhone}
          </p>

          <div
            style={{
              marginTop: "22px",
              marginBottom: "22px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              padding: "20px",
            }}
          >
            <h3 style={{ fontSize: "17px" }}>{t.cdSelectedDesignTitle}</h3>
            <p style={{ color: "var(--foreground-soft)", marginTop: "6px" }}>
              {selectedDesign || t.cdNoDesignSelected}
            </p>
            {selectedDesignImage && (
              <img
                src={selectedDesignImage}
                alt={t.cdSelectedDesignTitle}
                style={{
                  width: "220px",
                  maxWidth: "100%",
                  marginTop: "12px",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                }}
              />
            )}
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={!sessionToken}
              onClick={() => {
                window.location.href = `/?token=${sessionToken}`;
              }}
              style={{
                padding: "14px 22px",
                cursor: "pointer",
                borderRadius: "999px",
                border: "none",
                background: "var(--accent)",
                color: "white",
                fontWeight: 600,
              }}
            >
              {t.cdOpenAiButton}
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = `/appointments?customerId=${customerId}`;
              }}
              style={{
                padding: "14px 22px",
                cursor: "pointer",
                borderRadius: "999px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontWeight: 600,
              }}
            >
              {t.cdBookButton}
            </button>
          </div>

          <h3 style={{ fontSize: "18px", marginTop: "32px" }}>{t.cdHistoryTitle}</h3>
          {nailHistory && (
            <p style={{ whiteSpace: "pre-line", color: "var(--foreground)" }}>{nailHistory}</p>
          )}

          <textarea
            value={newNailHistory}
            onChange={(e) => setNewNailHistory(e.target.value)}
            placeholder={t.cdHistoryPlaceholder}
            rows={6}
            style={{
              width: "100%",
              maxWidth: "600px",
              padding: "14px",
              boxSizing: "border-box",
              borderRadius: "12px",
              border: "1px solid var(--border)",
            }}
          />

          <div style={{ marginTop: "14px" }}>
            <button
              type="button"
              onClick={saveNailHistory}
              disabled={saving}
              style={{
                padding: "12px 22px",
                cursor: "pointer",
                fontWeight: 600,
                borderRadius: "999px",
                border: "none",
                background: "var(--accent)",
                color: "white",
              }}
            >
              {saving ? t.cdSaving : t.cdSaveHistoryButton}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CustomerDetailsPage() {
  return (
    <Suspense fallback={<main className="pro-legacy" style={{ padding: "40px 20px" }}>Loading...</main>}>
      <CustomerDetailsContent />
    </Suspense>
  );
}