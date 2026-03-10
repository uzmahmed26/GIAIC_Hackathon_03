"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { executeCode, debugCode } from "@/src/lib/api";
import { useToast } from "@/src/components/ui/Toast";
import { CODE_HISTORY } from "@/src/lib/mock-data";
import type { CodeRun } from "@/src/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const STARTER = `def fibonacci(n: int) -> list[int]:
    """Return the first n Fibonacci numbers."""
    if n <= 0:
        return []
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence[:n]

# Try it out
result = fibonacci(10)
print("Fibonacci sequence:", result)
print("10th number:", result[-1])
`;

type PanelTab = "output" | "review" | "tests" | "history";

const TEST_CASES = [
  { input: "fibonacci(0)", expected: "[]", actual: "[]", passed: true },
  { input: "fibonacci(5)", expected: "[0, 1, 1, 2, 3]", actual: "[0, 1, 1, 2, 3]", passed: true },
  { input: "fibonacci(10)", expected: "[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]", actual: "Pending", passed: null },
];

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function CodePage() {
  const { toast } = useToast();
  const [code, setCode] = useState(STARTER);
  const [output, setOutput] = useState("");
  const [outputError, setOutputError] = useState(false);
  const [running, setRunning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>("output");
  const [fontSize, setFontSize] = useState(14);
  const [history, setHistory] = useState<CodeRun[]>(CODE_HISTORY);
  const editorRef = useRef<unknown>(null);

  async function handleRun() {
    if (running) return;
    setRunning(true);
    setOutput("Running…");
    setOutputError(false);
    setActiveTab("output");
    try {
      // Uses centralized api.ts — retry + interceptors included
      const data = await executeCode(code);
      const out = data.stdout ?? data.output ?? "(no output)";
      const err = data.stderr ?? "";
      if (!data.success && err) {
        setOutput(err);
        setOutputError(true);
        toast("Execution error — check your code.", "warning");
      } else {
        setOutput(out);
        setOutputError(false);
        toast("Code executed successfully.", "success");
      }
      const run: CodeRun = {
        id: `run-${Date.now()}`,
        code,
        output: data.success ? out : err,
        timestamp: new Date(),
        success: data.success ?? true,
      };
      setHistory((prev) => [run, ...prev.slice(0, 9)]);
    } catch {
      // api.ts interceptor already showed an error toast
      setOutput("⚠ Could not reach the execution backend — running in demo mode.");
      setOutputError(true);
    } finally {
      setRunning(false);
    }
  }

  async function handleReview() {
    if (analyzing) return;
    setAnalyzing(true);
    setActiveTab("review");
    setReview(null);
    try {
      const data = await debugCode(code);
      setReview(data.summary ?? data.message ?? data.raw ?? "No feedback returned.");
      toast("AI review complete.", "success");
    } catch {
      setReview("⚠ Could not reach the debug service.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "code.py";
    a.click();
  }

  const TABS: { key: PanelTab; label: string }[] = [
    { key: "output", label: "Output" },
    { key: "review", label: "AI Review" },
    { key: "tests", label: "Test Cases" },
    { key: "history", label: "History" },
  ];

  return (
    <div className="flex h-full" style={{ background: "#1e1e2e" }}>
      {/* Editor 60% */}
      <div className="flex flex-col" style={{ width: "60%" }}>
        {/* Toolbar */}
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2" style={{ background: "#181825", borderColor: "#313244" }}>
          <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium" style={{ borderColor: "#313244", color: "#a6adc8" }}>
            🐍 Python
          </div>
          <div className="flex-1" />
          {/* Font size */}
          <div className="flex items-center gap-1 rounded-lg border px-1.5" style={{ borderColor: "#313244" }}>
            <button onClick={() => setFontSize((s) => Math.max(10, s - 1))} className="px-1.5 py-1 text-xs transition-all" style={{ color: "#a6adc8" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#cdd6f4")} onMouseLeave={(e) => (e.currentTarget.style.color = "#a6adc8")}>−</button>
            <span className="min-w-[2rem] text-center text-xs" style={{ color: "#6c7086" }}>{fontSize}</span>
            <button onClick={() => setFontSize((s) => Math.min(24, s + 1))} className="px-1.5 py-1 text-xs transition-all" style={{ color: "#a6adc8" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#cdd6f4")} onMouseLeave={(e) => (e.currentTarget.style.color = "#a6adc8")}>+</button>
          </div>
          {/* Action buttons */}
          <button onClick={handleSave} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all" style={{ borderColor: "#313244", color: "#a6adc8" }} onMouseEnter={(e) => { (e.currentTarget.style.background = "#313244"); }} onMouseLeave={(e) => { (e.currentTarget.style.background = "transparent"); }}>
            💾 Save
          </button>
          <button onClick={handleReview} disabled={analyzing} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50" style={{ background: "rgba(137,180,250,0.15)", color: "#89b4fa" }} onMouseEnter={(e) => { if (!analyzing) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(137,180,250,0.25)"; } }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(137,180,250,0.15)"; }}>
            {analyzing ? <span className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent inline-block" /> : "🔍"} Review
          </button>
          <button onClick={handleRun} disabled={running} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50" style={{ background: "#a6e3a1", color: "#1e1e2e" }} onMouseEnter={(e) => { if (!running) (e.currentTarget.style.background = "#94d8a0"); }} onMouseLeave={(e) => { (e.currentTarget.style.background = "#a6e3a1"); }}>
            {running ? <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent inline-block" /> : "▶"} Run
          </button>
        </div>

        {/* Monaco */}
        <div className="flex-1 overflow-hidden">
          <MonacoEditor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v ?? "")}
            onMount={(editor) => { editorRef.current = editor; }}
            options={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize,
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              lineNumbersMinChars: 3,
              renderLineHighlight: "line",
              smoothScrolling: true,
              cursorBlinking: "smooth",
              tabSize: 4,
              folding: true,
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>
      </div>

      {/* Right panel 40% */}
      <div className="flex flex-col border-l" style={{ width: "40%", borderColor: "#313244", background: "#181825" }}>
        {/* Tabs */}
        <div className="flex shrink-0 border-b" style={{ borderColor: "#313244" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex-1 py-2.5 text-xs font-medium transition-all"
              style={{
                color: activeTab === t.key ? "#cdd6f4" : "#6c7086",
                borderBottom: activeTab === t.key ? "2px solid #6366f1" : "2px solid transparent",
                background: activeTab === t.key ? "rgba(99,102,241,0.08)" : "transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-auto">
          {/* Output */}
          {activeTab === "output" && (
            <div className="h-full" style={{ background: "#0d0d0d" }}>
              <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "#1a1a1a" }}>
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#45475a" }}>Terminal</span>
                {output && <button onClick={() => { setOutput(""); setOutputError(false); }} className="text-[11px] transition-all" style={{ color: "#45475a" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#a6adc8")} onMouseLeave={(e) => (e.currentTarget.style.color = "#45475a")}>Clear</button>}
              </div>
              <pre className="p-4 text-xs leading-relaxed" style={{ fontFamily: "'JetBrains Mono', monospace", color: outputError ? "#f38ba8" : "#a6e3a1", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {output || <span style={{ color: "#313244" }}>▶ Run your code to see output here…</span>}
              </pre>
            </div>
          )}

          {/* AI Review */}
          {activeTab === "review" && (
            <div className="p-4">
              {analyzing && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  <p className="text-sm" style={{ color: "#6c7086" }}>Analyzing your code…</p>
                </div>
              )}
              {!analyzing && !review && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <span className="text-3xl">🔍</span>
                  <p className="text-sm" style={{ color: "#6c7086" }}>Click "Review" to get AI feedback on your code</p>
                </div>
              )}
              {review && (
                <div className="rounded-xl border p-4 text-sm leading-relaxed animate-fade-in" style={{ background: "#1e1e2e", borderColor: "#313244", color: "#cdd6f4" }}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-base">🔍</span>
                    <span className="text-xs font-semibold" style={{ color: "#89b4fa" }}>AI Code Review</span>
                  </div>
                  <p style={{ whiteSpace: "pre-wrap" }}>{review}</p>
                </div>
              )}
            </div>
          )}

          {/* Test Cases */}
          {activeTab === "tests" && (
            <div className="p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: "#313244" }}>
                    {["Input", "Expected", "Actual", ""].map((h) => (
                      <th key={h} className="pb-2 text-left font-semibold" style={{ color: "#6c7086" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEST_CASES.map((tc, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: "#313244" }}>
                      <td className="py-2.5 pr-2 font-mono" style={{ color: "#a6adc8" }}>{tc.input}</td>
                      <td className="py-2.5 pr-2 font-mono" style={{ color: "#a6adc8" }}>{tc.expected}</td>
                      <td className="py-2.5 pr-2 font-mono" style={{ color: tc.actual === "Pending" ? "#6c7086" : "#cdd6f4" }}>{tc.actual}</td>
                      <td className="py-2.5">
                        {tc.passed === null ? (
                          <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "#313244", color: "#6c7086" }}>Pending</span>
                        ) : tc.passed ? (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(166,227,161,0.15)", color: "#a6e3a1" }}>✓ Pass</span>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(243,139,168,0.15)", color: "#f38ba8" }}>✗ Fail</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* History */}
          {activeTab === "history" && (
            <div className="p-3 space-y-2">
              {history.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setCode(run.code)}
                  className="w-full rounded-xl border p-3 text-left transition-all"
                  style={{ background: "#1e1e2e", borderColor: "#313244" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#313244")}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: run.success ? "rgba(166,227,161,0.15)" : "rgba(243,139,168,0.15)", color: run.success ? "#a6e3a1" : "#f38ba8" }}>
                      {run.success ? "✓ Success" : "✗ Error"}
                    </span>
                    <span className="text-[11px]" style={{ color: "#6c7086" }}>{timeAgo(run.timestamp)}</span>
                  </div>
                  <pre className="overflow-hidden text-[11px]" style={{ fontFamily: "monospace", color: "#6c7086", maxHeight: "3rem" }}>
                    {run.code.slice(0, 100)}…
                  </pre>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
