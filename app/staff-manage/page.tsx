"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";

type Staff = {
  id: number;
  name: string;
  pin_code: string;
  is_active: boolean;
};

export default function StaffManagePage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Language>("vi");

  const t = translations[lang];

  const loadStaff = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("staff")
      .select("id, name, pin_code, is_active")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setStaffList(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addStaff = async () => {
    if (!name.trim()) {
      alert(t.smNameRequired);
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      alert(t.smPinInvalid);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert(t.smLoginRequired);
      return;
    }

    const { error } = await supabase.from("staff").insert({
      name: name.trim(),
      pin_code: pin,
      user_id: user.id,
    });

    if (error) {
      console.error(error);
      alert(t.smAddError);
      return;
    }

    setName("");
    setPin("");
    loadStaff();
  };

  const toggleActive = async (staff: Staff) => {
    const { error } = await supabase
      .from("staff")
      .update({ is_active: !staff.is_active })
      .eq("id", staff.id);

    if (error) {
      alert(t.smUpdateError);
      return;
    }

    loadStaff();
  };

  if (loading) {
    return (
      <main style={{ padding: "30px", color: "var(--foreground-soft)" }}>
        {t.smLoading}
      </main>
    );
  }

  return (
    <main
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

      <h1 style={{ fontSize: "28px" }}>{t.smTitle}</h1>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "22px",
          borderRadius: "18px",
          marginTop: "22px",
          maxWidth: "400px",
        }}
      >
        <h3 style={{ fontSize: "17px", marginBottom: "12px" }}>{t.smAddNewTitle}</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.smNamePlaceholder}
          style={{
            width: "100%",
            padding: "10px 12px",
            marginBottom: "10px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            boxSizing: "border-box",
          }}
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder={t.smPinPlaceholder}
          inputMode="numeric"
          style={{
            width: "100%",
            padding: "10px 12px",
            marginBottom: "10px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          onClick={addStaff}
          style={{
            padding: "10px 18px",
            cursor: "pointer",
            fontWeight: 600,
            borderRadius: "999px",
            border: "none",
            background: "var(--accent)",
            color: "white",
          }}
        >
          {t.smAddButton}
        </button>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h3 style={{ fontSize: "18px" }}>{t.smListTitle}</h3>
        {staffList.length === 0 ? (
          <p style={{ color: "var(--foreground-soft)" }}>{t.smNoStaff}</p>
        ) : (
          staffList.map((staff) => (
            <div
              key={staff.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                padding: "16px 18px",
                borderRadius: "16px",
                marginTop: "10px",
                maxWidth: "400px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: staff.is_active ? 1 : 0.55,
              }}
            >
              <div>
                <strong style={{ color: "var(--foreground)" }}>{staff.name}</strong>
                <div style={{ fontSize: "13px", color: "var(--foreground-soft)" }}>
                  {t.smPinLabel.replace("{pin}", staff.pin_code)}
                </div>
                <div style={{ fontSize: "13px", color: "var(--foreground-soft)" }}>
                  {staff.is_active ? t.smActiveStatus : t.smInactiveStatus}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(staff)}
                style={{
                  padding: "8px 14px",
                  cursor: "pointer",
                  borderRadius: "999px",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--foreground)",
                  fontSize: "13px",
                }}
              >
                {staff.is_active ? t.smMarkInactive : t.smReactivate}
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}