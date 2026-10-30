/**
 * Serves the flag-labelling page and saves the labels written on it.
 *
 * Node built-ins only. Listens on 127.0.0.1, on port 4317 or the next free one, and
 * never on another interface: the labels are one person's judgement and nothing else
 * on the network needs to reach them.
 *
 * Routes:
 *   GET  /             the page
 *   GET  /flags.json   the ten flags
 *   GET  /labels.json  the labels saved so far, or null before the first one
 *   PUT  /labels.json  replace the saved labels (POST is accepted too, for sendBeacon)
 *   GET  /prd.json     PRD.md's sections on what good looks like and on which clauses
 *                      are flagged, read from PRD.md on every request so they stay word
 *                      for word
 *   GET  /health       answers while the server is up, so the page can say when it is not
 */
import http from "node:http";
import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const PAGE = path.join(HERE, "index.html");
const FLAGS = path.join(HERE, "flags.json");
const LABELS = path.join(HERE, "labels.json");
const PRD = path.join(REPO, "PRD.md");

const HOST = "127.0.0.1";
const FIRST_PORT = 4317;
const PORTS_TO_TRY = 20;
const MAX_BODY = 1024 * 1024;

/** The PRD sections the page shows, found by title so a renumbering does not lose them. */
const PRD_SECTIONS = [/^## \d+\. What good looks like\s*$/, /^## \d+\. Which clauses are flagged/];

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
};

function send(res, status, type, body) {
  res.writeHead(status, { ...HEADERS, "Content-Type": type });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(value));
}

/** Each section from its heading up to the next level-two heading, rules trimmed off the end. */
async function prdSections() {
  const lines = (await readFile(PRD, "utf8")).split("\n");
  return PRD_SECTIONS.map((pattern) => {
    const start = lines.findIndex((line) => pattern.test(line));
    if (start === -1) return null;
    let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
    if (end === -1) end = lines.length;
    const body = lines.slice(start, end);
    while (body.length > 0 && /^(\s*|---\s*)$/.test(body[body.length - 1])) body.pop();
    return body.join("\n");
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Write to a temporary file and rename it over the old one, so a crash never leaves half a file. */
async function saveLabels(text) {
  const temporary = `${LABELS}.${process.pid}.tmp`;
  await writeFile(temporary, text, "utf8");
  await rename(temporary, LABELS);
}

async function handle(req, res, port) {
  // Refuse a request addressed to any other host name, so a web page that rebinds a
  // domain to 127.0.0.1 cannot read or overwrite the labels.
  const host = req.headers.host ?? "";
  if (host !== `${HOST}:${port}` && host !== `localhost:${port}`) {
    send(res, 403, "text/plain; charset=utf-8", "Forbidden");
    return;
  }

  const url = new URL(req.url ?? "/", `http://${host}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    send(res, 200, "text/html; charset=utf-8", await readFile(PAGE));
    return;
  }
  if (req.method === "GET" && url.pathname === "/flags.json") {
    send(res, 200, "application/json; charset=utf-8", await readFile(FLAGS));
    return;
  }
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && url.pathname === "/prd.json") {
    sendJson(res, 200, { sections: await prdSections() });
    return;
  }
  if (url.pathname === "/labels.json") {
    if (req.method === "GET") {
      try {
        send(res, 200, "application/json; charset=utf-8", await readFile(LABELS));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        sendJson(res, 200, null);
      }
      return;
    }
    if (req.method === "PUT" || req.method === "POST") {
      let parsed;
      try {
        parsed = JSON.parse(await readBody(req));
      } catch {
        sendJson(res, 400, { error: "The body is not JSON." });
        return;
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        sendJson(res, 400, { error: "The labels must be a JSON object." });
        return;
      }
      await saveLabels(`${JSON.stringify(parsed, null, 2)}\n`);
      sendJson(res, 200, { savedAt: new Date().toISOString() });
      return;
    }
  }

  send(res, 404, "text/plain; charset=utf-8", "Not found");
}

function listen(port, attemptsLeft) {
  const server = http.createServer((req, res) => {
    handle(req, res, port).catch((error) => {
      console.error(error);
      if (!res.headersSent) sendJson(res, 500, { error: "The server could not do that." });
      else res.end();
    });
  });
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 1) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    console.error(`Could not listen on ${HOST}:${port}: ${error.message}`);
    process.exit(1);
  });
  server.listen(port, HOST, () => {
    console.log(`Labelling page: http://${HOST}:${port}/`);
    console.log(`Labels are saved to ${path.relative(REPO, LABELS)}`);
  });
}

listen(FIRST_PORT, PORTS_TO_TRY);
