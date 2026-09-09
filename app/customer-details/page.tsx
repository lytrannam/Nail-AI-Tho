"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";

type CustomerData = {
  id: string;
  name: string;
  phone: string;
  nail_history: string | null;
};

function CustomerDetailsContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("id");
  const [lang, setLang] = useState<Language>("vi");

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
    <main style={{ padding: "40px 20px", fontFamily: "Arial", position: "relative" }}>
      <button
        type="button"
        onClick={() => setLang(lang === "en" ? "vi" : "en")}
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          padding: "8px 14px",
          cursor: "pointer",
          borderRadius: "8px",
          border: "1px solid #ccc",
          background: "white",
        }}
      >
        🌐 {t.switchLang}
      </button>

      <h1>{t.cdTitle}</h1>

      {!customer ? (
        <p>{t.cdLoading}</p>
      ) : (
        <div>
          <h2>{customer.name}</h2>
          {lastVisit && (
            <p>
              {t.cdLastVisit}
              {new Date(lastVisit).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US")}
            </p>
          )}
          <p>
            {t.cdPhone}
            {customer.phone || t.cdNoPhone}
          </p>
          <div style={{ marginTop: "20px", marginBottom: "20px" }}>
            <h3>{t.cdSelectedDesignTitle}</h3>
            <p>{selectedDesign || t.cdNoDesignSelected}</p>
            {selectedDesignImage && (
              <img
                src={selectedDesignImage}
                alt={t.cdSelectedDesignTitle}
                style={{
                  width: "220px",
                  maxWidth: "100%",
                  marginTop: "12px",
                  borderRadius: "12px",
                }}
              />
            )}
          </div>

          <button
            type="button"
            disabled={!sessionToken}
            onClick={() => {
              window.location.href = `/?token=${sessionToken}`;
            }}
            style={{
              padding: "12px 18px",
              marginTop: "20px",
              cursor: "pointer",
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
              padding: "12px 18px",
              marginTop: "10px",
              cursor: "pointer",
            }}
          >
            {t.cdBookButton}
          </button>

          <h3>{t.cdHistoryTitle}</h3>
          {nailHistory && (
            <p style={{ whiteSpace: "pre-line" }}>{nailHistory}</p>
          )}

          <textarea
            value={newNailHistory}
            onChange={(e) => setNewNailHistory(e.target.value)}
            placeholder={t.cdHistoryPlaceholder}
            rows={6}
            style={{
              width: "100%",
              maxWidth: "600px",
              padding: "12px",
              boxSizing: "border-box",
            }}
          />

          <div style={{ marginTop: "12px" }}>
            <button
              type="button"
              onClick={saveNailHistory}
              disabled={saving}
              style={{
                padding: "12px 20px",
                cursor: "pointer",
                fontWeight: "bold",
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
    <Suspense fallback={<main style={{ padding: "40px 20px" }}>Loading...</main>}>
      <CustomerDetailsContent />
    </Suspense>
  );
}