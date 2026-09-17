export type MetricCustomer = { created_at: string | null; last_visit: string | null; selected_design: string | null };
export function calculateMetrics(customers: MetricCustomer[], days: 7 | 30, now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const buckets = Array.from({ length: days }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return { date, count: customers.filter(c => { const time = Date.parse(c.created_at || ""); return time >= date.getTime() && time < end.getTime(); }).length };
  });
  const ranking = new Map<string, number>();
  for (const c of customers) if (c.selected_design?.trim()) ranking.set(c.selected_design, (ranking.get(c.selected_design) || 0) + 1);
  return {
    newClients: customers.filter(c => { const time = Date.parse(c.created_at || ""); return time >= start.getTime() && time < tomorrow.getTime(); }).length,
    overdue: customers.filter(c => { const time = Date.parse(c.last_visit || ""); return Number.isFinite(time) && now.getTime() - time > 21 * 86400000; }).length,
    buckets,
    topDesigns: [...ranking.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}
