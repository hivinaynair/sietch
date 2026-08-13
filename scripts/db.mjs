import { join } from "node:path";

const commands = {
  generate: "db:generate",
  migrate: "db:migrate",
  push: "db:push",
  studio: "db:studio",
};

const command = process.argv[2];
const task = command ? commands[command] : undefined;

if (!task) {
  console.error("Usage: bun run db <generate|migrate|push|studio>");
  process.exit(1);
}

const proc = Bun.spawn(
  ["bunx", "turbo", "run", task, "--filter=@repo/db", ...process.argv.slice(3)],
  {
    cwd: join(import.meta.dir, ".."),
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  },
);

process.exit(await proc.exited);
