"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CustomersPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [showRemindersOnly, setShowRemindersOnly] = useState(false);
  const [customers, setCustomers] = useState<
    { id: string; name: string; phone: string; last_visit?: string | null }[]
  >([]);

useEffect(() => {
  const loadCustomers = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, last_visit")
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

  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: name.trim(),
      phone: phone.trim(),
      user_id: user.id,
    })
    .select("id, name, phone")
    .single();

  if (error) {
    console.error(error);
    alert("Không thể lưu khách hàng.");
    return;
  }

  setCustomers([...customers, data]);
  setName("");
  setPhone("");
};
const filteredCustomers = customers
  .filter((customer) => {
    const keyword = search.toLowerCase().trim();

    const matchesSearch =
  customer.name.toLowerCase().includes(keyword) ||
  customer.phone.includes(keyword);

const needsReminder =
  !!customer.last_visit &&
  Date.now() - new Date(customer.last_visit).getTime() >
    21 * 24 * 60 * 60 * 1000;

return matchesSearch && (!showRemindersOnly || needsReminder);
  })
  .sort((a,b) =>{
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
          <p
  onClick={() => setShowRemindersOnly(!showRemindersOnly)}
  style={{ fontWeight: "bold", cursor: "pointer" }}>
  🔔 Khách cần nhắc quay lại: {reminderCount}
  {showRemindersOnly && (
  <p>
    Đang lọc: khách cần nhắc quay lại — bấm 🔔 lần nữa để xem tất cả
  </p>
)}
</p>
          <input
  type="text"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Tìm theo tên hoặc số điện thoại..."
  style={{
    width: "100%",
    maxWidth: "400px",
    padding: "10px",
    marginBottom: "20px",
    border: "1px solid #ccc",
borderRadius: "8px",
  }}
/>

          {filteredCustomers.length === 0 ? (
            <p>Chưa có khách hàng.</p>
          ) : (
            filteredCustomers.map((customer, index) => (
  <div
    key={index}
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
  <a
    href={`sms:${customer.phone}`}
    style={{ display: "inline-block", marginTop: "6px" }}
  >
    💬 Nhắn tin
  </a>
)}
    <p>
  Lần ghé gần nhất:{" "}
  {customer.last_visit &&
  Date.now() - new Date(customer.last_visit).getTime() > 21 * 24 * 60 * 60 * 1000 && (
    <p>⚠️ Khách đã hơn 21 ngày chưa quay lại</p>
  )}
  {customer.last_visit
    ? new Date(customer.last_visit).toLocaleDateString("vi-VN")
    : "Chưa có"}
</p>
  </div>
))
          )}
        </div>
      </div>
    </main>
  );
}