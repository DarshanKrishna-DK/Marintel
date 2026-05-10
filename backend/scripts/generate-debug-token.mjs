import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function upsertEnvLine(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(contents)) return contents.replace(pattern, line);
  const suffix = contents.endsWith("\n") ? "" : "\n";
  return contents + suffix + line + "\n";
}

async function main() {
  const envPath = resolve(process.cwd(), ".env");
  const token = randomBytes(32).toString("hex");
  const existing = await readFile(envPath, "utf8");
  const next = upsertEnvLine(existing, "DEBUG_TOKEN", token);
  await writeFile(envPath, next, "utf8");
  console.log("Updated backend/.env DEBUG_TOKEN.");
}

await main();

