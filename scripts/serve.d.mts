import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "node:http";
import type { NetworkInterfaceInfo } from "node:os";

export function servePorts(dir: string): { proxy: number; next: number };
export function parseArgs(args: string[]): { branch?: string; pr?: number; stop: boolean } | undefined;
export function worktreeOf(porcelain: string, branch: string): string | undefined;
export function networkAddress(interfaces?: NodeJS.Dict<NetworkInterfaceInfo[]>): string;
export function towardsNext(headers: IncomingHttpHeaders, local: string): OutgoingHttpHeaders;
export function withoutSecure(cookies: string[] | undefined): string[] | undefined;
