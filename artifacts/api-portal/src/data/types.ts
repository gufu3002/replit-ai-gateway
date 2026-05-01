export interface ProviderConfig {
  configured: boolean;
  baseUrl?: string;
  apiKey?: string;
}

export interface SystemConfig {
  proxyApiKey: string;
  isDefaultKey: boolean;
  adminKeyConfigured: boolean;
  /** Optional advisory warning from the server about the admin key security posture. */
  adminKeyWarning?: string;
  budgetQuotaUsd?: number;
  providers: Record<string, ProviderConfig>;
}

export interface ProviderConfigUpdateBody {
  provider: string;
  baseUrl?: string;
  apiKey?: string;
}
