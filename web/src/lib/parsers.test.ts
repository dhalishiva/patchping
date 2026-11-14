import { describe, expect, it } from "vitest";
import { parseDependencyFile, parseManualList, pinFromRange } from "./parsers";

const has = (deps: { name: string; version: string }[], name: string, version: string) =>
  deps.some((d) => d.name === name && d.version === version);

describe("pinFromRange", () => {
  it("pins common ranges", () => {
    expect(pinFromRange("^18.2.0")).toBe("18.2.0");
    expect(pinFromRange("~4.17")).toBe("4.17.0");
    expect(pinFromRange(">=1.0.0 <2")).toBe("1.0.0");
    expect(pinFromRange("5")).toBe("5.0.0");
    expect(pinFromRange("1.0.0-beta.2")).toBe("1.0.0-beta.2");
    expect(pinFromRange("latest")).toBeNull();
    expect(pinFromRange("workspace:*")).toBeNull();
    expect(pinFromRange("github:user/repo")).toBeNull();
    expect(pinFromRange("npm:string-width@^4.2.0")).toBe("4.2.0");
  });
});

describe("parsers", () => {
  it("package-lock v3", () => {
    const r = parseDependencyFile("package-lock.json", JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { name: "app", version: "1.0.0" },
        "node_modules/react": { version: "18.3.1" },
        "node_modules/@babel/core": { version: "7.24.0" },
        "node_modules/a/node_modules/lodash": { version: "4.17.15" },
        "node_modules/linked": { link: true },
      },
    }));
    expect(r.deps).toHaveLength(3);
    expect(has(r.deps, "@babel/core", "7.24.0")).toBe(true);
    expect(has(r.deps, "lodash", "4.17.15")).toBe(true);
  });

  it("package-lock v1", () => {
    const r = parseDependencyFile("package-lock.json", JSON.stringify({
      lockfileVersion: 1,
      dependencies: { axios: { version: "0.21.0", dependencies: { "follow-redirects": { version: "1.13.0" } } } },
    }));
    expect(has(r.deps, "follow-redirects", "1.13.0")).toBe(true);
  });

  it("package.json warns about ranges", () => {
    const r = parseDependencyFile("package.json", JSON.stringify({
      dependencies: { react: "^18.2.0", local: "file:../x" }, devDependencies: { vite: "~5.1.0" },
    }));
    expect(has(r.deps, "react", "18.2.0")).toBe(true);
    expect(has(r.deps, "vite", "5.1.0")).toBe(true);
    expect(r.warnings.length).toBe(2);
  });

  it("yarn.lock classic and berry", () => {
    const classic = `# yarn lockfile v1\n\n"@babel/code-frame@^7.0.0", "@babel/code-frame@^7.22.13":\n  version "7.22.13"\n  resolved "x"\n\nlodash@^4.17.15:\n  version "4.17.21"\n`;
    const r1 = parseDependencyFile("yarn.lock", classic);
    expect(has(r1.deps, "@babel/code-frame", "7.22.13")).toBe(true);
    expect(has(r1.deps, "lodash", "4.17.21")).toBe(true);
    const berry = `__metadata:\n  version: 6\n\n"react@npm:^18.2.0":\n  version: 18.2.0\n  resolution: "react@npm:18.2.0"\n`;
    const r2 = parseDependencyFile("yarn.lock", berry);
    expect(r2.deps).toEqual([{ ecosystem: "npm", name: "react", version: "18.2.0" }]);
  });

  it("pnpm-lock v6 and v9", () => {
    const v6 = `lockfileVersion: '6.0'\n\npackages:\n\n  /react@18.2.0:\n    resolution: {}\n  /@babel/core@7.22.0:\n    resolution: {}\n`;
    const r = parseDependencyFile("pnpm-lock.yaml", v6);
    expect(has(r.deps, "react", "18.2.0")).toBe(true);
    expect(has(r.deps, "@babel/core", "7.22.0")).toBe(true);
    const v9 = `lockfileVersion: '9.0'\n\nimporters:\n  .:\n    dependencies:\n      react:\n        specifier: ^18\n\npackages:\n\n  '@supabase/supabase-js@2.45.0':\n    resolution: {}\n  react@18.3.1(foo@1.0.0):\n    resolution: {}\n`;
    const r9 = parseDependencyFile("pnpm-lock.yaml", v9);
    expect(has(r9.deps, "@supabase/supabase-js", "2.45.0")).toBe(true);
    expect(has(r9.deps, "react", "18.3.1")).toBe(true);
  });

  it("deno.json npm specifiers", () => {
    const r = parseDependencyFile("deno.json", JSON.stringify({ imports: { "@supabase/supabase-js": "npm:@supabase/supabase-js@2.45.0", zod: "npm:zod@^3.22", std: "jsr:@std/path@1" } }));
    expect(has(r.deps, "@supabase/supabase-js", "2.45.0")).toBe(true);
    expect(has(r.deps, "zod", "3.22.0")).toBe(true);
    expect(r.warnings).toHaveLength(1);
  });

  it("requirements.txt", () => {
    const r = parseDependencyFile("requirements.txt", "Django==3.2.0\nrequests[security]==2.25.0 ; python_version>'3'\n# c\n-r base.txt\nflask>=2\n");
    expect(has(r.deps, "django", "3.2.0")).toBe(true);
    expect(has(r.deps, "requests", "2.25.0")).toBe(true);
    expect(r.warnings[0]).toContain("flask");
  });

  it("go.mod", () => {
    const r = parseDependencyFile("go.mod", "module x\n\ngo 1.22\n\nrequire github.com/gin-gonic/gin v1.9.0\n\nrequire (\n\tgolang.org/x/net v0.17.0 // indirect\n)\n");
    expect(has(r.deps, "github.com/gin-gonic/gin", "v1.9.0")).toBe(true);
    expect(has(r.deps, "golang.org/x/net", "v0.17.0")).toBe(true);
  });

  it("Cargo.lock, composer.lock, Gemfile.lock", () => {
    const cargo = `[[package]]\nname = "serde"\nversion = "1.0.190"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\n\n[[package]]\nname = "mycrate"\nversion = "0.1.0"\n`;
    expect(parseDependencyFile("Cargo.lock", cargo).deps).toEqual([{ ecosystem: "crates.io", name: "serde", version: "1.0.190" }]);
    const composer = JSON.stringify({ packages: [{ name: "laravel/framework", version: "v10.0.0" }, { name: "x/y", version: "dev-main" }] });
    expect(parseDependencyFile("composer.lock", composer).deps).toEqual([{ ecosystem: "Packagist", name: "laravel/framework", version: "10.0.0" }]);
    const gem = `GEM\n  remote: https://rubygems.org/\n  specs:\n    rails (7.0.4)\n      actionpack (= 7.0.4)\n    nokogiri (1.15.0-x86_64-linux)\n\nPLATFORMS\n  ruby\n`;
    const g = parseDependencyFile("Gemfile.lock", gem).deps;
    expect(has(g, "rails", "7.0.4")).toBe(true);
    expect(has(g, "nokogiri", "1.15.0")).toBe(true);
    expect(g).toHaveLength(2);
  });

  it("unsupported and broken files", () => {
    expect(parseDependencyFile("notes.md", "hello").deps).toHaveLength(0);
    expect(parseDependencyFile("package.json", "{oops").warnings[0]).toContain("Could not read");
  });

  it("manual list", () => {
    const r = parseManualList("react@18.3.1\n@supabase/supabase-js@2.45.0\ndjango==3.2\nbad line here", "npm");
    expect(r.deps).toHaveLength(3);
    expect(has(r.deps, "@supabase/supabase-js", "2.45.0")).toBe(true);
    expect(r.warnings).toHaveLength(1);
  });
});
