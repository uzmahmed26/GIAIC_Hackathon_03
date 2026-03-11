import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.DEBUG_URL ??
  process.env.DEBUG_BACKEND_URL ??
  "http://localhost:8001";

interface Issue {
  severity: "error" | "warning" | "info";
  message: string;
}

function analyzeDemo(code: string): {
  summary: string;
  issues: Issue[];
  suggestions: string[];
} {
  const lines = code.split("\n");
  const issues: Issue[] = [];
  const suggestions: string[] = [];

  // Check for missing type hints on def lines
  const defLines = lines.filter((l) => /^\s*def /.test(l));
  const untyped = defLines.filter((l) => !l.includes("->") || !l.includes(":"));
  if (untyped.length > 0)
    issues.push({ severity: "info", message: "Some functions are missing return type hints." });

  // Check for bare except
  if (/except\s*:/.test(code))
    issues.push({ severity: "warning", message: 'Bare `except:` catches everything — use `except Exception as e:` instead.' });

  // Check for print inside a function (might be debug leftover)
  if (/def [\s\S]*?\n\s+print\(/.test(code))
    issues.push({ severity: "info", message: "Found `print()` inside a function — consider using logging for production code." });

  // Check for very long lines
  const longLines = lines.filter((l) => l.length > 88);
  if (longLines.length > 0)
    issues.push({ severity: "warning", message: `${longLines.length} line(s) exceed 88 characters (PEP 8 recommendation).` });

  // Check for TODO / FIXME comments
  if (/#.*(TODO|FIXME|HACK|XXX)/i.test(code))
    issues.push({ severity: "info", message: "Found TODO/FIXME comment — make sure it's tracked." });

  // Check for mutable default arguments
  if (/def .*=\s*(\[\]|\{\})/.test(code))
    issues.push({ severity: "error", message: "Mutable default argument detected (e.g. `def f(x=[])`). Use `None` as default and assign inside the function." });

  // Suggestions
  if (defLines.length > 0 && !code.includes('"""') && !code.includes("'''"))
    suggestions.push("Add docstrings to your functions to document their purpose and arguments.");

  if (!code.includes("if __name__") && !code.includes("def ") === false)
    suggestions.push('Wrap top-level code in `if __name__ == "__main__":` to make the module importable.');

  if (code.includes("range(len("))
    suggestions.push("Replace `range(len(x))` with `enumerate(x)` for more idiomatic Python.");

  if (/\blist\(/.test(code) || /\bdict\(/.test(code))
    suggestions.push("Prefer list literals `[]` and dict literals `{}` over `list()` and `dict()` for clarity.");

  const summary =
    issues.length === 0
      ? "Looks good! No obvious issues found in your code."
      : `Found ${issues.length} issue${issues.length > 1 ? "s" : ""}. Review the details below.`;

  return { summary, issues, suggestions };
}

export async function POST(req: NextRequest) {
  let body: { code?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : null;
  if (!code) {
    return NextResponse.json({ error: "Missing required field: code" }, { status: 400 });
  }

  // Try the real backend first
  try {
    const res = await fetch(`${BACKEND_URL}/debug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Backend unreachable — fall through to demo analysis
  }

  // Demo mode — static analysis
  console.info("[debug] demo analysis");
  const result = analyzeDemo(code);
  return NextResponse.json({ ...result, demo: true });
}
