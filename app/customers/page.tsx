"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { translations } from "../../lib/translations";
import { useProLanguage } from "../../lib/pro-language";
import { useProUser } from "../components/pro/ProShell";

type Customer = { id: number; name: string; phone: string | null; email: string | null; last_visit: string | null; created_at: string | null };
export default function CustomersPage() {
  const user = useProUser();
  const [lang] = useProLanguage();
  const vi = lang === "vi";
  const t = translations[lang];
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [asOf] = useState(() => Date.now());
  const saveLock = useRef(false);
  const [search, setSearch] = useState("");
  const [remindersOnly, setRemindersOnly] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const rows: Customer[] = [];
        for (let start = 0; ; start += 1000) {
          const { data, error } = await supabase.from("customers").select("id, name, phone, email, last_visit, created_at").eq("user_id", user.id).order("id", { ascending: false }).range(start, start + 999);
          if (error) throw error;
          rows.push(...(data || [])); if (!data || data.length < 1000) break;
        }
        if (active) { setCustomers(rows); setLoadError(false); }
      } catch { if (active) setLoadError(true); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [user.id, attempt]);
  const overdue = (c: Customer) => !!c.last_visit && asOf - Date.parse(c.last_visit) > 21 * 86400000;
  const due = customers.filter(overdue);
  const filtered = customers.filter(c => `${c.name} ${c.phone || ""} ${c.email || ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) && (!remindersOnly || overdue(c)));
  const addCustomer = async () => {
    if (!name.trim() || saveLock.current) return;
    saveLock.current = true; setSaving(true); setNotice("");
    try {
      const { data, error } = await supabase.from("customers").insert({ name: name.trim(), phone: phone.trim(), email: email.trim() || null, user_id: user.id, session_token: crypto.randomUUID() }).select("id, name, phone, email, last_visit, created_at").single();
      if (error || !data) throw error;
      setCustomers(old => [data, ...old]); setName(""); setPhone(""); setEmail(""); setFormOpen(false); setNotice(vi ? "Đã lưu khách hàng." : "Client saved.");
    } catch { setNotice(t.custSaveError); }
    finally { setSaving(false); saveLock.current = false; }
  };
  const sendReminders = async (rows: Customer[]) => {
    if (sending) return;
    const recipients = rows.filter(c => !!c.email);
    if (!recipients.length) { setNotice(t.custNoReminderNeeded); return; }
    if (!window.confirm(vi ? `Gửi email nhắc hẹn cho ${recipients.length} khách hàng?` : `Send reminder emails to ${recipients.length} clients?`)) return;
    setSending(true); setNotice("");
    let success = 0;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setNotice(t.custLoginRequired); return; }
      for (const customer of recipients) {
        try {
          const response = await fetch("/api/send-reminder", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ customerId: customer.id }) });
          const result = await response.json(); if (response.ok && !result.error) success++;
        } catch {}
      }
      setNotice(t.custReminderSentSummary.replace("{success}", String(success)).replace("{total}", String(recipients.length)));
    } finally { setSending(false); }
  };
  return <main><div className="pro-heading"><p className="pro-eyebrow">{vi ? "CHĂM SÓC TỪ SỰ THẤU HIỂU" : "CARE THROUGH UNDERSTANDING"}</p><h1>{vi ? "Khách hàng của bạn" : "Your clients"}</h1><p>{vi ? "Ghi nhớ một sở thích nhỏ, tạo nên một trải nghiệm tốt hơn." : "Remember a little preference. Create a more personal experience."}</p></div>
    <div className="pro-help-links"><Link href="/appointments">{vi ? "Lịch hẹn" : "Appointments"}</Link><Link href="/loyalty-settings">{vi ? "Ưu đãi khách thân thiết" : "Loyalty rewards"}</Link><Link href="/invite">{vi ? "Giới thiệu thợ nail" : "Invite a nail artist"}</Link></div>
    {notice && <div className="pro-notice" role="status"><span>{notice}</span><button aria-label={vi ? "Đóng thông báo" : "Dismiss message"} onClick={() => setNotice("")}>×</button></div>}
    <div className="pro-toolbar"><label className="pro-search"><span aria-hidden="true">⌕</span><input aria-label={vi ? "Tìm khách hàng" : "Search clients"} placeholder={t.custSearchPlaceholder} value={search} onChange={e => setSearch(e.target.value)}/></label><button className="pro-primary" aria-expanded={formOpen} aria-controls="pro-add-client" onClick={() => { setFormOpen(!formOpen); if (!formOpen) requestAnimationFrame(() => nameInput.current?.focus()); }}>+ {vi ? "Thêm khách" : "Add client"}</button></div>
    {formOpen && <form id="pro-add-client" className="pro-panel" onSubmit={e => { e.preventDefault(); void addCustomer(); }}><h2>{t.custAddButton}</h2><div className="pro-form-grid pro-spaced"><label className="pro-field">{vi ? "Tên khách hàng" : "Client name"}<input ref={nameInput} required maxLength={150} value={name} onChange={e => setName(e.target.value)} autoComplete="name"/></label><label className="pro-field">{vi ? "Số điện thoại" : "Phone"}<input type="tel" maxLength={40} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel"/></label></div><label className="pro-field">Email<input type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/></label><button className="pro-primary" disabled={saving}>{saving ? (vi ? "Đang lưu…" : "Saving…") : (vi ? "Lưu khách hàng" : "Save client")}</button></form>}
    <div className="pro-toolbar"><div className="pro-tabs"><button aria-pressed={!remindersOnly} onClick={() => setRemindersOnly(false)}>{vi ? "Tất cả" : "All"} ({customers.length})</button><button aria-pressed={remindersOnly} onClick={() => setRemindersOnly(true)}>{vi ? "Cần nhắc quay lại" : "Due a reminder"} ({due.length})</button></div>{due.some(c => c.email) && <button className="pro-secondary" disabled={sending} onClick={() => void sendReminders(due)}>{sending ? t.custSendingAll : t.custSendReminderAll.replace("{n}", String(due.filter(c => c.email).length))}</button>}</div>
    {loadError && <div className="pro-error" role="alert">{vi ? "Chưa tải được danh sách khách." : "Unable to load clients."}<button onClick={() => { setLoading(true); setAttempt(x => x + 1); }}>{vi ? "Thử lại" : "Retry"}</button></div>}
    <section className="pro-panel pro-client-list">{loading ? <p role="status">{vi ? "Đang tải…" : "Loading…"}</p> : !filtered.length && !loadError ? <div className="pro-empty">{t.custNoCustomers}</div> : filtered.map(c => <article className="pro-client-row" key={c.id}><span className="pro-avatar" aria-hidden="true">{c.name.charAt(0).toUpperCase()}</span><div className="pro-client-details"><Link href={`/customer-details?id=${c.id}`}><strong>{c.name}</strong></Link><small>{c.phone || t.custNoPhone}</small><small>{c.email || t.custNoEmail}</small><p>{t.custLastVisit} {c.last_visit ? new Date(c.last_visit).toLocaleDateString(vi ? "vi-VN" : "en-US") : t.custNever}</p>{overdue(c) && <p>{t.custOverdueWarning}</p>}<div className="pro-client-links"><Link href={`/customer-details?id=${c.id}`}>{vi ? "Chi tiết" : "Details"} →</Link><Link href={`/appointments?customerId=${c.id}`}>{vi ? "Đặt lịch" : "Appointments"}</Link>{c.phone && <><a href={`tel:${c.phone}`}>{vi ? "Gọi" : "Call"}</a><a href={`sms:${c.phone}`}>{t.custMessage}</a></>}{c.email && <a href={`mailto:${c.email}`}>Email</a>}</div></div>{c.email && <button className="pro-text" disabled={sending} onClick={() => void sendReminders([c])}>{t.custSendReminder}</button>}</article>)}</section>
  </main>;
}
