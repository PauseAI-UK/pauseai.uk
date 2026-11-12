import { SubmitButton } from "@/components/ui/SubmitButton";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { StaffSession } from "@/lib/server/staff-auth";
import { browserOf, systemOf } from "@/lib/user-agent";
import { Card } from "./ui/Grid";
import Rows, { Row } from "./ui/Rows";
import When from "./ui/When";
import styles from "./StaffSessions.module.css";

const copy = staffCopy.sessions;

/**
 * Your own sessions, a card of your page, two-thirds of its grid: what they
 * are, then a row each (ui/Rows): the browser and system it began in, as
 * far as they're known, marked if it's this browser's; under them when it
 * began, when it ends and, if so, that it's kept signed in; and at its
 * right Log out, which ends that one. Under the rows, the button that ends
 * them all, this one included. Each is a POST to the logout route.
 */
export default function StaffSessions({ sessions }: { sessions: StaffSession[] }) {
  return (
    <Card span={4} title={staffCopy.me.sessionsTitle} id="sessions">
      <p className={styles.intro}>{copy.intro}</p>
      <Rows label={staffCopy.me.sessionsTitle}>
        {sessions.map((session) => (
          <Row
            key={session.id}
            second={
              <span className={styles.facts}>
                <span>
                  {copy.started} <When at={session.startedAt} />
                </span>
                <span>
                  {copy.ends} <When at={session.expiresAt} />
                </span>
                {session.remember && <span>{copy.kept}</span>}
              </span>
            }
            end={
              <form method="post" action="/staff/api/logout">
                <input type="hidden" name="session" value={session.id} />
                <SubmitButton variant="ghost" size="small" fit>
                  {staffCopy.nav.logout}
                </SubmitButton>
              </form>
            }
          >
            <span className={styles.name}>
              {[browserOf(session.userAgent), systemOf(session.userAgent)].filter(Boolean).join(" · ") || copy.unknown}
              {session.current && <Tag>{copy.thisBrowser}</Tag>}
            </span>
          </Row>
        ))}
      </Rows>
      <form method="post" action="/staff/api/logout">
        <input type="hidden" name="everywhere" value="1" />
        <SubmitButton variant="ghost" size="small" fit>
          {copy.logOutEverywhere}
        </SubmitButton>
      </form>
    </Card>
  );
}
