import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.CHAT_BACKEND_URL ?? "http://localhost:8001";

// Simple demo responses keyed on keywords in the user message
function demoReply(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("for loop") || m.includes("for loops"))
    return `Great question! A \`for\` loop lets you iterate over a sequence:\n\n\`\`\`python\nfor i in range(5):\n    print(i)  # prints 0, 1, 2, 3, 4\n\`\`\`\n\nYou can also loop over lists, strings, or any iterable:\n\n\`\`\`python\nfruits = ["apple", "banana", "cherry"]\nfor fruit in fruits:\n    print(fruit)\n\`\`\`\n\nWant to try writing one yourself?`;

  if (m.includes("debug") || m.includes("error") || m.includes("fix"))
    return `Sure! Paste your code in the **Code Editor** tab and click **🔍 Analyze** — I'll review it for bugs and suggest fixes.\n\nOr share the code and error message here and I'll help you debug it step by step.`;

  if (m.includes("list") || m.includes("exercise"))
    return `Here's a list exercise for you:\n\n**Task:** Write a function that takes a list of numbers and returns only the even ones.\n\n\`\`\`python\ndef even_numbers(nums: list[int]) -> list[int]:\n    # your code here\n    pass\n\nprint(even_numbers([1, 2, 3, 4, 5, 6]))  # [2, 4, 6]\n\`\`\`\n\nHint: use a list comprehension with \`% 2 == 0\`. Give it a try!`;

  if (m.includes("variable") || m.includes("type"))
    return `In Python, variables are dynamically typed — you don't declare a type:\n\n\`\`\`python\nname = "Alice"   # str\nage  = 30        # int\nscore = 9.5      # float\nactive = True    # bool\n\`\`\`\n\nYou can check a type with \`type()\` or use type hints for clarity:\n\n\`\`\`python\ndef greet(name: str) -> str:\n    return f"Hello, {name}!"\n\`\`\``;

  if (m.includes("function") || m.includes("def"))
    return `Functions in Python are defined with \`def\`:\n\n\`\`\`python\ndef add(a: int, b: int) -> int:\n    return a + b\n\nresult = add(3, 4)  # 7\n\`\`\`\n\nYou can also use default arguments and *args / **kwargs for flexibility. What aspect of functions would you like to explore?`;

  if (m.includes("hello") || m.includes("hi"))
    return `Hello! Ready to learn some Python? 🐍\n\nYou can ask me about any Python topic, paste code for review, or use the quick prompts below to get started.`;

  return `That's a great Python question! 🐍\n\nI'm running in **demo mode** right now — connect the backend on port 8001 to get full AI-powered answers.\n\nIn the meantime, feel free to:\n- Use the **Code Editor** tab to write and run Python\n- Check your **Progress** to see which modules to tackle next\n- Try one of the quick prompts below`;
}

export async function POST(req: NextRequest) {
  let body: { message?: unknown; user_id?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : null;
  const user_id = typeof body.user_id === "string" ? body.user_id : "anonymous";

  if (!message) {
    return NextResponse.json({ error: "Missing required field: message" }, { status: 400 });
  }

  // Try the real backend first
  try {
    const res = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, user_id }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Backend unreachable — fall through to demo mode
  }

  // Demo mode
  console.info(`[chat] demo reply  user=${user_id}`);
  return NextResponse.json({
    response:   demoReply(message),
    agent_name: "LearnFlow Tutor (demo)",
    demo:       true,
  });
}
