"use client";

export default function StaffLoginPage() {
  return (
    <main style={{ padding: "40px", textAlign: "center" }}>
      <p>Tính năng này đang tạm thời không khả dụng.</p>
    </main>
  );
}

// Staff is temporarily unavailable. Original code is preserved below.
// "use client";
//
// import { Suspense, useState } from "react";
// import { useSearchParams } from "next/navigation";
// import { supabase } from "../../lib/supabase";
// import { translations, Language } from "../../lib/translations";
//
// function StaffLoginContent() {
//   const searchParams = useSearchParams();
//   const salonId = searchParams.get("salon");
//   const [pin, setPin] = useState("");
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [lang, setLang] = useState<Language>("vi");
//
//   const t = translations[lang];
//
//   const handleDigit = (digit: string) => {
//     if (pin.length < 4) {
//       setPin(pin + digit);
//     }
//   };
//
//   const handleClear = () => {
//     setPin("");
//     setError("");
//   };
//
//   const handleLogin = async (fullPin: string) => {
//     if (!salonId) {
//       setError(t.missingSalonInfo);
//       return;
//     }
//
//     setLoading(true);
//     setError("");
//
//     const { data, error: fetchError } = await supabase
//       .from("staff")
//       .select("id, name, is_active")
//       .eq("user_id", salonId)
//       .eq("pin_code", fullPin)
//       .single();
//
//     setLoading(false);
//
//     if (fetchError || !data) {
//       setError(t.pinIncorrect);
//       setPin("");
//       return;
//     }
//
//     if (!data.is_active) {
//       setError(t.staffLocked);
//       setPin("");
//       return;
//     }
//
//     sessionStorage.setItem("staff_id", String(data.id));
//     sessionStorage.setItem("staff_name", data.name);
//     sessionStorage.setItem("salon_id", salonId);
//
//     window.location.href = "/staff-work";
//   };
//
//   if (pin.length === 4 && !loading) {
//     handleLogin(pin);
//   }
//
//   return (
//     <main
//       style={{
//         minHeight: "100vh",
//         display: "flex",
//         flexDirection: "column",
//         alignItems: "center",
//         justifyContent: "center",
//         fontFamily: "var(--font-body)",
//         padding: "20px",
//         position: "relative",
//       }}
//     >
//       <button
//         type="button"
//         onClick={() => setLang(lang === "en" ? "vi" : "en")}
//         style={{
//           position: "absolute",
//           top: "20px",
//           right: "20px",
//           padding: "8px 16px",
//           cursor: "pointer",
//           borderRadius: "999px",
//           border: "1px solid var(--border)",
//           background: "var(--surface)",
//           color: "var(--foreground)",
//           fontSize: "14px",
//         }}
//       >
//         🌐 {t.switchLang}
//       </button>
//
//       <div style={{ fontSize: "48px", marginBottom: "12px" }}>💅</div>
//       <h1 style={{ marginBottom: "30px", fontSize: "24px" }}>{t.staffLoginTitle}</h1>
//
//       <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
//         {[0, 1, 2, 3].map((i) => (
//           <div
//             key={i}
//             style={{
//               width: "50px",
//               height: "60px",
//               border: `2px solid ${pin[i] ? "var(--accent)" : "var(--border)"}`,
//               borderRadius: "12px",
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "center",
//               fontSize: "28px",
//               background: "var(--surface)",
//               color: "var(--accent)",
//             }}
//           >
//             {pin[i] ? "●" : ""}
//           </div>
//         ))}
//       </div>
//
//       {error && (
//         <p style={{ color: "var(--accent-dark)", fontSize: "16px", marginBottom: "10px", fontWeight: 600 }}>
//           {error}
//         </p>
//       )}
//
//       {loading && <p style={{ fontSize: "16px", color: "var(--foreground-soft)" }}>{t.checking}</p>}
//
//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "repeat(3, 1fr)",
//           gap: "14px",
//           marginTop: "20px",
//         }}
//       >
//         {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
//           <button
//             key={digit}
//             type="button"
//             onClick={() => handleDigit(digit)}
//             style={{
//               width: "78px",
//               height: "78px",
//               fontSize: "28px",
//               borderRadius: "50%",
//               border: "1px solid var(--border)",
//               background: "var(--surface)",
//               color: "var(--foreground)",
//               cursor: "pointer",
//             }}
//           >
//             {digit}
//           </button>
//         ))}
//         <div />
//         <button
//           type="button"
//           onClick={() => handleDigit("0")}
//           style={{
//             width: "78px",
//             height: "78px",
//             fontSize: "28px",
//             borderRadius: "50%",
//             border: "1px solid var(--border)",
//             background: "var(--surface)",
//             color: "var(--foreground)",
//             cursor: "pointer",
//           }}
//         >
//           0
//         </button>
//         <button
//           type="button"
//           onClick={handleClear}
//           style={{
//             width: "78px",
//             height: "78px",
//             fontSize: "16px",
//             borderRadius: "50%",
//             border: "1px solid var(--border)",
//             background: "var(--accent-soft)",
//             color: "var(--accent-dark)",
//             cursor: "pointer",
//           }}
//         >
//           {t.clear}
//         </button>
//       </div>
//     </main>
//   );
// }
//
// export default function StaffLoginPage() {
//   return (
//     <Suspense fallback={<main style={{ padding: "40px" }}>Loading...</main>}>
//       <StaffLoginContent />
//     </Suspense>
//   );
// }
