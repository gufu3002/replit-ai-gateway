import { createHash, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { getConfig } from "../config";

export function safeCompare(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const googKey = req.headers["x-goog-api-key"];
  if (typeof googKey === "string" && googKey) {
    return googKey;
  }
  const queryKey = req.query.key;
  if (typeof queryKey === "string" && queryKey) {
    return queryKey;
  }
  return null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const proxyKey = getConfig().proxyApiKey;

  if (!proxyKey) {
    next();
    return;
  }

  const provided = extractApiKey(req);
  if (!provided) {
    res.status(401).json({
      error: {
        message: "Unauthorized: no API key provided",
        type: "invalid_request_error",
        code: "missing_api_key",
        hint: "请在请求中提供 API 密钥，支持三种方式：1) Authorization: Bearer YOUR_KEY  2) x-goog-api-key: YOUR_KEY  3) URL 参数 ?key=YOUR_KEY",
      },
    });
    return;
  }
  if (!safeCompare(provided, proxyKey)) {
    res.status(401).json({
      error: {
        message: "Unauthorized: invalid API key",
        type: "invalid_request_error",
        code: "invalid_api_key",
        hint: "提供的 API 密钥与服务器配置的 Proxy Key 不匹配。请检查密钥是否正确。",
      },
    });
    return;
  }

  next();
}

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();
  const adminKey = config.adminKey;
  const proxyKey = config.proxyApiKey;

  // If an adminKey is configured, it is the ONLY valid credential for admin
  // operations. The proxyApiKey is exclusively for AI proxy requests and must
  // NOT grant access to settings endpoints.
  // If no adminKey is set, fall back to proxyApiKey for backward compatibility
  // (single-operator deployments that haven't configured a separate admin key).
  const requiredKey = adminKey || proxyKey;

  if (!requiredKey) { next(); return; }

  const provided = extractApiKey(req);
  if (provided && safeCompare(provided, requiredKey)) {
    next();
    return;
  }
  res.status(401).json({
    error: {
      message: adminKey
        ? "Unauthorized: invalid Admin Key. The Admin Key is separate from the Proxy Key."
        : "Unauthorized: invalid API key",
      type: "invalid_request_error",
      code: "invalid_api_key",
    },
  });
}
