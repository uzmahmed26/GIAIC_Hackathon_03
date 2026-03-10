"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { sendChat } from "@/src/lib/api";
import { useToast } from "@/src/components/ui/Toast";
import { SkeletonChatMessage } from "@/src/components/ui/Skeleton";
import { CHAT_SESSIONS } from "@/src/lib/mock-data";
import type { Message, ChatSession } from "@/src/lib/types";

const AGENT_BADGES: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  concepts: { label: "Concepts", icon: "🎓", color: "#89b4fa", bg: "rgba(137,180,250,0.15)" },
  debug: { label: "Debug", icon: "🔍", color: "#f9e2af", bg: "rgba(249,226,175,0.15)" },
  exercise: { label: "Exercise", icon: "🎯", color: "#a6e3a1", bg: "rgba(166,227,161,0.15)" },
  default: { label: "Tutor", icon: "💬", color: "#cba6f7", bg: "rgba(203,166,247,0.15)" },
};

const QUICK_PROMPTS = [
  { label: "Explain for loops", prompt: "Can you explain how for loops work in Python with examples?" },
  { label: "Debug my code", prompt: "I have a bug in my code. Can you help me debug it?" },
  { label: "Give me exercise", prompt: "Give me a Python exercise to practice functions." },
  { label: "Quiz me", prompt: "Quiz me on Python lists and dictionaries." },
];

const WELCOME_MSG: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm your AI Python tutor. 🐍\n\nAsk me anything about Python — I can **explain concepts**, **debug your code**, or **give you exercises** to practice.\n\nWhat would you like to work on today?",
  agentName: "LearnFlow Tutor",
  agentType: "concepts",
  timestamp: new Date(),
  feedback: null,
};

function formatTime(d: Date) {
  return d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
}

function formatSessionDate(d: Date) {
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function renderContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const lines = part.split("\n");
      const lang = lines[0].replace("```", "") || "python";
      const code = lines.slice(1, -1).join("\n");
      return (
        <div key={i} className="my-2 overflow-hidden rounded-xl" style={{ background: "#1e1e2e", border: "1px solid #313244" }}>
          <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "#181825", borderBottom: "1px solid #313244" }}>
            <span className="text-[11px] font-medium" style={{ color: "#6c7086" }}>{lang}</span>
            <button
              onClick={() => navigator.clipboard.writeText(code)}
              className="text-[11px] transition-all"
              style={{ color: "#6c7086" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#cdd6f4")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6c7086")}
            >
              Copy
            </button>
          </div>
          <pre className="overflow-x-auto px-4 py-3 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#cdd6f4", margin: 0 }}>
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    // Render inline formatting
    const formatted = part
      .split(/(\*\*.*?\*\*)/g)
      .map((seg, j) =>
        seg.startsWith("**") ? (
          <strong key={j} style={{ color: "#cdd6f4" }}>{seg.slice(2, -2)}</strong>
        ) : (
          <span key={j}>{seg}</span>
        )
      );
    return <span key={i}>{formatted}</span>;
  });
}

export default function ChatPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>(CHAT_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
      feedback: null,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Uses centralized api.ts — includes retry + error interceptor
      const data = await sendChat(trimmed, "user-001");
      const agentType = (data.agent_type ?? "concepts") as Message["agentType"];
      const assistantMsg: Message = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        content: data.response ?? "No response received.",
        agentName: data.agent_name ?? "LearnFlow Tutor",
        agentType,
        timestamp: new Date(),
        feedback: null,
      };
      if (data.demo) toast("Running in demo mode — backend not connected.", "info");
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // api.ts already emitted an error toast via the interceptor
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-err`,
          role: "assistant",
          content: "I'm having trouble connecting right now — running in demo mode.\n\nTry one of the quick prompts below!",
          agentName: "LearnFlow Tutor",
          agentType: "concepts",
          timestamp: new Date(),
          feedback: null,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [loading, toast]);

  function newChat() {
    const id = `chat-${Date.now()}`;
    setSessions((prev) => [
      { id, title: "New conversation", lastMessage: "", timestamp: new Date(), messages: [] },
      ...prev,
    ]);
    setActiveSessionId(id);
    setMessages([WELCOME_MSG]);
  }

  function setFeedback(msgId: string, val: "up" | "down") {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, feedback: m.feedback === val ? null : val } : m));
  }

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full" style={{ background: "#1e1e2e" }}>
      {/* Left panel — chat history */}
      <div className="flex w-72 shrink-0 flex-col border-r" style={{ background: "#181825", borderColor: "#313244" }}>
        <div className="border-b p-3" style={{ borderColor: "#313244" }}>
          <button
            onClick={newChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all"
            style={{ background: "#6366f1" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}
          >
            + New Chat
          </button>
          <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "#1e1e2e", border: "1px solid #313244" }}>
            <span className="text-xs" style={{ color: "#6c7086" }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats…"
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: "#cdd6f4" }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActiveSessionId(s.id); }}
              className="mb-1 w-full rounded-xl p-3 text-left transition-all"
              style={{
                background: activeSessionId === s.id ? "rgba(99,102,241,0.15)" : "transparent",
                border: `1px solid ${activeSessionId === s.id ? "rgba(99,102,241,0.3)" : "transparent"}`,
              }}
              onMouseEnter={(e) => { if (activeSessionId !== s.id) (e.currentTarget.style.background = "rgba(255,255,255,0.04)"); }}
              onMouseLeave={(e) => { if (activeSessionId !== s.id) (e.currentTarget.style.background = "transparent"); }}
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-xs font-medium" style={{ color: "#cdd6f4" }}>{s.title}</span>
                <span className="ml-2 shrink-0 text-[10px]" style={{ color: "#6c7086" }}>{formatSessionDate(s.timestamp)}</span>
              </div>
              {s.lastMessage && (
                <p className="mt-0.5 truncate text-[11px]" style={{ color: "#6c7086" }}>{s.lastMessage}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right — chat area */}
      <div className="flex flex-1 flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {messages.map((msg) => {
            const agent = AGENT_BADGES[msg.agentType ?? "default"] ?? AGENT_BADGES.default;
            return (
              <div key={msg.id} className={`flex flex-col gap-1 animate-fade-in ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 px-1">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: agent.bg, color: agent.color }}>
                      {agent.icon} {agent.label}
                    </span>
                    <span className="text-[11px]" style={{ color: "#45475a" }}>{formatTime(msg.timestamp)}</span>
                  </div>
                )}
                <div className="group flex flex-col gap-1" style={{ maxWidth: "75%" }}>
                  <div
                    className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                    style={
                      msg.role === "user"
                        ? { background: "#6366f1", color: "#e0e7ff" }
                        : { background: "#181825", color: "#cdd6f4", border: "1px solid #313244" }
                    }
                  >
                    {renderContent(msg.content)}
                  </div>
                  {msg.role === "user" && (
                    <span className="self-end text-[11px]" style={{ color: "#45475a" }}>{formatTime(msg.timestamp)}</span>
                  )}
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(["up", "down"] as const).map((dir) => (
                        <button
                          key={dir}
                          onClick={() => setFeedback(msg.id, dir)}
                          className="rounded-lg px-2 py-1 text-xs transition-all"
                          style={{
                            color: msg.feedback === dir ? (dir === "up" ? "#a6e3a1" : "#f38ba8") : "#45475a",
                            background: msg.feedback === dir ? (dir === "up" ? "rgba(166,227,161,0.1)" : "rgba(243,139,168,0.1)") : "transparent",
                          }}
                        >
                          {dir === "up" ? "👍" : "👎"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="animate-fade-in">
              <SkeletonChatMessage align="left" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        <div className="flex flex-wrap gap-2 px-6 pb-2">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => sendMessage(p.prompt)}
              disabled={loading}
              className="rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
              style={{ borderColor: "#313244", color: "#a6adc8" }}
              onMouseEnter={(e) => { (e.currentTarget.style.background = "#313244"); (e.currentTarget.style.borderColor = "#6366f1"); }}
              onMouseLeave={(e) => { (e.currentTarget.style.background = "transparent"); (e.currentTarget.style.borderColor = "#313244"); }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="border-t px-6 py-4" style={{ borderColor: "#313244", background: "#181825" }}>
          <div className="flex items-end gap-3 rounded-2xl border px-4 py-3" style={{ background: "#1e1e2e", borderColor: "#313244" }}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Ask a Python question… (Enter to send, Shift+Enter for newline)"
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-sm outline-none disabled:opacity-50"
              style={{ color: "#cdd6f4", maxHeight: "8rem", lineHeight: "1.5" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
            />
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[11px]" style={{ color: input.length > 800 ? "#f38ba8" : "#45475a" }}>
                {input.length}/1000
              </span>
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition-all disabled:opacity-40"
                style={{ background: "#6366f1" }}
                onMouseEnter={(e) => { if (!loading && input.trim()) (e.currentTarget.style.background = "#4f46e5"); }}
                onMouseLeave={(e) => { (e.currentTarget.style.background = "#6366f1"); }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M3.105 3.105a.75.75 0 0 1 .815-.175l13.5 5.25a.75.75 0 0 1 0 1.4l-13.5 5.25a.75.75 0 0 1-1.05-.896L4.63 10 2.87 5.066a.75.75 0 0 1 .235-.961Z" />
                </svg>
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-center text-[11px]" style={{ color: "#45475a" }}>
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}
