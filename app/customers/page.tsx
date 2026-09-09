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
};

export default function CustomersPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [showRemindersOnly, setShowRemindersOnly] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [lang, setLang] = useState<Language>("vi");
  const [customers, setCustomers] = useState<Customer[]>([]);

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
          "id, name, phone, email, last_visit, selected_design_image, all_design_images"
        )
        .eq("user_id", user.id);

      if (!error && data) {
        setCustomers(data);
      }
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
      .select("id, name, phone, email")
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

    for (const customer of customersToRemind) {
      try {
        const res = await fetch("/api/send-reminder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toEmail: customer.email,
            customerName: customer.name,
            oldDesignImage: customer.selected_design_image,
            newDesignImages: (customer.all_design_images || []).filter(
              (img) => img !== customer.selected_design_image
            ),
          }),
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
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
        background: "#fafafa",
        position: "relative",
      }}
    >
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

      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        <h1>{t.custPageTitle}</h1>
        <p>{t.custPageSubtitle}</p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/stats";
          }}
          style={{
            padding: "10px 16px",
            marginBottom: "10px",
            cursor: "pointer",
          }}
        >
          {t.custViewStats}
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/staff-manage";
          }}
          style={{
            padding: "10px 16px",
            marginBottom: "10px",
            marginLeft: "8px",
            cursor: "pointer",
          }}
        >
          {t.custManageStaff}
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/staff-qr";
          }}
          style={{
            padding: "10px 16px",
            marginBottom: "10px",
            marginLeft: "8px",
            cursor: "pointer",
          }}
        >
          {t.custStaffQr}
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/loyalty-settings";
          }}
          style={{
            padding: "10px 16px",
            marginBottom: "10px",
            marginLeft: "8px",
            cursor: "pointer",
          }}
        >
          {t.custLoyalty}
        </button>
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "16px",
            marginTop: "25px",
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.custNamePlaceholder}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.custPhonePlaceholder}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.custEmailPlaceholder}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />

          <button
            type="button"
            onClick={addCustomer}
            style={{
              padding: "12px 20px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {t.custAddButton}
          </button>
        </div>

        <div style={{ marginTop: "30px" }}>
          <h2>{t.custListTitle}</h2>
          <p>{t.custTotalLabel.replace("{n}", String(customers.length))}</p>

          <div
            onClick={() => setShowRemindersOnly(!showRemindersOnly)}
            style={{ fontWeight: "bold", cursor: "pointer" }}
          >
            {t.custReminderLabel.replace("{n}", String(reminderCount))}
            {showRemindersOnly && (
              <div style={{ fontWeight: "normal", fontSize: "0.9em" }}>
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
                padding: "10px 16px",
                cursor: "pointer",
                fontWeight: "bold",
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
              padding: "10px",
              marginTop: "10px",
              marginBottom: "20px",
              border: "1px solid #ccc",
              borderRadius: "8px",
            }}
          />

          {filteredCustomers.length === 0 ? (
            <p>{t.custNoCustomers}</p>
          ) : (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                style={{
                  background: "white",
                  padding: "15px",
                  borderRadius: "12px",
                  marginBottom: "10px",
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
                      const res = await fetch("/api/send-reminder", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          toEmail: customer.email,
                          customerName: customer.name,
                          oldDesignImage: customer.selected_design_image,
                          newDesignImages: (
                            customer.all_design_images || []
                          ).filter(
                            (img) => img !== customer.selected_design_image
                          ),
                        }),
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
                      padding: "8px 14px",
                      cursor: "pointer",
                      display: "block",
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
                      <div>{t.custOverdueWarning}</div>
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