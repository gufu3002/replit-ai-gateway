import { useState, useCallback, useEffect } from "react";

/**
 * 把 React state 与 localStorage 绑定。
 * - 初始化时读 storage，缺失或解析失败回退 initial
 * - setter 写回 storage
 * - 监听其他 tab 的 storage 事件，跨 tab 自动同步
 *
 * 默认 parse/serialize 适用于 string；其他类型显式传入 JSON.parse / JSON.stringify。
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T = (raw) => raw as unknown as T,
  serialize: (val: T) => string = (val) => String(val),
): [T, (val: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : parse(raw);
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, serialize(v));
        } catch {}
        return v;
      });
    },
    [key, serialize],
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        setValue(e.newValue === null ? initial : parse(e.newValue));
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, initial, parse]);

  return [value, set];
}
