"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [reminderCount, setReminderCount] = useState(0);
  const [appointmentsThisMonth, setAppointmentsThisMonth] = useState(0);
  const [topDesign, setTopDesign] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Tổng số khách + tính khách cần nhắc quay lại
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("id, last_visit, selected_design")
        .eq("user_id", user.id);

      if (!customersError && customers) {
        setTotalCustomers(customers.length);

        const needReminder = customers.filter((c) => {
          if (!c.last_visit) return false;
          return (
            Date.now() - new Date(c.last_visit).getTime() >
            21 * 24 * 60 * 60 * 1000
          );
        }).length;
        setReminderCount(needReminder);

        // Tìm mẫu nail được chọn nhiều nhất
        const designCounts: Record<string, number> = {};
        customers.forEach((c) => {
          if (c.selected_design) {
            designCounts[c.selected_design] =
              (designCounts[c.selected_design] || 0) + 1;
          }
        });

        const sortedDesigns = Object.entries(designCounts).sort(
          (a, b) => b[1] - a[1]
        );
        setTopDesign(sortedDesigns[0]?.[0] || null);
      }

      // Lịch hẹn trong tháng này
      const now = new Date();
      const firstDayOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toISOString();

      const { count, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("appointments_at", firstDayOfMonth);

      if (!appointmentsError && count !== null) {
        setAppointmentsThisMonth(count);
      }

      setLoading(false);
    };

    loadStats();
  }, []);

  if (loading) {
    return <main style={{ padding: "30px" }}>Đang tải thống kê...</main>;
  }

  return (
    <main style={{ padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <h1>Thống kê tiệm</h1>
      <button
  type="button"
  onClick={() => {
    window.location.href = "/customers";
  }}
  style={{
    padding: "10px 16px",
    marginBottom: "10px",
    cursor: "pointer",
  }}
>
  ← Quay lại danh sách khách
</button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginTop: "25px",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid #eee",
          }}
        >
          <div style={{ fontSize: "14px", color: "#666" }}>Tổng số khách</div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>
            {totalCustomers}
          </div>
        </div>

        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid #eee",
          }}
        >
          <div style={{ fontSize: "14px", color: "#666" }}>
            🔔 Khách cần nhắc quay lại
          </div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>
            {reminderCount}
          </div>
        </div>

        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid #eee",
          }}
        >
          <div style={{ fontSize: "14px", color: "#666" }}>
            Lịch hẹn tháng này
          </div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>
            {appointmentsThisMonth}
          </div>
        </div>

        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid #eee",
          }}
        >
          <div style={{ fontSize: "14px", color: "#666" }}>
            Mẫu được chọn nhiều nhất
          </div>
          <div style={{ fontSize: "22px", fontWeight: "bold" }}>
            {topDesign || "Chưa có dữ liệu"}
          </div>
        </div>
      </div>
    </main>
  );
}