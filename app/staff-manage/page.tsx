"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Staff = {
  id: number;
  name: string;
  pin_code: string;
  is_active: boolean;
};

export default function StaffManagePage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);

  const loadStaff = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("staff")
      .select("id, name, pin_code, is_active")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setStaffList(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const addStaff = async () => {
    if (!name.trim()) {
      alert("Vui lòng nhập tên thợ.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      alert("Mã PIN phải gồm đúng 4 chữ số.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Bạn cần đăng nhập.");
      return;
    }

    const { error } = await supabase.from("staff").insert({
      name: name.trim(),
      pin_code: pin,
      user_id: user.id,
    });

    if (error) {
      console.error(error);
      alert("Không thể thêm thợ. Có thể mã PIN đã trùng.");
      return;
    }

    setName("");
    setPin("");
    loadStaff();
  };

  const toggleActive = async (staff: Staff) => {
    const { error } = await supabase
      .from("staff")
      .update({ is_active: !staff.is_active })
      .eq("id", staff.id);

    if (error) {
      alert("Không thể cập nhật trạng thái.");
      return;
    }

    loadStaff();
  };

  if (loading) {
    return <main style={{ padding: "30px" }}>Đang tải...</main>;
  }

  return (
    <main style={{ padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <button
        type="button"
        onClick={() => {
          window.location.href = "/customers";
        }}
        style={{ padding: "10px 16px", marginBottom: "20px", cursor: "pointer" }}
      >
        ← Quay lại danh sách khách
      </button>

      <h1>Quản lý thợ</h1>

      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "16px",
          marginTop: "20px",
          maxWidth: "400px",
        }}
      >
        <h3>Thêm thợ mới</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên thợ"
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Mã PIN 4 số"
          inputMode="numeric"
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        />
        <button
          type="button"
          onClick={addStaff}
          style={{ padding: "10px 16px", cursor: "pointer", fontWeight: "bold" }}
        >
          + Thêm thợ
        </button>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h3>Danh sách thợ</h3>
        {staffList.length === 0 ? (
          <p>Chưa có thợ nào.</p>
        ) : (
          staffList.map((staff) => (
            <div
              key={staff.id}
              style={{
                background: "white",
                padding: "15px",
                borderRadius: "12px",
                marginBottom: "10px",
                maxWidth: "400px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: staff.is_active ? 1 : 0.5,
              }}
            >
              <div>
                <strong>{staff.name}</strong>
                <div>Mã PIN: {staff.pin_code}</div>
                <div>{staff.is_active ? "Đang làm việc" : "Đã nghỉ"}</div>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(staff)}
                style={{ padding: "8px 12px", cursor: "pointer" }}
              >
                {staff.is_active ? "Đánh dấu nghỉ" : "Mở lại"}
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}