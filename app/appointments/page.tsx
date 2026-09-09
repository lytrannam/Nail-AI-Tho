"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";

type Appointment = {
  id: number;
  customer_id: number;
  appointments_at: string;
  service: string | null;
  notes: string | null;
};

type CustomerBrief = {
  id: number;
  name: string;
  phone: string | null;
};

function AppointmentsContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customer, setCustomer] = useState<CustomerBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<Language>("vi");

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [service, setService] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const t = translations[lang];

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      if (customerId) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("id, name, phone")
          .eq("id", customerId)
          .single();

        if (customerData) setCustomer(customerData);
      }

      let query = supabase
        .from("appointments")
        .select("id, customer_id, appointments_at, service, notes")
        .eq("user_id", user.id)
        .order("appointments_at", { ascending: true });

      if (customerId) {
        query = query.eq("customer_id", customerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error:", error.message, error.details, error.hint);
      } else {
        setAppointments(data || []);
      }

      setLoading(false);
    };

    load();
  }, [customerId]);

  const addAppointment = async () => {
    if (!customerId) {
      alert(t.apptMissingCustomer);
      return;
    }
    if (!date || !time) {
      alert(t.apptMissingDateTime);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert(t.apptLoginRequired);
      return;
    }

    setSaving(true);

    const appointmentsAt = new Date(`${date}T${time}`).toISOString();

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        customer_id: Number(customerId),
        user_id: user.id,
        appointments_at: appointmentsAt,
        service: service.trim() || null,
        notes: notes.trim() || null,
      })
      .select("id, customer_id, appointments_at, service, notes")
      .single();

    setSaving(false);

    if (error) {
      console.error(error);
      alert(t.apptSaveError);
      return;
    }

    // New booking = a new visit → allow a fresh trial, generate a new access token
    const newToken =
      Math.random().toString(36).slice(2) + Date.now().toString(36);

    const { data: currentCustomer } = await supabase
      .from("customers")
      .select("visit_count, total_spent")
      .eq("id", Number(customerId))
      .single();

    const newVisitCount = (currentCustomer?.visit_count || 0) + 1;
    const newTotalSpent =
      (currentCustomer?.total_spent || 0) + (Number(price) || 0);

    await supabase
      .from("customers")
      .update({
        all_design_images: null,
        selected_design_image: null,
        selected_design: null,
        tryon_used: false,
        session_token: newToken,
        visit_count: newVisitCount,
        total_spent: newTotalSpent,
      })
      .eq("id", Number(customerId));

    setAppointments((prev) =>
      [...prev, data].sort(
        (a, b) =>
          new Date(a.appointments_at).getTime() -
          new Date(b.appointments_at).getTime()
      )
    );
    setDate("");
    setTime("");
    setService("");
    setPrice("");
    setNotes("");
    alert(t.apptSavedSuccess);
  };

  if (loading) {
    return <main style={{ padding: "30px" }}>{t.apptLoading}</main>;
  }

  return (
    <main
      style={{ padding: "30px", fontFamily: "Arial, sans-serif", position: "relative" }}
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

      <h1>{t.apptTitle}</h1>
      {customer && (
        <p>
          {t.apptBookingFor}
          <strong>{customer.name}</strong>
          {customer.phone ? ` — ${customer.phone}` : ""}
        </p>
      )}

      {customerId && (
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "16px",
            marginBottom: "25px",
            maxWidth: "500px",
          }}
        >
          <h3>{t.apptNewTitle}</h3>

          <label style={{ display: "block", marginBottom: "10px" }}>
            {t.apptDateLabel}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: "100%", padding: "10px", marginTop: "4px" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "10px" }}>
            {t.apptTimeLabel}
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ width: "100%", padding: "10px", marginTop: "4px" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "10px" }}>
            {t.apptServiceLabel}
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder={t.apptServicePlaceholder}
              style={{ width: "100%", padding: "10px", marginTop: "4px" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: "10px" }}>
            {t.apptPriceLabel}
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={t.apptPricePlaceholder}
              style={{ width: "100%", padding: "10px", marginTop: "4px" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "10px" }}>
            {t.apptNotesLabel}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: "10px", marginTop: "4px" }}
            />
          </label>

          <button
            type="button"
            onClick={addAppointment}
            disabled={saving}
            style={{ padding: "12px 20px", cursor: "pointer", fontWeight: "bold" }}
          >
            {saving ? t.apptSaving : t.apptSaveButton}
          </button>
        </div>
      )}

      {appointments.length === 0 ? (
        <p>{t.apptNoAppointments}</p>
      ) : (
        appointments.map((appointment) => (
          <div
            key={appointment.id}
            style={{
              padding: "15px",
              marginBottom: "12px",
              border: "1px solid #ddd",
              borderRadius: "10px",
            }}
          >
            <strong>{appointment.service || t.apptDefaultService}</strong>
            <p>
              {new Date(appointment.appointments_at).toLocaleString(
                lang === "vi" ? "vi-VN" : "en-US"
              )}
            </p>
            {appointment.notes && <p>{appointment.notes}</p>}
          </div>
        ))
      )}
    </main>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<main style={{ padding: "30px" }}>Loading...</main>}>
      <AppointmentsContent />
    </Suspense>
  );
}