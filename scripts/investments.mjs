// Lists the items in investments/, most hits first, with each one's size and
// kind. A hit is a line starting "- " under "## Hits"; "(x14)" in it counts as
// fourteen. investments/README.md explains the format.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const folder = new URL("../investments/", import.meta.url).pathname;

const items = readdirSync(folder)
  .filter((name) => name.endsWith(".md") && name !== "README.md")
  .map((name) => {
    const text = readFileSync(join(folder, name), "utf8");
    const title = text.match(/^# (.+)$/m)?.[1] ?? name;
    const size = text.match(/^Size: (\w+)\./m)?.[1] ?? "?";
    const kind = text.match(/Kind: ([^.]+)\./)?.[1] ?? "?";
    const hits = (text.split(/^## Hits$/m)[1] ?? "")
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .reduce((sum, line) => sum + Number(line.match(/\(x(\d+)/)?.[1] ?? 1), 0);
    return { name, title, size, kind, hits };
  })
  .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));

const kindWidth = Math.max(...items.map((item) => item.kind.length));
for (const { name, title, size, kind, hits } of items) {
  console.log(`${String(hits).padStart(4)}  ${size}  ${kind.padEnd(kindWidth)}  ${title} (${name})`);
}
