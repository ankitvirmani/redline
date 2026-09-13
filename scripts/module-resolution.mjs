/**
 * Lets `node` run the product's TypeScript directly, the way `npm run smoke` needs.
 *
 * Vitest and Next both resolve `@/` and extensionless imports for us; plain `node`
 * does neither. `scripts/smoke.ts` runs the real seams rather than a copy of them, so
 * it imports the same files the app does, and those files import each other the way
 * the rest of the repo is written. This registers two resolution rules so they load:
 * `@/` means the repo root, as `tsconfig.json` says it does, and a specifier with no
 * extension is tried as `.ts`, `.tsx` and then as a directory's `index`.
 *
 * Node strips the types itself. This file adds no dependency and is not part of the
 * app: nothing under `app/` or `src/` imports it, and the deterministic suite does
 * not load it.
 */

import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

/** Tried in order. The bare specifier first, so an exact file still wins. */
const CANDIDATES = ["", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];

function isFile(url) {
  try {
    return existsSync(fileURLToPath(url)) && statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // `@/x` is the repo root, exactly as `tsconfig.json` maps it.
    const mapped = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;

    const relative = mapped.startsWith(".") || mapped.startsWith("file:");
    if (relative) {
      const base = new URL(mapped, context.parentURL);
      for (const candidate of CANDIDATES) {
        const tried = new URL(base.href + candidate);
        if (isFile(tried)) return nextResolve(tried.href, context);
      }
    }

    return nextResolve(mapped, context);
  },
});
