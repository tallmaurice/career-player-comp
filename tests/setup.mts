// Lets plain Node load the engine and the route the way Next's bundler does:
// the "@/" path alias, extensionless imports ("./system-prompt") and a JSON
// import with no `with { type: "json" }`. Loaded with --import before the tests.
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = new URL("../", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    const isPath = spec.startsWith("file:") || spec.startsWith("./") || spec.startsWith("../");
    if (isPath && !/\.(m?[jt]s|json)$/.test(spec) && context.parentURL) {
      // "./system-prompt" -> system-prompt.ts; "@/lib/engine" -> lib/engine/index.ts
      for (const ext of [".ts", "/index.ts"]) {
        const candidate = new URL(spec + ext, context.parentURL).href;
        if (existsSync(fileURLToPath(candidate))) { spec = candidate; break; }
      }
    }
    return nextResolve(spec, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(ROOT) && !url.includes("/node_modules/") && url.endsWith(".json")) {
      return { format: "module", source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`, shortCircuit: true };
    }
    if (url.startsWith(ROOT) && !url.includes("/node_modules/") && url.endsWith(".ts")) {
      return nextLoad(url, { ...context, format: "module-typescript" });
    }
    return nextLoad(url, context);
  },
});

export const ROOT_URL = ROOT;
export const rootPath = (p: string) => fileURLToPath(new URL(p, ROOT));
export const rootUrl = (p: string) => pathToFileURL(rootPath(p)).href;
