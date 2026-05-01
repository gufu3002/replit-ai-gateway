export interface UsageEntry {
  id: string;
  timestamp: string;
  model: string;
  provider: string;
  endpoint: string;
  stream: boolean;
  status: "success" | "error";
  statusCode: number;
  durationMs: number;
  firstTokenMs: number | null;
  inputTokens: number;
  outputTokens: number;
  requestBodyBytes: number;
  errorMessage?: string;
  disguisePreset?: string;
}

export interface UsageStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  totalTokens: number;
}

export interface DisguiseStat {
  preset: string;
  total: number;
  success: number;
  error: number;
}

export interface TimeBucket {
  labelMs: number;
  total: number;
  success: number;
  inputTokens: number;
  outputTokens: number;
}

export interface PerfRow {
  key: string;
  count: number;
  successCount: number;
  p50: number;
  p95: number;
  p99: number;
  avgTtft: number | null;
  p50Ttft: number | null;
  p95Ttft: number | null;
  avgTps: number | null;
  totalTokens: number;
  totalCost: number | null;
}

export interface ReplayResult {
  response: string | null;
  statusCode: number | null;
  error: string | null;
  duration: number | null;
  loading: boolean;
  requestHeaders: Record<string, string> | null;
  upstreamRequestHeaders: Record<string, string> | null;
  responseHeaders: Record<string, string> | null;
  method: string | null;
}

export interface ReplayState {
  entry: UsageEntry;
  bodyText: string;
  primary: ReplayResult;
  compareEnabled: boolean;
  compareModel: string;
  secondary: ReplayResult;
}

export type PerfGroupBy = "provider" | "model";
