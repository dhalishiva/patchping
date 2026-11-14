// Parse dependency manifests / lockfiles into exact (ecosystem, name, version) triples.
// Everything runs in the browser: the user's file never leaves their machine,
// only the package list is saved.

export type Ecosystem =
  | "npm" | "PyPI" | "Go" | "crates.io" | "Packagist" | "RubyGems" | "Maven" | "NuGet" | "Pub" | "Hex";

export const ECOSYSTEMS: { id: Ecosystem; label: string }[] = [
  { id: "npm", label: "npm (JavaScript / Node / Deno)" },
  { id: "PyPI", label: "PyPI (Python)" },
  { id: "Go", label: "Go modules" },
  { id: "crates.io", label: "crates.io (Rust)" },
  { id: "Packagist", label: "Packagist (PHP)" },
  { id: "RubyGems", label: "RubyGems (Ruby)" },
  { id: "Maven", label: "Maven (Java / Kotlin)" },
  { id: "NuGet", label: "NuGet (.NET)" },
  { id: "Pub", label: "Pub (Dart / Flutter)" },
  { id: "Hex", label: "Hex (Elixir / Erlang)" },
];

export type Dep = { ecosystem: Ecosystem; name: string; version: string };
export type ParseResult = { format: string; deps: Dep[]; warnings: string[] };

export const SUPPORTED_FILES = [
  "package-lock.json", "package.json", "yarn.lock", "pnpm-lock.yaml", "deno.json",
  "requirements.txt", "go.mod", "Cargo.lock", "composer.lock", "Gemfile.lock",
];

const EXACT = /^\d+(\.\d+){0,3}([-+][0-9A-Za-z.\-+]+)?$/;

function dedupe(deps: Dep[]): Dep[] {
  const seen = new Map<string, Dep>();
  for (const d of deps) {
    if (!d.name || !d.version) continue;
    seen.set(`${d.ecosystem}|${d.name}|${d.version}`, d);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/** "^1.2.3" -> "1.2.3"; returns null for things we cannot pin (latest, *, git urls...). */
export function pinFromRange(range: string): string | null {
  const r = range.trim();
  if (/^(npm:|workspace:|file:|link:|git|http|github:|\*|latest|next)/i.test(r)) {
    const alias = r.match(/^npm:(?:@?[^@]+)@(.+)$/);
    return alias ? pinFromRange(alias[1]) : null;
  }
  const m = r.match(/(\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.\-]+)?)/);
  if (!m) return null;
  const parts = m[1].split("-")[0].split(".");
  while (parts.length < 3) parts.push("0");
  const pre = m[1].includes("-") ? "-" + m[1].split("-").slice(1).join("-") : "";
  return parts.join(".") + pre;
}

function parsePackageLock(text: string): ParseResult {
  const j = JSON.parse(text);
  const deps: Dep[] = [];
  if (j.packages && typeof j.packages === "object") {
    for (const [path, info] of Object.entries<any>(j.packages)) {
      if (!path || info?.link || !info?.version) continue;
      const name = info.name ?? path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
      if (name) deps.push({ ecosystem: "npm", name, version: info.version });
    }
  } else if (j.dependencies) {
    const walk = (obj: Record<string, any>) => {
      for (const [name, info] of Object.entries(obj)) {
        if (info?.version && EXACT.test(info.version)) deps.push({ ecosystem: "npm", name, version: info.version });
        if (info?.dependencies) walk(info.dependencies);
      }
    };
    walk(j.dependencies);
  }
  return { format: "package-lock.json", deps: dedupe(deps), warnings: [] };
}

function parsePackageJson(text: string): ParseResult {
  const j = JSON.parse(text);
  const deps: Dep[] = [];
  const skipped: string[] = [];
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, range] of Object.entries<string>(j[section] ?? {})) {
      const v = typeof range === "string" ? pinFromRange(range) : null;
      if (v) deps.push({ ecosystem: "npm", name, version: v });
      else skipped.push(name);
    }
  }
  const warnings = [
    "package.json only has version ranges (like ^18.2.0), so we used the lowest version in each range. Upload package-lock.json, yarn.lock or pnpm-lock.yaml for exact versions, including sub-dependencies.",
  ];
  if (skipped.length) warnings.push(`Skipped ${skipped.length} without a pinnable version: ${skipped.slice(0, 8).join(", ")}${skipped.length > 8 ? "…" : ""}`);
  return { format: "package.json", deps: dedupe(deps), warnings };
}

function parseYarnLock(text: string): ParseResult {
  const deps: Dep[] = [];
  let names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    if (!line.startsWith(" ")) {
      // header: "react@^18.2.0", react@^18.0.0:   or   "@babel/core@npm:^7.0.0":
      names = line.replace(/:$/, "").split(",").map((s) => {
        const spec = s.trim().replace(/^"|"$/g, "");
        const at = spec.lastIndexOf("@");
        return at > 0 ? spec.slice(0, at) : spec;
      });
      continue;
    }
    const m = line.match(/^\s{2}version:?\s+"?([^"\s]+)"?/);
    if (m && names.length) {
      for (const n of new Set(names)) if (n && n !== "__metadata") deps.push({ ecosystem: "npm", name: n, version: m[1] });
      names = [];
    }
  }
  return { format: "yarn.lock", deps: dedupe(deps), warnings: [] };
}

function parsePnpmLock(text: string): ParseResult {
  const deps: Dep[] = [];
  let inPackages = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\S/.test(line)) { inPackages = /^(packages|snapshots):/.test(line); continue; }
    if (!inPackages) continue;
    // "  /react@18.2.0:"  "  react@18.2.0:"  "  '@babel/core@7.22.0':"  "  /@scope/x/1.0.0:" (v5)
    const m = line.match(/^ {2}'?\/?((?:@[^/@\s']+\/)?[^@/\s'(]+)[@/](\d[^\s:('"]*)/);
    if (m) deps.push({ ecosystem: "npm", name: m[1], version: m[2] });
  }
  return { format: "pnpm-lock.yaml", deps: dedupe(deps), warnings: [] };
}

function parseDenoJson(text: string): ParseResult {
  const deps: Dep[] = [];
  const warnings: string[] = [];
  const re = /npm:(@?[^@"'\s]+)@([^"'\s/]+)/g;
  for (const m of text.matchAll(re)) {
    const v = pinFromRange(m[2]);
    if (v) deps.push({ ecosystem: "npm", name: m[1], version: v });
  }
  if (/jsr:/.test(text)) warnings.push("jsr: imports are not covered by public vulnerability databases yet and were skipped.");
  return { format: "deno.json", deps: dedupe(deps), warnings };
}

function parseRequirements(text: string): ParseResult {
  const deps: Dep[] = [];
  const loose: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].split(";")[0].trim();
    if (!line || line.startsWith("-")) continue;
    const m = line.match(/^([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?\s*===?\s*([^\s,]+)/);
    if (m) deps.push({ ecosystem: "PyPI", name: m[1].toLowerCase().replace(/_/g, "-"), version: m[2] });
    else {
      const n = line.match(/^([A-Za-z0-9_.\-]+)/);
      if (n) loose.push(n[1]);
    }
  }
  const warnings = loose.length
    ? [`Skipped ${loose.length} without an exact == version: ${loose.slice(0, 8).join(", ")}${loose.length > 8 ? "…" : ""}. Run "pip freeze" for exact versions.`]
    : [];
  return { format: "requirements.txt", deps: dedupe(deps), warnings };
}

function parseGoMod(text: string): ParseResult {
  const deps: Dep[] = [];
  let block = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("//")[0].trim();
    if (/^require\s*\($/.test(line)) { block = true; continue; }
    if (block && line === ")") { block = false; continue; }
    const m = (block ? line : line.replace(/^require\s+/, "")).match(/^(\S+)\s+(v\d\S*)$/);
    if (m && (block || raw.trim().startsWith("require"))) deps.push({ ecosystem: "Go", name: m[1], version: m[2] });
  }
  return { format: "go.mod", deps: dedupe(deps), warnings: [] };
}

function parseCargoLock(text: string): ParseResult {
  const deps: Dep[] = [];
  for (const block of text.split("[[package]]").slice(1)) {
    const name = block.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
    const version = block.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
    const source = block.match(/^source\s*=\s*"([^"]+)"/m)?.[1];
    if (name && version && source?.includes("crates.io")) deps.push({ ecosystem: "crates.io", name, version });
  }
  return { format: "Cargo.lock", deps: dedupe(deps), warnings: [] };
}

function parseComposerLock(text: string): ParseResult {
  const j = JSON.parse(text);
  const deps: Dep[] = [...(j.packages ?? []), ...(j["packages-dev"] ?? [])]
    .filter((p: any) => p?.name && p?.version && !String(p.version).startsWith("dev-"))
    .map((p: any) => ({ ecosystem: "Packagist" as const, name: p.name, version: String(p.version).replace(/^v/, "") }));
  return { format: "composer.lock", deps: dedupe(deps), warnings: [] };
}

function parseGemfileLock(text: string): ParseResult {
  const deps: Dep[] = [];
  let inSpecs = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s{2}specs:/.test(line)) { inSpecs = true; continue; }
    if (/^\S/.test(line)) inSpecs = false;
    const m = inSpecs && line.match(/^ {4}([A-Za-z0-9_.\-]+) \(([^)\s]+)\)$/);
    if (m) deps.push({ ecosystem: "RubyGems", name: m[1], version: m[2].split("-")[0] });
  }
  return { format: "Gemfile.lock", deps: dedupe(deps), warnings: [] };
}

/** Pick a parser from the file name, falling back to sniffing the content. */
export function parseDependencyFile(fileName: string, text: string): ParseResult {
  const f = fileName.toLowerCase().split(/[\\/]/).pop() ?? "";
  try {
    if (f === "package-lock.json" || f === "npm-shrinkwrap.json") return parsePackageLock(text);
    if (f === "package.json") return parsePackageJson(text);
    if (f === "yarn.lock") return parseYarnLock(text);
    if (f === "pnpm-lock.yaml" || f === "pnpm-lock.yml") return parsePnpmLock(text);
    if (f === "deno.json" || f === "deno.jsonc" || f === "import_map.json") return parseDenoJson(text);
    if (f.endsWith(".txt") || f === "requirements.in") return parseRequirements(text);
    if (f === "go.mod") return parseGoMod(text);
    if (f === "cargo.lock") return parseCargoLock(text);
    if (f === "composer.lock") return parseComposerLock(text);
    if (f === "gemfile.lock") return parseGemfileLock(text);
    const t = text.trimStart();
    if (t.startsWith("{")) {
      const j = JSON.parse(text);
      if (j.lockfileVersion) return parsePackageLock(text);
      if (j.dependencies || j.devDependencies) return parsePackageJson(text);
    }
  } catch (e) {
    return { format: f || "file", deps: [], warnings: [`Could not read this file: ${(e as Error).message}`] };
  }
  return {
    format: f || "file",
    deps: [],
    warnings: [`Unsupported file. Try one of: ${SUPPORTED_FILES.join(", ")}.`],
  };
}

/** Parse a pasted "name@version" / "name==version" list, one per line. */
export function parseManualList(text: string, ecosystem: Ecosystem): ParseResult {
  const deps: Dep[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n|,/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(@?[^@\s=]+)\s*(?:@|==|\s)\s*v?(\S+)$/);
    if (m) deps.push({ ecosystem, name: m[1], version: m[2] });
    else bad.push(line);
  }
  return {
    format: "list",
    deps: dedupe(deps),
    warnings: bad.length ? [`Could not read: ${bad.slice(0, 5).join(", ")}. Use name@version.`] : [],
  };
}
