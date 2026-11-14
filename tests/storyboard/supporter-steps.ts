// Supporters and events in a flow's database, as the hourly imports bring
// them, through their own routes, from the fake Luma calendar and CiviCRM.
import type { APIRequestContext } from "@playwright/test";

/** Copies the fixture's UK chapter contacts from the fake CiviCRM into the flow's database through the hourly import's own route. */
export async function importCivicrm(request: APIRequestContext, base: string) {
  const res = await request.post(`${base}/api/cron/import-civicrm`, {
    headers: { Authorization: "Bearer fixture-cron-secret" },
  });
  if (!res.ok()) throw new Error(`CiviCRM import on ${base} failed: ${res.status()} ${await res.text()}`);
}

/** Copies the fixture Luma calendar into the flow's database through the hourly import's own route. */
export async function importLuma(request: APIRequestContext, base: string) {
  const res = await request.post(`${base}/api/cron/import-luma`, {
    headers: { Authorization: "Bearer fixture-cron-secret" },
  });
  if (!res.ok()) throw new Error(`Luma import on ${base} failed: ${res.status()} ${await res.text()}`);
}
