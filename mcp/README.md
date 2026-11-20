# Git MCP 库

在 Paseo Local 的 **设置 → 本地主机 → 扩展 → Git MCP 库** 打开目录。页面读取本仓库 `main` 分支的 `mcp/catalog.json`。安装后，回到 **扩展 → MCP** 测试连接，再新建 Codex 会话。

发布一个版本分两步：

1. 新建 `mcp/<recipe>/`，使用明确的 npm 版本生成 `package.json` 和 `package-lock.json` v3。清单中只声明一个直接依赖，锁文件中的依赖使用带完整性校验的 npm 官方注册表制品。提交配方，记下提交 SHA。
2. 将新项加入 `mcp/catalog.json` 或修改已有条目，提升根节点 `release`，然后提交、推送到 `main`。条目的 `revision` 填第一步的完整提交 SHA。更改启动参数时也使用新的配方提交 SHA，便于同事看到更新可用。

`id` 是在 Paseo 和 Codex 中使用的 MCP 名称，跨版本保持稳定。`package`、`version`、`bin` 分别填写确切的 npm 包名、版本和 npm 启动入口名称。`args` 包含该入口收到的参数。Chrome DevTools 需要主机已安装 Chrome。注册表安装会跳过 npm 生命周期脚本，因此只能发布无需这些脚本生成运行产物的包。

主机首次安装需要 Node.js、npm 和 GitHub、npm 注册表网络访问。目录刷新只查版本，安装或升级通过列表按钮触发。同名手动配置需要先在扩展页移除。
