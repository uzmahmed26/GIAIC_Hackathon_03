"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/src/lib/auth";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const user = getSession();
    if (!user) router.replace("/login");
    else if (user.role === "teacher") router.replace("/teacher");
    else router.replace("/dashboard");
  }, [router]);
  return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#1e1e2e" }}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );
}
