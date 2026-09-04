"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Appointment = {
  id: number;
  customer_id: number;
  appointments_at: string;
  service: string | null;
  notes: string | null;
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAppointments = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("appointments")
        .select("id, customer_id, appointments_at, service, notes")
        .eq("user_id", user.id)
        .order("appointments_at", { ascending: true });

      if (error) {
        console.error(error);
      } else {
        setAppointments(data || []);
      }

      setLoading(false);
    };

    loadAppointments();
  }, []);

  if (loading) {
    return <main style={{ padding: "30px" }}>Đang tải lịch hẹn...</main>;
  }

  return (
    <main style={{ padding: "30px" }}>
      <h1>Lịch hẹn</h1>

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