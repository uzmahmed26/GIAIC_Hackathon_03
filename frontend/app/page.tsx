"use client";

import { useState } from "react";
import Sidebar from "@/src/components/Sidebar";
import ChatPanel from "@/src/components/ChatPanel";
import CodeEditor from "@/src/components/CodeEditor";
import ProgressPanel from "@/src/components/ProgressPanel";

type Tab = "Tutor Chat" | "Code Editor" | "Progress";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("Tutor Chat");

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: "#1e1e2e", color: "#cdd6f4" }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex h-14 shrink-0 items-center border-b px-6 text-sm font-medium"
          style={{ backgroundColor: "#181825", borderColor: "#313244", color: "#a6adc8" }}
        >
          <span style={{ color: "#cdd6f4" }}>{activeTab}</span>
        </header>

        {/* Content — keep all panels mounted to avoid re-initialising Monaco */}
        <main className="flex-1 overflow-hidden">
          <div className={`h-full ${activeTab === "Tutor Chat" ? "block" : "hidden"}`}>
            <ChatPanel />
          </div>
          <div className={`h-full ${activeTab === "Code Editor" ? "block" : "hidden"}`}>
            <CodeEditor />
          </div>
          <div className={`h-full ${activeTab === "Progress" ? "block" : "hidden"}`}>
            <ProgressPanel />
          </div>
        </main>
      </div>
    </div>
  );
}
