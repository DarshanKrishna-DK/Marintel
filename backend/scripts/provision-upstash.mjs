import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function upsertEnvLine(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(contents)) return contents.replace(pattern, line);
  const suffix = contents.endsWith("\n") ? "" : "\n";
  return contents + suffix + line + "\n";
}

async function pingRedis(url, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(["PING"])
  });

  if (!res.ok) return false;
  const text = await res.text();
  return text.toUpperCase().includes("PONG");
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function main() {
  const envPath = resolve(process.cwd(), ".env");
  const res = await fetch("https://upstash.com/start-redis", { method: "POST" });
  if (!res.ok) {
    console.error(`Upstash provisioning failed: HTTP ${res.status}`);
    process.exit(1);
  }

  const bodyText = await res.text();

  let urlCandidates = [];
  let tokenCandidates = [];

  try {
    const data = JSON.parse(bodyText);
    const url = data?.url ?? data?.endpoint ?? data?.rest_url ?? null;
    const token = data?.token ?? data?.rest_token ?? data?.password ?? null;
    if (url) urlCandidates.push(url);
    if (token) tokenCandidates.push(token);
  } catch {
    // Upstash may return a markdown / text response.
    urlCandidates = bodyText
      .match(/https:\/\/[a-z0-9-]+\.upstash\.io[^\s)"']*/gi)
      ?.slice(0, 5) ?? [];

    const tokenFromLabels =
      bodyText.match(/token\s*[:=]\s*([^\s)"']+)/gi)?.map((m) => m.split(/[:=]/).slice(1).join("=").trim()) ?? [];
    const tokenFromBearer =
      bodyText.match(/bearer\s+([A-Za-z0-9._-]{20,})/gi)?.map((m) => m.replace(/bearer\s+/i, "").trim()) ?? [];
    const tokenFromJwt = bodyText.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? [];

    tokenCandidates = [...tokenFromLabels, ...tokenFromBearer, ...tokenFromJwt];
  }

  urlCandidates = unique(urlCandidates);
  tokenCandidates = unique(tokenCandidates).sort((a, b) => b.length - a.length);

  let url = null;
  let token = null;

  for (const u of urlCandidates) {
    for (const t of tokenCandidates) {
      const ok = await pingRedis(u, t);
      if (ok) {
        url = u;
        token = t;
        break;
      }
    }
    if (url && token) break;
  }

  if (!url || !token) {
    console.error("Upstash provisioning returned an unexpected response shape.");
    process.exit(1);
  }

  const existing = await readFile(envPath, "utf8");
  let next = existing;
  next = upsertEnvLine(next, "UPSTASH_REDIS_REST_URL", url);
  next = upsertEnvLine(next, "UPSTASH_REDIS_REST_TOKEN", token);
  await writeFile(envPath, next, "utf8");

  console.log("Updated backend/.env with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
}

await main();

