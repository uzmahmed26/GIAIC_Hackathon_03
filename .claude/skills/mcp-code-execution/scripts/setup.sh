#!/usr/bin/env bash
# mcp-code-execution/scripts/setup.sh
# Sets up an MCP server with sandboxed code execution tool.
# Usage: bash setup.sh [server_name] [sandbox] [output_dir]
# Returns: "✓ Done" on success

set -euo pipefail

SERVER_NAME="${1:-code-executor}"
SANDBOX="${2:-docker}"
OUTPUT_DIR="${3:-mcp-server}"

log() { echo "  [mcp] $*"; }

mkdir -p "${OUTPUT_DIR}/src" "${OUTPUT_DIR}/sandbox"

# ── package.json ──────────────────────────────────────────────────────────────
log "Writing package.json..."
cat > "${OUTPUT_DIR}/package.json" << PKGEOF
{
  "name": "${SERVER_NAME}",
  "version": "1.0.0",
  "description": "MCP server with sandboxed code execution",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc -w",
    "start": "node dist/index.js",
    "test": "node dist/index.js --test"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.0.0"
  }
}
PKGEOF

# ── tsconfig.json ─────────────────────────────────────────────────────────────
cat > "${OUTPUT_DIR}/tsconfig.json" << 'TSEOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
TSEOF

# ── src/index.ts ──────────────────────────────────────────────────────────────
log "Writing MCP server (src/index.ts)..."
cat > "${OUTPUT_DIR}/src/index.ts" << 'TSEOF'
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { executeCode } from "./executor.js";

const server = new Server(
  { name: "SERVER_NAME_PLACEHOLDER", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "execute_code",
      description:
        "Execute code in a sandboxed environment. Returns stdout and stderr. " +
        "No network access. Max 30s timeout. Max 128MB RAM.",
      inputSchema: {
        type: "object" as const,
        properties: {
          language: {
            type: "string",
            enum: ["python", "javascript", "typescript", "bash"],
            description: "Programming language to execute",
          },
          code: {
            type: "string",
            description: "Code to execute",
          },
          timeout: {
            type: "number",
            description: "Execution timeout in seconds (1-30, default: 10)",
            minimum: 1,
            maximum: 30,
            default: 10,
          },
        },
        required: ["language", "code"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "execute_code") {
    return {
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }

  const args = request.params.arguments as {
    language: string;
    code: string;
    timeout?: number;
  };

  if (!args.language || !args.code) {
    return {
      content: [{ type: "text", text: "Missing required arguments: language, code" }],
      isError: true,
    };
  }

  const timeout = Math.min(Math.max(args.timeout ?? 10, 1), 30);
  const result = await executeCode(args.language, args.code, timeout);

  const output = [
    result.stdout ? `STDOUT:\n${result.stdout}` : "",
    result.stderr ? `STDERR:\n${result.stderr}` : "",
    !result.stdout && !result.stderr ? "(no output)" : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    content: [{ type: "text", text: output }],
    isError: result.exitCode !== 0,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
TSEOF

# Replace placeholder
sed -i "s/SERVER_NAME_PLACEHOLDER/${SERVER_NAME}/g" "${OUTPUT_DIR}/src/index.ts"

# ── src/executor.ts ───────────────────────────────────────────────────────────
log "Writing executor (src/executor.ts)..."
cat > "${OUTPUT_DIR}/src/executor.ts" << TSEOF
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

const SANDBOX_MODE = "${SANDBOX}";

const DOCKER_IMAGES: Record<string, string> = {
  python: "${SERVER_NAME}-python:latest",
  javascript: "${SERVER_NAME}-node:latest",
  typescript: "${SERVER_NAME}-node:latest",
  bash: "${SERVER_NAME}-bash:latest",
};

const LANGUAGE_COMMANDS: Record<string, string[]> = {
  python: ["python3", "-c"],
  javascript: ["node", "-e"],
  typescript: ["ts-node", "--skip-project", "-e"],
  bash: ["bash", "-c"],
};

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function executeCode(
  language: string,
  code: string,
  timeoutSecs: number
): Promise<ExecutionResult> {
  const cmd = LANGUAGE_COMMANDS[language];
  if (!cmd) {
    return { stdout: "", stderr: \`Unsupported language: \${language}\`, exitCode: 1 };
  }

  if (SANDBOX_MODE === "docker") {
    return executeInDocker(language, cmd, code, timeoutSecs);
  } else {
    return executeSubprocess(cmd, code, timeoutSecs);
  }
}

async function executeInDocker(
  language: string,
  cmd: string[],
  code: string,
  timeoutSecs: number
): Promise<ExecutionResult> {
  const image = DOCKER_IMAGES[language];
  try {
    const { stdout, stderr } = await execFileAsync(
      "docker",
      [
        "run", "--rm",
        "--network", "none",
        "--memory", "128m",
        "--cpus", "0.5",
        "--pids-limit", "50",
        "--read-only",
        "--tmpfs", "/tmp:size=10m,noexec",
        "--security-opt", "no-new-privileges",
        "--cap-drop", "ALL",
        image,
        ...cmd,
        code,
      ],
      { timeout: timeoutSecs * 1000 }
    );
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean };
    if (e.killed) {
      return { stdout: "", stderr: \`Timed out after \${timeoutSecs}s\`, exitCode: 124 };
    }
    return {
      stdout: (e.stdout ?? "").trim(),
      stderr: (e.stderr ?? e.message ?? "").trim(),
      exitCode: (e as { code?: number }).code ?? 1,
    };
  }
}

async function executeSubprocess(
  cmd: string[],
  code: string,
  timeoutSecs: number
): Promise<ExecutionResult> {
  const tmpFile = join(tmpdir(), \`mcp-exec-\${Date.now()}.tmp\`);
  await writeFile(tmpFile, code, "utf8");
  try {
    const { stdout, stderr } = await execFileAsync(
      cmd[0],
      [...cmd.slice(1), code],
      { timeout: timeoutSecs * 1000 }
    );
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string; code?: number; killed?: boolean };
    if (e.killed) {
      return { stdout: "", stderr: \`Timed out after \${timeoutSecs}s\`, exitCode: 124 };
    }
    return {
      stdout: (e.stdout ?? "").trim(),
      stderr: (e.stderr ?? e.message ?? "").trim(),
      exitCode: e.code ?? 1,
    };
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}
TSEOF

# ── Sandbox Dockerfiles ───────────────────────────────────────────────────────
if [[ "$SANDBOX" == "docker" ]]; then
  log "Writing sandbox Dockerfiles..."

  cat > "${OUTPUT_DIR}/sandbox/Dockerfile.python" << 'DEOF'
FROM python:3.12-slim
RUN pip install --no-cache-dir numpy pandas matplotlib scipy sympy
RUN useradd -m -u 1000 sandbox
USER sandbox
WORKDIR /tmp
DEOF

  cat > "${OUTPUT_DIR}/sandbox/Dockerfile.node" << 'DEOF'
FROM node:20-alpine
RUN npm install -g ts-node typescript
RUN adduser -D -u 1000 sandbox
USER sandbox
WORKDIR /tmp
DEOF

  cat > "${OUTPUT_DIR}/sandbox/Dockerfile.bash" << 'DEOF'
FROM alpine:3.19
RUN adduser -D -u 1000 sandbox
USER sandbox
WORKDIR /tmp
DEOF

  cat > "${OUTPUT_DIR}/sandbox/build.sh" << BEOF
#!/usr/bin/env bash
# Build all sandbox images
set -e
SERVER="${SERVER_NAME}"
docker build -f Dockerfile.python -t "\${SERVER}-python:latest" .
docker build -f Dockerfile.node   -t "\${SERVER}-node:latest"   .
docker build -f Dockerfile.bash   -t "\${SERVER}-bash:latest"   .
echo "✓ All sandbox images built"
BEOF
  chmod +x "${OUTPUT_DIR}/sandbox/build.sh"
fi

# ── Claude Desktop config ─────────────────────────────────────────────────────
log "Writing Claude Desktop config snippet..."
cat > "${OUTPUT_DIR}/claude_desktop_config.json" << CONFEOF
{
  "mcpServers": {
    "${SERVER_NAME}": {
      "command": "node",
      "args": ["$(pwd)/${OUTPUT_DIR}/dist/index.js"],
      "env": {}
    }
  }
}
CONFEOF

# ── Install deps and build ────────────────────────────────────────────────────
log "Installing dependencies..."
cd "${OUTPUT_DIR}"
npm install > /dev/null 2>&1
npm run build > /dev/null 2>&1
cd - > /dev/null

echo ""
echo "  MCP server ready: ${OUTPUT_DIR}/"
echo ""
if [[ "$SANDBOX" == "docker" ]]; then
  echo "  1. Build sandbox images:"
  echo "     cd ${OUTPUT_DIR}/sandbox && bash build.sh"
  echo ""
fi
echo "  2. Add to Claude Desktop config:"
echo "     cat ${OUTPUT_DIR}/claude_desktop_config.json"
echo ""
echo "  3. Test the server:"
echo "     echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}' | node ${OUTPUT_DIR}/dist/index.js"
echo ""
echo "✓ Done"
