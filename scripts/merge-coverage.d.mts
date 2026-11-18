import type { CoverageMap, CoverageMapData } from "@vitest/istanbul-lib-coverage";

export function parseCoverage(text: string): CoverageMapData;
export function mergeShards(shards: CoverageMapData[]): CoverageMap;
export function shortfalls(map: CoverageMap, root?: string): string[];
