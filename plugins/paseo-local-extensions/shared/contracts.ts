import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

const mcpName = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,64}$/)
  .refine(
    (value) => !["__proto__", "constructor", "prototype", "paseo_local_demo"].includes(value),
  );

export const stdioServer = z.object({
  name: mcpName,
  command: z.string().trim().min(1).max(1024),
  args: z.array(z.string().max(4096)).max(48),
  enabled: z.boolean(),
});

export const preferences = defineSettings({
  id: "extensions",
  scope: "host",
  version: 1,
  schema: z.object({
    demoMcp: z.boolean().default(true),
    servers: z
      .array(stdioServer)
      .max(30)
      .refine(
        (servers) => new Set(servers.map((entry) => entry.name)).size === servers.length,
        "MCP names must be unique",
      )
      .default([]),
  }),
});

const skillSchema = z.object({
  name: z.string(),
  path: z.string(),
  location: z.string(),
  description: z.string(),
});

export const listSkills = defineRpc({
  name: "list-local-skills",
  input: z.object({}),
  output: z.object({
    skills: z.array(skillSchema),
    sample: z.enum(["available", "installed", "external"]),
  }),
});

export const changeSkill = defineRpc({
  name: "change-sample-skill",
  input: z.object({ install: z.boolean() }),
  output: listSkills.output,
});

export const testMcp = defineRpc({
  name: "test-mcp-connection",
  input: z.object({ name: z.string() }),
  output: z.object({ tools: z.array(z.string()), sampleResult: z.string().optional() }),
});
