"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/src/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const user = login(email, password);
      if (!user) {
        setError("Invalid email or password. Try maya@example.com or john@example.com");
        setLoading(false);
        return;
      }
      if (user.role === "teacher") router.push("/teacher");
      else router.push("/dashboard");
    }, 600);
  }

  function handleGoogle() {
    const user = login("uzma@example.com", "any");
    if (user) router.push("/dashboard");
  }

  function handleQuickLogin(role: "student" | "teacher") {
    const e = role === "student" ? "uzma@example.com" : "john@example.com";
    const user = login(e, "any");
    if (!user) return;
    router.push(user.role === "teacher" ? "/teacher" : "/dashboard");
  }

  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(135deg, #1e1e2e 0%, #181825 100%)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-xl sm:h-14 sm:w-14 sm:text-2xl" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            🐍
          </div>
          <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "#cdd6f4" }}>LearnFlow</h1>
          <p className="mt-1 text-sm" style={{ color: "#6c7086" }}>AI-powered Python tutoring</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border p-5 sm:p-8" style={{ background: "#181825", borderColor: "#313244" }}>
          <h2 className="mb-5 text-lg font-semibold sm:mb-6 sm:text-xl" style={{ color: "#cdd6f4" }}>Welcome back</h2>

          {error && (
            <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ background: "rgba(243,139,168,0.1)", borderColor: "rgba(243,139,168,0.3)", color: "#f38ba8" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "#a6adc8" }}>Email</label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-3 text-base outline-none transition-all sm:text-sm"
                style={{ background: "#313244", color: "#cdd6f4", border: "1px solid #45475a" }}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "#45475a")}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "#a6adc8" }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 pr-11 text-base outline-none transition-all sm:text-sm"
                  style={{ background: "#313244", color: "#cdd6f4", border: "1px solid #45475a" }}
                  onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                  onBlur={(e) => (e.target.style.borderColor = "#45475a")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: "#6c7086" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#a6adc8")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#6c7086")}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="flex cursor-pointer items-center gap-2" style={{ color: "#a6adc8" }}>
                <input type="checkbox" className="rounded" /> Remember me
              </label>
              <button type="button" className="hover:underline" style={{ color: "#6366f1" }}>Forgot password?</button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: loading ? "#4f46e5" : "#6366f1" }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget.style.background = "#4f46e5"); }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget.style.background = "#6366f1"); }}
            >
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 border-t" style={{ borderColor: "#313244" }} />
            <span className="text-xs" style={{ color: "#6c7086" }}>or</span>
            <div className="flex-1 border-t" style={{ borderColor: "#313244" }} />
          </div>

          <button
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-xl border py-3 text-sm font-medium transition-all"
            style={{ borderColor: "#313244", color: "#cdd6f4", background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#313244")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-xs" style={{ color: "#6c7086" }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium hover:underline" style={{ color: "#6366f1" }}>Sign up</Link>
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-center text-xs" style={{ color: "#45475a" }}>Quick demo login</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickLogin("student")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-all"
              style={{ borderColor: "#313244", color: "#a6e3a1", background: "rgba(166,227,161,0.06)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(166,227,161,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(166,227,161,0.06)")}
            >
              🎓 Student
            </button>
            <button
              onClick={() => handleQuickLogin("teacher")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-all"
              style={{ borderColor: "#313244", color: "#89b4fa", background: "rgba(137,180,250,0.06)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(137,180,250,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(137,180,250,0.06)")}
            >
              👨‍🏫 Teacher
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
