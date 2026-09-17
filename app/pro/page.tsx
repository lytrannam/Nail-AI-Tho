"use client";
import Link from "next/link";
import Image from "next/image";
import { LanguageSwitch, ProIcon } from "../components/pro/ProShell";
import { useProLanguage } from "../../lib/pro-language";

export default function ProWelcome() {
  const [lang] = useProLanguage();
  const vi = lang === "vi";
  return <main className="pro-root pro-production" lang={lang}><div className="pro-main is-welcome"><header className="pro-header"><Link href="/" className="pro-brand">AL NAIL <span>AI</span><small>PRO</small></Link><LanguageSwitch /></header><section className="pro-welcome"><div className="pro-welcome-copy"><p className="pro-eyebrow">{vi ? "DÀNH CHO NGƯỜI TẠO NÊN VẺ ĐẸP" : "FOR THE ARTIST BEHIND THE BEAUTY"}</p><h1>{vi ? "Tài năng của bạn." : "Your talent."}<br/><em>{vi ? "Dấu ấn riêng bạn." : "Your signature."}</em></h1><p>{vi ? "Một nơi để giới thiệu mẫu nail, ghi nhớ sở thích khách và chăm chút cho công việc mỗi ngày." : "A place to showcase your nail artistry, understand your clients and care for your work every day."}</p><Link href="/dashboard" className="pro-primary">{vi ? "Vào không gian Pro" : "Enter your Pro space"} <span aria-hidden="true">→</span></Link><small>{vi ? "Dành cho thợ nail cá nhân · Đăng nhập để lưu dữ liệu" : "For independent nail artists · Sign in to save your work"}</small><div className="pro-welcome-features"><span><ProIcon name="grid"/>{vi ? "Mẫu nail" : "Portfolio"}</span><span><ProIcon name="users"/>{vi ? "Khách hàng" : "Clients"}</span><span><ProIcon name="chart"/>{vi ? "Hiệu quả" : "Insights"}</span></div></div><div className="pro-welcome-art"><Image src="/pro-assets/floral.png" alt={vi ? "Móng hồng với hoa nổi tinh tế" : "Pink manicure with delicate sculpted flowers"} fill sizes="(max-width: 760px) 100vw, 50vw" priority style={{ objectFit: "cover" }}/><div><span>AL NAIL AI</span><strong>{vi ? "Đẹp từ từng chi tiết." : "Beauty in every detail."}</strong></div></div></section><footer className="pro-footer"><Link href="/">{vi ? "Khám phá dành cho khách" : "Explore as a customer"}</Link></footer></div></main>;
}
