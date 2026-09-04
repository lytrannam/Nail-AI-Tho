"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function CustomerDetailsPage() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("id");

  const [customer, setCustomer] = useState<{
    id: string;
    name: string;
    phone: string;
    nail_history: string | null;
  } | null>(null);

  const [nailHistory, setNailHistory] = useState("");
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
        .select("id, name, phone, nail_history")
        .eq("id", customerId)
        .single();

      if (error) {
  alert("Lỗi tải khách hàng: " + error.message);
  return;
}

if (data) {
  setCustomer(data);
  setNailHistory(data.nail_history || "");
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
        nail_history: nailHistory,
      })
      .eq("id", customerId);

    setSaving(false);

    if (error) {
      alert("Không thể lưu lịch sử nail.");
      return;
    }

    alert("Đã lưu lịch sử nail.");
  };

  return (
    <main style={{ padding: "40px 20px", fontFamily: "Arial" }}>
      <h1>Hồ sơ khách hàng</h1>

      {!customer ? (
        <p>Đang tải thông tin khách hàng...</p>
      ) : (
        <div>
          <h2>{customer.name}</h2>
          <p>Số điện thoại: {customer.phone || "Chưa có số điện thoại"}</p>

          <h3>Lịch sử làm nail</h3>

          <textarea
            value={nailHistory}
            onChange={(e) => setNailHistory(e.target.value)}
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