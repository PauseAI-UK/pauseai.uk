import StaffLink from "../ui/StaffLink";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextInput } from "@/components/ui/Controls";
import { Field, FieldError } from "@/components/ui/Field";
import { FormStack } from "@/components/ui/Form";
import { LOGIN_PATH, NEXT_PARAM } from "@/lib/accounts/session";
import KeepSignedIn from "./KeepSignedIn";
import styles from "../StaffForms.module.css";
import { accountsCopy } from "./copy";

/**
 * The login page's card's contents, from its URL: the form, with why the
 * last link didn't work if it didn't, or, once a link is sent, word of it.
 * `next` is the page to go to once logged in, passed on with the address.
 */
export default function LoginForm({
  sent,
  failed,
  elsewhere,
  next,
}: {
  sent?: string;
  failed?: string;
  elsewhere?: string;
  next?: string;
}) {
  if (sent) {
    // Replaces the form, so the page visibly changes once the link is sent.
    return (
      <>
        <p role="status">{accountsCopy.login.sent}</p>
        <p>
          <StaffLink href={LOGIN_PATH}>{accountsCopy.login.again}</StaffLink>
        </p>
      </>
    );
  }
  return (
    <>
      <p>{accountsCopy.login.intro}</p>
      {failed && <FieldError>{accountsCopy.login.failed}</FieldError>}
      {elsewhere && <FieldError>{accountsCopy.login.elsewhere}</FieldError>}
      <FormStack method="post" action="/staff/api/login" className={styles.login}>
        {next && <input type="hidden" name={NEXT_PARAM} value={next} />}
        <Field label={accountsCopy.login.emailLabel}>
          <TextInput name="email" type="email" autoComplete="email" required />
        </Field>
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
