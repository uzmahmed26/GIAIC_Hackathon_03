import { NextRequest, NextResponse } from "next/server";

// ── Blocked patterns ──────────────────────────────────────────────────────────

const BLOCKED: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bimport\s+os\b/,          reason: "import os"       },
  { pattern: /\bimport\s+subprocess\b/,  reason: "import subprocess" },
  { pattern: /\bfrom\s+os\b/,            reason: "from os"         },
  { pattern: /\bfrom\s+subprocess\b/,    reason: "from subprocess" },
  { pattern: /\beval\s*\(/,              reason: "eval()"          },
  { pattern: /\bexec\s*\(/,              reason: "exec()"          },
  { pattern: /\bopen\s*\(/,              reason: "open()"          },
  { pattern: /__import__\s*\(/,          reason: "__import__()"    },
];

function checkBlocked(code: string): string | null {
  for (const { pattern, reason } of BLOCKED) {
    if (pattern.test(code)) return reason;
  }
  return null;
}

// ── Demo-mode executor ────────────────────────────────────────────────────────

function runDemo(code: string): { stdout: string; stderr: string; success: boolean } {
  // Lightweight simulation: detect print calls and echo them so the UI feels alive.
  const printMatches = [...code.matchAll(/print\s*\(([^)]+)\)/g)];

  if (printMatches.length === 0) {
    return {
      stdout: "(no print() calls detected — connect a real executor to run arbitrary Python)",
      stderr: "",
      success: true,
    };
  }

  const lines = printMatches.map((m) => {
    const arg = m[1].trim();
    // Strip surrounding quotes for plain string literals
    if ((arg.startsWith('"') && arg.endsWith('"')) ||
        (arg.startsWith("'") && arg.endsWith("'"))) {
      return arg.slice(1, -1);
    }
    return arg; // expression — show as-is
  });

  return {
    stdout: lines.join("\n"),
    stderr: "",
    success: true,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { code?: unknown; user_id?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, stdout: "", stderr: "Invalid JSON body", execution_time_ms: 0 },
      { status: 400 },
    );
  }

  const code    = typeof body.code    === "string" ? body.code    : null;
  const user_id = typeof body.user_id === "string" ? body.user_id : "anonymous";

  if (!code) {
    return NextResponse.json(
      { success: false, stdout: "", stderr: "Missing required field: code", execution_time_ms: 0 },
      { status: 400 },
    );
  }

  if (code.length > 10_000) {
    return NextResponse.json(
      { success: false, stdout: "", stderr: "Code exceeds maximum length (10 000 chars)", execution_time_ms: 0 },
      { status: 400 },
    );
  }

  // Safety check
  const blocked = checkBlocked(code);
  if (blocked) {
    return NextResponse.json(
      {
        success: false,
        stdout: "",
        stderr: `Blocked: "${blocked}" is not permitted in the sandbox.`,
        execution_time_ms: 0,
      },
      { status: 422 },
    );
  }

  const start = Date.now();

  // Demo mode — replace this block with a real executor (e.g. Pyodide, Judge0, or
  // a sidecar container) when you're ready to run actual Python.
  const DEMO_MODE = process.env.PYTHON_EXECUTOR_URL == null;

  if (DEMO_MODE) {
    const { stdout, stderr, success } = runDemo(code);
    const execution_time_ms = Date.now() - start;

    console.info(`[execute] demo run  user=${user_id}  lines=${code.split("\n").length}  ok=${success}`);

    return NextResponse.json(
      {
        success,
        stdout: stdout
          ? `${stdout}\n\n── Demo mode ──────────────────────────────────────────\n` +
            `This is a simulated run. To execute real Python, set\n` +
            `PYTHON_EXECUTOR_URL in your .env.local and connect an executor.`
          : "",
        stderr,
        execution_time_ms,
      },
      { status: 200 },
    );
  }

  // Real executor path (forward to external service)
  try {
    const res = await fetch(process.env.PYTHON_EXECUTOR_URL!, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code, user_id }),
      signal:  AbortSignal.timeout(15_000),
    });

    const data = await res.json() as {
      stdout?: string;
      stderr?: string;
      success?: boolean;
      output?:  string;
      error?:   string;
    };

    const execution_time_ms = Date.now() - start;

    console.info(
      `[execute] forwarded  user=${user_id}  status=${res.status}  ms=${execution_time_ms}`,
    );

    return NextResponse.json(
      {
        success:          data.success ?? res.ok,
        stdout:           data.stdout  ?? data.output ?? "",
        stderr:           data.stderr  ?? data.error  ?? "",
        execution_time_ms,
      },
      { status: res.ok ? 200 : 502 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown executor error";
    return NextResponse.json(
      {
        success: false,
        stdout:  "",
        stderr:  `Executor unreachable: ${message}`,
        execution_time_ms: Date.now() - start,
      },
      { status: 502 },
    );
  }
}
