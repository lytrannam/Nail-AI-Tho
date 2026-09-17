"use client";
import { useState } from "react";
import Link from "next/link";
import { useProLanguage } from "../../lib/pro-language";
import { useProOverview } from "../../lib/pro-overview";
import { calculateMetrics } from "../../lib/pro-metrics";
import { useProUser } from "../components/pro/ProShell";

export default function StatsPage() {
  const user = useProUser();
  const [lang] = useProLanguage();
  const vi = lang === "vi";
  const data = useProOverview(user.id);
  const [days, setDays] = useState<7 | 30>(30);
  const [asOf] = useState(() => new Date());
  const metrics = calculateMetrics(data.customers || [], days, asOf);
  const value = (n: number | null | undefined) => data.loading || n == null ? "—" : n.toLocaleString(vi ? "vi-VN" : "en-US");
  const maximum = Math.max(1, ...metrics.buckets.map(b => b.count));
  return <main><div className="pro-heading"><p className="pro-eyebrow">{vi ? "HIỂU CÔNG VIỆC CỦA BẠN" : "UNDERSTAND YOUR BUSINESS"}</p><h1>{vi ? "Thống kê của bạn" : "Your insights"}</h1><p>{vi ? "Số liệu từ khách hàng, lịch hẹn và hồ sơ của bạn." : "Insights from your clients, appointments and profile."}</p></div>
    {data.failed && <div className="pro-error" role="alert">{vi ? "Một số số liệu chưa tải được. Dấu — nghĩa là chưa có dữ liệu để hiển thị." : "Some statistics could not be loaded. A dash means the value is unavailable."} <button onClick={data.reload}>{vi ? "Thử lại" : "Retry"}</button></div>}
    <div className="pro-stat-grid"><div><span>{vi ? "Tổng khách hàng" : "Total clients"}</span><strong>{value(data.customers?.length)}</strong></div><div><span>{vi ? "Lượt xem hồ sơ · tổng cộng" : "Profile views · all time"}</span><strong>{value(data.profileLoaded ? data.profile?.profile_views ?? 0 : null)}</strong></div><div><span>{vi ? "Lịch hẹn tháng này" : "Appointments this month"}</span><strong>{value(data.appointmentsThisMonth)}</strong></div><div><span>{vi ? "Khách hơn 21 ngày chưa quay lại" : "Clients away over 21 days"}</span><strong>{value(data.customers ? metrics.overdue : null)}</strong></div></div>
    <section className="pro-panel pro-spaced"><div className="pro-section-top"><h2>{vi ? "Khách hàng mới" : "New clients"}</h2><label className="pro-range">{vi ? "Khoảng thời gian" : "Period"}<select value={days} onChange={e => setDays(Number(e.target.value) as 7 | 30)}><option value={7}>{vi ? "7 ngày" : "7 days"}</option><option value={30}>{vi ? "30 ngày" : "30 days"}</option></select></label></div><p>{vi ? "Tổng khách mới trong khoảng đã chọn:" : "New clients in the selected period:"} <strong>{value(data.customers ? metrics.newClients : null)}</strong></p>{data.loading ? <p role="status">{vi ? "Đang tải…" : "Loading…"}</p> : data.customers === null ? <p>{vi ? "Chưa tải được biểu đồ." : "The chart is unavailable."}</p> : <><div className="pro-chart-bars" role="img" aria-label={vi ? `${metrics.newClients} khách mới trong ${days} ngày` : `${metrics.newClients} new clients in ${days} days`}>{metrics.buckets.map(b => <div className="pro-chart-column" key={b.date.toISOString()} title={`${b.date.toLocaleDateString(vi ? "vi-VN" : "en-US")}: ${b.count}`}><span>{b.count || ""}</span><div style={{ height: `${Math.max(1, b.count / maximum * 130)}px` }}/></div>)}</div><div className="pro-section-top"><small>{metrics.buckets[0].date.toLocaleDateString(vi ? "vi-VN" : "en-US")}</small><small>{metrics.buckets.at(-1)!.date.toLocaleDateString(vi ? "vi-VN" : "en-US")}</small></div><details><summary>{vi ? "Xem số liệu theo ngày" : "View daily counts"}</summary><table className="pro-data-table"><thead><tr><th>{vi ? "Ngày" : "Date"}</th><th>{vi ? "Khách mới" : "New clients"}</th></tr></thead><tbody>{metrics.buckets.map(b => <tr key={b.date.toISOString()}><td>{b.date.toLocaleDateString(vi ? "vi-VN" : "en-US")}</td><td>{b.count}</td></tr>)}</tbody></table></details></>}</section>
    <section className="pro-panel"><h2>{vi ? "Mẫu khách đã chọn · tổng cộng" : "Clients’ selected designs · all time"}</h2>{data.customers && metrics.topDesigns.length ? metrics.topDesigns.map(([name, count], index) => <div key={name} className="pro-ranking"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{name}</strong><small>{count} {vi ? "khách đã chọn" : "clients selected"}</small></div></div>) : <p>{data.customers === null ? (vi ? "Chưa tải được dữ liệu." : "Data is unavailable.") : (vi ? "Chưa có mẫu được lưu cùng khách hàng." : "No designs have been saved with a client yet.")}</p>}<Link className="pro-text" href="/customers">{vi ? "Xem khách hàng" : "View clients"} →</Link></section>
  </main>;
}
