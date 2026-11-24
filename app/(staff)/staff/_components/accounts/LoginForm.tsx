import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextInput } from "@/components/ui/Controls";
import { Field, FieldError } from "@/components/ui/Field";
import { FormStack } from "@/components/ui/Form";
import { GOOGLE_START_PATH, LOCAL_LOGIN_PATH, NEXT_PARAM } from "@/lib/accounts/session";
import KeepSignedIn from "./KeepSignedIn";
import styles from "../ui/StaffForms.module.css";
import { accountsCopy } from "./copy";

const copy = accountsCopy.login;

/**
 * The login page's card's contents, from its URL: the button that goes to
 * Google, with "Keep me signed in", and, back from Google, why the last
 * try didn't work if it didn't. `next` is the page to go to once logged in,
 * passed on with the button. On a local build without fixtures (`local`),
 * which Google can't sign in to, an address to print a link for instead
 * (lib/accounts/local-login.server.ts), and once it's `printed`, word of it.
 */
export default function LoginForm({
  failed,
  other,
  printed,
  next,
  local = false,
}: {
  failed?: string;
  other?: string;
  printed?: string;
  next?: string;
  local?: boolean;
}) {
  return (
    <>
      <p>{local ? copy.local.intro : copy.intro}</p>
      {failed && <FieldError>{copy.failed}</FieldError>}
      {other && <FieldError>{copy.other}</FieldError>}
      {printed && <p role="status">{copy.local.printed}</p>}
      <FormStack
        method={local ? "post" : "get"}
        action={local ? LOCAL_LOGIN_PATH : GOOGLE_START_PATH}
        className={styles.login}
      >
        {next && <input type="hidden" name={NEXT_PARAM} value={next} />}
        {local && (
          <Field label={copy.local.emailLabel}>
            <TextInput name="email" type="email" autoComplete="email" required />
          </Field>
        )}
        <KeepSignedIn />
        <div>
          <SubmitButton variant="primary" size="small" fit>
            {local ? copy.local.button : copy.button}
          </SubmitButton>
        </div>
      </FormStack>
    </>
  );
}
