# mcp-code-execution Reference

## Overview

Sets up an MCP (Model Context Protocol) server that exposes a `execute_code` tool for secure sandboxed code execution. Claude can call this tool to run Python, JavaScript, Bash, and other languages in isolated containers.

## MCP Code Execution Pattern

From Anthropic's engineering blog: the key insight is that **scripts do the heavy lifting, not the LLM**. The LLM calls tools with minimal parameters; the tool calls pre-written scripts that contain all the complex logic and return concise results.

```
User prompt
    │
    ▼
Claude (tool call)
    │  execute_code(language="python", code="print(1+1)")
    ▼
MCP Server (receives tool call)
    │  validates inputs, sets up sandbox
    ▼
Docker Container (isolated execution)
    │  runs code with resource limits
    ▼
stdout/stderr capture
    │
    ▼
Claude (receives result: "2\n")
    │
    ▼
User response
```

## Generated Server Structure

```
mcp-server/
├── src/
│   index.ts              # MCP server entry point
│   executor.ts           # Sandbox execution logic
│   languages.ts          # Language configs
├── sandbox/
│   Dockerfile.python     # Python sandbox image
│   Dockerfile.node       # Node.js sandbox image
│   Dockerfile.bash       # Bash sandbox image
├── package.json
├── tsconfig.json
└── claude_desktop_config.json  # Config snippet
```

## MCP Server Implementation

```typescript
// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { executeCode } from "./executor.js";

const server = new Server(
  { name: "code-executor", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "execute_code",
    description: "Execute code in a sandboxed environment and return stdout/stderr",
    inputSchema: {
      type: "object",
      properties: {
        language: {
          type: "string",
          enum: ["python", "javascript", "bash", "typescript"],
          description: "Programming language to execute",
        },
        code: {
          type: "string",
          description: "Code to execute",
        },
        timeout: {
          type: "number",
          description: "Execution timeout in seconds (default: 10, max: 30)",
          default: 10,
        },
      },
      required: ["language", "code"],
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "execute_code") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const { language, code, timeout = 10 } = request.params.arguments as {
    language: string;
    code: string;
    timeout?: number;
  };

  const result = await executeCode(language, code, Math.min(timeout, 30));

  return {
    content: [{
      type: "text",
      text: result.stdout || result.stderr || "(no output)",
    }],
    isError: result.exitCode !== 0,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Sandbox Executor

```typescript
// src/executor.ts
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const LANGUAGE_IMAGES: Record<string, string> = {
  python: "code-executor-python:latest",
  javascript: "code-executor-node:latest",
  typescript: "code-executor-node:latest",
  bash: "code-executor-bash:latest",
};

const LANGUAGE_COMMANDS: Record<string, string[]> = {
  python: ["python3", "-c"],
  javascript: ["node", "-e"],
  typescript: ["ts-node", "-e"],
  bash: ["bash", "-c"],
};

export async function executeCode(
  language: string,
  code: string,
  timeoutSecs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const image = LANGUAGE_IMAGES[language];
  if (!image) throw new Error(`Unsupported language: ${language}`);

  const cmd = LANGUAGE_COMMANDS[language];

  try {
    const { stdout, stderr } = await execFileAsync("docker", [
      "run",
      "--rm",
      "--network", "none",          // No network access
      "--memory", "128m",            // 128MB RAM limit
      "--cpus", "0.5",              // 0.5 CPU cores
      "--pids-limit", "50",         // Max 50 processes
      "--read-only",                 // Read-only filesystem
      "--tmpfs", "/tmp:size=10m",   // Writable /tmp (10MB)
      "--security-opt", "no-new-privileges",
      image,
      ...cmd,
      code,
    ], { timeout: timeoutSecs * 1000 });

    return { stdout, stderr, exitCode: 0 };
  } catch (err: any) {
    if (err.killed) {
      return { stdout: "", stderr: `Execution timed out after ${timeoutSecs}s`, exitCode: 124 };
    }
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || err.message,
      exitCode: err.code || 1,
    };
  }
}
```

## Sandbox Dockerfiles

```dockerfile
# sandbox/Dockerfile.python
FROM python:3.12-slim

# Install common data science packages
RUN pip install --no-cache-dir numpy pandas matplotlib scipy

# Create non-root user
RUN useradd -m -u 1000 sandbox
USER sandbox
WORKDIR /tmp
```

## Claude Desktop Configuration

```json
{
  "mcpServers": {
    "code-executor": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {}
    }
  }
}
```

## Security Considerations

| Risk | Mitigation |
|------|-----------|
| Network access | `--network none` |
| Resource exhaustion | `--memory 128m --cpus 0.5 --pids-limit 50` |
| Filesystem writes | `--read-only --tmpfs /tmp:size=10m` |
| Privilege escalation | `--security-opt no-new-privileges` |
| Infinite loops | `timeout` parameter + Docker `--stop-timeout` |
| Container escape | Rootless Docker + non-root user in container |

## Troubleshooting

**Docker not found**
```bash
# Use subprocess sandbox instead
SANDBOX=subprocess node dist/index.js
```

**Tool not appearing in Claude**
```bash
# Test MCP server directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

**Timeout on first run**
- Docker needs to pull sandbox images — allow extra time on first execution
- Pre-pull: `docker pull code-executor-python:latest`
