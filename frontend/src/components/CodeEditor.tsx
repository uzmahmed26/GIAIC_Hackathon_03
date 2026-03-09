"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import axios from "axios";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const STARTER_CODE = `def fibonacci(n: int) -> list[int]:
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

interface AnalysisFeedback {
  summary?: string;
  issues?: { severity: "error" | "warning" | "info"; message: string }[];
  suggestions?: string[];
  raw?: string;
}

function severityColor(s: "error" | "warning" | "info") {
  if (s === "error")   return "#f38ba8";
  if (s === "warning") return "#f9e2af";
  return "#89b4fa";
}

function severityIcon(s: "error" | "warning" | "info") {
  if (s === "error")   return "✕";
  if (s === "warning") return "⚠";
  return "ℹ";
}

export default function CodeEditor() {
  const [code, setCode]               = useState(STARTER_CODE);
  const [output, setOutput]           = useState("");
  const [outputError, setOutputError] = useState(false);
  const [running, setRunning]         = useState(false);
  const [analyzing, setAnalyzing]     = useState(false);
  const [feedback, setFeedback]       = useState<AnalysisFeedback | null>(null);
  const editorRef = useRef<unknown>(null);

  async function handleRun() {
    if (running) return;
    setRunning(true);
    setOutput("Running…");
    setOutputError(false);
    try {
      const { data } = await axios.post("/api/execute", { code });
      if (!data.success && data.stderr) {
        setOutput(data.stderr);
        setOutputError(true);
      } else {
        setOutput(data.stdout ?? "(no output)");
        setOutputError(false);
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error ?? err.message
        : "Unknown error";
      setOutput(`Error: ${message}`);
      setOutputError(true);
    } finally {
      setRunning(false);
    }
  }

  async function handleAnalyze() {
    if (analyzing) return;
    setAnalyzing(true);
    setFeedback(null);
    try {
      const { data } = await axios.post("/api/debug", { code });
      // Normalise varying response shapes
      if (typeof data === "string") {
        setFeedback({ raw: data });
      } else {
        setFeedback({
          summary:     data.summary     ?? data.message ?? undefined,
          issues:      data.issues      ?? [],
          suggestions: data.suggestions ?? [],
          raw:         data.raw         ?? undefined,
        });
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error ?? err.message
        : "Unknown error";
      setFeedback({ raw: `⚠️ Could not reach debug service: ${message}` });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: "#1e1e2e" }}>
      {/* ── Editor + output column ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div
          className="flex shrink-0 items-center justify-end gap-2 border-b px-4 py-2"
          style={{ backgroundColor: "#181825", borderColor: "#313244" }}
        >
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#313244", color: "#a6adc8" }}
            onMouseEnter={(e) => { if (!analyzing) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#45475a"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#313244"; }}
          >
            {analyzing ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : "🔍"}
            Analyze
          </button>

          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#a6e3a1", color: "#1e1e2e" }}
            onMouseEnter={(e) => { if (!running) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#94d8a0"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#a6e3a1"; }}
          >
            {running ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : "▶"}
            Run
          </button>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 overflow-hidden">
          <MonacoEditor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val ?? "")}
            onMount={(editor) => { editorRef.current = editor; }}
            options={{
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontSize: 14,
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              lineNumbersMinChars: 3,
              renderLineHighlight: "line",
              smoothScrolling: true,
              cursorBlinking: "smooth",
              tabSize: 4,
            }}
          />
        </div>

        {/* Output panel */}
        <div
          className="h-36 shrink-0 overflow-auto border-t"
          style={{ backgroundColor: "#000000", borderColor: "#313244" }}
        >
          <div className="flex items-center justify-between border-b px-4 py-1.5" style={{ borderColor: "#1a1a1a" }}>
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#585b70" }}>
              Output
            </span>
            {output && (
              <button
                onClick={() => { setOutput(""); setOutputError(false); }}
                className="text-[11px] transition-colors"
                style={{ color: "#585b70" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#a6adc8"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#585b70"; }}
              >
                Clear
              </button>
            )}
          </div>
          <pre
            className="px-4 py-2 text-xs leading-relaxed"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: outputError ? "#f38ba8" : "#a6e3a1",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {output || <span style={{ color: "#313244" }}>Run your code to see output…</span>}
          </pre>
        </div>
      </div>

      {/* ── Analysis feedback panel ── */}
      {feedback && (
        <div
          className="flex w-80 shrink-0 flex-col overflow-hidden border-l"
          style={{ backgroundColor: "#181825", borderColor: "#313244" }}
        >
          {/* Header */}
          <div
            className="flex shrink-0 items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "#313244" }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#a6adc8" }}>
              🔍 Analysis
            </span>
            <button
              onClick={() => setFeedback(null)}
              className="text-sm leading-none transition-colors"
              style={{ color: "#585b70" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#cdd6f4"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#585b70"; }}
              aria-label="Close analysis"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
            {/* Raw fallback */}
            {feedback.raw && (
              <p className="leading-relaxed" style={{ color: "#cdd6f4" }}>
                {feedback.raw}
              </p>
            )}

            {/* Summary */}
            {feedback.summary && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#585b70" }}>
                  Summary
                </p>
                <p className="leading-relaxed" style={{ color: "#cdd6f4" }}>
                  {feedback.summary}
                </p>
              </div>
            )}

            {/* Issues */}
            {feedback.issues && feedback.issues.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#585b70" }}>
                  Issues
                </p>
                <ul className="space-y-2">
                  {feedback.issues.map((issue, i) => (
                    <li
                      key={i}
                      className="flex gap-2 rounded-md px-3 py-2 text-xs"
                      style={{
                        backgroundColor: "#1e1e2e",
                        border: `1px solid ${severityColor(issue.severity)}33`,
                      }}
                    >
                      <span className="mt-px shrink-0 font-bold" style={{ color: severityColor(issue.severity) }}>
                        {severityIcon(issue.severity)}
                      </span>
                      <span style={{ color: "#cdd6f4" }}>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {feedback.suggestions && feedback.suggestions.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#585b70" }}>
                  Suggestions
                </p>
                <ul className="space-y-1.5">
                  {feedback.suggestions.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed" style={{ color: "#a6adc8" }}>
                      <span className="mt-0.5 shrink-0" style={{ color: "#89b4fa" }}>→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
