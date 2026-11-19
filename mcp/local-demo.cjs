const readline = require("node:readline");

const tool = {
  name: "local_extension_status",
  description: "Report the version of the offline Paseo sample extension.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

function write(id, response) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, ...response }) + "\n");
}

readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  if (!request || request.id === undefined) return;
  const { id, method, params } = request;
  switch (method) {
    case "initialize":
      return write(id, {
        result: {
          protocolVersion: ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"].includes(
            params?.protocolVersion,
          )
            ? params.protocolVersion
            : "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "paseo-local-demo", version: "1.0.0" },
        },
      });
    case "ping":
      return write(id, { result: {} });
    case "tools/list":
      return write(id, { result: { tools: [tool] } });
    case "tools/call":
      if (params?.name === tool.name) {
        return write(id, {
          result: {
            content: [{ type: "text", text: "Paseo Local Extensions 1.0.0 · offline MCP ready" }],
          },
        });
      }
      return write(id, { error: { code: -32602, message: "Unknown tool" } });
    default:
      return write(id, { error: { code: -32601, message: "Method not found" } });
  }
});
