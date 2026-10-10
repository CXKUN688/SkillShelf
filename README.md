# SkillShelf

Windows 桌面技能管理器。每台电脑独立扫描本地 Codex / Agents 技能，无需同步服务。

## 下载与运行

在 [Releases](https://github.com/CXKUN688/SkillShelf/releases/latest) 下载 Windows x64 便携包，完整解压后双击 **SkillShelf.exe**。无需安装 Node.js 或 Python。

复制到另一台电脑后，程序会自动识别那台电脑的当前用户目录。不要只复制 exe；请保留 resources、locales 和 DLL 文件。

## 功能

- 自动扫描当前用户的 `.codex/skills`、`.agents/skills` 和 Codex 插件缓存，支持 `CODEX_HOME` 与自定义目录。
- 完整技能列表、全文搜索、分类筛选、同名副本与内容校验值比较。
- 个人技能启停；备份校验后卸载；恢复时拒绝覆盖已有目录或被重定向的路径。
- 系统和插件技能保护。插件缓存存在不代表正在加载，配置无法确认时显示状态未知。
- GitHub 七日热门候选榜单，查看技能内容后从固定提交安装；不覆盖同名目录，不执行下载脚本。
- 支持窗口缩放和滚动；单实例运行避免同时修改记录。

## GitHub 榜单口径

热度来自 **七个完整数据日的仓库新增 Stars**，并非单个技能的热度。日界按 GitHub 返回的历史数据桶处理，不保证 UTC，也不是严格 168 小时。

检索 `agent-skills`、`codex-skills`、`claude-code-skills` 关键词，检查候选仓库的 `SKILL.md` 元数据。公开接口模式最多检查 16 个候选；本机有可用 GitHub CLI 时最多检查 24 个。覆盖数量在界面展示，**不是 GitHub 全站完整榜单**。

本地缓存有效期 6 小时，支持手动更新。缺失数据标为不可用；离线或限流时尽量保留缓存。正常读取公开仓库无需登录；已配置的 GitHub CLI 可提供认证请求，程序不读取或保存其口令。

参考：[GitHub repository star history](https://docs.github.com/en/rest/activity/starring?apiVersion=2026-03-10#get-repository-star-history)。

## 本地数据与状态

程序默认将设置、GitHub 缓存、备份和操作记录保存在旁边的 `data` 文件夹；程序目录不可写时使用当前用户的应用数据目录。实际位置可在“扫描设置”查看。

“已启用”表示本机设置未停用该技能，并不证明当前 Codex 会话正在加载。启停后通常需要重启 Codex。插件通过 Codex 的插件管理功能处理；已有技能未记录来源时显示来源未知。

迁移程序时可不复制 `data`，让新电脑建立自己的设置与记录。技能所需的可选运行依赖请按其文档配置。

## 从源码运行

建议使用 Node.js 24 与 Windows x64。

```powershell
npm ci
node node_modules/electron/install.js
npm start
```

Electron 运行组件由官方安装脚本下载。已有组件时该步骤会直接退出。

```powershell
npm test
npm run package
```

打包结果位于 `outputs/SkillShelf-win32-x64`。修改核心逻辑后请运行测试；测试文件和运行产生的数据不会进入程序包。

## 验证

19 项测试覆盖用户目录与 CODEX_HOME、递归完整扫描、配置文件缺失及等价 TOML 写法、同名技能、链接防护、嵌套子技能保护、恢复冲突与七日指标计算。

Windows x64 打包程序已实际启动验证：搜索、详情全文、900×640 窗口滚动、单实例与联网候选榜单。真实技能下载安装、拒绝覆盖、卸载和恢复在隔离目录中验证，未修改真实用户技能。尚未在第二台实体电脑上运行。

## 许可证

[MIT](LICENSE)。Electron 和其第三方组件保留各自的许可证，便携包内包含对应许可文件。
