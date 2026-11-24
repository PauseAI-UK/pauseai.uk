import { SubmitButton } from "@/components/ui/SubmitButton";
import Actions from "@/components/ui/Actions";
import type { FormResult } from "@/lib/form-result";
import { Refusal, ResultForm } from "../ui/ResultForm";

/** The Server Action that runs a job now. It's never refused: a run that fails is in the job's log. */
export type RunJob = (form: FormData) => Promise<FormResult<never>>;

/** A job's button, on its page: runs it now. A press that fails says so under the button. */
export default function JobActions({ action, label }: { action: RunJob; label: string }) {
  return (
    <Actions>
      <ResultForm action={action} says={{}}>
        <SubmitButton variant="primary" size="small">
          {label}
        </SubmitButton>
        <Refusal />
      </ResultForm>
    </Actions>
  );
}
