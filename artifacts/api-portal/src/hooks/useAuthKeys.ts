import { useState, useCallback, useEffect } from "react";
import {
  readAdminKey,
  writeAdminKey,
  readProxyKey,
  writeProxyKey,
} from "../utils/secretStorage";

/**
 * Admin Key / Proxy Key 的 React 状态绑定。
 *
 * - 初始化从 sessionStorage 读取（与 secretStorage 保持一致，不落 localStorage）
 * - setter 自动持久化（消除原本各页面在 onChange 重复调用 writeXxxKey 的不一致）
 * - 监听其他 tab 的同 sessionStorage key 改动（注：sessionStorage 不会触发 storage 事件，
 *   仅做形态对齐与未来切换 storage 时的扩展点）
 */
function useSecretKey(
  read: () => string,
  write: (k: string) => void,
): [string, (k: string) => void] {
  const [key, setKey] = useState<string>(read);
  const set = useCallback(
    (k: string) => {
      setKey(k);
      write(k);
    },
    [write],
  );
  // 当前 tab 内 read 函数引用稳定，下方 effect 仅为预留接口
  useEffect(() => {
    // sessionStorage 不会跨 tab 同步；保留 effect 占位以便未来切换为 localStorage 时无需改调用方
  }, []);
  return [key, set];
}

export function useAdminKey(): [string, (k: string) => void] {
  return useSecretKey(readAdminKey, writeAdminKey);
}

export function useProxyKey(): [string, (k: string) => void] {
  return useSecretKey(readProxyKey, writeProxyKey);
}
