/**
 * LearnFlow API client
 *
 * All client-side code talks to Next.js API routes (/api/*).
 * Next.js routes proxy to the actual backend services using server-side env vars.
 *
 * Env vars used on the client:
 *   NEXT_PUBLIC_TRIAGE_URL — shown in UI for diagnostics (optional)
 *
 * Features:
 *   - Centralised axios instance (base URL, default headers, timeout)
 *   - Automatic retry with exponential back-off (up to MAX_RETRIES attempts)
 *   - Response/error interceptors that emit toast events
 *   - Typed helper functions for every backend capability
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  isAxiosError,
} from "axios";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400; // first retry delay; doubled each attempt

// ---------------------------------------------------------------------------
// Toast event bus (avoids circular dep with React context)
// ---------------------------------------------------------------------------

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastPayload {
  message: string;
  type: ToastType;
  id: string;
}

const TOAST_EVENT = "learnflow:toast";

/** Fire a toast from outside React. Listened to by <ToastContainer>. */
export function emitToast(message: string, type: ToastType = "error"): void {
  if (typeof window === "undefined") return;
  const payload: ToastPayload = { message, type, id: `${Date.now()}-${Math.random()}` };
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
}

export { TOAST_EVENT };

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const instance: AxiosInstance = axios.create({
  // All requests go to Next.js API routes (same origin)
  baseURL: "/api",
  timeout: 12_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ---------------------------------------------------------------------------
// Retry interceptor (request side — attaches retry metadata)
// ---------------------------------------------------------------------------

instance.interceptors.request.use((config) => {
  // Attach retry counter if not already present
  if ((config as AxiosRequestConfig & { _retryCount?: number })._retryCount === undefined) {
    (config as AxiosRequestConfig & { _retryCount?: number })._retryCount = 0;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — retry on network/5xx, toast on final failure
// ---------------------------------------------------------------------------

instance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: unknown) => {
    if (!isAxiosError(error) || !error.config) return Promise.reject(error);

    const config = error.config as AxiosRequestConfig & { _retryCount?: number };
    const retryCount = config._retryCount ?? 0;

    const isRetryable =
      !error.response || // network error
      error.response.status === 429 || // rate limit
      error.response.status >= 500; // server error

    if (isRetryable && retryCount < MAX_RETRIES) {
      config._retryCount = retryCount + 1;
      const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
      await new Promise((r) => setTimeout(r, delay));
      return instance(config);
    }

    // Final failure — emit toast
    const message = isAxiosError(error)
      ? error.response?.data?.error ??
        error.response?.data?.message ??
        error.message
      : "Unexpected error";

    const friendlyMessage =
      error.code === "ECONNABORTED" || !error.response
        ? "Cannot reach the backend — running in demo mode."
        : `Request failed: ${message}`;

    emitToast(friendlyMessage, "error");
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ChatResponse {
  response: string;
  agent_name: string;
  agent_type?: "concepts" | "debug" | "exercise";
  demo?: boolean;
}

export interface ExecuteResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  output?: string;
}

export interface DebugResponse {
  summary?: string;
  issues?: { severity: "error" | "warning" | "info"; message: string }[];
  suggestions?: string[];
  raw?: string;
  message?: string;
}

export interface ExerciseGenerateResponse {
  exercises: {
    title: string;
    description: string;
    starterCode: string;
    solution: string;
    testCases: { input: string; expected: string }[];
    xpReward: number;
  }[];
}

export interface ProgressResponse {
  modules: {
    id: number;
    mastery: number;
    exercisesDone: number;
  }[];
  totalXp: number;
  streak: number;
  level: string;
}

// ---------------------------------------------------------------------------
// Typed API helpers
// ---------------------------------------------------------------------------

/** Send a chat message to the triage → concepts/debug/exercise agent pipeline. */
export async function sendChat(
  message: string,
  userId = "user-001"
): Promise<ChatResponse> {
  const { data } = await instance.post<ChatResponse>("/chat", { message, user_id: userId });
  return data;
}

/** Execute Python code via the sandbox. */
export async function executeCode(code: string): Promise<ExecuteResponse> {
  const { data } = await instance.post<ExecuteResponse>("/execute", { code });
  return data;
}

/** Request an AI code review from the debug agent. */
export async function debugCode(code: string): Promise<DebugResponse> {
  const { data } = await instance.post<DebugResponse>("/debug", { code });
  return data;
}

/** Ask the exercise agent to generate exercises. */
export async function generateExercises(params: {
  topic: string;
  difficulty: string;
  module: number;
  quantity: number;
  userId?: string;
}): Promise<ExerciseGenerateResponse> {
  const { data } = await instance.post<ExerciseGenerateResponse>("/exercises/generate", params);
  return data;
}

/** Fetch student progress from the progress service. */
export async function fetchProgress(userId = "user-001"): Promise<ProgressResponse> {
  const { data } = await instance.get<ProgressResponse>(`/progress/${userId}`);
  return data;
}

// Default export for ad-hoc requests
export default instance;
