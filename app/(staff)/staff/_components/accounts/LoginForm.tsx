import { SubmitButton } from "@/components/ui/SubmitButton";
import { FieldError } from "@/components/ui/Field";
import { FormStack } from "@/components/ui/Form";
import { GOOGLE_START_PATH, NEXT_PARAM } from "@/lib/accounts/session";
import KeepSignedIn from "./KeepSignedIn";
import styles from "../ui/StaffForms.module.css";
import { accountsCopy } from "./copy";

/**
 * The login page's card's contents, from its URL: the button that goes to
 * Google, with "Keep me signed in", and, back from Google, why the last
 * try didn't work if it didn't. `next` is the page to go to once logged in,
 * passed on with the button.
 */
export default function LoginForm({ failed, other, next }: { failed?: string; other?: string; next?: string }) {
  return (
    <>
      <p>{accountsCopy.login.intro}</p>
      {failed && <FieldError>{accountsCopy.login.failed}</FieldError>}
      {other && <FieldError>{accountsCopy.login.other}</FieldError>}
      <FormStack method="get" action={GOOGLE_START_PATH} className={styles.login}>
        {next && <input type="hidden" name={NEXT_PARAM} value={next} />}
        <KeepSignedIn />
        <div>
          <SubmitButton variant="primary" size="small" fit>
            {accountsCopy.login.button}
          </SubmitButton>
        </div>
      </FormStack>
    </>
  );
}
