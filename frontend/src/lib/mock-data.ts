import type {
  Module,
  Exercise,
  ActivityEntry,
  Achievement,
  ChatSession,
  Student,
  StruggleAlert,
  DailyActivity,
  MasteryDataPoint,
  CodeRun,
} from "./types";

export const MODULES: Module[] = [
  {
    id: 1,
    name: "Variables & Types",
    mastery: 95,
    status: "completed",
    exercisesDone: 10,
    totalExercises: 10,
    topics: [
      { name: "Integers & Floats", completed: true },
      { name: "Strings", completed: true },
      { name: "Booleans", completed: true },
      { name: "Type Casting", completed: true },
    ],
  },
  {
    id: 2,
    name: "Control Flow",
    mastery: 82,
    status: "completed",
    exercisesDone: 8,
    totalExercises: 10,
    topics: [
      { name: "If/Else", completed: true },
      { name: "For Loops", completed: true },
      { name: "While Loops", completed: true },
      { name: "Break & Continue", completed: false },
    ],
  },
  {
    id: 3,
    name: "Functions",
    mastery: 67,
    status: "in-progress",
    exercisesDone: 6,
    totalExercises: 12,
    topics: [
      { name: "Defining Functions", completed: true },
      { name: "Parameters & Args", completed: true },
      { name: "Return Values", completed: false },
      { name: "Lambda Functions", completed: false },
    ],
  },
  {
    id: 4,
    name: "Lists & Dicts",
    mastery: 55,
    status: "in-progress",
    exercisesDone: 5,
    totalExercises: 12,
    topics: [
      { name: "List Operations", completed: true },
      { name: "List Comprehensions", completed: false },
      { name: "Dictionaries", completed: true },
      { name: "Nested Structures", completed: false },
    ],
  },
  {
    id: 5,
    name: "OOP Basics",
    mastery: 38,
    status: "in-progress",
    exercisesDone: 3,
    totalExercises: 14,
    topics: [
      { name: "Classes & Objects", completed: true },
      { name: "Inheritance", completed: false },
      { name: "Encapsulation", completed: false },
      { name: "Polymorphism", completed: false },
    ],
  },
  {
    id: 6,
    name: "File I/O",
    mastery: 20,
    status: "in-progress",
    exercisesDone: 2,
    totalExercises: 8,
    topics: [
      { name: "Reading Files", completed: true },
      { name: "Writing Files", completed: false },
      { name: "CSV & JSON", completed: false },
    ],
  },
  {
    id: 7,
    name: "Error Handling",
    mastery: 10,
    status: "locked",
    exercisesDone: 1,
    totalExercises: 10,
    topics: [
      { name: "Try/Except", completed: false },
      { name: "Custom Exceptions", completed: false },
      { name: "Context Managers", completed: false },
    ],
  },
  {
    id: 8,
    name: "Modules & Packages",
    mastery: 0,
    status: "locked",
    exercisesDone: 0,
    totalExercises: 8,
    topics: [
      { name: "Import System", completed: false },
      { name: "Standard Library", completed: false },
      { name: "pip & virtualenv", completed: false },
    ],
  },
];

export const EXERCISES: Exercise[] = [
  {
    id: "ex-001",
    title: "Hello, World!",
    module: 1,
    difficulty: "Beginner",
    description: "Write a function that returns the string 'Hello, World!'.",
    starterCode: "def hello_world():\n    # Your code here\n    pass",
    xpReward: 50,
    status: "done",
    attempts: 1,
    hints: [
      "Use the return statement to return a value.",
      "The function should return a string.",
      "return 'Hello, World!'",
    ],
    solution: "def hello_world():\n    return 'Hello, World!'",
    testCases: [
      { input: "", expected: "Hello, World!", actual: "Hello, World!", passed: true },
    ],
  },
  {
    id: "ex-002",
    title: "FizzBuzz",
    module: 2,
    difficulty: "Beginner",
    description:
      "Write a function fizzbuzz(n) that returns a list of strings from 1 to n. For multiples of 3, use 'Fizz'; for multiples of 5, use 'Buzz'; for multiples of both, use 'FizzBuzz'.",
    starterCode: "def fizzbuzz(n: int) -> list:\n    result = []\n    # Your code here\n    return result",
    xpReward: 100,
    status: "done",
    attempts: 2,
    hints: [
      "Use a for loop to iterate from 1 to n.",
      "Check divisibility with the modulo operator %.",
      "Check for FizzBuzz first (divisible by both 3 and 5).",
    ],
    solution:
      "def fizzbuzz(n):\n    result = []\n    for i in range(1, n+1):\n        if i % 15 == 0: result.append('FizzBuzz')\n        elif i % 3 == 0: result.append('Fizz')\n        elif i % 5 == 0: result.append('Buzz')\n        else: result.append(str(i))\n    return result",
    testCases: [
      { input: "15", expected: "['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz']", actual: "Correct", passed: true },
    ],
  },
  {
    id: "ex-003",
    title: "Factorial Function",
    module: 3,
    difficulty: "Beginner",
    description: "Write a recursive function factorial(n) that returns n!.",
    starterCode: "def factorial(n: int) -> int:\n    # Your code here\n    pass",
    xpReward: 150,
    status: "in-progress",
    attempts: 1,
    hints: [
      "The factorial of 0 is 1.",
      "Use recursion: n * factorial(n-1).",
      "Make sure you have a base case!",
    ],
    testCases: [
      { input: "0", expected: "1" },
      { input: "5", expected: "120" },
      { input: "10", expected: "3628800" },
    ],
  },
  {
    id: "ex-004",
    title: "List Flattener",
    module: 4,
    difficulty: "Intermediate",
    description: "Write a function flatten(nested) that flattens a nested list of any depth.",
    starterCode: "def flatten(nested: list) -> list:\n    # Your code here\n    pass",
    xpReward: 200,
    status: "todo",
    attempts: 0,
    hints: [
      "Use recursion to handle arbitrary nesting.",
      "Check if an item is a list with isinstance(item, list).",
    ],
    testCases: [
      { input: "[[1,2],[3,[4,5]]]", expected: "[1,2,3,4,5]" },
    ],
  },
  {
    id: "ex-005",
    title: "Class Bank Account",
    module: 5,
    difficulty: "Intermediate",
    description:
      "Create a BankAccount class with deposit, withdraw, and get_balance methods. Withdrawals should not allow negative balance.",
    starterCode:
      "class BankAccount:\n    def __init__(self, initial_balance: float = 0):\n        # Your code here\n        pass\n\n    def deposit(self, amount: float):\n        pass\n\n    def withdraw(self, amount: float) -> bool:\n        pass\n\n    def get_balance(self) -> float:\n        pass",
    xpReward: 250,
    status: "todo",
    attempts: 0,
    hints: [
      "Store balance as an instance variable in __init__.",
      "Return False if withdrawal would cause negative balance.",
    ],
    testCases: [
      { input: "deposit(100), withdraw(50)", expected: "balance: 50.0" },
      { input: "withdraw(200) on empty account", expected: "False" },
    ],
  },
  {
    id: "ex-006",
    title: "Word Frequency Counter",
    module: 4,
    difficulty: "Intermediate",
    description: "Write a function word_freq(text) that returns a dict of word frequencies (case-insensitive).",
    starterCode: "def word_freq(text: str) -> dict:\n    # Your code here\n    pass",
    xpReward: 175,
    status: "todo",
    attempts: 0,
    hints: [
      "Use .lower() and .split() to process the text.",
      "Use a dictionary to count occurrences.",
    ],
    testCases: [
      { input: '"hello world hello"', expected: '{"hello": 2, "world": 1}' },
    ],
  },
  {
    id: "ex-007",
    title: "File Line Counter",
    module: 6,
    difficulty: "Beginner",
    description: "Write a function count_lines(filename) that returns the number of lines in a file.",
    starterCode: "def count_lines(filename: str) -> int:\n    # Your code here\n    pass",
    xpReward: 125,
    status: "todo",
    attempts: 0,
    hints: [
      "Use open() with a context manager (with statement).",
      "Iterate over lines or use readlines().",
    ],
    testCases: [{ input: '"test.txt" (3 lines)', expected: "3" }],
  },
  {
    id: "ex-008",
    title: "Custom Exception",
    module: 7,
    difficulty: "Advanced",
    description:
      "Create a custom InvalidAgeError exception and a validate_age(age) function that raises it for invalid ages.",
    starterCode:
      "class InvalidAgeError(Exception):\n    pass\n\ndef validate_age(age: int) -> bool:\n    # Your code here\n    pass",
    xpReward: 300,
    status: "todo",
    attempts: 0,
    hints: [
      "Age should be between 0 and 150.",
      "Use raise InvalidAgeError('message') to raise the error.",
    ],
    testCases: [
      { input: "validate_age(25)", expected: "True" },
      { input: "validate_age(-5)", expected: "InvalidAgeError raised" },
    ],
  },
];

export const RECENT_ACTIVITY: ActivityEntry[] = [
  {
    id: "act-001",
    type: "exercise",
    description: "Completed 'FizzBuzz' exercise",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    xpGained: 100,
  },
  {
    id: "act-002",
    type: "chat",
    description: "Asked about list comprehensions",
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    xpGained: 10,
  },
  {
    id: "act-003",
    type: "code",
    description: "Ran code in editor (fibonacci.py)",
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    xpGained: 5,
  },
  {
    id: "act-004",
    type: "achievement",
    description: "Earned 'Week Warrior' badge",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    xpGained: 200,
  },
  {
    id: "act-005",
    type: "exercise",
    description: "Started 'Factorial Function' exercise",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    xpGained: 25,
  },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: "ach-001", title: "First Steps", description: "Complete your first exercise", icon: "🎉", unlocked: true, unlockedAt: new Date("2024-01-16") },
  { id: "ach-002", title: "Week Warrior", description: "Maintain a 7-day streak", icon: "🔥", unlocked: true, unlockedAt: new Date("2024-02-01") },
  { id: "ach-003", title: "Bug Squasher", description: "Debug 10 code errors", icon: "🐛", unlocked: true, unlockedAt: new Date("2024-02-10") },
  { id: "ach-004", title: "Loop Master", description: "Complete all Control Flow exercises", icon: "🔄", unlocked: true, unlockedAt: new Date("2024-02-15") },
  { id: "ach-005", title: "Speed Coder", description: "Submit a correct solution in under 2 minutes", icon: "⚡", unlocked: false },
  { id: "ach-006", title: "OOP Wizard", description: "Complete the OOP module", icon: "🧙", unlocked: false },
  { id: "ach-007", title: "Night Owl", description: "Code after midnight 5 times", icon: "🦉", unlocked: false },
  { id: "ach-008", title: "Perfectionist", description: "Get 100% mastery in any module", icon: "💎", unlocked: false },
];

export const CHAT_SESSIONS: ChatSession[] = [
  {
    id: "chat-001",
    title: "Understanding list comprehensions",
    lastMessage: "Great explanation, thanks!",
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    messages: [],
  },
  {
    id: "chat-002",
    title: "Debug: infinite loop in while",
    lastMessage: "Fixed! The condition was wrong.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    messages: [],
  },
  {
    id: "chat-003",
    title: "How do decorators work?",
    lastMessage: "I think I understand now.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    messages: [],
  },
  {
    id: "chat-004",
    title: "Fibonacci exercise help",
    lastMessage: "Try the recursive approach.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
    messages: [],
  },
];

export const STUDENTS: Student[] = [
  { id: "s-001", name: "Maya Chen", email: "maya@example.com", module: 3, mastery: 68, lastActive: new Date(Date.now() - 1000 * 60 * 30), status: "on-track", streak: 7 },
  { id: "s-002", name: "Liam Patel", email: "liam@example.com", module: 2, mastery: 45, lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2), status: "struggling", streak: 1 },
  { id: "s-003", name: "Sofia Garcia", email: "sofia@example.com", module: 5, mastery: 82, lastActive: new Date(Date.now() - 1000 * 60 * 15), status: "on-track", streak: 14 },
  { id: "s-004", name: "Noah Kim", email: "noah@example.com", module: 1, mastery: 30, lastActive: new Date(Date.now() - 1000 * 60 * 60 * 72), status: "inactive", streak: 0 },
  { id: "s-005", name: "Emma Wilson", email: "emma@example.com", module: 4, mastery: 55, lastActive: new Date(Date.now() - 1000 * 60 * 45), status: "on-track", streak: 3 },
  { id: "s-006", name: "Oliver Brown", email: "oliver@example.com", module: 2, mastery: 38, lastActive: new Date(Date.now() - 1000 * 60 * 60 * 4), status: "struggling", streak: 0 },
  { id: "s-007", name: "Ava Martinez", email: "ava@example.com", module: 6, mastery: 91, lastActive: new Date(Date.now() - 1000 * 60 * 60), status: "on-track", streak: 21 },
  { id: "s-008", name: "James Lee", email: "james@example.com", module: 3, mastery: 60, lastActive: new Date(Date.now() - 1000 * 60 * 20), status: "on-track", streak: 5 },
];

export const STRUGGLE_ALERTS: StruggleAlert[] = [
  { id: "al-001", studentName: "Liam Patel", issue: "Stuck on while loops — 3 failed attempts in a row", timestamp: new Date(Date.now() - 1000 * 60 * 15), severity: "high" },
  { id: "al-002", studentName: "Oliver Brown", issue: "No activity for 2 days — was on Control Flow", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), severity: "medium" },
  { id: "al-003", studentName: "Noah Kim", issue: "72h inactive — last seen on Module 1", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), severity: "high" },
];

export const DAILY_ACTIVITY: DailyActivity[] = Array.from({ length: 52 * 7 }, (_, i) => ({
  date: new Date(Date.now() - (52 * 7 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  count: Math.random() < 0.3 ? 0 : Math.floor(Math.random() * 8),
}));

export const MASTERY_OVER_TIME: MasteryDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString("en", { month: "short", day: "numeric" }),
  mastery: Math.min(100, 30 + Math.floor(i * 1.5 + Math.random() * 10)),
}));

export const EXERCISES_PER_MODULE = MODULES.map((m) => ({
  name: m.name.split(" ")[0],
  done: m.exercisesDone,
  total: m.totalExercises,
}));

export const TIME_PER_TOPIC = [
  { name: "Variables", value: 120 },
  { name: "Control Flow", value: 200 },
  { name: "Functions", value: 150 },
  { name: "Lists", value: 180 },
  { name: "OOP", value: 90 },
  { name: "Other", value: 60 },
];

export const CODE_HISTORY: CodeRun[] = [
  {
    id: "run-001",
    code: 'print("Hello, World!")',
    output: "Hello, World!",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    success: true,
  },
  {
    id: "run-002",
    code: "def fib(n):\n    if n <= 1: return n\n    return fib(n-1) + fib(n-2)\nprint(fib(10))",
    output: "55",
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    success: true,
  },
  {
    id: "run-003",
    code: "x = [1, 2, 3\nprint(x)",
    output: "SyntaxError: '(' was never closed",
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    success: false,
  },
];
