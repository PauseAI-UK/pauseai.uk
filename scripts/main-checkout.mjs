// Main's checkout for the storyboard review: one git worktree outside the
// repo (MAIN_WORKTREE, tests/checkout.mjs), kept between reviews so its
// node_modules and Next's cache stay in it. scripts/storyboard.mjs runs
// main's own suite there, and scripts/serve-main.mjs builds and serves it.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MAIN_WORKTREE } from "../tests/checkout.mjs";

const run = (command, args, options = {}) => execFileSync(command, args, { stdio: "inherit", ...options });

/**
 * Checks `ref` out in main's checkout, making the worktree if it isn't
 * there, and installs that version's own dependencies when its
 * package-lock.json has changed. Nothing is fetched.
 */
export function checkOutMain(ref, dir = MAIN_WORKTREE) {
  // One the repo no longer knows (pruned, or the repo moved) is made again from scratch.
  if (existsSync(join(dir, ".git"))) {
    try {
      execFileSync("git", ["rev-parse", "--git-dir"], { cwd: dir, stdio: "ignore" });
    } catch {
      console.log(`${dir} is no longer a worktree of this repo: making it again.`);
      rmSync(dir, { recursive: true, force: true });
      run("git", ["worktree", "prune"]);
    }
  }
  if (existsSync(join(dir, ".git"))) {
    run("git", ["checkout", "--detach", "--force", ref], { cwd: dir });
    // Not its dependencies, nor Next's cache: Turbopack's work, which the
    // build checks against the sources, and the resized images, without which
    // every picture on main's side waits on an image being resized.
    run("git", ["clean", "-fdxq", "-e", "node_modules", "-e", "/.next/cache"], { cwd: dir });
  } else {
    run("git", ["worktree", "add", "--detach", "--force", dir, ref]);
  }

  const lock = readFileSync(join(dir, "package-lock.json"), "utf8");
  const stamp = join(dir, "node_modules", ".installed-lock");
  if (!existsSync(stamp) || readFileSync(stamp, "utf8") !== lock) {
    run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: dir });
    writeFileSync(stamp, lock);
  }
}

/** Whether a process with this ID is running. */
function running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Takes main's checkout for this process, waiting while another has it: a
 * review, or the run `npm run worktree` starts in the background. Returns
 * what gives it back, which the process's exit does too.
 */
export async function lockMain(dir = MAIN_WORKTREE) {
  const lock = `${dir}.lock`;
  for (let told = false; ;) {
    try {
      writeFileSync(lock, String(process.pid), { flag: "wx" });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    // Gone again already, if its holder has just finished.
    if (!existsSync(lock)) continue;
    const holder = Number(readFileSync(lock, "utf8"));
    if (!running(holder)) {
      // Left by a process that was killed.
      rmSync(lock, { force: true });
      continue;
    }
    if (!told) console.log(`\n▶ Storyboard: waiting for process ${holder}, which is using main's checkout (${dir}).\n`);
    told = true;
    await new Promise((done) => setTimeout(done, 2000));
  }
  let held = true;
  const release = () => {
    if (held) rmSync(lock, { force: true });
    held = false;
  };
  process.on("exit", release);
  return release;
}
