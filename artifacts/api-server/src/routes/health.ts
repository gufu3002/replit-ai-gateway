import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

export const APP_VERSION = "0.1.81";
export const APP_BUILD_TIME = "2026-05-01";
// Changelog: keep only the 10 most recent versions; drop the oldest entry when adding a new one.
export const APP_CHANGELOG = [
  "v0.1.81 (2026-05-01): 代码审计修复（9项）—— 安全：① 500 全局错误处理器将 err.message 替换为固定字符串，防止内部错误信息泄漏给客户端；② GET /api/models?refresh=1 强制刷新路径新增认证校验，防止未认证调用方消耗上游配额；③ GET /api/settings/disguise 响应移除 headers 字段，防止 SDK 伪装指纹数据暴露；④ chart.tsx dangerouslySetInnerHTML 注入的 CSS 颜色值与属性名增加白名单正则校验，防止 CSS 注入；质量：⑤ LogsPage 轮询新增 AbortController（fetchAbortRef），stopPolling() 立即取消进行中的 fetch 请求，修复 AbortError 静默忽略、请求在后台静默完成的竞态；⑥ proxy-raw.ts getProviderCredentials() 新增注释，说明 Replit AI Integration env-var baseUrl 指向 localhost 属平台注入行为，设计上不走 isPrivateUrl() 校验；⑦ routes/index.ts URL_AC_VALID_KEYS 新增注释，说明 enabled/global 双键并存原因（向后兼容别名）；⑧ types.ts SystemConfig 新增 adminKeyWarning? 字段，与后端 getPublicConfig() 已有字段保持类型一致；版本：前后端同步至 0.1.81",
  "v0.1.80 (2026-05-01): 安全加固全量收尾 —— 后端批次一：CSP 启用、CORS 显式配置、rate-limit skip 回调移除、URL ReDoS 防护（2048 字符上限）、SSRF 正则补充 CGNAT/GCP metadata 段、Zod 配置校验 + 随机 proxyKey 自动生成、分层超时（非流式 3 min / 流式 10 min）；后端批次二：trust proxy 1 修复 req.ip 失真、proxy-anthropic.ts/proxy-gemini.ts 非流式路径 JSON.parse 包裹 try/catch（上游非 JSON 时返回 502）、getPublicConfig() 在 adminKey 未配置时追加 adminKeyWarning 字段、404 处理器移除 REPLIT_DOMAINS 域名泄露；前端批次一：LogsPage 401/403 停止轮询并展示可关闭错误横幅，网络错误改为 console.warn 后继续重试；前端 UsageLogsPage：Replay 增加 AbortController + 取消按钮，超时从 120s 降至 60s；前端批次二：getReplayUrl/getCompareUrl 对 Gemini 路径模型名改用 encodeURIComponent() 防路径穿越，删除 replay 请求中已废弃的 X-Gateway-Debug-Headers 头",
  "v0.1.79 (2026-05-01): 上游响应大小防护扫尾 —— claude.ts（/v1/messages 格式转换端点）遗漏了 4 处无上限读取：① 流式 Gemini 错误路径 upstream.text()；② 流式 OpenAI-compat 错误路径 upstream.text()；③ 非流式 Gemini 路径 upstream.text()；④ 非流式 OpenAI-compat 路径 upstream.text()；全部替换为 readResponseTextCapped()；至此，服务器全部路由中的 upstream.text() / upstream.arrayBuffer() 调用已全量替换为有上限的读取，防御面完整闭合",
  "v0.1.78 (2026-05-01): 上游响应大小防护全量补全 —— 安全审查发现 6 处非流式代理路径绕过了 v0.1.76 引入的 readResponseBufferCapped 防护：① proxy-gemini.ts handleGeminiNonStream 直接调用 upstream.arrayBuffer()；② proxy-anthropic.ts handleAnthropicNonStream 直接调用 upstream.arrayBuffer()；③ proxy-anthropic.ts / proxy-gemini.ts 错误路径各 1 处 upstream.text()；④ gemini-native.ts Anthropic 非流式路径 upstream.text()；⑤ gemini-native.ts OpenAI-compat 非流式路径 upstream.text()；⑥ gemini-native.ts Anthropic/OpenAI-compat 流式错误路径各 1 处 upstream.text()；修复方案：将 readResponseBufferCapped 从私有函数改为 export，新增 readResponseTextCapped 便捷包装（decode UTF-8），6 处全部替换，防止恶意上游通过超大响应体引发 OOM",
  "v0.1.77 (2026-05-01): 安全审查第三轮 —— ① 请求体上限从 50 MB 调整为 256 MB：50 MB 过严（20 张高清图 base64 约 50-80 MB），256 MB 覆盖绝大多数真实 AI 请求场景，同时相比 1 GB 显著降低 OOM 风险（1 GB body 解析峰值内存约 2-3 GB，Replit 容器无法承受）；② SSRF 防护补全：isPrivateUrl 正则新增 0.0.0.0（Linux 下等价于 127.0.0.1）和 ::ffff:（IPv4-mapped IPv6 绕过向量），同时增加协议白名单（仅 http:/https: 允许），阻断 file:/ftp:/等本地资源访问；③ 流式代理客户端断连状态修正：rawPassthroughStream 和 rawVendorPassthroughStream 在客户端提前断连（res.writableEnded/res.destroyed）时原本记录 status: success，现改为 status: error / statusCode: 499（Client Closed Request），使使用日志与统计成功率真实反映实际完成情况；④ adminRateLimit skip 中 getConfig() 双重调用优化：原 !getConfig().proxyApiKey && !getConfig().adminKey 调用 getConfig() 两次，改为单次赋值复用",
  "v0.1.76 (2026-05-01): 安全加固第二轮 —— ① JSON 请求体上限从 1 GB 收缩至 50 MB（urlencoded 收至 1 MB），防止 OOM DoS 攻击（后在 v0.1.77 调整为 256 MB）；② GET /api/config 中对 Admin/Proxy Key 的判断从 === 改为 safeCompare()，消除最后一处计时旁路；③ 模型缓存强制刷新（?refresh=1）新增 10 秒最短间隔（FORCE_REFRESH_MIN_INTERVAL_MS），防止串行请求触发上游拉取风暴；④ 错误响应 docs 字段从 req.get(\"host\") 改为读取 REPLIT_DOMAINS 环境变量，消除 Host 头注入攻击面；⑤ x-gateway-debug-headers 功能移除客户端触发路径（rawPassthroughNonStream / rawVendorPassthroughNonStream），防止任意代理客户端通过 header 读取上游请求详情（伪装配置信息）；⑥ 非流式上游响应引入 100 MB 分块读取上限（readResponseBufferCapped），Content-Length 超限时主动取消流并返回 502，防止恶意上游通过超大响应体导致 OOM",
  "v0.1.75 (2026-05-01): 安全加固全量修复 —— ① 计时攻击防护：auth.ts 密钥比较从 === 改为 crypto.timingSafeEqual()（先 SHA-256 再等长比较，消除逐字符短路泄露）；② 速率限制：引入 express-rate-limit，管理接口（/api/config、/api/settings、/api/logs、/api/billing 等）每 IP 每 15 分钟限 30 次，代理接口（/v1、/v1beta）每 IP 每分钟限 300 次，响应头携带剩余次数与重置时间，未配置密钥时自动跳过；③ HTTP 安全响应头：引入 helmet 中间件，全局注入 X-Content-Type-Options: nosniff、X-Frame-Options: SAMEORIGIN、Referrer-Policy: no-referrer、Strict-Transport-Security 等；④ SSRF 防护：POST /api/config/provider 写入 baseUrl 前校验 hostname，拒绝 localhost/127.x/10.x/172.16-31.x/192.168.x/169.254.x/::1 等私有及回环地址；⑤ 密钥最短长度提升：Admin Key 与 Proxy Key 最短长度从 6 位升至 16 位；⑥ 预算上限校验：budgetQuotaUsd 新增上限 $100,000 防止意外写入极大值；⑦ 模型缓存惊群效应修复：proxy-models.ts 缓存失效时用单例 inflight Promise 合并并发请求，任意时刻最多触发一次上游 fetch；⑧ 文档修正：删除从未实现的 GET /api/logs/stream SSE 端点描述，改为如实描述 sinceIndex 增量轮询接口",
  "v0.1.74 (2026-05-01): 模型清单与 SDK 指纹全量同步 —— 新增模型：gpt-5.5 ($5/$30 per 1M, 1M ctx, API 2026-04-24 开放)、gpt-5.5-pro ($30/$180 per 1M)、grok-4.3 ($1.25/$2.50 per 1M)、mistral-medium-3.5 (128B dense, 256K ctx, 2026-04-29)；补入 billing.ts 遗漏的 gpt-5.4 定价条目；SDK 版本更新：openai JS 6.34→6.35、anthropic JS 0.90→0.92、@google/genai 1.50.1→1.51.0、openai Python 2.32→2.33、anthropic Python 0.96→0.97、google-genai Python 1.73.1→1.74.0、LiteLLM 1.83.12→1.83.14、Deno 2.7.13→2.7.14、curl 8.19.0→8.20.0、Vercel AI SDK 6.0.168→6.0.170；Chrome 147 保持（148 预计 2026-05-05 发布）；以上均经 npm/PyPI/GitHub Releases 实时核查",
  "v0.1.73 (2026-04-24): DeepSeek V4 正式 ID 修正 —— deepseek-v4 → deepseek-v4-pro ($1.74/$3.48 per 1M) + deepseek-v4-flash ($0.14/$0.28 per 1M)，上下文 64K→1M；deepseek-chat/reasoner 标注废弃（2026-07-24，映射至 v4-flash），定价同步更新；pricing.ts/billing.ts/models.ts/proxy-models.ts 四处一致；GPT-5.5 今日发布仅限 ChatGPT，API 尚未开放",
  "v0.1.72 (2026-04-24): 对照 Replit AI Integrations SKILL 文档审查三大渠道模型清单 —— OpenAI 19 项、Anthropic 7 项、Gemini 6 项均与 SKILL 完全一致，无需增删；OpenRouter 保持实时拉取，DeepSeek 系列自动同步；版本号同步至 0.1.72",
];

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/version", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.json({
    version: APP_VERSION,
    buildTime: APP_BUILD_TIME,
    changelog: APP_CHANGELOG,
  });
});

export default router;
