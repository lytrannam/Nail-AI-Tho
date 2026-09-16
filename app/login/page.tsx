"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";

type Mode = "login" | "signup";

// Danh sach cac ten mien email "dung 1 lan" pho bien nhat, hay bi loi dung
// de tao nhieu tai khoan ao lach gioi han dung thu. Danh sach nay khong the
// day du 100%, nhung chan duoc phan lon truong hop de gap nhat.
const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "throwawaymail.com",
  "getnada.com",
  "trashmail.com",
  "sharklasers.com",
  "fakeinbox.com",
  "maildrop.cc",
];

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [lang, setLang] = useState<Language>("vi");

  const t = translations[lang];

  const login = async () => {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/customers");
  };

  const signUp = async () => {
    setError("");

    // Chan email dung 1 lan NGAY TU DAU, truoc khi goi Supabase - tiet kiem
    // 1 luot goi API khong can thiet, va bao loi ngay lap tuc cho nguoi dung.
    if (isDisposableEmail(email)) {
      setError(
        lang === "vi"
          ? "Vui lòng dùng địa chỉ email thật (không dùng email tạm thời)."
          : "Please use a real email address (temporary/disposable emails are not allowed)."
      );
      return;
    }

    setLoading(true);
    setSignupSuccess(false);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSignupSuccess(true);
  };

  const handleSubmit = () => {
    if (mode === "login") {
      login();
    } else {
      signUp();
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setSignupSuccess(false);
  };

  const [showPassword, setShowPassword] = useState(false);
  return (
    <main className="auth-root" lang={lang}>
      <header className="auth-top"><a href="/" className="auth-brand" aria-label="AL NAIL AI">AL NAIL <span>AI<small aria-hidden="true">♥</small></span></a><button type="button" className="auth-lang" onClick={() => setLang(lang === "en" ? "vi" : "en")} aria-label={lang === "vi" ? "Đổi ngôn ngữ" : "Change language"}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>{t.switchLang}</button></header>
      <div className="auth-layout">
        <section className="auth-art" aria-label={lang === "vi" ? "Cảm hứng nail dành cho thợ" : "Inspiration for nail artists"}>
          <div className="auth-main-photo"><img src="/auth-look/artist-signature.png" alt={lang === "vi" ? "Bàn tay với móng French đỏ rượu và đường ánh vàng tinh tế" : "Burgundy French manicure with a delicate gold accent"} fetchPriority="high"/><div className="auth-photo-caption"><span>YOUR ART. YOUR SIGNATURE.</span><p>{lang === "vi" ? "Đẹp từ từng chi tiết." : "Beauty in every detail."}</p></div></div>
          <div className="auth-art-note"><span aria-hidden="true">✦</span><p>{lang === "vi" ? "Tay nghề của bạn. Cảm hứng của khách." : "Your craft. Their inspiration."}</p></div>
        </section>
        <section className="auth-card" aria-labelledby="auth-title">
          <p className="auth-eyebrow">{lang === "vi" ? "KHÔNG GIAN DÀNH CHO THỢ NAIL" : "A SPACE FOR NAIL ARTISTS"}</p>
          <h1 id="auth-title">{mode === "login" ? (lang === "vi" ? "Chào mừng bạn trở lại." : "Welcome back.") : (lang === "vi" ? "Bắt đầu dấu ấn riêng." : "Make your mark.")}</h1>
          <h2>{mode === "login" ? (lang === "vi" ? "Đăng nhập dành cho thợ nail" : "Sign in as a nail artist") : (lang === "vi" ? "Tạo tài khoản thợ nail" : "Create your nail artist account")}</h2>
          <p className="auth-intro">{lang === "vi" ? "Giới thiệu tay nghề, lưu cảm hứng và kết nối với khách của bạn." : "Showcase your craft, save inspiration and connect with your clients."}</p>
          {signupSuccess ? <div className="auth-success" role="status"><span aria-hidden="true">✓</span><h3>{lang === "vi" ? "Kiểm tra email của bạn" : "Check your email"}</h3><p>{t.loginSignupSuccessMessage}</p></div> : <form onSubmit={e => { e.preventDefault(); if (!loading) handleSubmit(); }}>
            <label className="auth-field" htmlFor="auth-email">Email<input id="auth-email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={lang === "vi" ? "Nhập email của bạn" : "Your email address"} value={email} onChange={e => setEmail(e.target.value)} disabled={loading}/></label>
            <label className="auth-field" htmlFor="auth-password">{t.loginPasswordPlaceholder}</label>
            <div className="auth-password"><input id="auth-password" required type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={lang === "vi" ? "Nhập mật khẩu" : "Your password"} value={password} onChange={e => setPassword(e.target.value)} disabled={loading}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? (lang === "vi" ? "Ẩn mật khẩu" : "Hide password") : (lang === "vi" ? "Hiện mật khẩu" : "Show password")} aria-pressed={showPassword}>{showPassword ? (lang === "vi" ? "Ẩn" : "Hide") : (lang === "vi" ? "Hiện" : "Show")}</button></div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={loading}>{mode === "login" ? (loading ? t.loginLoggingIn : t.loginButton) : (loading ? t.loginSigningUp : t.loginSignupButton)}<span aria-hidden="true">→</span></button>
          </form>}
          <button type="button" className="auth-switch" onClick={() => { switchMode(); setShowPassword(false); }} disabled={loading}>{mode === "login" ? t.loginSwitchToSignup : t.loginSwitchToLogin}</button>
          <div className="auth-customer"><span>{lang === "vi" ? "Bạn là khách muốn tìm mẫu nail?" : "Looking for your next nail design?"}</span><a href="/">{lang === "vi" ? "Khám phá dành cho khách" : "Explore as a customer"}<span aria-hidden="true"> →</span></a></div>
        </section>
      </div>
      <footer className="auth-footer">AL NAIL AI · {lang === "vi" ? "Kết nối thợ nail và khách." : "Connecting nail artists and clients."}</footer>
      <style>{`
        .auth-root{min-height:100dvh;background:#fff8fb;color:#3c2532;font:14px/1.6 Arial,sans-serif;padding:0 40px;box-sizing:border-box}.auth-root *{box-sizing:border-box}.auth-root button,.auth-root input{font:inherit}.auth-root button{cursor:pointer}.auth-root button:disabled{opacity:.55;cursor:wait}.auth-root a,.auth-root button{-webkit-tap-highlight-color:transparent}.auth-root button:focus-visible,.auth-root a:focus-visible,.auth-root input:focus-visible{outline:3px solid #ac4273;outline-offset:3px}.auth-top{max-width:1160px;margin:auto;height:100px;display:flex;align-items:center;justify-content:space-between}.auth-brand{font:28px Georgia,serif;letter-spacing:-1px;text-decoration:none;color:#31202a;white-space:nowrap}.auth-brand>span{color:#d32369;position:relative}.auth-brand small{position:absolute;top:-8px;right:0;font:11px Arial}.auth-lang{display:flex;align-items:center;gap:8px;border:1px solid #ebdbe3;border-radius:99px;background:#fff;color:#684759;padding:9px 15px;min-height:42px;font-size:12px!important}.auth-layout{display:grid;grid-template-columns:1.15fr 1fr;gap:60px;align-items:center;max-width:1100px;margin:20px auto 35px}.auth-art{position:relative;padding:0 0 48px 0;min-width:0}.auth-main-photo{height:565px;position:relative;border-radius:110px 110px 28px 28px;overflow:hidden;background:#f8dae7}.auth-main-photo>img{width:100%;height:100%;object-fit:cover;display:block}.auth-photo-caption{position:absolute;bottom:0;left:0;right:0;padding:90px 25px 28px;background:linear-gradient(transparent,#5e223b9c);color:white}.auth-photo-caption>span{font-size:9px;letter-spacing:2px}.auth-photo-caption>p{font-size:24px;line-height:1.35;margin:10px 0 0}.auth-second-photo{position:absolute;right:0;bottom:0;width:43%;border:7px solid #fff8fb;border-radius:90px 90px 22px 22px;overflow:hidden;background:#fff;box-shadow:0 10px 25px #63234212}.auth-second-photo>img{width:100%;aspect-ratio:.85;object-fit:cover;display:block}.auth-second-photo>span{display:block;text-align:center;padding:11px 3px;font-size:8px;letter-spacing:1px;color:#a4597e;background:white}.auth-art-note{position:absolute;bottom:2px;left:8px;width:100%;display:flex;gap:10px;align-items:center;color:#ac6688}.auth-art-note>span{font-size:26px}.auth-art-note>p{font-size:12px;line-height:1.6}.auth-card{max-width:450px;padding:30px 0}.auth-eyebrow{color:#b04775;letter-spacing:2px;font-size:9px;margin:0 0 17px;font-weight:600}.auth-card h1{font:500 36px/1.2 Arial,sans-serif;letter-spacing:-1.2px;margin:0 0 16px;color:#402336}.auth-card h2{font:600 16px/1.5 Arial,sans-serif;color:#a13f69;margin:0 0 10px}.auth-intro{font-size:13px;color:#987889;margin:0 0 28px;line-height:1.8}.auth-field{display:block;margin:18px 0 7px;font-size:12px;color:#715064;font-weight:600}.auth-field>input,.auth-password>input{width:100%;min-width:0;border:1px solid #ead7e1;border-radius:12px;background:#fff;color:#382631;padding:14px 15px;font-size:16px;min-height:52px}.auth-field>input{display:block;margin-top:7px}.auth-root input::placeholder{color:#b39aaa;font-weight:400}.auth-password{position:relative}.auth-password>input{padding-right:70px}.auth-password>button{position:absolute;right:6px;top:4px;bottom:4px;min-width:53px;border:0;background:transparent;color:#a33b6a;font-size:12px;font-weight:600;border-radius:8px}.auth-submit{width:100%;display:flex;align-items:center;justify-content:center;gap:16px;background:#d72c6e;color:white;border:0;border-radius:99px;min-height:52px;padding:13px 20px;font-weight:600!important;margin:24px 0 0;box-shadow:0 7px 20px #d72c6e26}.auth-submit>span{font-size:22px;line-height:1}.auth-switch{border:0;background:transparent;color:#ac3566;font-size:12px!important;font-weight:600!important;min-height:44px;padding:12px 5px;display:block;margin:10px auto;text-align:center;text-decoration:underline;text-underline-offset:4px}.auth-customer{border-top:1px solid #ecdce5;padding-top:22px;margin-top:18px;text-align:center;font-size:11px;color:#9b7b8d;line-height:1.8}.auth-customer>span{display:block}.auth-customer>a{display:inline-flex;align-items:center;gap:5px;color:#815369;min-height:36px;text-decoration:none}.auth-footer{text-align:center;padding:10px 0 25px;color:#b190a3;font-size:10px;letter-spacing:.7px}.auth-error{font-size:12px;line-height:1.6;color:#ad224b;background:#ffeaf0;border:1px solid #f2c0d0;border-radius:10px;padding:10px 13px;margin:15px 0}.auth-success{border:1px solid #ecd1df;background:#fff0f6;padding:22px;border-radius:16px;margin:20px 0}.auth-success>span{display:grid;place-items:center;width:35px;height:35px;border-radius:50%;background:#e7f1e8;color:#4f775a}.auth-success h3{font:600 18px/1.4 Arial,sans-serif;margin:14px 0 8px}.auth-success p{font-size:13px;color:#8a6276;line-height:1.8;margin:0}
        @media(max-width:850px){.auth-root{padding:0 22px}.auth-top{height:75px;max-width:480px}.auth-brand{font-size:25px}.auth-layout{display:flex;flex-direction:column;gap:14px;max-width:480px;margin:6px auto 10px}.auth-art{width:100%;padding:0}.auth-main-photo{height:310px;border-radius:60px 60px 18px 18px}.auth-main-photo>img{object-position:center 69%}.auth-photo-caption{padding:45px 16px 18px}.auth-photo-caption>span{font-size:7px;letter-spacing:1.5px}.auth-photo-caption>p{font-size:18px;margin-top:5px}.auth-second-photo{width:37%;right:0;bottom:0;border-width:5px;border-radius:65px 65px 16px 16px}.auth-second-photo>img{aspect-ratio:.82}.auth-second-photo>span{font-size:6px;letter-spacing:.6px;padding:8px 1px}.auth-art-note{display:none}.auth-card{width:100%;max-width:none;padding:8px 2px 0}.auth-eyebrow{margin-bottom:10px;font-size:8px;letter-spacing:1.6px}.auth-card h1{font-size:29px;letter-spacing:-.8px;margin-bottom:10px}.auth-card h2{font-size:14px;margin-bottom:7px}.auth-intro{font-size:12px;margin-bottom:20px}.auth-field{margin-top:15px}.auth-submit{margin-top:20px}.auth-customer{margin-top:12px;padding-top:17px}.auth-footer{font-size:9px;padding:14px 0 20px}.auth-switch{font-size:12px!important}}@media(max-width:350px){.auth-root{padding:0 16px}.auth-main-photo{height:280px}.auth-card h1{font-size:26px}.auth-photo-caption>p{font-size:16px}.auth-brand{font-size:23px}.auth-lang{padding:8px 11px}.auth-layout{gap:10px}}
      `}</style>
    </main>
  );
}
