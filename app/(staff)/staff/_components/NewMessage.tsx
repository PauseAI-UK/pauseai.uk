import { Select } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { staffCopy } from "@/lib/content/staff-interface";
import { sendsOf, stateValue } from "@/lib/contact-permissions";
import { Numbered } from "./DraftWriter";
import { SUBSCRIPTION_ORDER } from "./SupporterFilters";
import Grid, { Card } from "./ui/Grid";

const copy = staffCopy.messagePages;

/** The topics a broadcast can be about: those we can be sure someone said yes to, as the Consent filter orders them. */
const CONSENTS = SUBSCRIPTION_ORDER.filter(([channel, topic]) => sendsOf(channel, topic).includes("yes"));

/**
 * New broadcast: the Consent it goes under, which says whether it's an email
 * or a text and what it's about, then Change who, which makes the draft to
 * everyone who said yes and opens the supporters list to narrow them.
 */
export default function NewMessage({ action }: { action: (form: FormData) => void | Promise<void> }) {
  return (
    <>
      <h1>{copy.newMessage}</h1>
      <Grid>
        <Card span={6} title={<Numbered n={1}>{copy.sections.who}</Numbered>} id="who-title">
          <form action={action}>
            <Field label={copy.facts.saidYes}>
              <Select name="contact" required defaultValue="">
                <option value="" disabled>
                  {staffCopy.mailingPages.choose}
                </option>
                {CONSENTS.map(([channel, topic]) => (
                  <option key={`${channel}:${topic}`} value={stateValue({ channel, topic, send: "yes" })}>
                    {staffCopy.supporters.subscriptions.topics[channel][topic]}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton variant="primary" size="small" fit>
              {staffCopy.mailingPages.changeWho}
            </SubmitButton>
          </form>
        </Card>
      </Grid>
    </>
  );
}
