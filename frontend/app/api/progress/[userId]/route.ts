import { NextRequest, NextResponse } from "next/server";
import { MODULES } from "@/src/lib/mock-data";

const BACKEND_URL =
  process.env.PROGRESS_URL ??
  process.env.TRIAGE_URL ??
  "http://localhost:8001";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  // Try real backend
  try {
    const res = await fetch(`${BACKEND_URL}/progress/${userId}`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Demo mode fallback
  }

  // Return mock progress data
  return NextResponse.json({
    modules: MODULES.map((m) => ({
      id: m.id,
      mastery: m.mastery,
      exercisesDone: m.exercisesDone,
    })),
    totalXp: 2450,
    streak: 7,
    level: "Intermediate",
    demo: true,
  });
}
