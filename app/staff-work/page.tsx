"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type WorkItem = {
  appointmentId: number;
  customerId: number;
  customerName: string;
  designImage: string | null;
  service: string | null;
};

export default function StaffWorkPage() {
  const [staffName, setStaffName] = useState("");
  const [salonId, setSalonId] = useState("");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const staff = sessionStorage.getItem("staff_name");
    const salon = sessionStorage.getItem("salon_id");

    if (!staff || !salon) {
      window.location.href = "/staff-login";
      return;
    }

    setStaffName(staff);
    setSalonId(salon);
    loadWork(salon);
  }, []);

  const loadWork = async (salon: string) => {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).toISOString();
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    ).toISOString();

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, customer_id, service, appointments_at")
      .eq("user_id", salon)
      .gte("appointments_at", startOfDay)
      .lt("appointments_at", endOfDay);

    if (error || !appointments) {
      setLoading(false);
      return;
    }

    const customerIds = appointments.map((a) => a.customer_id);

    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, selected_design_image")
      .in("id", customerIds);

    const workItems: WorkItem[] = appointments.map((appt) => {
      const customer = customers?.find((c) => c.id === appt.customer_id);
      const shortName = customer?.name
        ? customer.name.split(" ").slice(-1)[0]
        : "Khách";

      return {
        appointmentId: appt.id,
        customerId: appt.customer_id,
        customerName: shortName,
        designImage: customer?.selected_design_image || null,
        service: appt.service,
      };
    });

    setItems(workItems);
    setLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("staff_id");
    sessionStorage.removeItem("staff_name");
    sessionStorage.removeItem("salon_id");
    window.location.href = "/staff-login";
  };

  const handleTakePhoto = (item: WorkItem) => {
    setSelectedItem(item);
    setCapturedImage(null);
    setSavedMessage(false);
    setTimeout(() => fileInput.current?.click(), 100);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!selectedItem || !capturedImage) return;

    setSaving(true);

    const { error } = await supabase
      .from("appointments")
      .update({ notes: "Đã hoàn thành, có ảnh xác nhận" })
      .eq("id", selectedItem.appointmentId);

    setSaving(false);

    if (!error) {
      setSavedMessage(true);
      setTimeout(() => {
        setSelectedItem(null);
        setCapturedImage(null);
        setSavedMessage(false);
      }, 2000);
    } else {
      alert("Không thể lưu. Vui lòng thử lại.");
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setTimeout(() => fileInput.current?.click(), 100);
  };

  const handleCancel = () => {
    setSelectedItem(null);
    setCapturedImage(null);
  };

  if (loading) {
    return (
      <main style={{ padding: "40px", textAlign: "center", fontSize: "24px" }}>
        Đang tải...
      </main>
    );
  }

  // Màn hình xác nhận đã lưu
  if (savedMessage) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: "80px" }}>✅</div>
        <h1 style={{ fontSize: "28px", textAlign: "center", padding: "0 20px" }}>
          Đã lưu cho {selectedItem?.customerName}
        </h1>
      </main>
    );
  }

  // Màn hình xem lại ảnh vừa chụp
  if (selectedItem && capturedImage) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "20px",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "26px" }}>Ảnh cho {selectedItem.customerName}</h2>
        <img
          src={capturedImage}
          alt="Ảnh vừa chụp"
          style={{
            width: "100%",
            maxWidth: "400px",
            borderRadius: "16px",
            marginTop: "20px",
          }}
        />
        <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "22px",
              fontSize: "22px",
              fontWeight: "bold",
              borderRadius: "16px",
              border: "none",
              background: "#2e7d32",
              color: "white",
              cursor: "pointer",
            }}
          >
            {saving ? "Đang lưu..." : "✅ DÙNG ẢNH NÀY"}
          </button>
          <button
            type="button"
            onClick={handleRetake}
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "18px",
              fontSize: "20px",
              borderRadius: "16px",
              border: "1px solid #999",
              background: "white",
              cursor: "pointer",
            }}
          >
            🔄 CHỤP LẠI
          </button>
        </div>
      </main>
    );
  }

  // Màn hình chờ chụp (đã chọn khách nhưng chưa chụp)
  if (selectedItem) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          padding: "20px",
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleImageChange}
        />
        <h2 style={{ fontSize: "26px", marginBottom: "30px" }}>
          Chụp tay cho {selectedItem.customerName}
        </h2>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          style={{
            width: "220px",
            height: "220px",
            borderRadius: "50%",
            border: "none",
            background: "#1976d2",
            color: "white",
            fontSize: "22px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          📷 CHỤP
        </button>
        <button
          type="button"
          onClick={handleCancel}
          style={{
            marginTop: "30px",
            padding: "14px 24px",
            fontSize: "18px",
            borderRadius: "12px",
            border: "1px solid #999",
            background: "white",
            cursor: "pointer",
          }}
        >
          Hủy
        </button>
      </main>
    );
  }

  // Màn hình danh sách khách chờ
  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "24px" }}>Xin chào, {staffName}</h1>
        <button
          type="button"
          onClick={handleLogout}
          style={{ padding: "10px 16px", cursor: "pointer" }}
        >
          Đăng xuất
        </button>
      </div>

      <h2 style={{ fontSize: "20px", marginTop: "20px" }}>Khách hôm nay</h2>

      {items.length === 0 ? (
        <p style={{ fontSize: "18px" }}>Chưa có khách nào hôm nay.</p>
      ) : (
        items.map((item) => (
          <button
            key={item.appointmentId}
            type="button"
            onClick={() => handleTakePhoto(item)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              width: "100%",
              padding: "16px",
              marginBottom: "14px",
              borderRadius: "16px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {item.designImage ? (
              <img
                src={item.designImage}
                alt="Mẫu nail"
                style={{ width: "70px", height: "70px", borderRadius: "12px", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "70px",
                  height: "70px",
                  borderRadius: "12px",
                  background: "#eee",
                }}
              />
            )}
            <div>
              <div style={{ fontSize: "22px", fontWeight: "bold" }}>
                {item.customerName}
              </div>
              <div style={{ fontSize: "16px", color: "#666" }}>
                {item.service || "Chưa rõ dịch vụ"}
              </div>
            </div>
          </button>
        ))
      )}
    </main>
  );
}