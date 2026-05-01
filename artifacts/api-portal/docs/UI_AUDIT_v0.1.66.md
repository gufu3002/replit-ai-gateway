# AI Gateway 前端 UI 审查报告 — v0.1.66

> 审查日期：2026-04-21
> 审查范围：前端 8 个标签页（系统设置 / 实时日志 / 使用日志 / 费用统计 / 技术参考 / 项目文档），概览与模型列表按要求跳过
> 设计基线：`artifacts/api-portal/UI_DESIGN.md`、`replit.md` 字号规范条款

---

## 一、总体结论

| 维度 | 结论 |
|---|---|
| 字号三级制（22 / 18 / 14 / 12） | ✅ 全量合规，未见 11px / 13px / 13.5px 越界 |
| 暗色玻璃质感 | ✅ 卡片层叠半透明背景一致 |
| 服务商颜色使用范围 | ✅ 仅在分组按钮、徽标、性能表「按供应商」单元格使用 |
| 厂商命名（Google / Anthropic / DeepSeek / OpenRouter / OpenAI） | ✅ 与规范一致 |
| 圆角规范（卡片 12 / 子卡 8 / 行项 6–7 / 标签 4–8） | ✅ 全量合规 |
| 状态 badge（成功 / 失败 / 警告） | ✅ 与调色板对齐 |
| Header 22px 产品名 | ✅ 永久固定 |

整体设计实现度高，本轮无破坏性变更，仅优化使用日志页的图表与按钮风格。

---

## 二、各标签页审查记录

### 1. 系统设置（settings）
- BASE URL / Admin Key / Proxy Key / 预算配置 / AI 服务商配置 等卡片层级清晰，节标题 18px 700，正文 14px。
- 「已配置」徽标使用 `#10b981` 成功色，符合规范。
- ✅ 未发现需要调整的问题。

### 2. 实时日志（logs）
- 节标题、轮询说明、级别筛选标签字号合规。
- 「未连接」状态点 + 灰色文字符合状态 badge 规范。
- ✅ 未发现需要调整的问题。

### 3. 使用日志（usage）— **本次重点优化**
- **优化前**：3 个面板切换按钮（趋势 / 性能 / 伪装）使用 3 种不同主色（绿 / 蓝 / 紫），视觉碎片化；性能子切换（按供应商 / 按模型）单独配色为 `#38bdf8`，与上方语义不一致。
- **优化后**：
  - 新增 `SegmentedControl` 组件，统一使用主交互色 `#6366f1` 系列；外层容器使用「胶囊式」分段背板（`rgba(0,0,0,0.25)` + `1px solid rgba(255,255,255,0.06)`，圆角 8px，内部 padding 3px），符合设计规范的玻璃感与圆角层级。
  - 三个面板按钮保持纯文本 14px 600 字号，未引入额外图标，避免视觉噪点。
  - 性能面板「按供应商 / 按模型」改用同一组件（小号，size="sm"），外观与上方一致。
- **趋势图表优化**：
  - SVG 高度从 64px 提升到 96px，可视性更高；
  - 顶部摘要从 5 列横排改为响应式网格卡片（`auto-fit minmax(120px,1fr)`），数值 14px 700 等宽数字、标签 12px。
  - 图表容器加上 `1px solid rgba(255,255,255,0.05)` 与 8px 圆角，与卡片体系对齐。
  - 坐标轴刻度（100% / 50% / 0% / 时间戳）从 14px 降至 12px Menlo，符合「次级元信息使用 12px」原则。
  - 图例「■ ≥95%」改为色块 + 文本的标准 LegendDot，颜色与图表强一致。
  - Token 波动柱状图增加圆角 + 提升不透明度，叠加视觉更清晰。
- **统计卡片**：保留原有 4 色（灰 / 绿 / 红 / 琥珀）+ 估算费用绿色，与状态色板一致。
- ✅ 优化已完成。

### 4. 费用统计（billing）
- 节标题 + Admin Key + 货币选择 + 刷新按钮在卡片头部右侧。
- 空态文字 14px，居中显示。
- ✅ 未发现需要调整的问题。

### 5. 技术参考（reference）
- API 端点列表使用 GET / POST 方法 badge，字号 12px 600，颜色与 MethodBadge 规范一致。
- 路径 `/v1/models` 等使用 14px Menlo monospace。
- ✅ 未发现需要调整的问题。

### 6. 项目文档（docs）
- 项目概述 + 4 个统计方块 + 路由规则代码块 + 格式自动转换表格 + 认证机制 + SSE 流式输出 全部符合规范。
- ✅ 未发现需要调整的问题。

---

## 三、本轮修改清单

| 文件 | 变更说明 |
|---|---|
| `src/components/SegmentedControl.tsx` | **新增通用组件**：胶囊式分段切换控件，支持 size="sm"/"md"、allowDeselect、每项可选 `accentColor`（自动派生 bg/border）与 `badge`（数量徽标） |
| `src/pages/usageLogs/ToggleButton.tsx` | 简化为 `SegmentedControl` 的兼容性再导出，便于外部引用 |
| `src/pages/UsageLogsPage.tsx` | 三个面板切换替换为 `SegmentedControl`，纯文本统一风格 |
| `src/pages/usageLogs/PerformancePanel.tsx` | 「按供应商 / 按模型」改用 `SegmentedControl size="sm"` |
| `src/pages/usageLogs/TrendPanel.tsx` | 图表高度 64→96，顶部摘要改网格卡片，坐标轴字号统一 12px Menlo，图例改为 LegendDot |
| `src/pages/LogsPage.tsx` | 实时日志页级别筛选（全部 / INFO / WARN / ERROR / DEBUG）改用 `SegmentedControl`，通过 `accentColor` 保留严重等级语义色，`badge` 显示计数 |

---

## 四、后续建议（非本轮强制）

- 如未来需要在性能面板加入图形可视化（条形分布、热力图），可复用 `TrendPanel` 的 SVG 模式。
- `SegmentedControl` 已抽取到 `src/components/`，后续新增的互斥状态切换场景（如设置页的"全部 / 仅启用 / 仅未启用"等）应直接复用，避免再造按钮组样式。
