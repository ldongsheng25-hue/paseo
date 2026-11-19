import type { PluginServerContext } from "@getpaseo/plugin/server";
import { bundle } from "./shared/bundle.js";
import { changeSkill, listSkills, preferences, testMcp } from "./shared/contracts.js";
import { demoLaunch, probeMcp, type StdioLaunch } from "./server/mcp.js";
import { scanLocalSkills, setSampleSkill } from "./server/skills.js";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(preferences);
  server.handle(listSkills, scanLocalSkills);
  server.handle(changeSkill, ({ install }) => setSampleSkill(install));
  server.handle(testMcp, async ({ name }) => {
    if (name === bundle.mcp) return probeMcp(demoLaunch(), true);
    const state = await settings.read();
    if (state.status !== "ready") throw new Error(state.error);
    const config = state.values.servers.find((entry) => entry.name === name);
    if (!config) throw new Error("MCP 配置已移除。");
    return probeMcp({ type: "stdio", command: config.command, args: config.args }, false);
  });
  return server.addHook("agent.open.before", async ({ request }) => {
    if (request.provider !== "codex" || request.background || request.purpose !== "interactive")
      return;
    const state = await settings.read();
    if (state.status !== "ready") return;
    const additions: Record<string, StdioLaunch> = {};
    if (state.values.demoMcp) additions[bundle.mcp] = demoLaunch();
    for (const { name, command, args, enabled } of state.values.servers) {
      if (enabled) additions[name] = { type: "stdio", command, args };
    }
    return { ...request, mcpServers: { ...additions, ...request.mcpServers } };
  });
}
