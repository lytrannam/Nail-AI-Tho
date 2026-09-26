"use client";

import ProArtwork from "./components/ProArtwork";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { translations, Language } from "../lib/translations";

type TryOnResult = {
  designIndex: number;
  image: string;
};

type FinalizeImage =
  | { kind: "uploaded"; path: string }
  | { kind: "reused"; url: string };

const MAX_TRYON_PER_VISIT = 2;

// Bound data URLs before serializing both images into the same request.
async function prepareTryOnImage(source: string): Promise<string> {
  if (!source.startsWith("data:")) return source;
  const photo = new window.Image();
  await new Promise<void>((resolve, reject) => {
    photo.onload = () => resolve();
    photo.onerror = () => reject(new Error("Không đọc được ảnh. Vui lòng chọn ảnh JPG hoặc PNG khác."));
    photo.src = source;
  });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context || !photo.naturalWidth || !photo.naturalHeight) {
    throw new Error("Không xử lý được ảnh trên thiết bị này.");
  }
  for (const edge of [1600, 1280, 1024, 800]) {
    const scale = Math.min(1, edge / Math.max(photo.naturalWidth, photo.naturalHeight));
    canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.7]) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      if (encoded.startsWith("data:image/jpeg;") && encoded.length <= 1500000) return encoded;
    }
  }
  throw new Error("Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn.");
}

// Chuyen data URL (dang "data:<mime>;base64,<data>") thanh Blob. Tu choi
// data URL sai cau truc thay vi am tham dung MIME mac dinh - loi phai duoc
// bao ra ngoai de saveAsWalkIn dung lai va bao cho khach, khong tiep tuc
// voi du lieu khong dang tin cay.
function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid data URL structure.");
  }

  const mimeType = match[1];
  const base64Data = match[2];

  let byteCharacters: string;

  try {
    byteCharacters = atob(base64Data);
  } catch {
    throw new Error("Invalid base64 data.");
  }

  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

// Anh xa ma loi HTTP tu prepare/finalize sang thong bao tieng Anh ngan gon,
// khong tiet lo chi tiet ky thuat/noi bo cho khach.
function mapErrorStatus(status: number): string {
  switch (status) {
    case 400:
      return "Please check your information and try again.";
    case 404:
      return "We couldn't find this nail tech's profile.";
    case 409:
      return "We couldn't complete this request. Please try again.";
    case 422:
      return "One of the images couldn't be used. Please try again.";
    case 429:
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function PageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [showWelcome, setShowWelcome] = useState(true);
  const [cameFromGallery, setCameFromGallery] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [designImages, setDesignImages] = useState<string[]>([]);
  const [designSources, setDesignSources] = useState<("real" | "ai")[]>([]);
  const [designImage, setDesignImage] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<number | null>(null);
  const [tryOnResults, setTryOnResults] = useState<TryOnResult[]>([]);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnError, setTryOnError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [lang, setLang] = useState<Language>("en");
  const [tryOnCount, setTryOnCount] = useState(0);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [walkInToken, setWalkInToken] = useState<string | null>(null);
  const [loyaltyInfo, setLoyaltyInfo] = useState<{
    enabled: boolean;
    visitsRequired: number;
    amountRequired: number;
    discountPercent: number;
    currentVisits: number;
    currentSpent: number;
  } | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInSaving, setWalkInSaving] = useState(false);
  const [walkInSaved, setWalkInSaved] = useState(false);
  const walkInSavingRef = useRef(false);

  const t = translations[lang];

  useEffect(() => {
    const loadByToken = async () => {
      if (!token) return;

      try {
        const response = await fetch(
          `/api/customer-by-token?token=${encodeURIComponent(token)}`
        );

        const result = await response.json();

        if (!response.ok || !result.customer) {
          console.error("Không tìm thấy khách:", result);
          return;
        }

        const data = result.customer;

        setCustomerId(data.id);
        // Neu khach nay da tung dung tryon_used=true tu truoc (du lieu cu, chi
        // luu 1 lan dung/chua), coi nhu da het luot de an toan chi phi, khong
        // biet chinh xac ho da dung bao nhieu lan truoc do.
        setTryOnCount(data.tryon_used ? MAX_TRYON_PER_VISIT : 0);

        const loyaltySettings = result.loyaltySettings;

        if (loyaltySettings?.enabled) {
          setLoyaltyInfo({
            enabled: true,
            visitsRequired: loyaltySettings.visits_required ?? 0,
            amountRequired: loyaltySettings.amount_required ?? 0,
            discountPercent: loyaltySettings.discount_percent ?? 0,
            currentVisits: data.visit_count ?? 0,
            currentSpent: data.total_spent ?? 0,
          });
        }
      } catch (error) {
        console.error("Lỗi đọc token:", error);
      }
    };

    loadByToken();
  }, [token]);

  // Neu khach den tu Gallery (bam 1 anh tren trang ca nhan tho), URL se co
  // ?designImage=... -> dien san mau do, bo qua buoc AI phan tich/tao moi.
  useEffect(() => {
    const galleryDesign = searchParams.get("designImage");
    if (galleryDesign) {
      const decoded = decodeURIComponent(galleryDesign);
      setDesignImage(decoded);
      setDesignImages([decoded]);
      setDesignSources(["real"]);
      setSelectedDesign(0);
      setResult(t.galleryChosenMessage);
      setCameFromGallery(true);
      setShowWelcome(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCustomerToken = (): string | null => token || walkInToken;

  const saveSelectedDesign = async (index: number, imageUrl: string) => {
    const customerToken = getCustomerToken();
    if (!customerId || !customerToken) return;

    try {
      const response = await fetch("/api/customers/design-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          token: customerToken,
          kind: "selected_design",
          index,
          image: imageUrl,
        }),
      });

      if (response.ok) {
        setSaveMessage(t.savedMessage);
      } else {
        console.error("Lưu mẫu đã chọn thất bại:", response.status);
      }
    } catch (err) {
      console.error("Không thể lưu mẫu đã chọn:", err);
    }
  };

  const handleImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = () => {
        setImage(reader.result as string);
        setTryOnResults([]);
        setTryOnError("");

        if (!cameFromGallery) {
          // Luong binh thuong: anh tay moi -> xoa het ket qua/mau cu, bat dau lai
          setResult("");
          setSelectedDesign(null);
          setDesignImage(null);
          setDesignImages([]);
          setDesignSources([]);
        }
        // Neu cameFromGallery: GIU NGUYEN designImage/designImages/selectedDesign,
        // vi khach da chon san mau tu Gallery, chi can chup tay moi la du.
      };

      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    setLoading(true);
    setResult("");
    setDesignImage(null);
    setSelectedDesign(null);
    setTryOnResults([]);
    setTryOnError("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const salonParam = searchParams.get("salon");
      const salonRef = salonParam || userData?.user?.id || null;

      const response = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, salonRef }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể phân tích ảnh");
      }

      setResult(data.result);
      setDesignImages(data.designImages || []);
      setDesignSources(
        data.designSources || (data.designImages || []).map(() => "ai" as const)
      );
      setDesignImage(data.designImages?.[0] || null);
      setSelectedDesign(0);

      const customerToken = getCustomerToken();

      if (customerId && customerToken && data.designImages?.length > 0) {
        const sources: ("real" | "ai")[] =
          data.designSources || data.designImages.map(() => "ai");

        try {
          const saveResponse = await fetch("/api/customers/design-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId,
              token: customerToken,
              kind: "all_design_images",
              images: data.designImages,
              sources,
            }),
          });

          if (!saveResponse.ok) {
            console.error("Lưu ảnh thiết kế thất bại:", saveResponse.status);
          }
        } catch (err) {
          console.error("Không thể lưu ảnh thiết kế:", err);
        }
      }
    } catch (error) {
      setResult("⚠️ AI chưa thể tạo gợi ý lúc này. Vui lòng thử lại sau.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const tryOnNails = async () => {
    if (!image || !designImage || selectedDesign === null) return;
    if (tryOnCount >= MAX_TRYON_PER_VISIT) return;

    setTryOnLoading(true);
    try {
      setTryOnError("");

      const handForRequest = await prepareTryOnImage(image);
      const designForRequest = await prepareTryOnImage(designImage);
      const payload = JSON.stringify({ image: handForRequest, designImage: designForRequest });
      if (new Blob([payload]).size > 3500000) throw new Error("Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn.");
      const response = await fetch("/api/try-on", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const data = await response.json().catch(() => null);
      if (response.status === 413) throw new Error(lang === "vi" ? "Ảnh vượt giới hạn dung lượng. Vui lòng chọn ảnh nhỏ hơn." : "The images exceed the size limit. Please choose smaller images.");
      if (!data) throw new Error(t.tryOnError);

      if (!response.ok) {
        throw new Error(data.error || "Không thể thử mẫu");
      }

      const newResultImage = data.tryOnImage || data.image;
      if (typeof newResultImage !== "string" || !newResultImage) throw new Error(t.tryOnError);

      // Them ket qua moi vao danh sach, KHONG xoa ket qua cu (de khach so sanh)
      setTryOnResults((prev) => [
        ...prev,
        { designIndex: selectedDesign, image: newResultImage },
      ]);

      const newCount = tryOnCount + 1;
      setTryOnCount(newCount);

      const customerToken = getCustomerToken();

      if (customerId && customerToken && newResultImage) {
        try {
          const saveResponse = await fetch("/api/customers/design-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId,
              token: customerToken,
              kind: "tryon_image",
              image: newResultImage,
              used: newCount >= MAX_TRYON_PER_VISIT,
            }),
          });

          if (!saveResponse.ok) {
            console.error("Lưu ảnh thử mẫu thất bại:", saveResponse.status);
          }
        } catch (err) {
          console.error("Không thể lưu ảnh thử mẫu:", err);
        }
      }
    } catch (error) {
      console.error(error);
      setTryOnError(error instanceof Error ? error.message : t.tryOnError);
    } finally {
      setTryOnLoading(false);
    }
  };

  const removeTryOnResult = (index: number) => {
    setTryOnResults((prev) => prev.filter((_, i) => i !== index));
    // Luu y: xoa khoi man hinh khong hoan lai luot da dung, vi AI da chay va
    // ton chi phi roi. tryOnCount giu nguyen.
  };

  const saveAsWalkIn = async () => {
    // Khoa dong bo - chan double-submit tuc thi, khong phu thuoc chu ky render
    // cua React (setWalkInSaving la bat dong bo, ref thi khong).
    if (walkInSavingRef.current) return;

    if (!walkInName.trim() || !walkInPhone.trim()) {
      alert("Vui lòng nhập tên và số điện thoại.");
      return;
    }

    if (designImages.length === 0 || designImages.length > 4) {
      alert("Something went wrong. Please try again.");
      return;
    }

    if (
      typeof selectedDesign !== "number" ||
      !Number.isInteger(selectedDesign) ||
      selectedDesign < 0 ||
      selectedDesign >= designImages.length
    ) {
      alert("Please choose a design first.");
      return;
    }

    walkInSavingRef.current = true;
    setWalkInSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const salonParam = searchParams.get("salon");
      const salonRef = salonParam || userData?.user?.id;

      if (!salonRef) {
        alert("Please scan the nail tech's QR code to continue.");
        return;
      }

      // Phan loai TINH toan bo designImages theo dung thu tu hien thi,
      // khong dung designSources de quyet dinh upload hay khong.
      const classified = designImages.map((img) => {
        if (typeof img === "string" && img.startsWith("data:image/")) {
          return { type: "toUpload" as const, raw: img };
        }
        if (typeof img === "string" && img.startsWith("https://")) {
          return { type: "reused" as const, url: img };
        }
        return { type: "invalid" as const };
      });

      if (classified.some((c) => c.type === "invalid")) {
        alert("One of the designs couldn't be used. Please try again.");
        return;
      }

      const uploadCount = classified.filter((c) => c.type === "toUpload").length;

      const prepareRes = await fetch("/api/uploads/walk-in/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salonRef, count: uploadCount }),
      });
      const prepareData = await prepareRes.json().catch(() => null);

      if (!prepareRes.ok || !prepareData) {
        alert(mapErrorStatus(prepareRes.status));
        return;
      }

      const { batchId, uploads } = prepareData as {
        batchId?: unknown;
        uploads?: unknown;
      };

      const UUID_PATTERN =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

      if (typeof batchId !== "string" || !UUID_PATTERN.test(batchId)) {
        alert("Something went wrong. Please try again.");
        return;
      }

      if (!Array.isArray(uploads) || uploads.length !== uploadCount) {
        alert("Something went wrong. Please try again.");
        return;
      }

      const uploadSlots: { path: string; token: string }[] = [];

      for (const slot of uploads) {
        const candidate = slot as { path?: unknown; token?: unknown };
        const path = typeof candidate.path === "string" ? candidate.path.trim() : "";
        const uploadToken = typeof candidate.token === "string" ? candidate.token.trim() : "";

        if (path.length === 0 || uploadToken.length === 0) {
          alert("Something went wrong. Please try again.");
          return;
        }

        uploadSlots.push({ path, token: uploadToken });
      }

      // Nen anh AI + upload qua signed URL, giu dung thu tu goc cua designImages
      const finalImages: FinalizeImage[] = [];
      let uploadIndex = 0;

      for (const item of classified) {
        if (item.type === "toUpload") {
          const compressed = await prepareTryOnImage(item.raw);

          if (typeof compressed !== "string" || !compressed.startsWith("data:image/jpeg")) {
            alert("We couldn't process one of the images. Please try again.");
            return;
          }

          let blob: Blob;

          try {
            blob = dataUrlToBlob(compressed);
          } catch {
            alert("We couldn't process one of the images. Please try again.");
            return;
          }

          if (
            blob.type !== "image/jpeg" ||
            blob.size <= 0 ||
            blob.size > 1_500_000
          ) {
            alert("We couldn't process one of the images. Please try again.");
            return;
          }

          const slot = uploadSlots[uploadIndex];
          uploadIndex++;

          const { error: uploadError } = await supabase.storage
            .from("walk-in-designs")
            .uploadToSignedUrl(slot.path, slot.token, blob, {
              contentType: "image/jpeg",
            });

          if (uploadError) {
            alert("We couldn't upload one of the images. Please try again.");
            return;
          }

          finalImages.push({ kind: "uploaded", path: slot.path });
        } else if (item.type === "reused") {
          finalImages.push({ kind: "reused", url: item.url });
        }
      }

      const finalizeRes = await fetch("/api/customers/walk-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonRef,
          name: walkInName.trim(),
          phone: walkInPhone.trim(),
          batchId,
          images: finalImages,
          selectedIndex: selectedDesign,
        }),
      });
      const finalizeData = await finalizeRes.json().catch(() => null);

      if (!finalizeRes.ok || !finalizeData?.success) {
        alert(mapErrorStatus(finalizeRes.status));
        return;
      }

      if (
        typeof finalizeData.customerId !== "number" ||
        !Number.isSafeInteger(finalizeData.customerId) ||
        finalizeData.customerId <= 0
      ) {
        alert("Something went wrong. Please try again.");
        return;
      }

      setCustomerId(finalizeData.customerId);
      setWalkInToken(batchId);
      setWalkInSaved(true);
    } catch (err) {
      console.error(
        "saveAsWalkIn failed:",
        err instanceof Error ? err.message : "unknown error"
      );
      alert("Something went wrong. Please try again.");
    } finally {
      walkInSavingRef.current = false;
      setWalkInSaving(false);
    }
  };

  if (showWelcome) {
    return (
      <main className="al-welcome" lang={lang}>
        <div className="al-page">
          <header className="al-header">
            <h1 className="al-logo">AL NAIL <span>AI<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21S3 15 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12Z" /></svg></span></h1>
            <label className="al-language"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/></svg><select aria-label={lang === "vi" ? "Ngôn ngữ" : "Language"} value={lang} onChange={(event) => setLang(event.target.value as Language)}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>
          </header>
          <section className="al-intro" aria-labelledby="al-title">
            <h2 id="al-title">{lang === "vi" ? "Móng xinh. Phong cách riêng. Mọi nơi." : "Your Nails, Your Style, Anywhere"}</h2>
            <div className="al-divider" aria-hidden="true"><span/>♥<span/></div>
            <p>{lang === "vi" ? "MÓNG ĐẸP DÀNH CHO MỌI NGƯỜI" : "BEAUTIFUL NAILS FOR EVERYONE"}</p>
          </section>
          <div className="al-hero"><img src="/al-nail-ai-hero.png" width={1536} height={1024} alt={lang === "vi" ? "Bộ móng hồng đính hoa trắng và nét vàng trên nền lụa hồng" : "Glossy pink manicure with white flowers and fine gold details on blush silk"} fetchPriority="high" /></div>
          <section className="al-panel" aria-label={lang === "vi" ? "Bắt đầu trải nghiệm" : "Start your experience"}>
            <h2 className="al-motto">{lang === "vi" ? "Hơn cả một bộ móng." : "More Than Nails."}<br/>{lang === "vi" ? "Một bạn đẹp hơn." : "A More Beautiful You."}</h2>
            <div className="al-underline" aria-hidden="true"/>
            <div className="al-features">
              <button type="button" className="al-feature" onClick={() => setShowWelcome(false)}><span className="al-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6ZM20 17v5m-2.5-2.5h5"/></svg></span><span>{lang === "vi" ? "Khám phá mẫu" : "Discover Designs"}</span></button>
              <button type="button" className="al-feature" onClick={() => fileInput.current?.click()}><span className="al-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 9.5 3h5L16 5h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="5"/></svg></span><span>{lang === "vi" ? "Thử móng với AI" : "Try On With AI"}</span></button>
              <details className="al-save"><summary className="al-feature"><span className="al-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21S3 15 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12Z"/></svg></span><span>{lang === "vi" ? "Lưu mẫu yêu thích" : "Save Your Looks"}</span></summary><div className="al-save-info"><p>{lang === "vi" ? "Sau khi chọn mẫu, bạn có thể lưu cùng tên và số điện thoại để đưa cho thợ nail." : "After choosing a design, save it with your name and phone number to show your nail technician."}</p><button type="button" onClick={() => setShowWelcome(false)}>{lang === "vi" ? "Chọn mẫu để lưu →" : "Choose a design to save →"}</button></div></details>
            </div>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { if (!event.target.files?.[0]) return; handleImage(event); setShowWelcome(false); }} />
            <div className="al-actions">
              <button type="button" className="al-primary" onClick={() => setShowWelcome(false)}>{lang === "vi" ? "Bắt đầu" : "Get Started"}<span aria-hidden="true">→</span></button>
              <button type="button" className="al-signin" onClick={() => { window.location.href = "/pro"; }}>{lang === "vi" ? "Đăng nhập (Dành cho thợ nail)" : "Sign In (For Nail Techs)"}<span aria-hidden="true">→</span></button>
              <button type="button" className="al-guest" onClick={() => setShowWelcome(false)}>{lang === "vi" ? "Tiếp tục với tư cách khách" : "Continue as Guest"}<span aria-hidden="true">→</span></button>
            </div>
            <ProArtwork variant="welcome" lang={lang} />
            <footer className="al-legal">{lang === "vi" ? "Bằng việc tiếp tục, bạn đồng ý với" : "By continuing, you agree to our"}<br/><a href="/legal">{lang === "vi" ? "Điều khoản dịch vụ và Chính sách quyền riêng tư" : "Terms of Service & Privacy Policy"}</a></footer>
          </section>
        </div>
        <style jsx>{`
          .al-welcome { min-height:100svh; color:#26151d; background:#fbe3ec; font-family:Arial,sans-serif; }
          .al-welcome * { box-sizing:border-box; }
          .al-page { max-width:680px; margin:auto; background:#fff2f7; min-height:100svh; }
          .al-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:27px 22px 15px; }
          .al-logo { margin:0; font:500 clamp(25px,5.8vw,40px)/1.15 Georgia,serif; letter-spacing:-1.4px; white-space:nowrap; color:#211219; }
          .al-logo>span { position:relative; color:#e91566; }
          .al-logo svg { position:absolute; width:16px; height:16px; top:-13px; right:0; fill:currentColor; }
          .al-language { display:flex; align-items:center; padding:0 9px; min-height:44px; border:1px solid #f2c1d4; border-radius:999px; background:#fff8fb; gap:5px; }
          .al-language svg { width:18px; height:18px; stroke:currentColor; stroke-width:1.6; fill:none; }
          .al-language select { font:12px Arial,sans-serif; min-height:42px; max-width:85px; color:#281620; border:0; background:transparent; cursor:pointer; }
          .al-intro { padding:12px 22px 20px; text-align:center; background:radial-gradient(ellipse at 10% 90%,#ffd8e8,transparent 70%); }
          .al-intro h2 { font:500 clamp(22px,5.1vw,33px)/1.22 Georgia,serif; color:#291620; margin:0 auto; max-width:560px; }
          .al-intro p { margin:9px 0 0; font-size:10px; letter-spacing:2px; line-height:1.5; color:#9e2454; }
          .al-divider { display:flex; align-items:center; justify-content:center; gap:10px; margin:11px 0 0; color:#ed1464; font-size:22px; }
          .al-divider span { width:65px; height:1px; background:linear-gradient(90deg,transparent,#f02870); }
          .al-divider span:last-child { transform:rotate(180deg); }
          .al-hero { width:100%; aspect-ratio:1.4; overflow:hidden; }
          .al-hero img { width:100%; height:100%; object-fit:cover; display:block; }
          .al-panel { position:relative; margin-top:-20px; padding:22px 18px max(22px,env(safe-area-inset-bottom)); border-radius:28px 28px 0 0; background:linear-gradient(145deg,#fff3f8,#ffe5ef); text-align:center; }
          .al-motto { font:italic 400 clamp(25px,6vw,38px)/1.22 Georgia,serif; margin:0; color:#3d1b2a; }
          .al-underline { margin:10px auto 18px; height:3px; width:74px; background:#f42072; border-radius:100%; transform:rotate(-4deg); }
          .al-features { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; align-items:start; position:relative; margin-bottom:15px; }
          .al-feature { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; width:100%; min-height:118px; padding:12px 6px; border:1px solid #f7c9dc; border-radius:17px; background:#fff9fc; color:#30202a; font:600 12px/1.35 Arial,sans-serif; cursor:pointer; box-shadow:0 3px 12px #bf276309; }
          .al-feature>span:last-child { max-width:100px; }
          .al-icon { display:flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:#ffe6f0; color:#f2196d; }
          .al-icon svg { width:28px; height:28px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
          .al-save summary { list-style:none; }
          .al-save summary::-webkit-details-marker { display:none; }
          .al-save-info { position:relative; margin-top:8px; padding:10px; border:1px solid #f1b6cf; border-radius:12px; background:#fff; font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
          .al-save-info p { margin:0 0 8px; }
          .al-save-info button { background:#ffe6ef; border:0; color:#881442; padding:10px 4px; border-radius:8px; cursor:pointer; font:inherit; min-height:44px; }
          .al-actions { display:flex; flex-direction:column; gap:10px; }
          .al-actions button { width:100%; min-height:48px; display:flex; align-items:center; justify-content:center; gap:12px; padding:11px 12px; border-radius:999px; cursor:pointer; font:600 14px/1.4 Arial,sans-serif; }
          .al-actions button span { font-size:23px; line-height:1; }
          .al-primary { color:#fff; background:linear-gradient(105deg,#fb1778,#eb0d61); border:1px solid #ed1167; box-shadow:0 5px 15px #ec22631a; }
          .al-signin { color:#281722; background:#fffafd; border:1px solid #bb8a9f; }
          .al-guest { background:transparent; color:#482637; border:0; }
          .al-legal { margin-top:15px; color:#775165; font-size:11px; line-height:1.65; }
          .al-legal a { color:inherit; text-decoration:underline; text-underline-offset:3px; }
          .al-feature:hover,.al-signin:hover { background:#ffeaf3; }
          .al-primary:hover { background:#d4115c; }
          .al-welcome button:focus-visible,.al-welcome summary:focus-visible,.al-welcome a:focus-visible,.al-language:focus-within { outline:3px solid #891249; outline-offset:3px; }
          @media(min-width:600px) { .al-panel { padding-left:32px; padding-right:32px; } .al-feature { font-size:16px; min-height:140px; } .al-feature>span:last-child { max-width:140px; } .al-actions button { font-size:18px; min-height:54px; } .al-legal { font-size:13px; } }
          @media(max-width:350px) { .al-header { padding-left:14px; padding-right:14px; gap:6px; } .al-logo { font-size:24px; } .al-language { padding:0 6px; } .al-panel { padding-left:12px; padding-right:12px; } .al-feature { font-size:11px; } .al-actions button { font-size:12px; } }
        `}</style>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 20px",
        textAlign: "center",
        fontFamily: "var(--font-body)",
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={() => setLang(lang === "en" ? "vi" : "en")}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          padding: "8px 16px",
          cursor: "pointer",
          borderRadius: "999px",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
          fontSize: "14px",
        }}
      >
        🌐 {t.switchLang}
      </button>

      {saveMessage && (
        <p style={{ marginBottom: "20px", color: "var(--accent)", fontWeight: 600 }}>
          {saveMessage}
        </p>
      )}

      {loyaltyInfo?.enabled && (
        <div
          style={{
            maxWidth: "500px",
            margin: "0 auto 24px",
            padding: "16px 18px",
            borderRadius: "14px",
            background: "var(--accent-soft)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
          }}
        >
          {loyaltyInfo.currentVisits >= loyaltyInfo.visitsRequired ||
          loyaltyInfo.currentSpent >= loyaltyInfo.amountRequired ? (
            <strong>
              🎉 You&apos;ve earned {loyaltyInfo.discountPercent}% off your next visit!
            </strong>
          ) : (
            <span>
              🎁 Loyalty progress: {loyaltyInfo.currentVisits}/
              {loyaltyInfo.visitsRequired} visits — get{" "}
              {loyaltyInfo.discountPercent}% off when you reach the goal!
            </span>
          )}
        </div>
      )}

      <div style={{ marginBottom: "36px" }}>
        <div style={{ fontSize: "46px", marginBottom: "10px" }}>💅</div>
        <h1 style={{ fontSize: "34px", marginBottom: "10px", letterSpacing: "-0.01em" }}>
          {t.appTitle}
        </h1>
        <p style={{ fontSize: "17px", color: "var(--foreground-soft)", margin: "0 0 22px" }}>
          {t.appSubtitle}
        </p>

        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "20px 22px",
            borderRadius: "18px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderLeft: "4px solid var(--accent)",
            lineHeight: "1.7",
            textAlign: "left",
            color: "var(--foreground)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
          }}
        >
          {t.instructions}
          <br />
          {t.aiExplain}
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleImage}
      />

      <button
        onClick={() => fileInput.current?.click()}
        style={{
          padding: "18px 32px",
          borderRadius: "999px",
          border: "none",
          fontSize: "17px",
          fontWeight: 600,
          cursor: "pointer",
          margin: "10px",
          background: "var(--accent)",
          color: "white",
          boxShadow: "0 6px 20px rgba(255,45,120,0.3)",
        }}
      >
        {t.chooseOrTakePhoto}
      </button>

      {image && (
        <div style={{ marginTop: "34px" }}>
          <h2 style={{ fontSize: "22px", marginBottom: "14px" }}>{t.yourHandPhoto}</h2>
          <img
            src={image}
            alt={t.yourHandPhoto}
            style={{
              maxWidth: "90%",
              width: "350px",
              borderRadius: "20px",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <br />
          {!cameFromGallery && (
            <button
              onClick={analyzeImage}
              disabled={loading}
              style={{
                padding: "18px 32px",
                borderRadius: "999px",
                border: "none",
                fontSize: "17px",
                fontWeight: 600,
                cursor: "pointer",
                marginTop: "24px",
                background: loading ? "var(--foreground-soft)" : "var(--accent)",
                color: "white",
                boxShadow: loading ? "none" : "0 6px 20px rgba(255,45,120,0.3)",
              }}
            >
              {loading ? t.analyzing : t.viewSuggestions}
            </button>
          )}
          {cameFromGallery && (
            <p style={{ marginTop: "16px", color: "var(--accent)", fontWeight: 600 }}>
              {lang === "vi"
                ? "Ảnh đã sẵn sàng! Kéo xuống để thử mẫu lên tay."
                : "Photo ready! Scroll down to try the design on your hand."}
            </p>
          )}
        </div>
      )}

      {result && (
        <div
          style={{
            margin: "36px auto",
            maxWidth: "600px",
            textAlign: "left",
            padding: "26px",
            borderRadius: "20px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ fontSize: "22px", marginBottom: "10px" }}>
            {cameFromGallery ? (lang === "vi" ? "Mẫu bạn đã chọn" : "Your chosen design") : t.suggestionsTitle}
          </h2>
          <p style={{ whiteSpace: "pre-wrap", color: "var(--foreground)", lineHeight: "1.6" }}>
            {result}
          </p>

          {designImages.length > 0 && (
            <div style={{ marginTop: "28px" }}>
              <h2 style={{ fontSize: "20px", marginBottom: "4px" }}>{t.chooseDesignTitle}</h2>
              <p style={{ fontSize: "13px", color: "var(--foreground-soft)", marginTop: "4px" }}>
                {t.disclaimerDesign}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginTop: "16px",
                }}
              >
                {designImages.map((img, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setSelectedDesign(index);
                      if (customerId) saveSelectedDesign(index, img);
                      setDesignImage(img);
                      setTryOnError("");
                      // KHONG xoa tryOnResults o day nua - giu lai de khach so sanh
                    }}
                    style={{
                      padding: "10px",
                      borderRadius: "18px",
                      cursor: "pointer",
                      border:
                        selectedDesign === index
                          ? "3px solid var(--accent)"
                          : "1px solid var(--border)",
                      background: "var(--surface)",
                      boxShadow:
                        selectedDesign === index
                          ? "0 4px 16px rgba(255,45,120,0.18)"
                          : "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                  >
                    <img
                      src={img}
                      alt={`${t.design} ${index + 1}`}
                      style={{ width: "100%", borderRadius: "12px" }}
                    />
                    <div style={{ marginTop: "8px", fontWeight: 600, color: "var(--foreground)" }}>
                      {t.design} {index + 1}
                    </div>
                    {designSources[index] === "real" && (
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          color: "var(--gold)",
                          fontWeight: 600,
                        }}
                      >
                        ✓ Thợ đã từng làm mẫu này
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={tryOnNails}
            disabled={tryOnLoading || !designImage || !image || tryOnCount >= MAX_TRYON_PER_VISIT}
            type="button"
            style={{
              marginTop: "22px",
              padding: "14px 24px",
              borderRadius: "999px",
              border: "1px solid var(--gold)",
              background: "transparent",
              color: "var(--gold)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tryOnLoading ? t.tryOnLoading : t.tryOnButton}
          </button>
          <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--foreground-soft)" }}>
            {lang === "vi"
              ? `Đã dùng ${tryOnCount}/${MAX_TRYON_PER_VISIT} lượt thử cho lần ghé này.`
              : `Used ${tryOnCount}/${MAX_TRYON_PER_VISIT} try-ons for this visit.`}
          </p>
          {tryOnCount >= MAX_TRYON_PER_VISIT && (
            <p style={{ marginTop: "4px", color: "var(--foreground-soft)", fontSize: "14px" }}>
              {lang === "vi"
                ? "Bạn đã dùng hết lượt thử miễn phí cho lần ghé này."
                : "You've used all your free try-ons for this visit."}
            </p>
          )}

          {tryOnResults.length > 0 && (
            <div style={{ marginTop: "28px" }}>
              <h2 style={{ fontSize: "20px", marginBottom: "14px" }}>{t.tryOnResultTitle}</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    tryOnResults.length > 1 ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr",
                  gap: "16px",
                }}
              >
                {tryOnResults.map((res, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "18px",
                      padding: "10px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        marginBottom: "8px",
                        color: "var(--foreground-soft)",
                      }}
                    >
                      {t.design} {res.designIndex + 1}
                    </div>
                    <img
                      src={res.image}
                      alt={t.tryOnResultTitle}
                      style={{
                        width: "100%",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeTryOnResult(i)}
                      style={{
                        marginTop: "10px",
                        width: "100%",
                        padding: "8px",
                        fontSize: "13px",
                        cursor: "pointer",
                        background: "transparent",
                        border: "1px solid var(--accent)",
                        borderRadius: "999px",
                        color: "var(--accent)",
                        fontWeight: 600,
                      }}
                    >
                      {lang === "vi" ? "Xóa ảnh này" : "Delete this"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tryOnError && (
            <p style={{ marginTop: "15px", color: "var(--accent-dark)" }}>{tryOnError}</p>
          )}

          {!customerId && designImages.length > 0 && !walkInSaved && (
            <div
              style={{
                marginTop: "32px",
                padding: "22px",
                background: "var(--accent-soft)",
                borderRadius: "18px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
              }}
            >
              <h3 style={{ fontSize: "18px", marginBottom: "12px" }}>
                Save this design — I want it!
              </h3>
              <input
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  marginBottom: "10px",
                  boxSizing: "border-box",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}
              />
              <input
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                placeholder="Phone number"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  marginBottom: "10px",
                  boxSizing: "border-box",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}
              />
              <button
                type="button"
                onClick={saveAsWalkIn}
                disabled={walkInSaving}
                style={{
                  padding: "14px 22px",
                  cursor: "pointer",
                  fontWeight: 600,
                  borderRadius: "999px",
                  border: "none",
                  background: "var(--accent)",
                  color: "white",
                }}
              >
                {walkInSaving ? "Saving..." : "Save & show to technician"}
              </button>
            </div>
          )}

          {walkInSaved && (
            <p style={{ marginTop: "20px", fontWeight: 600, color: "var(--accent)" }}>
              ✅ Information saved successfully.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}
