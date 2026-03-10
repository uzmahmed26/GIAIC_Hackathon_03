import type { User } from "./types";

const SESSION_KEY = "learnflow_session";

export const MOCK_USERS: User[] = [
  {
    id: "student-001",
    name: "Maya Chen",
    email: "maya@example.com",
    role: "student",
    xp: 2450,
    streak: 7,
    level: "Intermediate",
    joinedAt: "2024-01-15",
  },
  {
    id: "teacher-001",
    name: "John Smith",
    email: "john@example.com",
    role: "teacher",
    xp: 0,
    streak: 0,
    level: "Expert",
    joinedAt: "2023-09-01",
  },
];

export function login(email: string, _password: string): User | null {
  const user = MOCK_USERS.find((u) => u.email === email);
  if (!user) return null;
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  return user;
}

export function register(name: string, email: string, role: "student" | "teacher"): User {
  const user: User = {
    id: `user-${Date.now()}`,
    name,
    email,
    role,
    xp: 0,
    streak: 0,
    level: "Beginner",
    joinedAt: new Date().toISOString().split("T")[0],
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  return user;
}

export function getSession(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getAvatarInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
