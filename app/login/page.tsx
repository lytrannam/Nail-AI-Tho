"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/customers");
  };

  return (
    <main style={{ padding: "40px 20px", fontFamily: "Arial" }}>
      <div style={{ maxWidth: "420px", margin: "0 auto" }}>
        <h1>AL NAIL AI</h1>
        <h2>Đăng nhập Salon</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "12px", marginBottom: "12px" }}
        />

        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "12px", marginBottom: "12px" }}
        />

        <button
          type="button"
          onClick={login}
          disabled={loading}
          style={{ padding: "12px 20px", cursor: "pointer" }}
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        {error && <p style={{ marginTop: "15px" }}>{error}</p>}
      </div>
    </main>
  );
}