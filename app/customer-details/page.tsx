"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

function CustomerDetailsContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("id");

  const [customer, setCustomer] = useState<{
    id: string;
    name: string;
    phone: string;
    nail_history: string | null;
  } | null>(null);

  const [nailHistory, setNailHistory] = useState("");
  const [newNailHistory, setNewNailHistory] = useState("");
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState("");
  const [selectedDesignImage, setSelectedDesignImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCustomer = async () => {
      if (!customerId) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.");
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, nail_history, selected_design, selected_design_image, last_visit")
        .eq("id", customerId)
        .single();

      if (error) {
        alert("Lỗi tải khách hàng: " + error.message);
        return;
      }

      if (data) {
        setCustomer(data);
        setNailHistory(data.nail_history || "");
        setSelectedDesign(data.selected_design || "");
        setSelectedDesignImage(data.selected_design_image || null);
        setLastVisit(data.last_visit || null);
      }
    };

    loadCustomer();
  }, [customerId]);

  const saveNailHistory = async () => {
    if (!customerId) return;

    setSaving(true);

    const { error } = await supabase
      .from("customers")
      .update({
        nail_history: newNailHistory
          ? `${nailHistory}\n${new Date().toLocaleDateString()} - ${newNailHistory}`.trim()
          : nailHistory,
        last_visit: new Date().toISOString(),
      })
      .eq("id", customerId);

    setSaving(false);

    if (error) {
      alert("Không thể lưu lịch sử nail.");
      return;
    }

    alert("Đã lưu lịch sử nail.");
    const updatedHistory = newNailHistory
      ? `${nailHistory}\n${new Date().toLocaleDateString()} - ${newNailHistory}`.trim()
      : nailHistory;

    setNailHistory(updatedHistory);
    setNewNailHistory("");
    setLastVisit(new Date().toISOString());
  };

  return (
    <main style={{ padding: "40px 20px", fontFamily: "Arial" }}>
      <h1>Hồ sơ khách hàng</h1>

      {!customer ? (
        <p>Đang tải thông tin khách hàng...</p>
      ) : (
        <div>
          <h2>{customer.name}</h2>
          {lastVisit && <p>Lần ghé thăm gần nhất: {new Date(lastVisit).toLocaleDateString()}</p>}
          <p>Số điện thoại: {customer.phone || "Chưa có số điện thoại"}</p>
          <div style={{ marginTop: "20px", marginBottom: "20px" }}>
            <h3>Mẫu nail đã chọn</h3>
            <p>{selectedDesign || "Chưa có mẫu nail được chọn."}</p>
            {selectedDesignImage && (
              <img
                src={selectedDesignImage}
                alt="Mẫu nail đã chọn"
                style={{
                  width: "220px",
                  maxWidth: "100%",
                  marginTop: "12px",
                  borderRadius: "12px",
                }}
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = `/?customerId=${customerId}`;
            }}
            style={{
              padding: "12px 18px",
              marginTop: "20px",
              cursor: "pointer",
            }}
          >
            Mở AI chọn mẫu nail
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.href = `/appointments?customerId=${customerId}`;
            }}
            style={{
              padding: "12px 18px",
              marginTop: "10px",
              cursor: "pointer",
            }}
          >
            Đặt lịch hẹn
          </button>

          <h3>Lịch sử làm nail</h3>
          {nailHistory && (
            <p style={{ whiteSpace: "pre-line" }}>
              {nailHistory}
            </p>
          )}

          <textarea
            value={newNailHistory}
            onChange={(e) => setNewNailHistory(e.target.value)}
            placeholder="Nhập lịch sử làm nail của khách..."
            rows={6}
            style={{
              width: "100%",
              maxWidth: "600px",
              padding: "12px",
              boxSizing: "border-box",
            }}
          />

          <div style={{ marginTop: "12px" }}>
            <button
              type="button"
              onClick={saveNailHistory}
              disabled={saving}
              style={{
                padding: "12px 20px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              {saving ? "Đang lưu..." : "Lưu lịch sử nail"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CustomerDetailsPage() {
  return (
    <Suspense fallback={<main style={{ padding: "40px 20px" }}>Đang tải...</main>}>
      <CustomerDetailsContent />
    </Suspense>
  );
}