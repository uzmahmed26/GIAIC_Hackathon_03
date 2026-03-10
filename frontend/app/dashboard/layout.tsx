"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/src/lib/auth";
import DashboardSidebar from "@/src/components/layout/DashboardSidebar";
import DashboardHeader from "@/src/components/layout/DashboardHeader";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const user = getSession();
    if (!user) router.replace("/login");
    else if (user.role === "teacher") router.replace("/teacher");
  }, [router]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#1e1e2e" }}>
      <DashboardSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
