"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "@/src/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const user = register(name, email, role);
      if (user.role === "teacher") router.push("/teacher");
      else router.push("/dashboard");
    }, 600);
  }

  const inputStyle = {
    background: "#313244",
    color: "#cdd6f4",
    border: "1px solid #45475a",
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #1e1e2e 0%, #181825 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            🐍
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#cdd6f4" }}>LearnFlow</h1>
          <p className="mt-1 text-sm" style={{ color: "#6c7086" }}>Create your account</p>
        </div>

        <div className="rounded-2xl border p-8" style={{ background: "#181825", borderColor: "#313244" }}>
          <h2 className="mb-6 text-xl font-semibold" style={{ color: "#cdd6f4" }}>Get started free</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "#a6adc8" }}>Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Maya Chen"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "#45475a")}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "#a6adc8" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "#45475a")}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "#a6adc8" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "#45475a")}
              />
            </div>

            {/* Role selector */}
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: "#a6adc8" }}>I am a…</label>
              <div className="grid grid-cols-2 gap-3">
                {(["student", "teacher"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium capitalize transition-all"
                    style={{
                      background: role === r ? "rgba(99,102,241,0.15)" : "transparent",
                      borderColor: role === r ? "#6366f1" : "#313244",
                      color: role === r ? "#a5b4fc" : "#a6adc8",
                    }}
                  >
                    <span className="text-2xl">{r === "student" ? "🎓" : "👨‍🏫"}</span>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "#6366f1" }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget.style.background = "#4f46e5"); }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget.style.background = "#6366f1"); }}
            >
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs" style={{ color: "#6c7086" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-medium hover:underline" style={{ color: "#6366f1" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
