# Paseo 扩展库

这个目录包含随 Paseo Local 桌面版发布的扩展示例。Git 扩展库保管发布源码，桌面版使用构建时固定的副本。

- `skills/paseo-project-check` 检查本地项目启动方式。
- `skills/catalog.json` 是 Paseo Local 的 Git Skill 库。每个条目包含名称、版本、提交 SHA、文件列表和可选的 MCP 依赖。
- `mcp/local-demo.cjs` 提供无需联网、无外部依赖的 MCP 状态工具。
- `plugins/paseo-local-extensions` 提供主机技能和 MCP 设置，作为 Paseo Local 的内置插件构建。
- `manifest.json` 记录发布版本和标识。

用 Paseo 源码中的 `npm run sync:local-extensions` 将本目录中的 Skill 和 MCP 更新到编译输入。插件开发请使用声明版本匹配的 Paseo 源码。

发布 Git Skill 时，先提交 `skills/<id>/` 中的 `SKILL.md` 和配套文件。然后在 `skills/catalog.json` 加入条目，`revision` 填包含文件的完整提交 SHA，`files` 填相对 Skill 目录的路径。提升目录的 `release`，将目录更新推送到 `main`。Paseo Local 中点 **扩展 → Skills → 从 Git 来源添加** 即可刷新安装列表。
