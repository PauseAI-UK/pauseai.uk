export function startHttp2(
  target: string,
  certificate: { key: Buffer; cert: Buffer },
): Promise<{ url: string; stop: () => Promise<void> }>;
