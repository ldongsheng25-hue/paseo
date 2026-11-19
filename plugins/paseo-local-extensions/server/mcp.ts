import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { z } from "zod";
import { bundle, mcpSource } from "../shared/bundle.js";

export interface StdioLaunch {
  type: "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export function demoLaunch(): StdioLaunch {
  return {
    type: "stdio",
    command: process.execPath,
    args: ["-e", mcpSource],
    ...(process.versions.electron ? { env: { ELECTRON_RUN_AS_NODE: "1" } } : {}),
  };
}

const responseSchema = z.object({
  id: z.number(),
  error: z.object({ message: z.string() }).optional(),
  result: z.unknown(),
});
const initializeSchema = z.object({
  protocolVersion: z.string(),
  serverInfo: z.object({ name: z.string() }),
});
const toolsSchema = z.object({ tools: z.array(z.object({ name: z.string() })) });
const demoResultSchema = z.object({
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })).min(1),
  isError: z.literal(false).optional(),
});

export function probeMcp(launch: StdioLaunch, demo: boolean) {
  return new Promise<{ tools: string[]; sampleResult?: string }>((resolve, reject) => {
    const child = spawn(launch.command, launch.args, {
      stdio: ["pipe", "pipe", "ignore"],
      env: { ...process.env, ...launch.env },
      windowsHide: true,
    });
    const lines = createInterface({ input: child.stdout });
    let settled = false;
    let tools: string[] = [];
    let received = 0;
    const timer = setTimeout(() => fail(new Error("MCP 在 10 秒内未完成握手。")), 10_000);

    function stop() {
      settled = true;
      clearTimeout(timer);
      lines.close();
      child.stdin.destroy();
      child.stdout.destroy();
      child.kill();
    }

    function fail(error: unknown) {
      if (settled) return;
      stop();
      reject(error);
    }

    function success(sampleResult?: string) {
      stop();
      resolve({ tools, sampleResult });
    }

    function send(method: string, id?: number, params?: object) {
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    }

    child.on("error", fail);
    child.stdin.on("error", fail);
    child.on("exit", (code) => fail(new Error(`MCP 在完成握手前退出（${code ?? "signal"}）。`)));
    child.stdout.on("data", (chunk: Buffer) => {
      received += chunk.byteLength;
      if (received > 2 * 1024 * 1024) fail(new Error("MCP 握手响应超过 2 MB。"));
    });
    lines.on("line", (line) => {
      if (settled) return;
      try {
        const response = responseSchema.safeParse(JSON.parse(line));
        if (!response.success) return;
        const { id, result, error } = response.data;
        if (error) throw new Error(error.message);
        switch (id) {
          case 1:
            initializeSchema.parse(result);
            send("notifications/initialized");
            send("tools/list", 2);
            break;
          case 2:
            tools = toolsSchema.parse(result).tools.map(({ name }) => name);
            if (demo) send("tools/call", 3, { name: "local_extension_status", arguments: {} });
            else success();
            break;
          case 3:
            if (demo) success(demoResultSchema.parse(result).content[0]!.text);
            break;
        }
      } catch (error) {
        fail(error);
      }
    });
    send("initialize", 1, {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "Paseo Local", version: bundle.version },
    });
  });
}
