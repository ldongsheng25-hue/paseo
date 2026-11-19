import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  useRpc,
  useSettings,
  type PluginSurfaceProps,
  type SettingsState,
} from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import type { z } from "zod";
import { bundle } from "../shared/bundle.js";
import { changeSkill, listSkills, preferences, stdioServer, testMcp } from "../shared/contracts.js";

type Inventory = z.output<typeof listSkills.output>;
type ReadySettings = Extract<SettingsState<typeof preferences.schema>, { status: "ready" }>;
type Server = z.output<typeof stdioServer>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function SkillsPanel() {
  const getSkills = useRpc(listSkills);
  const setSkill = useRpc(changeSkill);
  const [inventory, setInventory] = useState<Inventory>();
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    setWorking(true);
    setMessage("");
    try {
      setInventory(await getSkills({}));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setWorking(false);
    }
  }, [getSkills]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleSample = useCallback(
    async (install: boolean) => {
      setWorking(true);
      setMessage("");
      try {
        setInventory(await setSkill({ install }));
      } catch (error) {
        setMessage(errorMessage(error));
      } finally {
        setWorking(false);
      }
    },
    [setSkill],
  );

  return (
    <SettingsSection title="Skills">
      <SettingsCard>
        <SettingsAction
          label="本机技能"
          hint={
            inventory
              ? `已发现 ${inventory.skills.length} 项用户级技能`
              : "扫描所选主机的用户级技能目录"
          }
          actionLabel="刷新"
          onPress={refresh}
          disabled={working}
        />
        <SettingsSwitch
          label={bundle.skill}
          hint={
            inventory?.sample === "external"
              ? "已有本机版本，可在原目录管理"
              : "随安装包提供 · 安装到当前主机用户的 .agents/skills"
          }
          value={inventory?.sample === "installed"}
          disabled={working || !inventory || inventory.sample === "external"}
          onValueChange={toggleSample}
        />
        {message ? <SettingsRow label="技能操作失败" error={message} /> : null}
        {inventory?.skills.map((skill) => (
          <SettingsRow
            label={skill.name}
            key={skill.path}
            hint={`${skill.path}${skill.description ? `\n${skill.description}` : ""}${skill.dependencies.length ? `\n依赖：${skill.dependencies.join("、")}` : ""}`}
          />
        ))}
      </SettingsCard>
    </SettingsSection>
  );
}

const emptyServer: Server = { name: "", command: "", args: [], enabled: false };

function ServerEditor({
  server,
  onSave,
  onCancel,
  disabled,
}: {
  server: Server;
  onSave(value: Server): Promise<boolean>;
  onCancel(): void;
  disabled: boolean;
}) {
  const [name, setName] = useState(server.name);
  const [command, setCommand] = useState(server.command);
  const [args, setArgs] = useState(JSON.stringify(server.args));
  const [error, setError] = useState("");

  const save = useCallback(async () => {
    setError("");
    try {
      const parsed = stdioServer.safeParse({
        name,
        command,
        args: JSON.parse(args),
        enabled: server.enabled,
      });
      if (!parsed.success) {
        setError(
          "请检查名称、命令和参数。名称只能包含字母、数字、连字符或下划线，参数必须是 JSON 字符串数组。",
        );
        return;
      }
      await onSave(parsed.data);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [args, command, name, onSave, server.enabled]);

  return (
    <SettingsCard>
      <SettingsInput
        label="MCP 名称"
        initialValue={name}
        onChangeText={setName}
        placeholder="my_mcp"
        disabled={disabled}
      />
      <SettingsInput
        label="启动命令"
        initialValue={command}
        onChangeText={setCommand}
        placeholder="node"
        disabled={disabled}
      />
      <SettingsInput
        label="命令参数（JSON）"
        initialValue={args}
        onChangeText={setArgs}
        placeholder='["server.js"]'
        disabled={disabled}
      />
      <SettingsAction
        label="STDIO MCP"
        hint="启用或测试时，命令会在所选主机上运行。"
        error={error}
        actionLabel="保存"
        disabled={disabled}
        onPress={save}
      />
      <SettingsAction label="取消编辑" actionLabel="取消" disabled={disabled} onPress={onCancel} />
    </SettingsCard>
  );
}

function ServerRow({
  server,
  working,
  disabled,
  onToggle,
  onProbe,
  onEdit,
  onRemove,
}: {
  server: Server;
  working: boolean;
  disabled: boolean;
  onToggle(name: string, enabled: boolean): void;
  onProbe(name: string): void;
  onEdit(server: Server): void;
  onRemove(name: string): void;
}) {
  const toggle = useCallback(
    (enabled: boolean) => onToggle(server.name, enabled),
    [onToggle, server.name],
  );
  const probe = useCallback(() => onProbe(server.name), [onProbe, server.name]);
  const edit = useCallback(() => onEdit(server), [onEdit, server]);
  const remove = useCallback(() => onRemove(server.name), [onRemove, server.name]);
  return (
    <View>
      <SettingsSwitch
        label={server.name}
        hint={server.command}
        value={server.enabled}
        disabled={disabled}
        onValueChange={toggle}
      />
      <SettingsAction
        label={server.name}
        actionLabel={working ? "测试中…" : "测试连接"}
        disabled={disabled}
        onPress={probe}
      />
      <SettingsAction label={server.name} actionLabel="编辑" disabled={disabled} onPress={edit} />
      <SettingsAction
        label={server.name}
        actionLabel="移除配置"
        disabled={disabled}
        onPress={remove}
      />
    </View>
  );
}

function McpPanel({ settings }: { settings: ReadySettings }) {
  const probe = useRpc(testMcp);
  const [editing, setEditing] = useState<{ original?: string; server: Server; revision: string }>();
  const [working, setWorking] = useState<string>();
  const [diagnostic, setDiagnostic] = useState<{ name: string; result?: string; error?: string }>();
  const [saveError, setSaveError] = useState("");
  const disabled = settings.saving || working !== undefined;

  const runTest = useCallback(
    async (name: string) => {
      setWorking(name);
      setDiagnostic(undefined);
      try {
        const result = await probe({ name });
        setDiagnostic({
          name,
          result:
            result.sampleResult ??
            (result.tools.length ? result.tools.join("、") : "已连接，服务未报告工具"),
        });
      } catch (error) {
        setDiagnostic({ name, error: errorMessage(error) });
      } finally {
        setWorking(undefined);
      }
    },
    [probe],
  );

  const saveServers = useCallback(
    async (servers: Server[]) => {
      setSaveError("");
      return settings.save({ ...settings.values, servers }, settings.revision);
    },
    [settings],
  );

  const saveEdit = useCallback(
    async (server: Server) => {
      if (editing?.revision !== settings.revision) {
        setSaveError("主机配置已更新，请重新打开编辑。");
        return false;
      }
      if (
        settings.values.servers.some(
          (entry) => entry.name === server.name && entry.name !== editing?.original,
        )
      ) {
        setSaveError("此 MCP 名称已存在。");
        return false;
      }
      const saved = await saveServers([
        ...settings.values.servers.filter((entry) => entry.name !== editing?.original),
        server,
      ]);
      if (saved) setEditing(undefined);
      return saved;
    },
    [editing, saveServers, settings.revision, settings.values.servers],
  );

  const addServer = useCallback(
    () => setEditing({ server: emptyServer, revision: settings.revision }),
    [settings.revision],
  );
  const editServer = useCallback(
    (server: Server) => setEditing({ original: server.name, server, revision: settings.revision }),
    [settings.revision],
  );
  const cancelEdit = useCallback(() => setEditing(undefined), []);
  const toggleDemo = useCallback(
    (demoMcp: boolean) => {
      void settings.save({ ...settings.values, demoMcp }, settings.revision);
    },
    [settings],
  );
  const testDemo = useCallback(() => {
    void runTest(bundle.mcp);
  }, [runTest]);
  const toggleServer = useCallback(
    (name: string, enabled: boolean) => {
      void saveServers(
        settings.values.servers.map((entry) =>
          entry.name === name ? { ...entry, enabled } : entry,
        ),
      );
    },
    [saveServers, settings.values.servers],
  );
  const removeServer = useCallback(
    (name: string) => {
      if (editing?.original === name) setEditing(undefined);
      void saveServers(settings.values.servers.filter((entry) => entry.name !== name));
    },
    [editing, saveServers, settings.values.servers],
  );

  return (
    <SettingsSection title="MCP">
      <SettingsCard>
        <SettingsSwitch
          label={bundle.mcp}
          hint="随安装包提供 · 离线样例 · 将配置应用到随后启动的 Codex 会话"
          value={settings.values.demoMcp}
          disabled={disabled}
          onValueChange={toggleDemo}
        />
        <SettingsAction
          label={bundle.mcp}
          actionLabel={working === bundle.mcp ? "测试中…" : "测试连接"}
          disabled={disabled}
          onPress={testDemo}
        />
        {settings.values.servers.map((server) => (
          <ServerRow
            key={server.name}
            server={server}
            working={working === server.name}
            disabled={disabled}
            onToggle={toggleServer}
            onProbe={runTest}
            onEdit={editServer}
            onRemove={removeServer}
          />
        ))}
        {diagnostic ? (
          <SettingsRow label={diagnostic.name} hint={diagnostic.result} error={diagnostic.error} />
        ) : null}
        {settings.saveError || saveError ? (
          <SettingsRow label="保存失败" error={saveError || settings.saveError} />
        ) : null}
        {!editing ? (
          <SettingsAction
            label="添加 STDIO MCP"
            actionLabel="添加"
            disabled={disabled}
            onPress={addServer}
          />
        ) : null}
      </SettingsCard>
      {editing ? (
        <ServerEditor
          key={editing.original ?? "new"}
          server={editing.server}
          onSave={saveEdit}
          onCancel={cancelEdit}
          disabled={disabled}
        />
      ) : null}
    </SettingsSection>
  );
}

export function ExtensionSettings({ theme }: PluginSurfaceProps) {
  const settings = useSettings(preferences);
  const textStyle = useMemo(() => ({ color: theme.colors.foreground }), [theme.colors.foreground]);
  return (
    <View>
      <SkillsPanel />
      {settings.status === "ready" ? (
        <McpPanel settings={settings} />
      ) : (
        <SettingsSection title="MCP">
          <Text style={textStyle}>
            {settings.status === "loading" ? "正在读取主机配置…" : settings.error}
          </Text>
        </SettingsSection>
      )}
      <SettingsSection title="随包插件">
        <SettingsCard>
          <SettingsRow
            label="Paseo Local Extensions"
            hint={`${bundle.version} · ${bundle.repository}`}
          />
        </SettingsCard>
      </SettingsSection>
    </View>
  );
}
