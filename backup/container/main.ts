import { backupServer } from "./server.ts";

// The container's entry point (Dockerfile). DATABASE_URL, SITE_URL and
// SITE_BACKUP_SECRET are the Worker's, passed in when it starts the
// container.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
const { SITE_URL: siteUrl, SITE_BACKUP_SECRET: secret } = process.env;
backupServer(databaseUrl, {
  dump: "/tmp/backup.dump",
  messages: "/tmp/messages.tar",
  site:
    siteUrl && secret
      ? (path) => fetch(`${siteUrl}${path}`, { headers: { Authorization: `Bearer ${secret}` } })
      : undefined,
}).listen(8080);
