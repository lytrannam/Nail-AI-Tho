"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import { useProLanguage } from "../../lib/pro-language";
import { useProUser } from "../components/pro/ProShell";

export default function QrPage() {
  const user = useProUser();
  const [lang] = useProLanguage();
  const vi = lang === "vi";
  const [profile, setProfile] = useState<{ username: string; display_name: string | null; is_public: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<"copied" | "copyFailed" | null>(null);
  const [origin, setOrigin] = useState("");
  const qr = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await supabase.from("tech_profiles").select("username, display_name, is_public").eq("user_id", user.id).maybeSingle();
        if (active) { setProfile(data); setFailed(!!error); }
      } catch { if (active) setFailed(true); }
      finally { if (active) { setOrigin(window.location.origin); setReady(true); } }
    }
    void load();
    return () => { active = false; };
  }, [user.id]);
  const hasProfile = !!profile?.is_public && !!profile.username;
  const url = !origin ? "" : hasProfile ? `${origin}/u/${encodeURIComponent(profile!.username)}` : `${origin}/?salon=${encodeURIComponent(user.id)}`;
  const download = () => {
    const canvas = qr.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a"); link.href = canvas.toDataURL("image/png"); link.download = "al-nail-ai-personal-qr.png"; link.click();
  };
  return <main><div className="pro-heading"><p className="pro-eyebrow">{vi ? "MỘT LẦN QUÉT, THÊM KẾT NỐI" : "ONE SCAN, A NEW CONNECTION"}</p><h1>{vi ? "Mã QR cho khách" : "Your customer QR code"}</h1><p>{vi ? "Để khách dễ tìm hồ sơ và các mẫu nail do bạn thực hiện." : "Help clients discover your profile and nail designs."}</p></div><div className="pro-qr-layout"><section className="pro-qr-card"><p className="pro-brand">AL NAIL <span>AI</span></p><h2>{profile?.display_name || (vi ? "Không gian nail của bạn" : "Your nail artist space")}</h2><p>{vi ? "Quét để khám phá cảm hứng nail" : "Scan to explore nail inspiration"}</p><div ref={qr}>{ready && url ? <QRCodeCanvas value={url} size={560} style={{ width: 280, height: 280 }} marginSize={4} title={vi ? "QR cá nhân của thợ nail" : "Your personal nail artist QR"}/> : <p role="status">{vi ? "Đang tạo QR…" : "Preparing your QR…"}</p>}</div><span>{vi ? "ĐẸP TỪ TỪNG CHI TIẾT" : "BEAUTY IN EVERY DETAIL"}</span></section><section className="pro-panel"><span className="pro-pill">{vi ? "QR CÁ NHÂN" : "YOUR PERSONAL QR"}</span><h2>{vi ? "Mang cảm hứng đến gần hơn" : "Bring your artistry closer"}</h2><p>{hasProfile ? (vi ? "QR mở hồ sơ công khai của bạn và bộ sưu tập thật." : "This QR opens your public profile and real portfolio.") : (vi ? "QR mở trải nghiệm khách hàng gắn với tài khoản của bạn. Hoàn thiện và công khai hồ sơ để chia sẻ bộ sưu tập cá nhân." : "This QR opens the customer experience linked to your account. Complete and publish your profile to share your personal portfolio.")}</p>{failed && <p className="pro-error" role="alert">{vi ? "Chưa tải được hồ sơ. Đang dùng đường dẫn khách hàng của bạn." : "Profile unavailable. Using your linked customer experience instead."}</p>}<label className="pro-field">{vi ? "Đường dẫn trong QR" : "QR destination"}<input value={ready ? url : ""} readOnly onFocus={e => e.target.select()}/></label><button className="pro-primary" disabled={!ready || !url} onClick={download}>{vi ? "Tải mã QR" : "Download QR"}</button><button className="pro-secondary" disabled={!ready || !url} onClick={async () => { try { await navigator.clipboard.writeText(url); setNotice("copied"); } catch { setNotice("copyFailed"); } }}>{vi ? "Sao chép liên kết" : "Copy link"}</button>{notice && <p role="status">{notice === "copied" ? (vi ? "Đã sao chép." : "Copied.") : (vi ? "Hãy chọn và sao chép đường dẫn bên trên." : "Select and copy the link above.")}</p>}<Link href="/profile" className="pro-text">{vi ? "Chỉnh sửa hồ sơ" : "Edit your profile"} →</Link></section></div></main>;
}
