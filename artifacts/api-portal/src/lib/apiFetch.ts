/**
 * 统一的 API 请求工具：集中处理 baseUrl 拼接、Bearer 鉴权头注入、超时控制与 JSON 解析。
 *
 * - bearer：传入 admin/proxy key 时自动注入 Authorization 头
 * - timeoutMs：默认 8000ms；传 0 表示不超时（流式 / 长任务请显式禁用）
 * - signal：用户提供的 AbortSignal 优先于内部 timeout
 *
 * 设计上保留原生 Response，方便流式 / 自定义解析；如需直接拿 JSON 用 apiFetchJson。
 */
export interface ApiFetchOptions extends Omit<RequestInit, "signal"> {
  bearer?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_TIMEOUT_MS = 8000;

export async function apiFetch(
  baseUrl: string,
  path: string,
  opts: ApiFetchOptions = {},
): Promise<Response> {
  const {
    bearer,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: userSignal,
    headers,
    ...rest
  } = opts;
  const finalHeaders: Record<string, string> = {
    ...((headers as Record<string, string> | undefined) ?? {}),
  };
  if (bearer) {
    finalHeaders.Authorization = `Bearer ${bearer}`;
  }
  let signal = userSignal;
  if (!signal && timeoutMs > 0) {
    try {
      signal = AbortSignal.timeout(timeoutMs);
    } catch {
      // 老旧浏览器降级：跳过超时
    }
  }
  return fetch(`${baseUrl}${path}`, { ...rest, headers: finalHeaders, signal });
}

export async function apiFetchJson<T>(
  baseUrl: string,
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const res = await apiFetch(baseUrl, path, opts);
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      try {
        body = await res.text();
      } catch {}
    }
    throw new ApiError(`HTTP ${res.status} on ${path}`, res.status, body);
  }
  return (await res.json()) as T;
}
