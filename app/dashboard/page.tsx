"use client";
import Link from "next/link";
import Image from "next/image";
import { useProLanguage } from "../../lib/pro-language";
import { useProOverview } from "../../lib/pro-overview";
import { useProUser, ProIcon, proLinks } from "../components/pro/ProShell";

export default function Dashboard() {
  const user = useProUser();
  const [lang] = useProLanguage();
  const vi = lang === "vi";
  const data = useProOverview(user.id);
  const name = data.profile?.display_name || (vi ? "bạn" : "there");
  const stat = (n: number | null | undefined) => data.loading || n == null ? "—" : n.toLocaleString(vi ? "vi-VN" : "en-US");
  return <main><div className="pro-heading"><p className="pro-eyebrow">{vi ? "KHÔNG GIAN CỦA BẠN" : "YOUR ARTIST SPACE"}</p><h1>{vi ? "Chào" : "Hello"} {name},</h1><p>{vi ? "Một ngày mới, thêm những bộ móng đẹp." : "A new day, more beautiful nails."}</p></div>
    {data.failed && <div className="pro-error" role="alert">{vi ? "Một số dữ liệu chưa tải được." : "Some data could not be loaded."} <button onClick={data.reload}>{vi ? "Thử lại" : "Retry"}</button></div>}
    <div className="pro-dashboard-grid"><div><section className="pro-feature"><div><span className="pro-pill">{vi ? "BỘ SƯU TẬP CÁ NHÂN" : "YOUR OWN COLLECTION"}</span><h2>{vi ? "Để tác phẩm thay bạn kể chuyện." : "Let your work tell your story."}</h2><p>{vi ? "Thêm mẫu mới vào góc cảm hứng của riêng bạn." : "Add a new design to your own corner of inspiration."}</p><Link href="/portfolio" className="pro-primary">+ {vi ? "Thêm mẫu nail" : "Add nail designs"}</Link></div><Image src="/pro-assets/floral.png" width={250} height={330} alt={vi ? "Ảnh cảm hứng nail hoa nổi" : "Sculpted floral nail inspiration"}/></section>
    <section className="pro-stats" aria-label={vi ? "Số liệu tài khoản" : "Account statistics"}><div><ProIcon name="users"/><strong>{stat(data.customers?.length)}</strong><span>{vi ? "Khách hàng" : "Clients"}</span></div><div><ProIcon name="grid"/><strong>{stat(data.portfolio)}</strong><span>{vi ? "Mẫu đã lưu" : "Saved designs"}</span></div><div><ProIcon name="chart"/><strong>{stat(data.profileLoaded ? data.profile?.profile_views ?? 0 : null)}</strong><span>{vi ? "Lượt xem hồ sơ" : "Profile views"}</span></div></section>
    <section className="pro-panel pro-spaced"><div className="pro-section-top"><h2>{vi ? "Lịch hẹn sắp tới" : "Upcoming appointments"}</h2><Link className="pro-text" href="/appointments">{vi ? "Xem tất cả" : "View all"} →</Link></div>{data.loading ? <p role="status">{vi ? "Đang tải…" : "Loading…"}</p> : data.appointments === null ? <p>{vi ? "Chưa tải được lịch hẹn." : "Appointments are unavailable."}</p> : data.appointments.length === 0 ? <p>{vi ? "Chưa có lịch hẹn sắp tới. Chọn một khách hàng để đặt lịch." : "No upcoming appointments. Choose a client to schedule a visit."}</p> : data.appointments.map(a => <Link className="pro-appointment" href={`/appointments?customerId=${a.customer_id}`} key={a.id}><time dateTime={a.appointments_at}>{new Date(a.appointments_at).toLocaleString(vi ? "vi-VN" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time><div><strong>{data.customers?.find(c => c.id === a.customer_id)?.name || (vi ? "Khách hàng" : "Client")}</strong><p>{a.service || (vi ? "Xem lịch hẹn" : "View appointment")}</p></div></Link>)}</section></div>
    <div><section className="pro-panel"><h2>{vi ? "Thao tác nhanh" : "Quick actions"}</h2><div className="pro-actions pro-spaced">{proLinks.slice(2, 6).map(([href, vn, en, icon]) => <Link href={href} key={href}><ProIcon name={icon}/><strong>{vi ? vn : en}</strong><span aria-hidden="true">→</span></Link>)}</div></section><section className="pro-panel pro-tip"><ProIcon name="spark"/><h2>{vi ? "Một gợi ý nhỏ" : "A little inspiration"}</h2><p>{vi ? "Ảnh rõ nét, nền gọn và ánh sáng tự nhiên giúp khách nhìn thấy nét riêng trong tác phẩm của bạn." : "Clear photos, simple backgrounds and natural light help clients appreciate your signature style."}</p><Link href="/profile" className="pro-text">{vi ? "Hoàn thiện hồ sơ" : "Complete your profile"} →</Link></section></div></div>
  </main>;
}
