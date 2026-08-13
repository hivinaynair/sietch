import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const config = join(repoRoot, "tooling/dependency-cruiser/nextjs.mjs");
const appsDir = join(repoRoot, "apps");

const entries = await readdir(appsDir);
let failed = false;
let cruised = 0;

for (const name of entries) {
  const appDir = join(appsDir, name);
  if (!(await stat(appDir)).isDirectory()) {
    continue;
  }

  const pkgFile = Bun.file(join(appDir, "package.json"));
  if (!(await pkgFile.exists())) {
    continue;
  }

  const pkg = await pkgFile.json();
  if (!pkg.dependencies?.next && !pkg.devDependencies?.next) {
    continue;
  }

  const srcDir = join(appDir, "src");
  try {
    if (!(await stat(srcDir)).isDirectory()) {
      continue;
    }
  } catch {
    continue;
  }

  cruised += 1;
  const proc = Bun.spawn(["bunx", "depcruise", "src", "--config", config], {
    cwd: appDir,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    failed = true;
  }
}

if (cruised === 0) {
  console.error("No Next.js apps with src/ found under apps/.");
  process.exit(1);
}

if (failed) {
  process.exit(1);
}
