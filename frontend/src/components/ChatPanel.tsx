"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";

interface Message {
  role: "user" | "assistant";
  content: string;
  agentName?: string;
}

const QUICK_PROMPTS = [
  "How do for loops work?",
  "Debug my code",
  "Give me an exercise on lists",
];

const WELCOME: Message = {
  role: "assistant",
  agentName: "LearnFlow Tutor",
  content:
    "Hi! I'm your AI Python tutor. Ask me anything about Python, request a code review, or pick a quick prompt below to get started. 🐍",
};

const USER_ID = "user-001";

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data } = await axios.post("/api/chat", {
        message: trimmed,
        user_id: USER_ID,
      });

      const assistantMsg: Message = {
        role: "assistant",
        agentName: data.agent_name ?? "LearnFlow Tutor",
        content: data.response ?? data.message ?? JSON.stringify(data),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          agentName: "System",
          content: "⚠️ Could not reach the tutor service. Make sure the backend is running on port 8001.",
        },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#1e1e2e" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            {/* Agent name above assistant bubbles */}
            {msg.role === "assistant" && msg.agentName && (
              <span className="px-1 text-[11px] font-semibold" style={{ color: "#7c7f93" }}>
                {msg.agentName}
              </span>
            )}

            <div
              className="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
              style={
                msg.role === "user"
                  ? { backgroundColor: "#4f46e5", color: "#e0e7ff" }
                  : { backgroundColor: "#181825", color: "#cdd6f4", border: "1px solid #313244" }
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading animation */}
        {loading && (
          <div className="flex items-start gap-1 flex-col">
            <span className="px-1 text-[11px] font-semibold" style={{ color: "#7c7f93" }}>
              LearnFlow Tutor
            </span>
            <div
              className="flex items-center gap-1.5 rounded-2xl px-4 py-3"
              style={{ backgroundColor: "#181825", border: "1px solid #313244" }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: "#6c7086",
                    animation: "bounce 1.2s infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => sendMessage(prompt)}
            disabled={loading}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              borderColor: "#313244",
              color: "#a6adc8",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#313244";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div
        className="flex items-end gap-3 border-t px-4 py-3"
        style={{ borderColor: "#313244", backgroundColor: "#181825" }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a Python question… (Enter to send, Shift+Enter for newline)"
          disabled={loading}
          className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm outline-none transition-all disabled:opacity-50"
          style={{
            backgroundColor: "#313244",
            color: "#cdd6f4",
            maxHeight: "8rem",
            lineHeight: "1.5",
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: "#4f46e5" }}
          onMouseEnter={(e) => {
            if (!loading && input.trim())
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#4338ca";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#4f46e5";
          }}
          aria-label="Send"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M3.105 3.105a.75.75 0 0 1 .815-.175l13.5 5.25a.75.75 0 0 1 0 1.4l-13.5 5.25a.75.75 0 0 1-1.05-.896L4.63 10 2.87 5.066a.75.75 0 0 1 .235-.961Z" />
          </svg>
        </button>
      </div>

      {/* Bounce keyframe */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%            { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
