import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The skill exists twice, on purpose:
//
//   skills/scholar-sidekick/SKILL.md         — repo root. Read by `npx skills add`
//                                              and by third-party crawlers that scan
//                                              `skills/` (this is how directories find us).
//   plugin/skills/scholar-sidekick/SKILL.md  — the Claude Code plugin payload.
//
// The plugin lives in its own subdirectory rather than at the repo root because a
// plugin root containing package.json makes Claude Code run `npm install` on it,
// dragging ~94MB of devDependencies onto every user's machine. `plugin/` has no
// package.json, so the install stays tiny.
//
// The cost of that split is a duplicated file, so this test is the drift guard.
// If it fails: copy the repo-root skill over the plugin copy.
//   cp -R skills/scholar-sidekick plugin/skills/

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), "utf8");

describe("plugin skill parity", () => {
  it("plugin/skills/scholar-sidekick/SKILL.md is byte-identical to the repo-root skill", () => {
    const canonical = read("skills/scholar-sidekick/SKILL.md");
    const pluginCopy = read("plugin/skills/scholar-sidekick/SKILL.md");

    expect(pluginCopy).toBe(canonical);
  });

  it("the plugin root has no package.json (or Claude Code would npm install it)", () => {
    expect(() => read("plugin/package.json")).toThrow();
  });
});
