import type { CoverageMap } from "@vitest/istanbul-lib-coverage";

/** Each shard's coverage-final.json, parsed: its end columns can be null, which FileCoverageData's type doesn't allow. */
export function mergeShards(shards: Record<string, unknown>[]): CoverageMap;
export function shortfalls(map: CoverageMap, root?: string): string[];
