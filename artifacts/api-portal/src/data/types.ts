export interface ProviderConfig {
  configured: boolean;
  baseUrl?: string;
  apiKey?: string;
}

export interface SystemConfig {
  proxyApiKey: string;
  isDefaultKey: boolean;
  adminKeyConfigured: boolean;
  budgetQuotaUsd?: number;
  providers: Record<string, ProviderConfig>;
}

export interface ProviderConfigUpdateBody {
  provider: string;
  baseUrl?: string;
  apiKey?: string;
}
