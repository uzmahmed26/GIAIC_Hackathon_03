---
name: mcp-code-execution
version: 1.0.0
description: Set up MCP server with secure sandboxed code execution tool for Claude
triggers:
  - "mcp code execution"
  - "setup mcp server"
  - "add code execution tool"
  - "mcp sandbox"
parameters:
  - name: server_name
    description: Name for the MCP server
    default: code-executor
  - name: sandbox
    description: "Sandbox backend: docker | nsjail | subprocess"
    default: docker
  - name: output_dir
    description: Directory to create the MCP server in
    default: mcp-server
script: scripts/setup.sh
# ~85 tokens
---

## Usage

```
/mcp-code-execution server_name=code-executor sandbox=docker
```

## What it does

1. Scaffolds MCP server with `@modelcontextprotocol/sdk`
2. Implements `execute_code` tool with stdin/stdout capture
3. Configures Docker sandbox with resource limits (CPU, memory, timeout)
4. Creates Claude Desktop config snippet
5. Adds test harness to verify tool registration
