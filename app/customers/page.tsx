"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CustomersPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [showRemindersOnly, setShowRemindersOnly] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [customers, setCustomers] = useState<
    {
      id: string;
      name: string;
      phone: string;
      email?: string | null;
      last_visit?: string | null;
      selected_design_image?: string | null;
      all_design_images?: string[] | null;
    }[]
  >([]);

  useEffect(() => {
    const loadCustomers = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, name, phone, email, last_visit, selected_design_image, all_design_images"
        )
        .eq("user_id", user.id);

      if (!error && data) {
        setCustomers(data);
      }
    };

    loadCustomers();
  }, []);

  const addCustomer = async () => {
    if (!name.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Bạn cần đăng nhập.");
      return;
    }
const newToken =
  Math.random().toString(36).slice(2) + Date.now().toString(36);
    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        user_id: user.id,
        session_token: newToken,
      })
      .select("id, name, phone, email")
      .single();

    if (error) {
      console.error(error);
      alert("Không thể lưu khách hàng.");
      return;
    }

    setCustomers([...customers, data]);
    setName("");
    setPhone("");
    setEmail("");
  };

  const filteredCustomers = customers
    .filter((customer) => {
      const keyword = search.toLowerCase().trim();

      const matchesSearch =
        customer.name.toLowerCase().includes(keyword) ||
        (customer.phone ?? "").includes(keyword) ||
        (customer.email ?? "").toLowerCase().includes(keyword);

      const needsReminder =
        !!customer.last_visit &&
        Date.now() - new Date(customer.last_visit).getTime() >
          21 * 24 * 60 * 60 * 1000;

      return matchesSearch && (!showRemindersOnly || needsReminder);
    })
    .sort((a, b) => {
      const timeA = a.last_visit ? new Date(a.last_visit).getTime() : 0;
      const timeB = b.last_visit ? new Date(b.last_visit).getTime() : 0;
      return timeB - timeA;
    });

  const reminderCount = customers.filter((customer) => {
    if (!customer.last_visit) return false;
    return (
      Date.now() - new Date(customer.last_visit).getTime() >
      21 * 24 * 60 * 60 * 1000
    );
  }).length;

  const sendReminderToAll = async () => {
    const customersToRemind = customers.filter((customer) => {
      const needsReminder =
        !!customer.last_visit &&
        Date.now() - new Date(customer.last_visit).getTime() >
          21 * 24 * 60 * 60 * 1000;
      return needsReminder && customer.email;
    });

    if (customersToRemind.length === 0) {
      alert("Không có khách nào cần nhắc (hoặc chưa có email).");
      return;
    }

    setSendingAll(true);
    let successCount = 0;

    for (const customer of customersToRemind) {
      try {
        const res = await fetch("/api/send-reminder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toEmail: customer.email,
            customerName: customer.name,
            oldDesignImage: customer.selected_design_image,
            newDesignImages: (customer.all_design_images || []).filter(
              (img) => img !== customer.selected_design_image
            ),
          }),
        });
        const data = await res.json();
        if (!data.error) successCount++;
      } catch (error) {
        console.error(error);
      }
    }

    setSendingAll(false);
    alert(
      `Đã gửi email nhắc cho ${successCount}/${customersToRemind.length} khách.`
    );
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
        background: "#fafafa",
      }}
    >
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        <h1>Khách hàng</h1>
        <p>Lưu thông tin khách và lịch sử làm nail.</p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/stats";
          }}
          style={{
            padding: "10px 16px",
            marginBottom: "10px",
            cursor: "pointer",
          }}
        >
          📊 Xem thống kê
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/staff-manage";
          }}
          style={{
            padding: "10px 16px",
            marginBottom: "10px",
            marginLeft: "8px",
            cursor: "pointer",
          }}
        >
          👤 Quản lý thợ
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/staff-qr";
          }}
          style={{
            padding: "10px 16px",
            marginBottom: "10px",
            marginLeft: "8px",
            cursor: "pointer",
          }}
        >
          🔒 Mã QR cho thợ
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/loyalty-settings";
          }}
          style={{
            padding: "10px 16px",
            marginBottom: "10px",
            marginLeft: "8px",
            cursor: "pointer",
          }}
        >
          🎁 Điểm thưởng
        </button>
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "16px",
            marginTop: "25px",
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên khách hàng"
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Số điện thoại"
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (không bắt buộc)"
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />

          <button
            type="button"
            onClick={addCustomer}
            style={{
              padding: "12px 20px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            + Thêm khách hàng
          </button>
        </div>

        <div style={{ marginTop: "30px" }}>
          <h2>Danh sách khách hàng</h2>
          <p>Tổng số khách: {customers.length}</p>

          <div
            onClick={() => setShowRemindersOnly(!showRemindersOnly)}
            style={{ fontWeight: "bold", cursor: "pointer" }}
          >
            🔔 Khách cần nhắc quay lại: {reminderCount}
            {showRemindersOnly && (
              <div style={{ fontWeight: "normal", fontSize: "0.9em" }}>
                Đang lọc: khách cần nhắc quay lại — bấm 🔔 lần nữa để xem tất cả
              </div>
            )}
          </div>

          {reminderCount > 0 && (
            <button
              type="button"
              onClick={sendReminderToAll}
              disabled={sendingAll}
              style={{
                marginTop: "10px",
                padding: "10px 16px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              {sendingAll
                ? "Đang gửi..."
                : `📧 Gửi email nhắc tất cả (${reminderCount})`}
            </button>
          )}

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, số điện thoại hoặc email..."
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "10px",
              marginTop: "10px",
              marginBottom: "20px",
              border: "1px solid #ccc",
              borderRadius: "8px",
            }}
          />

          {filteredCustomers.length === 0 ? (
            <p>Chưa có khách hàng.</p>
          ) : (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                style={{
                  background: "white",
                  padding: "15px",
                  borderRadius: "12px",
                  marginBottom: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/customer-details?id=${customer.id}`;
                  }}
                >
                  <strong>{customer.name}</strong>
                </button>

                <div>
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                  ) : (
                    "Chưa có số điện thoại"
                  )}
                </div>

                {customer.phone && (
                  
                   <a href={`sms:${customer.phone}`}
                    style={{ display: "inline-block", marginTop: "6px" }}
                  >
                    💬 Nhắn tin
                  </a>
                )}

                <div>
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`}>{customer.email}</a>
                  ) : (
                    "Chưa có email"
                  )}
                </div>

                {customer.email && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch("/api/send-reminder", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          toEmail: customer.email,
                          customerName: customer.name,
                          oldDesignImage: customer.selected_design_image,
                          newDesignImages: (
                            customer.all_design_images || []
                          ).filter(
                            (img) => img !== customer.selected_design_image
                          ),
                        }),
                      });
                      const data = await res.json();
                      if (data.error) {
                        alert("Lỗi: " + data.error);
                      } else {
                        alert("Đã gửi email nhắc cho " + customer.name);
                      }
                    }}
                    style={{
                      marginTop: "8px",
                      padding: "8px 14px",
                      cursor: "pointer",
                      display: "block",
                    }}
                  >
                    📧 Gửi email nhắc
                  </button>
                )}

                <div>
                  Lần ghé gần nhất:{" "}
                  {customer.last_visit
                    ? new Date(customer.last_visit).toLocaleDateString("vi-VN")
                    : "Chưa có"}
                  {customer.last_visit &&
                    Date.now() - new Date(customer.last_visit).getTime() >
                      21 * 24 * 60 * 60 * 1000 && (
                      <div>⚠️ Khách đã hơn 21 ngày chưa quay lại</div>
                    )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}