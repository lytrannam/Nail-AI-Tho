"use client";

import { useState } from "react";

export default function CustomersPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customers, setCustomers] = useState<
    { name: string; phone: string }[]
  >([]);

  const addCustomer = () => {
    if (!name.trim()) return;

    setCustomers([
      ...customers,
      {
        name: name.trim(),
        phone: phone.trim(),
      },
    ]);

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
                <strong>{customer.name}</strong>
                <div>{customer.phone || "Chưa có số điện thoại"}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}