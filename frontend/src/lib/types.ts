export type UserRole = "student" | "teacher";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  xp: number;
  streak: number;
  level: string;
  joinedAt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  agentType?: "concepts" | "debug" | "exercise";
  timestamp: Date;
  feedback?: "up" | "down" | null;
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
}

export interface Exercise {
  id: string;
  title: string;
  module: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  starterCode: string;
  testCases: TestCase[];
  xpReward: number;
  status: "todo" | "in-progress" | "done";
  attempts: number;
  solution?: string;
  hints: string[];
}

export interface TestCase {
  input: string;
  expected: string;
  actual?: string;
  passed?: boolean;
}

export interface Module {
  id: number;
  name: string;
  mastery: number;
  topics: Topic[];
  status: "completed" | "in-progress" | "locked";
  exercisesDone: number;
  totalExercises: number;
}

export interface Topic {
  name: string;
  completed: boolean;
}

export interface ActivityEntry {
  id: string;
  type: "exercise" | "chat" | "code" | "achievement";
  description: string;
  timestamp: Date;
  xpGained?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: Date;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  module: number;
  mastery: number;
  lastActive: Date;
  status: "on-track" | "struggling" | "inactive";
  streak: number;
}

export interface StruggleAlert {
  id: string;
  studentName: string;
  issue: string;
  timestamp: Date;
  severity: "high" | "medium" | "low";
}

export interface CodeRun {
  id: string;
  code: string;
  output: string;
  timestamp: Date;
  success: boolean;
}

export interface DailyActivity {
  date: string;
  count: number;
}

export interface MasteryDataPoint {
  date: string;
  mastery: number;
}
