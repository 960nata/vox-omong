import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const tools = path.join(root, ".tools");
const proxy = path.join(tools, "headroom", "venv", "bin", "headroom");

async function alive(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; }
  catch { return false; }
}

function launch(command, args, logName, extraEnv = {}) {
  mkdirSync(tools, { recursive: true });
  const log = openSync(path.join(tools, logName), "a", 0o600);
  const child = spawn(command, args, {
    cwd: root, detached: true,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", log, log],
  });
  child.on("error", (error) => console.warn(`${logName}: ${error.message}`));
  child.unref();
}

if (existsSync(proxy) && !(await alive("http://127.0.0.1:8787/livez"))) {
  launch(proxy, ["proxy", "--host", "127.0.0.1", "--port", "8787"], "headroom.log", { HEADROOM_OFFLINE: "1" });
}
