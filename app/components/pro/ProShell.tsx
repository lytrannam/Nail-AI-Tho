"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useProLanguage } from "../../../lib/pro-language";
import "./pro.css";

const UserContext = createContext<User | null>(null);
export function useProUser() {
  const user = useContext(UserContext);
  if (!user) throw new Error("Pro content requires an authenticated user");
  return user;
}
export const proLinks = [
  ["/dashboard", "Tổng quan", "Dashboard", "home"],
  ["/portfolio", "Bộ sưu tập", "Portfolio", "grid"],
  ["/customers", "Khách hàng", "Clients", "users"],
  ["/qr", "Mã QR", "QR code", "qr"],
  ["/stats", "Thống kê", "Analytics", "chart"],
  ["/marketing", "Quảng bá", "Marketing", "spark"],
  ["/profile", "Hồ sơ & cài đặt", "Profile & settings", "settings"],
] as const;
export function ProIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "m3 10 9-7 9 7v10H3Zm6 10v-7h6v7", grid: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m8 0a4 4 0 0 1 0 8m3 10v-2a4 4 0 0 0-3-4",
    qr: "M3 3h6v6H3Zm12 0h6v6h-6ZM3 15h6v6H3Zm12 0h3v3h3v3h-6Zm6-3v3M12 3v3m0 6h3M3 12h3",
    chart: "M3 3v18h18M7 16v-4m5 4V8m5 8V5", spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z",
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.spark} /></svg>;
}
export function LanguageSwitch() {
  const [lang, setLang] = useProLanguage();
  return <div className="pro-languages" role="group" aria-label={lang === "vi" ? "Ngôn ngữ" : "Language"}>
    <button type="button" lang="vi" aria-pressed={lang === "vi"} onClick={() => setLang("vi")}>Tiếng Việt</button>
    <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
  </div>;
}
export default function ProShell({ children }: { children: ReactNode }) {
  const [lang] = useProLanguage();
  const vi = lang === "vi";
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [menu, setMenu] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (data.user) setUser(data.user);
      else if (authError && authError.name !== "AuthSessionMissingError") setError(true);
      else router.replace("/login");
    }).catch(() => { if (active) setError(true); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") { setUser(null); router.replace("/login"); }
      else if (session?.user) setUser(session.user);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [router, attempt]);
  const selected = (href: string) => pathname === href || (href === "/customers" && ["/customer-details", "/appointments", "/loyalty-settings"].includes(pathname));
  const nav = <nav aria-label={vi ? "Điều hướng Pro" : "Pro navigation"}>{proLinks.map(([href, vn, en, icon]) => <Link key={href} href={href} aria-current={selected(href) ? "page" : undefined} onClick={() => setMenu(false)}><ProIcon name={icon} /><span>{vi ? vn : en}</span></Link>)}</nav>;
  return <div className="pro-root pro-production" lang={lang}>
    <a className="pro-skip" href="#pro-content">{vi ? "Đến nội dung" : "Skip to content"}</a>
    <aside className="pro-sidebar"><Link href="/pro" className="pro-brand">AL NAIL <span>AI</span><small>PRO</small></Link><p className="pro-sidebar-label">{vi ? "KHÔNG GIAN CỦA BẠN" : "YOUR ARTIST SPACE"}</p>{nav}<div className="pro-sidebar-bottom"><ProIcon name="spark" /><small>{vi ? "Dành cho thợ nail cá nhân" : "For independent nail artists"}</small></div></aside>
    <div className="pro-main">
      <header className="pro-header"><Link className="pro-brand" href="/pro">AL NAIL <span>AI</span><small>PRO</small></Link><LanguageSwitch /><button className="pro-secondary pro-menu-toggle" aria-expanded={menu} aria-controls="pro-mobile-menu" onClick={() => setMenu(!menu)}>{vi ? "Danh mục" : "Menu"}</button></header>
      {menu && <div id="pro-mobile-menu" className="pro-mobile-menu">{nav}</div>}
      {user ? <UserContext.Provider value={user}><div id="pro-content" className="pro-content">{children}</div></UserContext.Provider> : <section id="pro-content" className="pro-panel pro-loading" role={error ? "alert" : "status"}><h1>{error ? (vi ? "Chưa kết nối được tài khoản" : "Unable to connect to your account") : (vi ? "Đang mở không gian của bạn…" : "Opening your artist space…")}</h1>{error && <><p>{vi ? "Kiểm tra kết nối rồi thử lại." : "Check your connection and try again."}</p><button className="pro-primary" onClick={() => { setError(false); setAttempt(x => x + 1); }}>{vi ? "Thử lại" : "Retry"}</button> <Link href="/login" className="pro-secondary">{vi ? "Đăng nhập" : "Sign in"}</Link></>}</section>}
      <footer className="pro-footer"><span>AL NAIL AI · {vi ? "Tay nghề của bạn. Dấu ấn của bạn." : "Your art. Your signature."}</span><div><Link href="/help">{vi ? "Trợ giúp" : "Help"}</Link><Link href="/">{vi ? "Trang dành cho khách" : "Customer experience"}</Link>{user && <button disabled={signingOut} onClick={async () => { setSigningOut(true); const { error } = await supabase.auth.signOut(); if (error) { setSigningOut(false); window.alert(vi ? "Chưa đăng xuất được. Hãy thử lại." : "Unable to sign out. Please retry."); } }}>{vi ? "Đăng xuất" : "Sign out"}</button>}</div></footer>
    </div>
    <nav className="pro-bottom" aria-label={vi ? "Điều hướng nhanh" : "Quick navigation"}>{proLinks.slice(0, 4).map(([href, vn, en, icon]) => <Link key={href} href={href} aria-current={selected(href) ? "page" : undefined}><ProIcon name={icon}/>{vi ? vn : en}</Link>)}</nav>
  </div>;
}
