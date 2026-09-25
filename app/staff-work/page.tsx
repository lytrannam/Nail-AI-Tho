"use client";

export default function StaffWorkPage() {
  return (
    <main style={{ padding: "40px", textAlign: "center" }}>
      <p>Tính năng này đang tạm thời không khả dụng.</p>
    </main>
  );
}

// Staff is temporarily unavailable. Original code is preserved below.
// "use client";
//
// import { useEffect, useRef, useState } from "react";
// import { supabase } from "../../lib/supabase";
// import { translations, Language } from "../../lib/translations";
//
// type WorkItem = {
//   appointmentId: number;
//   customerId: number;
//   customerName: string;
//   designImage: string | null;
//   tryonImage: string | null;
//   service: string | null;
// };
//
// export default function StaffWorkPage() {
//   const [lang, setLang] = useState<Language>("vi");
//   const t = translations[lang];
//   const [staffName, setStaffName] = useState("");
//   const [salonId, setSalonId] = useState("");
//   const [items, setItems] = useState<WorkItem[]>([]);
//   const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
//   const [capturedImage, setCapturedImage] = useState<string | null>(null);
//   const [saving, setSaving] = useState(false);
//   const [savedMessage, setSavedMessage] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const fileInput = useRef<HTMLInputElement>(null);
//
//   useEffect(() => {
//     const staff = sessionStorage.getItem("staff_name");
//     const salon = sessionStorage.getItem("salon_id");
//
//     if (!staff || !salon) {
//       window.location.href = "/staff-login";
//       return;
//     }
//
//     setStaffName(staff);
//     setSalonId(salon);
//     loadWork(salon);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);
//
//   const loadWork = async (salon: string) => {
//     const today = new Date();
//     const startOfDay = new Date(
//       today.getFullYear(),
//       today.getMonth(),
//       today.getDate()
//     ).toISOString();
//     const endOfDay = new Date(
//       today.getFullYear(),
//       today.getMonth(),
//       today.getDate() + 1
//     ).toISOString();
//
//     const { data: appointments, error } = await supabase
//       .from("appointments")
//       .select("id, customer_id, service, appointments_at")
//       .eq("user_id", salon)
//       .gte("appointments_at", startOfDay)
//       .lt("appointments_at", endOfDay);
//
//     if (error || !appointments) {
//       setLoading(false);
//       return;
//     }
//
//     const customerIds = appointments.map((a) => a.customer_id);
//
//     const { data: customers } = await supabase
//       .from("customers")
//       .select("id, name, selected_design_image, tryon_image")
//       .in("id", customerIds);
//
//     const workItems: WorkItem[] = appointments
//       .sort(
//         (a, b) =>
//           new Date(a.appointments_at).getTime() -
//           new Date(b.appointments_at).getTime()
//       )
//       .map((appt, index) => {
//         const customer = customers?.find((c) => c.id === appt.customer_id);
//
//         return {
//           appointmentId: appt.id,
//           customerId: appt.customer_id,
//           customerName: t.swCustomerNumber.replace("{n}", String(index + 1)),
//           designImage: customer?.selected_design_image || null,
//           tryonImage: customer?.tryon_image || null,
//           service: appt.service,
//         };
//       });
//
//     setItems(workItems);
//     setLoading(false);
//   };
//
//   const handleLogout = () => {
//     sessionStorage.removeItem("staff_id");
//     sessionStorage.removeItem("staff_name");
//     sessionStorage.removeItem("salon_id");
//     window.location.href = "/staff-login";
//   };
//
//   const handleTakePhoto = (item: WorkItem) => {
//     setSelectedItem(item);
//     setCapturedImage(null);
//     setSavedMessage(false);
//   };
//
//   const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = () => {
//         setCapturedImage(reader.result as string);
//       };
//       reader.readAsDataURL(file);
//     }
//   };
//
//   const handleSave = async () => {
//     if (!selectedItem || !capturedImage) return;
//
//     setSaving(true);
//
//     const { error } = await supabase
//       .from("appointments")
//       .update({ notes: "Đã hoàn thành, có ảnh xác nhận" })
//       .eq("id", selectedItem.appointmentId);
//
//     setSaving(false);
//
//     if (!error) {
//       setSavedMessage(true);
//       setTimeout(() => {
//         setSelectedItem(null);
//         setCapturedImage(null);
//         setSavedMessage(false);
//       }, 2000);
//     } else {
//       alert(t.swSaveError);
//     }
//   };
//
//   const handleRetake = () => {
//     setCapturedImage(null);
//     setTimeout(() => fileInput.current?.click(), 100);
//   };
//
//   const handleCancel = () => {
//     setSelectedItem(null);
//     setCapturedImage(null);
//   };
//
//   const LangToggle = () => (
//     <button
//       type="button"
//       onClick={() => setLang(lang === "en" ? "vi" : "en")}
//       style={{
//         position: "absolute",
//         top: "20px",
//         right: "20px",
//         padding: "8px 16px",
//         cursor: "pointer",
//         borderRadius: "999px",
//         border: "1px solid var(--border)",
//         background: "var(--surface)",
//         color: "var(--foreground)",
//         fontSize: "14px",
//       }}
//     >
//       🌐 {t.switchLang}
//     </button>
//   );
//
//   if (loading) {
//     return (
//       <main style={{ padding: "40px", textAlign: "center", fontSize: "20px", color: "var(--foreground-soft)" }}>
//         {t.swLoading}
//       </main>
//     );
//   }
//
//   if (savedMessage) {
//     return (
//       <main
//         style={{
//           minHeight: "100vh",
//           display: "flex",
//           flexDirection: "column",
//           alignItems: "center",
//           justifyContent: "center",
//           fontFamily: "var(--font-body)",
//         }}
//       >
//         <div style={{ fontSize: "72px" }}>✅</div>
//         <h1 style={{ fontSize: "24px", textAlign: "center", padding: "0 20px", marginTop: "12px" }}>
//           {t.staffSavedFor} {selectedItem?.customerName}
//         </h1>
//       </main>
//     );
//   }
//
//   if (selectedItem && capturedImage) {
//     return (
//       <main
//         style={{
//           minHeight: "100vh",
//           padding: "20px",
//           fontFamily: "var(--font-body)",
//           textAlign: "center",
//           position: "relative",
//         }}
//       >
//         <LangToggle />
//         <h2 style={{ fontSize: "22px" }}>
//           {t.staffTakePhotoFor} {selectedItem.customerName}
//         </h2>
//         <img
//           src={capturedImage}
//           alt={t.swCapturedPhotoAlt}
//           style={{
//             width: "100%",
//             maxWidth: "400px",
//             borderRadius: "18px",
//             marginTop: "20px",
//             border: "1px solid var(--border)",
//           }}
//         />
//         <div
//           style={{
//             marginTop: "30px",
//             display: "flex",
//             flexDirection: "column",
//             gap: "14px",
//             alignItems: "center",
//           }}
//         >
//           <button
//             type="button"
//             onClick={handleSave}
//             disabled={saving}
//             style={{
//               width: "100%",
//               maxWidth: "400px",
//               padding: "20px",
//               fontSize: "20px",
//               fontWeight: 600,
//               borderRadius: "999px",
//               border: "none",
//               background: "var(--accent)",
//               color: "white",
//               cursor: "pointer",
//             }}
//           >
//             {saving ? t.staffSaving : t.staffUseThisPhoto}
//           </button>
//           <button
//             type="button"
//             onClick={handleRetake}
//             style={{
//               width: "100%",
//               maxWidth: "400px",
//               padding: "16px",
//               fontSize: "18px",
//               borderRadius: "999px",
//               border: "1px solid var(--border)",
//               background: "var(--surface)",
//               color: "var(--foreground)",
//               cursor: "pointer",
//             }}
//           >
//             {t.staffRetake}
//           </button>
//         </div>
//       </main>
//     );
//   }
//
//   if (selectedItem) {
//     return (
//       <main
//         style={{
//           minHeight: "100vh",
//           display: "flex",
//           flexDirection: "column",
//           alignItems: "center",
//           justifyContent: "center",
//           fontFamily: "var(--font-body)",
//           padding: "20px",
//           position: "relative",
//         }}
//       >
//         <LangToggle />
//         <input
//           ref={fileInput}
//           type="file"
//           accept="image/*"
//           capture="environment"
//           style={{ display: "none" }}
//           onChange={handleImageChange}
//         />
//         <h2 style={{ fontSize: "22px", marginBottom: "20px" }}>
//           {t.staffTakePhotoFor} {selectedItem.customerName}
//         </h2>
//
//         {(selectedItem.tryonImage || selectedItem.designImage) && (
//           <div style={{ textAlign: "center", marginBottom: "20px" }}>
//             <p style={{ fontSize: "14px", color: "var(--foreground-soft)" }}>{t.swDesignToMake}</p>
//             <img
//               src={selectedItem.tryonImage || selectedItem.designImage || ""}
//               alt={t.swDesignToMake}
//               style={{
//                 width: "200px",
//                 borderRadius: "16px",
//                 border: "1px solid var(--border)",
//               }}
//             />
//           </div>
//         )}
//
//         <button
//           type="button"
//           onClick={() => fileInput.current?.click()}
//           style={{
//             width: "200px",
//             height: "200px",
//             borderRadius: "50%",
//             border: "none",
//             background: "var(--accent)",
//             color: "white",
//             fontSize: "20px",
//             fontWeight: 600,
//             cursor: "pointer",
//             boxShadow: "0 8px 24px rgba(140,47,75,0.3)",
//           }}
//         >
//           {t.staffTakePhotoButton}
//         </button>
//         <button
//           type="button"
//           onClick={handleCancel}
//           style={{
//             marginTop: "30px",
//             padding: "14px 26px",
//             fontSize: "16px",
//             borderRadius: "999px",
//             border: "1px solid var(--border)",
//             background: "var(--surface)",
//             color: "var(--foreground)",
//             cursor: "pointer",
//           }}
//         >
//           {t.staffCancel}
//         </button>
//       </main>
//     );
//   }
//
//   return (
//     <main style={{ padding: "24px 20px", fontFamily: "var(--font-body)", maxWidth: "700px", margin: "0 auto" }}>
//       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <h1 style={{ fontSize: "22px" }}>
//           {t.staffWelcome}, {staffName}
//         </h1>
//         <div style={{ display: "flex", gap: "10px" }}>
//           <button
//             type="button"
//             onClick={() => setLang(lang === "en" ? "vi" : "en")}
//             style={{
//               padding: "8px 14px",
//               cursor: "pointer",
//               borderRadius: "999px",
//               border: "1px solid var(--border)",
//               background: "var(--surface)",
//               color: "var(--foreground)",
//               fontSize: "13px",
//             }}
//           >
//             🌐 {t.switchLang}
//           </button>
//           <button
//             type="button"
//             onClick={handleLogout}
//             style={{
//               padding: "10px 16px",
//               cursor: "pointer",
//               borderRadius: "999px",
//               border: "1px solid var(--border)",
//               background: "var(--surface)",
//               color: "var(--foreground)",
//               fontSize: "13px",
//             }}
//           >
//             {t.staffLogout}
//           </button>
//         </div>
//       </div>
//
//       <h2 style={{ fontSize: "18px", marginTop: "24px", color: "var(--foreground-soft)" }}>
//         {t.staffTodayCustomers}
//       </h2>
//
//       {items.length === 0 ? (
//         <p style={{ fontSize: "16px", color: "var(--foreground-soft)" }}>{t.staffNoCustomers}</p>
//       ) : (
//         items.map((item) => (
//           <button
//             key={item.appointmentId}
//             type="button"
//             onClick={() => handleTakePhoto(item)}
//             style={{
//               display: "flex",
//               alignItems: "center",
//               gap: "16px",
//               width: "100%",
//               padding: "16px",
//               marginTop: "12px",
//               borderRadius: "18px",
//               border: "1px solid var(--border)",
//               background: "var(--surface)",
//               cursor: "pointer",
//               textAlign: "left",
//             }}
//           >
//             {item.tryonImage || item.designImage ? (
//               <img
//                 src={item.tryonImage || item.designImage || ""}
//                 alt={t.swNailDesignAlt}
//                 style={{
//                   width: "64px",
//                   height: "64px",
//                   borderRadius: "12px",
//                   objectFit: "cover",
//                 }}
//               />
//             ) : (
//               <div
//                 style={{
//                   width: "64px",
//                   height: "64px",
//                   borderRadius: "12px",
//                   background: "var(--accent-soft)",
//                 }}
//               />
//             )}
//             <div>
//               <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--foreground)" }}>
//                 {item.customerName}
//               </div>
//               <div style={{ fontSize: "14px", color: "var(--foreground-soft)" }}>
//                 {item.service || t.swUnknownService}
//               </div>
//             </div>
//           </button>
//         ))
//       )}
//     </main>
//   );
// }
