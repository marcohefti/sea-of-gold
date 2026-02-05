#!/usr/bin/env node
import net from "node:net";
import { spawn } from "node:child_process";

function canListen(port) {
  return new Promise((resolve) => {
    const srv = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => srv.close(() => resolve(true)))
      // Bind like Next (defaults to :: / dual-stack), otherwise we can get false-positives
      // where 127.0.0.1 is free but :: is already in use.
      .listen(port);
  });
}

async function pickPort() {
  for (let port = 5180; port <= 5189; port++) {
    // eslint-disable-next-line no-await-in-loop
    if (await canListen(port)) return port;
  }
  return null;
}

const port = await pickPort();
if (port == null) {
  console.error("No free port found in range 5180–5189.");
  process.exit(1);
}

console.log(`Starting dev server on http://localhost:${port}`);

const child = spawn(
  "pnpm",
  ["--filter", "@sea-of-gold/web", "exec", "next", "dev", "-p", String(port)],
  { stdio: "inherit" }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
