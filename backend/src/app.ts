import { randomUUID } from "crypto";

import cors, { type CorsOptions } from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import pino from "pino";
import pinoHttp from "pino-http";
import { ZodError } from "zod";

import type { Env } from "./env";
import { AppError, isAppError } from "./lib/httpErrors";
import { createDebugRouter } from "./routes/debug";
import { createHealthRouter } from "./routes/health";
import { createIntelligenceRouter } from "./routes/intelligence";
import type { RedisClient } from "./redis";

function compileOriginPattern(pattern: string): (origin: string) => boolean {
  const normalized = pattern.trim();
  if (normalized === "*") return () => true;
  if (!normalized.includes("*")) return (origin) => origin === normalized;

  const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
  return (origin) => regex.test(origin);
}

function expandLoopbackOrigins(patterns: string[] | null | undefined): string[] {
  const expanded: string[] = [];

  for (const p of patterns ?? []) {
    const trimmed = p.trim();
    if (trimmed.length === 0) continue;
    expanded.push(trimmed);

    const variants: Array<[from: string, to: string]> = [
      ["://localhost", "://127.0.0.1"],
      ["://localhost", "://[::1]"],
      ["://127.0.0.1", "://localhost"],
      ["://[::1]", "://localhost"],
      ["://127.0.0.1", "://[::1]"],
      ["://[::1]", "://127.0.0.1"]
    ];

    for (const [from, to] of variants) {
      if (trimmed.includes(from)) expanded.push(trimmed.replace(from, to));
    }
  }

  return Array.from(new Set(expanded));
}

export function createApp(deps: { env: Env; redis: RedisClient | null }) {
  const app = express();

  app.disable("x-powered-by");
  if (deps.env.NODE_ENV === "production") app.set("trust proxy", 1);

  const logger = pino({ level: deps.env.LOG_LEVEL });

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = req.headers["x-request-id"];
        const id =
          typeof existing === "string" && existing.trim().length > 0 ? existing : randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      }
    })
  );

  app.use(helmet());

  // Private Network Access (PNA) preflight support for secure contexts (including chrome-extension://).
  // If the browser sends `Access-Control-Request-Private-Network: true` on an OPTIONS preflight,
  // we must echo `Access-Control-Allow-Private-Network: true` for the request to proceed.
  app.use((req, res, next) => {
    const wantsPrivateNetwork = req.header("access-control-request-private-network");
    if (wantsPrivateNetwork && wantsPrivateNetwork.toLowerCase() === "true") {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    next();
  });

  const originOption: CorsOptions["origin"] = (() => {
    const patterns = expandLoopbackOrigins(deps.env.allowedOrigins);
    if (patterns.length === 0) return true;
    const matchers = patterns.map(compileOriginPattern);
    return (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = matchers.some((m) => m(origin));
      return callback(null, allowed);
    };
  })();

  app.use(
    cors({
      origin: originOption,
      exposedHeaders: ["x-marintel-cache", "x-request-id"]
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(createHealthRouter({ redis: deps.redis }));
  app.use(createIntelligenceRouter({ env: deps.env, redis: deps.redis }));
  if (deps.env.ENABLE_DEBUG_ENDPOINTS) {
    app.use(createDebugRouter({ env: deps.env, redis: deps.redis }));
  }

  app.use((_req, _res, next) => {
    next(new AppError({ statusCode: 404, code: "NOT_FOUND", message: "Route not found" }));
  });

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const requestId = res.getHeader("x-request-id");
    const log = (req as unknown as { log?: { error: (obj: unknown, msg?: string) => void } }).log;
    log?.error({ err, requestId }, "request_failed");

    if (err instanceof ZodError) {
      return res.status(400).json({
        error: { code: "INVALID_REQUEST", message: "Request validation failed", issues: err.issues }
      });
    }

    const maybeBodyParserError = err as unknown as { type?: unknown; status?: unknown };
    if (
      err instanceof SyntaxError &&
      maybeBodyParserError.status === 400 &&
      maybeBodyParserError.type === "entity.parse.failed"
    ) {
      return res.status(400).json({
        error: { code: "INVALID_JSON", message: "Invalid JSON body" }
      });
    }

    if (isAppError(err)) {
      return res.status(err.statusCode).json({
        error: { code: err.code, message: err.expose ? err.message : "Internal server error" }
      });
    }

    return res
      .status(500)
      .json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } });
  };

  app.use(errorHandler);

  return app;
}

