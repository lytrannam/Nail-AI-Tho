"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

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

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [service, setService] = useState("");
  const [notes, setNotes] = useState("");

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
        console.error("Lỗi Supabase:", error.message, error.details, error.hint);
      } else {
        setAppointments(data || []);
      }

      setLoading(false);
    };

    load();
  }, [customerId]);

  const addAppointment = async () => {
    if (!customerId) {
      alert("Thiếu thông tin khách hàng — vui lòng mở trang này từ hồ sơ khách.");
      return;
    }
    if (!date || !time) {
      alert("Vui lòng chọn ngày và giờ hẹn.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Bạn cần đăng nhập.");
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
      alert("Không thể lưu lịch hẹn.");
      return;
    }

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
    setNotes("");
    alert("Đã đặt lịch hẹn.");
  };

  if (loading) {
    return <main style={{ padding: "30px" }}>Đang tải lịch hẹn...</main>;
  }

  return (
    <main style={{ padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <h1>Lịch hẹn</h1>
      {customer && (
        <p>
          Đặt lịch cho: <strong>{customer.name}</strong>
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
          <h3>Đặt lịch hẹn mới</h3>

          <label style={{ display: "block", marginBottom: "10px" }}>
            Ngày
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: "100%", padding: "10px", marginTop: "4px" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "10px" }}>
            Giờ
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ width: "100%", padding: "10px", marginTop: "4px" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "10px" }}>
            Dịch vụ
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="Ví dụ: Sơn gel, đắp bột..."
              style={{ width: "100%", padding: "10px", marginTop: "4px" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "10px" }}>
            Ghi chú
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
            {saving ? "Đang lưu..." : "Lưu lịch hẹn"}
          </button>
        </div>
      )}

      {appointments.length === 0 ? (
        <p>Chưa có lịch hẹn.</p>
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
            <strong>{appointment.service || "Dịch vụ nail"}</strong>
            <p>
              {new Date(appointment.appointments_at).toLocaleString("vi-VN")}
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
    <Suspense fallback={<main style={{ padding: "30px" }}>Đang tải...</main>}>
      <AppointmentsContent />
    </Suspense>
  );
}