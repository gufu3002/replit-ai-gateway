import { useState, useEffect, useCallback } from "react";
import { TABS, LOCAL_VERSION, LOCAL_BUILD_TIME, PROVIDER_LABELS } from "./data/models";
import type { TabId } from "./data/models";
import type { SystemConfig } from "./data/types";
import { AppHeader } from "./components/AppHeader";
import { TabNav } from "./components/TabNav";
import OverviewPage from "./pages/OverviewPage";
import ModelsPage from "./pages/ModelsPage";
import SettingsPage from "./pages/SettingsPage";
import ReferencePage from "./pages/ReferencePage";
import LogsPage from "./pages/LogsPage";
import UsageLogsPage from "./pages/UsageLogsPage";
import DocsPage from "./pages/DocsPage";
import BillingPage from "./pages/BillingPage";
import { clearLegacyAdminKeyStorage } from "./utils/secretStorage";
import { useAdminKey, useProxyKey } from "./hooks/useAuthKeys";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { apiFetch, apiFetchJson } from "./lib/apiFetch";

type DensityMode = "comfortable" | "compact";
type UrlACConfig = {
  chatCompletions: boolean;
  messages: boolean;
  models: boolean;
  geminiGenerate: boolean;
  geminiStream: boolean;
  global: boolean;
};

// 由 PROVIDER_LABELS 派生折叠分组初始状态，新增 provider 时单点维护
const INITIAL_EXPANDED_GROUPS: Record<string, boolean> = Object.fromEntries(
  Object.keys(PROVIDER_LABELS).map((k) => [k, false]),
);

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const param = new URLSearchParams(window.location.search).get("tab");
    const valid = TABS.some((t) => t.id === param);
    return (valid ? (param as TabId) : "overview");
  });
  const [densityMode, setDensityMode] = useLocalStorageState<DensityMode>(
    "portal_density_mode",
    "comfortable",
    (raw) => (raw === "compact" ? "compact" : "comfortable"),
  );
  const [online, setOnline] = useState<boolean | null>(null);
  const [urlACConfig, setUrlACConfig] = useState<UrlACConfig>({
    chatCompletions: true, messages: true, models: true, geminiGenerate: true, geminiStream: true, global: true,
  });
  const [urlACLoading, setUrlACLoading] = useState(true);
  const [adminKey, setAdminKey] = useAdminKey();
  const [proxyKey, setProxyKey] = useProxyKey();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    INITIAL_EXPANDED_GROUPS,
  );
  const [localServerVersion, setLocalServerVersion] = useState<string>(LOCAL_VERSION);
  const [localServerBuildTime, setLocalServerBuildTime] = useState<string>(LOCAL_BUILD_TIME);
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);
  const [logsSearch, setLogsSearch] = useState<string>("");
  const [usageHighlightTime, setUsageHighlightTime] = useState<string>("");
  const baseUrl = window.location.origin;

  const jumpToLogsTab = useCallback((search: string) => {
    setLogsSearch(search);
    setActiveTab("logs");
  }, []);

  const jumpToUsageTab = useCallback((isoTimestamp: string) => {
    setUsageHighlightTime(isoTimestamp);
    setActiveTab("usage");
  }, []);

  useEffect(() => {
    clearLegacyAdminKeyStorage();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") === activeTab) return;
    if (activeTab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", activeTab);
    window.history.replaceState(null, "", url.toString());
  }, [activeTab]);

  useEffect(() => {
    const handler = () => {
      const param = new URLSearchParams(window.location.search).get("tab");
      const valid = TABS.some((t) => t.id === param);
      setActiveTab(valid ? (param as TabId) : "overview");
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const res = await apiFetch(baseUrl, "/api/healthz", { timeoutMs: 5000 });
      setOnline(res.ok);
    } catch { setOnline(false); }
  }, [baseUrl]);

  const fetchUrlACMode = useCallback(async () => {
    try {
      if (!adminKey) {
        setUrlACLoading(false);
        return;
      }
      const d = await apiFetchJson<UrlACConfig>(baseUrl, "/api/settings/url-autocorrect", {
        bearer: adminKey,
      });
      setUrlACConfig(d);
    } catch {}
    setUrlACLoading(false);
  }, [baseUrl, adminKey]);

  const toggleUrlAC = async (field: keyof UrlACConfig) => {
    const prev = { ...urlACConfig };
    const updated = { ...urlACConfig, [field]: !urlACConfig[field] };
    setUrlACConfig(updated);
    try {
      const d = await apiFetchJson<UrlACConfig>(baseUrl, "/api/settings/url-autocorrect", {
        method: "POST",
        bearer: adminKey || undefined,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: updated[field] }),
      });
      setUrlACConfig(d);
    } catch { setUrlACConfig(prev); }
  };

  const fetchConfig = useCallback(async () => {
    try {
      const d = await apiFetchJson<SystemConfig>(baseUrl, "/api/config", {
        bearer: adminKey || undefined,
      });
      setSysConfig(d);
    } catch {}
  }, [baseUrl, adminKey]);

  useEffect(() => {
    checkHealth();
    fetchUrlACMode();
    fetchConfig();
    apiFetchJson<{ version: string; buildTime: string }>(baseUrl, "/api/version", { timeoutMs: 5000 })
      .then((data) => {
        setLocalServerVersion(data.version);
        setLocalServerBuildTime(data.buildTime);
      })
      .catch(() => {});
    // 健康检查保持 15 分钟节奏（用户明确指定）
    const interval = setInterval(checkHealth, 900000);
    return () => clearInterval(interval);
  }, [checkHealth, fetchUrlACMode, fetchConfig, baseUrl]);

  const toggleGroup = (group: string) =>
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));

  const toggleDensityMode = () => {
    setDensityMode((prev) => (prev === "compact" ? "comfortable" : "compact"));
  };

  return (
    <div data-density={densityMode} style={{ minHeight: "100vh", background: "hsl(222,47%,11%)", color: "#e2e8f0", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <AppHeader
          localServerVersion={localServerVersion} localServerBuildTime={localServerBuildTime}
          online={online}
          densityMode={densityMode} toggleDensityMode={toggleDensityMode}
        />

        <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />

        <div style={{ display: activeTab === "overview" ? "block" : "none" }}><OverviewPage baseUrl={baseUrl} setActiveTab={setActiveTab} /></div>
        <div style={{ display: activeTab === "models" ? "block" : "none" }}><ModelsPage expandedGroups={expandedGroups} toggleGroup={toggleGroup} baseUrl={baseUrl} /></div>
        <div style={{ display: activeTab === "settings" ? "block" : "none" }}><SettingsPage adminKey={adminKey} setAdminKey={setAdminKey} baseUrl={baseUrl} urlACConfig={urlACConfig} urlACLoading={urlACLoading} toggleUrlAC={toggleUrlAC} sysConfig={sysConfig} fetchConfig={fetchConfig} /></div>
        <div style={{ display: activeTab === "reference" ? "block" : "none" }}><ReferencePage baseUrl={baseUrl} adminKey={adminKey} proxyKey={proxyKey} /></div>
        <div style={{ display: activeTab === "logs" ? "block" : "none" }}><LogsPage adminKey={adminKey} setAdminKey={setAdminKey} baseUrl={baseUrl} externalSearch={logsSearch} jumpToUsage={jumpToUsageTab} /></div>
        <div style={{ display: activeTab === "usage" ? "block" : "none" }}><UsageLogsPage adminKey={adminKey} setAdminKey={setAdminKey} proxyKey={proxyKey} setProxyKey={setProxyKey} baseUrl={baseUrl} activeTab={activeTab} jumpToLogs={jumpToLogsTab} externalHighlightTime={usageHighlightTime} /></div>
        <div style={{ display: activeTab === "billing" ? "block" : "none" }}><BillingPage adminKey={adminKey} setAdminKey={setAdminKey} baseUrl={baseUrl} activeTab={activeTab} /></div>
        <div style={{ display: activeTab === "docs" ? "block" : "none" }}><DocsPage baseUrl={baseUrl} adminKey={adminKey} proxyKey={proxyKey} setProxyKey={setProxyKey} /></div>

      </div>
    </div>
  );
}
