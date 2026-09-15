"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  last_visit?: string | null;
  selected_design_image?: string | null;
  all_design_images?: string[] | null;
  created_at?: string | null;
};

const navButtonStyle: React.CSSProperties = {
  padding: "10px 18px",
  cursor: "pointer",
  borderRadius: "999px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--foreground)",
  fontSize: "14px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

// Lay dung header Authorization tu phien dang nhap hien tai, de gui kem
// moi lan goi API can xac minh danh tinh (vd: send-reminder)
async function getAuthHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return {};

  return { Authorization: `Bearer ${session.access_token}` };
}

export default function CustomersPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [showRemindersOnly, setShowRemindersOnly] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [lang, setLang] = useState<Language>("vi");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profileViews, setProfileViews] = useState<number | null>(null);

  const t = translations[lang];

  useEffect(() => {
    const loadCustomers = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, name, phone, email, last_visit, selected_design_image, all_design_images, created_at"
        )
        .eq("user_id", user.id);

      if (!error && data) {
        setCustomers(data);
      }

      const { data: profileData } = await supabase
        .from("tech_profiles")
        .select("profile_views")
        .eq("user_id", user.id)
        .maybeSingle();

      setProfileViews(profileData?.profile_views ?? 0);
    };

    loadCustomers();
  }, []);

  const addCustomer = async () => {
    if (!name.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert(t.custLoginRequired);
      return;
    }
    const newToken =
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        user_id: user.id,
        session_token: newToken,
      })
      .select("id, name, phone, email, created_at")
      .single();

    if (error) {
      console.error(error);
      alert(t.custSaveError);
      return;
    }

    setCustomers([...customers, data]);
    setName("");
    setPhone("");
    setEmail("");
  };

  const filteredCustomers = customers
    .filter((customer) => {
      const keyword = search.toLowerCase().trim();

      const matchesSearch =
        customer.name.toLowerCase().includes(keyword) ||
        (customer.phone ?? "").includes(keyword) ||
        (customer.email ?? "").toLowerCase().includes(keyword);

      const needsReminder =
        !!customer.last_visit &&
        Date.now() - new Date(customer.last_visit).getTime() >
          21 * 24 * 60 * 60 * 1000;

      return matchesSearch && (!showRemindersOnly || needsReminder);
    })
    .sort((a, b) => {
      const timeA = a.last_visit ? new Date(a.last_visit).getTime() : 0;
      const timeB = b.last_visit ? new Date(b.last_visit).getTime() : 0;
      return timeB - timeA;
    });

  const reminderCount = customers.filter((customer) => {
    if (!customer.last_visit) return false;
    return (
      Date.now() - new Date(customer.last_visit).getTime() >
      21 * 24 * 60 * 60 * 1000
    );
  }).length;

  const newCustomersCount = customers.filter((customer) => {
    if (!customer.created_at) return false;
    return (
      Date.now() - new Date(customer.created_at).getTime() <=
      30 * 24 * 60 * 60 * 1000
    );
  }).length;

  const sendReminderToAll = async () => {
    const customersToRemind = customers.filter((customer) => {
      const needsReminder =
        !!customer.last_visit &&
        Date.now() - new Date(customer.last_visit).getTime() >
          21 * 24 * 60 * 60 * 1000;
      return needsReminder && customer.email;
    });

    if (customersToRemind.length === 0) {
      alert(t.custNoReminderNeeded);
      return;
    }

    setSendingAll(true);
    let successCount = 0;

    const authHeader = await getAuthHeader();

    for (const customer of customersToRemind) {
      try {
        // CHI gui customerId - server se tu tra cuu email/ten/anh that,
        // khong tin bat ky du lieu nao khac tu trinh duyet nua.
        const res = await fetch("/api/send-reminder", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ customerId: customer.id }),
        });
        const data = await res.json();
        if (!data.error) successCount++;
      } catch (error) {
        console.error(error);
      }
    }

    setSendingAll(false);
    alert(
      t.custReminderSentSummary
        .replace("{success}", String(successCount))
        .replace("{total}", String(customersToRemind.length))
    );
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 20px",
        fontFamily: "var(--font-body)",
        position: "relative",
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

      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "30px" }}>{t.custPageTitle}</h1>
        <p style={{ color: "var(--foreground-soft)", marginTop: "6px" }}>{t.custPageSubtitle}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px",
            marginTop: "20px",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "14px 10px",
              textAlign: "center",
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--accent)" }}>
              {profileViews ?? "—"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--foreground-soft)", marginTop: "4px" }}>
              {lang === "vi" ? "Lượt xem hồ sơ" : "Profile Views"}
            </div>
          </div>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "14px 10px",
              textAlign: "center",
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--accent)" }}>
              {customers.length}
            </div>
            <div style={{ fontSize: "12px", color: "var(--foreground-soft)", marginTop: "4px" }}>
              {lang === "vi" ? "Tổng khách" : "Total Customers"}
            </div>
          </div>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "14px 10px",
              textAlign: "center",
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--accent)" }}>
              {newCustomersCount}
            </div>
            <div style={{ fontSize: "12px", color: "var(--foreground-soft)", marginTop: "4px" }}>
              {lang === "vi" ? "Khách mới (30 ngày)" : "New (30 days)"}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginTop: "20px",
            marginBottom: "10px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              window.location.href = "/stats";
            }}
            style={navButtonStyle}
          >
            📊 {t.custViewStats}
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/portfolio";
            }}
            style={navButtonStyle}
          >
            🖼️ {t.custPortfolioNav}
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/profile";
            }}
            style={navButtonStyle}
          >
            👤 {t.custProfileNav}
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/help";
            }}
            style={navButtonStyle}
          >
            ❓ {lang === "vi" ? "Trợ giúp" : "Help"}
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/pricing";
            }}
            style={navButtonStyle}
          >
            💎 {lang === "vi" ? "Nâng cấp" : "Upgrade"}
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/invite";
            }}
            style={navButtonStyle}
          >
            🖨️ {lang === "vi" ? "Mã QR mời thợ" : "Invite QR"}
          </button>
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "22px",
            borderRadius: "18px",
            marginTop: "28px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.custNamePlaceholder}
            style={{
              width: "100%",
              padding: "12px 14px",
              marginBottom: "12px",
              boxSizing: "border-box",
              borderRadius: "10px",
              border: "1px solid var(--border)",
            }}
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.custPhonePlaceholder}
            style={{
              width: "100%",
              padding: "12px 14px",
              marginBottom: "12px",
              boxSizing: "border-box",
              borderRadius: "10px",
              border: "1px solid var(--border)",
            }}
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.custEmailPlaceholder}
            style={{
              width: "100%",
              padding: "12px 14px",
              marginBottom: "12px",
              boxSizing: "border-box",
              borderRadius: "10px",
              border: "1px solid var(--border)",
            }}
          />

          <button
            type="button"
            onClick={addCustomer}
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
            {t.custAddButton}
          </button>
        </div>

        <div style={{ marginTop: "36px" }}>
          <h2 style={{ fontSize: "22px" }}>{t.custListTitle}</h2>
          <p style={{ color: "var(--foreground-soft)" }}>{t.custTotalLabel.replace("{n}", String(customers.length))}</p>

          <div
            onClick={() => setShowRemindersOnly(!showRemindersOnly)}
            style={{ fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}
          >
            {t.custReminderLabel.replace("{n}", String(reminderCount))}
            {showRemindersOnly && (
              <div style={{ fontWeight: "normal", fontSize: "0.9em", color: "var(--foreground-soft)" }}>
                {t.custFilteringNote}
              </div>
            )}
          </div>

          {reminderCount > 0 && (
            <button
              type="button"
              onClick={sendReminderToAll}
              disabled={sendingAll}
              style={{
                marginTop: "10px",
                padding: "10px 18px",
                cursor: "pointer",
                fontWeight: 600,
                borderRadius: "999px",
                border: "1px solid var(--gold)",
                background: "transparent",
                color: "var(--gold)",
              }}
            >
              {sendingAll
                ? t.custSendingAll
                : t.custSendReminderAll.replace("{n}", String(reminderCount))}
            </button>
          )}

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.custSearchPlaceholder}
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "10px 14px",
              marginTop: "14px",
              marginBottom: "20px",
              border: "1px solid var(--border)",
              borderRadius: "999px",
              background: "var(--surface)",
            }}
          />

          {filteredCustomers.length === 0 ? (
            <p>{t.custNoCustomers}</p>
          ) : (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  padding: "16px 18px",
                  borderRadius: "16px",
                  marginBottom: "10px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/customer-details?id=${customer.id}`;
                  }}
                >
                  <strong>{customer.name}</strong>
                </button>

                <div>
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                  ) : (
                    t.custNoPhone
                  )}
                </div>

                {customer.phone && (
                  <a
                    href={`sms:${customer.phone}`}
                    style={{ display: "inline-block", marginTop: "6px" }}
                  >
                    {t.custMessage}
                  </a>
                )}

                <div>
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`}>{customer.email}</a>
                  ) : (
                    t.custNoEmail
                  )}
                </div>

                {customer.email && (
                  <button
                    type="button"
                    onClick={async () => {
                      const authHeader = await getAuthHeader();
                      // CHI gui customerId - server se tu tra cuu email/ten/anh that
                      const res = await fetch("/api/send-reminder", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...authHeader },
                        body: JSON.stringify({ customerId: customer.id }),
                      });
                      const data = await res.json();
                      if (data.error) {
                        alert(t.custReminderError.replace("{error}", data.error));
                      } else {
                        alert(t.custReminderSentOne.replace("{name}", customer.name));
                      }
                    }}
                    style={{
                      marginTop: "8px",
                      padding: "8px 16px",
                      cursor: "pointer",
                      display: "inline-block",
                      borderRadius: "999px",
                      border: "1px solid var(--accent)",
                      background: "transparent",
                      color: "var(--accent)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {t.custSendReminder}
                  </button>
                )}

                <div>
                  {t.custLastVisit}
                  {customer.last_visit
                    ? new Date(customer.last_visit).toLocaleDateString(
                        lang === "vi" ? "vi-VN" : "en-US"
                      )
                    : t.custNever}
                  {customer.last_visit &&
                    Date.now() - new Date(customer.last_visit).getTime() >
                      21 * 24 * 60 * 60 * 1000 && (
                      <div style={{ color: "var(--accent-dark)", fontWeight: 600, marginTop: "4px" }}>{t.custOverdueWarning}</div>
                    )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}