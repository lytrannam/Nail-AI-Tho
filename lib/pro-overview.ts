"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type ProCustomer = { id: number; name: string; created_at: string | null; last_visit: string | null; selected_design: string | null };
type Appointment = { id: number; customer_id: number; appointments_at: string; service: string | null };
type Profile = { display_name: string | null; username: string; is_public: boolean; profile_views: number | null };
type Overview = { customers: ProCustomer[] | null; portfolio: number | null; profile: Profile | null; profileLoaded: boolean; appointments: Appointment[] | null; appointmentsThisMonth: number | null; failed: boolean };
const empty: Overview = { customers: null, portfolio: null, profile: null, profileLoaded: false, appointments: null, appointmentsThisMonth: null, failed: false };
export async function readProCustomers(userId: string): Promise<ProCustomer[]> {
  const rows: ProCustomer[] = [];
  // Supabase limits a response to 1,000 rows by default. Fetch every page for accurate totals.
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from("customers").select("id, name, created_at, last_visit, selected_design").eq("user_id", userId).order("id").range(start, start + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}
export function useProOverview(userId: string) {
  const [data, setData] = useState<Overview>(empty);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    async function load() {
      const results = await Promise.allSettled([
        readProCustomers(userId),
        supabase.from("portfolio").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("tech_profiles").select("display_name, username, is_public, profile_views").eq("user_id", userId).maybeSingle(),
        supabase.from("appointments").select("id, customer_id, appointments_at, service").eq("user_id", userId).gte("appointments_at", now.toISOString()).order("appointments_at").limit(5),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("appointments_at", start).lt("appointments_at", end),
      ]);
      if (!active) return;
      const [customers, portfolio, profile, appointments, count] = results;
      setData({
        customers: customers.status === "fulfilled" ? customers.value : null,
        portfolio: portfolio.status === "fulfilled" && !portfolio.value.error ? portfolio.value.count : null,
        profile: profile.status === "fulfilled" && !profile.value.error ? profile.value.data : null,
        profileLoaded: profile.status === "fulfilled" && !profile.value.error,
        appointments: appointments.status === "fulfilled" && !appointments.value.error ? appointments.value.data : null,
        appointmentsThisMonth: count.status === "fulfilled" && !count.value.error ? count.value.count : null,
        failed: results.some(r => r.status === "rejected" || (!Array.isArray(r.value) && !!r.value.error)),
      });
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [userId, attempt]);
  return { ...data, loading, reload: () => { setLoading(true); setAttempt(x => x + 1); } };
}
