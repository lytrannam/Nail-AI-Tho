"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useProLanguage } from "../../lib/pro-language";
import { useProUser } from "../components/pro/ProShell";

type Design = { id: number; image_url: string; style: string | null; color: string | null };
export default function Marketing() {
  const user = useProUser();
  const [lang] = useProLanguage();
  const vi = lang === "vi";
  const [designs, setDesigns] = useState<Design[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [tone, setTone] = useState("gentle");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<"copied" | "copyFailed" | "saved" | "saveFailed" | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const all: Design[] = [];
        for (let start = 0; ; start += 1000) {
          const { data, error } = await supabase.from("portfolio").select("id, image_url, style, color").eq("user_id", user.id).order("id", { ascending: false }).range(start, start + 999);
          if (error) throw error;
          all.push(...(data || [])); if (!data || data.length < 1000) break;
        }
        const { data: profile, error } = await supabase.from("tech_profiles").select("display_name, username, is_public").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        if (!active) return;
        setDesigns(all); setSelected(all.length ? String(all[0].id) : ""); setName(profile?.display_name || "");
        setProfileUrl(profile?.is_public && profile.username ? `${window.location.origin}/u/${encodeURIComponent(profile.username)}` : `${window.location.origin}/?salon=${user.id}`);
        try { const raw = localStorage.getItem(`al-nail-marketing:${user.id}`); if (raw) { const draft = JSON.parse(raw); if (typeof draft.text === "string" && all.some(d => String(d.id) === draft.designId)) { setText(draft.text); setSelected(draft.designId); if (draft.tone === "short" || draft.tone === "gentle") setTone(draft.tone); } } } catch {}
        setFailed(false);
      } catch { if (active) setFailed(true); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [user.id, attempt]);
  const design = designs.find(d => String(d.id) === selected);
  const title = design ? [design.style, design.color].filter(Boolean).join(" · ") || `${vi ? "Mẫu" : "Design"} #${design.id}` : "";
  const createCaption = () => {
    if (!design) return;
    const caption = vi ? (tone === "short" ? `${title} ✨\nMột mẫu nail mới từ ${name || "bộ sưu tập của tôi"}.` : `Một chút cảm hứng cho bộ móng tiếp theo của bạn 🌸\nKhám phá ${title} trong bộ sưu tập của ${name || "tôi"}.`) : (tone === "short" ? `${title} ✨\nA new nail design from ${name || "my collection"}.` : `A little inspiration for your next manicure 🌸\nDiscover ${title} in ${name ? `${name}’s` : "my"} collection.`);
    setText(`${caption}\n\n${vi ? "Xem mẫu và hồ sơ" : "Explore designs and profile"}: ${profileUrl}\n\n#NailArt #ALNailAI`); setNotice(null);
  };
  return <main><div className="pro-heading"><p className="pro-eyebrow">{vi ? "GIỚI THIỆU TAY NGHỀ CỦA BẠN" : "SHARE YOUR NAIL ARTISTRY"}</p><h1>{vi ? "Góc quảng bá" : "Your marketing studio"}</h1><p>{vi ? "Soạn bài từ tác phẩm thật, theo giọng của bạn." : "Create a post from your own work, in your own voice."}</p></div>{failed ? <div className="pro-error" role="alert">{vi ? "Chưa tải được bộ sưu tập hoặc hồ sơ." : "Unable to load your portfolio or profile."} <button onClick={() => { setLoading(true); setAttempt(x => x + 1); }}>{vi ? "Thử lại" : "Retry"}</button></div> : loading ? <p role="status">{vi ? "Đang tải bộ sưu tập…" : "Loading your portfolio…"}</p> : !designs.length ? <section className="pro-panel pro-empty"><h2>{vi ? "Bắt đầu bằng tác phẩm của bạn" : "Start with your own work"}</h2><p>{vi ? "Tải mẫu nail vào portfolio để soạn bài giới thiệu." : "Upload a nail design to your portfolio to create your first post."}</p><Link href="/portfolio" className="pro-primary">{vi ? "Thêm mẫu nail" : "Add a design"}</Link></section> : <div className="pro-marketing-layout"><section className="pro-panel"><h2>{vi ? "Soạn bài giới thiệu" : "Create a post"}</h2><label className="pro-field">{vi ? "Chọn tác phẩm" : "Choose a design"}<select value={selected} onChange={e => { setSelected(e.target.value); setText(""); setNotice(null); }}>{designs.map(d => <option value={d.id} key={d.id}>{[d.style, d.color].filter(Boolean).join(" · ") || `${vi ? "Mẫu" : "Design"} #${d.id}`}</option>)}</select></label><label className="pro-field">{vi ? "Phong cách viết" : "Writing style"}<select value={tone} onChange={e => setTone(e.target.value)}><option value="gentle">{vi ? "Nhẹ nhàng" : "Warm & gentle"}</option><option value="short">{vi ? "Ngắn gọn" : "Short & sweet"}</option></select></label><button className="pro-primary" onClick={createCaption}>{vi ? "Soạn nội dung" : "Create caption"}</button><p className="pro-caption">{vi ? "Dùng câu gợi ý có sẵn, bạn có thể chỉnh sửa trước khi đăng." : "Start with a suggested caption and edit it before posting."}</p><label className="pro-field">{vi ? "Nội dung bài viết" : "Post caption"}<textarea value={text} maxLength={5000} onChange={e => { setText(e.target.value); setNotice(null); }}/></label><div className="pro-inline-actions"><button className="pro-secondary" disabled={!text.trim()} onClick={async () => { try { await navigator.clipboard.writeText(text); setNotice("copied"); } catch { setNotice("copyFailed"); } }}>{vi ? "Sao chép bài viết" : "Copy caption"}</button><button className="pro-secondary" onClick={() => { try { localStorage.setItem(`al-nail-marketing:${user.id}`, JSON.stringify({ text, designId: selected, tone })); setNotice("saved"); } catch { setNotice("saveFailed"); } }}>{vi ? "Lưu nháp trên máy này" : "Save draft on this device"}</button></div>{notice && <p role="status">{notice === "copied" ? (vi ? "Đã sao chép nội dung." : "Caption copied.") : notice === "saved" ? (vi ? "Đã lưu nháp trên trình duyệt này." : "Draft saved in this browser.") : notice === "copyFailed" ? (vi ? "Hãy chọn và sao chép nội dung trong ô bên trên." : "Select and copy the caption above.") : (vi ? "Trình duyệt không cho phép lưu nháp." : "This browser could not save the draft.")}</p>}</section><section className="pro-panel pro-post"><span className="pro-pill">{vi ? "XEM TRƯỚC" : "POST PREVIEW"}</span><div className="pro-post-artist"><span className="pro-avatar">{name.charAt(0) || "✦"}</span><strong>{name || (vi ? "Tác phẩm của bạn" : "Your nail artistry")}</strong></div>{design && <img src={design.image_url} alt={title}/>}<p>{text || (vi ? "Nội dung bài viết của bạn sẽ xuất hiện tại đây." : "Your caption will appear here.")}</p><p className="pro-caption">{vi ? "Sao chép nội dung rồi đăng bằng tài khoản Instagram hoặc Facebook của bạn. Ảnh gốc có trong Bộ sưu tập." : "Copy the caption and post it using your Instagram or Facebook account. Find the original image in Portfolio."}</p><Link href="/portfolio" className="pro-text">{vi ? "Mở bộ sưu tập để chia sẻ ảnh" : "Open portfolio to share your image"} →</Link></section></div>}</main>;
}
