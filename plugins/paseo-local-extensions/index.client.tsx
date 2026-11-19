import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ExtensionSettings } from "./client/extension-settings.js";

export default function contribute(client: PluginClientContext) {
  return client.addSettingsScreen({
    id: "extensions",
    title: "扩展",
    icon: "Blocks",
    Component: ExtensionSettings,
  });
}
