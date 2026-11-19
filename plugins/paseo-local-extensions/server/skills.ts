import { lstat, mkdir, open, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bundle, skillBody } from "../shared/bundle.js";

function skillRoots() {
  const home = os.homedir();
  return [
    { path: path.join(home, ".agents", "skills"), location: ".agents" },
    { path: path.join(home, ".codex", "skills"), location: ".codex" },
    { path: path.join(home, ".claude", "skills"), location: ".claude" },
    { path: path.join(home, ".config", "opencode", "skills"), location: "OpenCode" },
  ];
}

function samplePaths() {
  const dir = path.join(skillRoots()[0]!.path, bundle.skill);
  return { dir, file: path.join(dir, "SKILL.md") };
}

async function sampleStatus(): Promise<"available" | "installed" | "external"> {
  const { dir, file } = samplePaths();
  const directory = await lstat(dir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!directory) return "available";
  if (!directory.isDirectory()) return "external";
  const stat = await lstat(file).catch(() => null);
  if (!stat) return "available";
  if (!stat.isFile() || stat.size !== Buffer.byteLength(skillBody)) return "external";
  return (await readFile(file, "utf8")) === skillBody ? "installed" : "external";
}

async function description(file: string): Promise<string | null> {
  const stat = await lstat(file).catch(() => null);
  if (!stat?.isFile()) return null;
  const contents = Buffer.alloc(8192);
  const handle = await open(file, "r");
  try {
    const { bytesRead } = await handle.read(contents, 0, contents.length, 0);
    const header = contents
      .toString("utf8", 0, bytesRead)
      .match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\s*$/m)?.[1];
    return (
      header
        ?.match(/^description:\s*(.*)$/m)?.[1]
        ?.trim()
        .replace(/^["']|["']$/g, "")
        .slice(0, 220) ?? ""
    );
  } finally {
    await handle.close();
  }
}

export async function scanLocalSkills() {
  const skills = [];
  for (const root of skillRoots()) {
    const dirs = await readdir(root.path, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      },
    );
    for (const dir of dirs
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(root.path, dir.name, "SKILL.md");
      const hint = await description(file).catch(() => null);
      if (hint !== null)
        skills.push({ name: dir.name, path: file, location: root.location, description: hint });
    }
  }
  return { skills, sample: await sampleStatus() };
}

export async function setSampleSkill(install: boolean) {
  const { dir, file } = samplePaths();
  const status = await sampleStatus();
  if (status === "external") throw new Error("同名技能已有本机修改，请在原目录管理。");
  if (install && status === "available") {
    await mkdir(dir, { recursive: true });
    await writeFile(file, skillBody, { flag: "wx" });
  }
  if (!install && status === "installed") {
    await unlink(file);
  }
  return scanLocalSkills();
}
