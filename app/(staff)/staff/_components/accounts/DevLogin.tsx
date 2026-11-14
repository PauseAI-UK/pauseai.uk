import { SubmitButton } from "@/components/ui/SubmitButton";
import { Muted } from "@/components/ui/Text";
import type { DevLoginChoice } from "@/lib/accounts/dev-login.server";
import { DEV_LOGIN_PATH, NEXT_PARAM } from "@/lib/accounts/session";
import styles from "./DevLogin.module.css";
import { accountsCopy } from "./copy";

const copy = accountsCopy.devLogin;

/**
 * The dev login, only in a fixture build (DATA_FIXTURES=1): under the
 * login card, a box in the development colour, per address a button that
 * signs in as them at once, with no email, and under it what they are:
 * their permissions, an account with none, or no account, and goes to
 * `next`, as the emailed link would. Given no addresses, as outside a
 * fixture build (lib/accounts/dev-login.server.ts), it's nothing; the route refuses
 * it there too.
 */
export default function DevLogin({ accounts, next }: { accounts: DevLoginChoice[] | undefined; next?: string }) {
  if (!accounts) return null;
  return (
    <section className={styles.dev} aria-label={copy.title}>
      <h2 className={styles.title}>{copy.title}</h2>
      <p className={styles.hint}>{copy.hint}</p>
      <ul className={styles.choices}>
        {accounts.map(({ email, description }) => (
          <li key={email}>
            <form method="post" action={DEV_LOGIN_PATH}>
              <input type="hidden" name="email" value={email} />
              {next && <input type="hidden" name={NEXT_PARAM} value={next} />}
              <SubmitButton variant="ghost" size="small">
                {email}
              </SubmitButton>
            </form>
            <Muted>{description}</Muted>
          </li>
        ))}
      </ul>
    </section>
  );
}
