"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CustomersPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customers, setCustomers] = useState<
    { id: string;name: string; phone: string }[]
  >([]);

useEffect(() => {
  const loadCustomers = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone")
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

          {customers.length === 0 ? (
            <p>Chưa có khách hàng.</p>
          ) : (
            customers.map((customer, index) => (
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

    <div>{customer.phone || "Chưa có số điện thoại"}</div>
  </div>
))
          )}
        </div>
      </div>
    </main>
  );
}