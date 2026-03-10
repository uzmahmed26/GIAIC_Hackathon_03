import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.EXERCISE_URL ??
  process.env.TRIAGE_URL ??
  "http://localhost:8001";

interface GenerateBody {
  topic?: unknown;
  difficulty?: unknown;
  module?: unknown;
  quantity?: unknown;
  userId?: unknown;
}

export async function POST(req: NextRequest) {
  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topic, difficulty = "Intermediate", module: mod = 1, quantity = 3 } = body;

  if (!topic || typeof topic !== "string") {
    return NextResponse.json({ error: "Missing required field: topic" }, { status: 400 });
  }

  // Try real backend
  try {
    const res = await fetch(`${BACKEND_URL}/exercises/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, difficulty, module: mod, quantity }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Demo mode — return stub exercises
  }

  // Demo response
  const count = typeof quantity === "number" ? Math.min(quantity, 5) : 3;
  const exercises = Array.from({ length: count }, (_, i) => ({
    title: `${topic} Exercise ${i + 1}`,
    description: `Practice your ${topic} skills with this ${difficulty} challenge.`,
    starterCode: `# ${topic} - Exercise ${i + 1}\n# Your code here\n\ndef solution():\n    pass\n`,
    solution: `def solution():\n    # Example solution\n    return True\n`,
    testCases: [
      { input: "solution()", expected: "True" },
    ],
    xpReward: difficulty === "Beginner" ? 100 : difficulty === "Intermediate" ? 200 : 300,
  }));

  return NextResponse.json({ exercises, demo: true });
}
