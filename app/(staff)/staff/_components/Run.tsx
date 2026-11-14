import { SubmitButton } from "@/components/ui/SubmitButton";
import { staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { gmailMessageLink } from "@/lib/letter-links";
import {
  type AnyImportRun,
  type ControlAiImport,
  type ControlAiStatementImport,
  type LumaImport,
  type CivicrmImport,
  type GmailReading,
  type PoliticianImport,
  type Sending,
  type Tidying,
} from "@/lib/import-runs";
import type { House } from "@/lib/politicians/filters";
import { importChangeCount } from "@/lib/politicians/import-changes";
import RunBox from "./RunBox";
import { Muted } from "@/components/ui/Text";
import Table from "@/components/ui/Table";
import ExternalLink from "./ui/ExternalLink";
import { politiciansCopy } from "./politicians/copy";

/** The Server Action that applies or discards a held import. */
export type Decide = (formData: FormData) => void | Promise<void>;

/** Who a politician is, as a run lists them: where they sit and their name. */
type Listed = { name?: string; house?: House; constituency?: string | null; email?: string | null };

/**
 * Politicians a run added, lost or changed, each by where they sit and
 * their name, in the order a person reads them. Runs from before every body was read have only MPs, without
 * a house.
 */
function Politicians({ heading, politicians }: { heading: string; politicians: Listed[] }) {
  if (politicians.length === 0) return null;
  const where = (p: Listed) => `${p.constituency ?? staffVocabulary.houses[p.house!]}: ${p.name}`;
  // In the order a person reads them, a number in a name as a number: Gone 2 before Gone 10.
  const sorted = [...politicians].sort((a, b) => where(a).localeCompare(where(b), "en-GB", { numeric: true }));
  return (
    <>
      <h4>
        {heading} ({politicians.length})
      </h4>
      <ul>
        {sorted.map((p) => (
          <li key={where(p)}>
            {where(p)}
            {p.email === null ? ` (${politiciansCopy.politicians.noEmail})` : ""}
          </li>
        ))}
      </ul>
    </>
  );
}

/** A list of lines under a heading with how many, or nothing if there are none. */
function Lines({ heading, lines }: { heading: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <>
      <h4>
        {heading} ({lines.length})
      </h4>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}

/** One button, in a form of its own, so the decision travels as a field. */
function Decision({ run, decision, decide }: { run: PoliticianImport; decision: "apply" | "discard"; decide: Decide }) {
  return (
    <form action={decide}>
      <input type="hidden" name="id" value={run.id} />
      <input type="hidden" name="job" value={run.job} />
      <input type="hidden" name="decision" value={decision} />
      <SubmitButton variant={decision === "apply" ? "primary" : "ghost"} size="small">
        {politiciansCopy.politicianImports[decision]}
      </SubmitButton>
    </form>
  );
}

/**
 * An import of a body's members: who it added, changed and found had left,
 * then what a person should look at first, the names changed and the seats no
 * postcode would find, and the salutations unlike the rule's; for
 * Parliament's, the constituencies with no MP; and what relinking did. A held
 * one can be applied or discarded, given `decide`.
 */
function PoliticianImportRun({
  run,
  decide,
  open,
  bare,
}: {
  run: PoliticianImport;
  decide?: Decide;
  open?: boolean;
  bare?: boolean;
}) {
  if (run.status === "failed") return <RunBox run={run} summary={null} open={open} bare={bare} />;
  const words = politiciansCopy.politicianImports;
  const { changes, vacant, relinked } = run.result;
  const { added, changed, left, renamed, unofficial, salutations } = changes;
  const count = importChangeCount(changes) + renamed.length + unofficial.length + salutations.length;
  const summary = [words.result({ added: added.length, changed: changed.length, left: left.length })];
  if (vacant?.length) summary.push(words.vacant(vacant.length));
  if (relinked) summary.push(words.relinked(relinked));
  return (
    <RunBox
      run={run}
      open={open}
      bare={bare}
      lines={count + (vacant?.length ?? 0)}
      summary={summary.join(" ")}
      actions={
        run.status === "held" &&
        decide && (
          <>
            <Decision run={run} decision="apply" decide={decide} />
            <Decision run={run} decision="discard" decide={decide} />
          </>
        )
      }
    >
      {count + (vacant?.length ?? 0) > 0 && (
        <>
          <Lines heading={words.renamed} lines={renamed.map((r) => `${r.from} → ${r.to}`)} />
          <Lines heading={words.unofficial} lines={unofficial.map((u) => `${u.constituency}: ${u.name}`)} />
          <Politicians heading={words.added} politicians={added.map((m) => ({ ...m, email: m.emails[0] ?? null }))} />
          <Politicians heading={words.left} politicians={left} />
          <Lines
            heading={words.changed}
            lines={changed.map((c) => `${c.name}: ${Object.keys(c.changed).join(", ")}`)}
          />
          <Lines heading={words.salutations} lines={salutations.map((s) => `${s.name}: ${s.ours} → ${s.rule}`)} />
          <Lines heading={words.noMp} lines={vacant ?? []} />
        </>
      )}
    </RunBox>
  );
}

/** A copy of ControlAI's statement's supporters: what it did. Links it couldn't match are a problem of the run. */
function ControlAiStatementRun({ run, open, bare }: { run: ControlAiStatementImport; open?: boolean; bare?: boolean }) {
  return (
    <RunBox
      run={run}
      summary={run.status === "failed" ? null : staffCopy.controlAiStatement.result(run.result)}
      open={open}
      bare={bare}
    />
  );
}

/** A copy of ControlAI's letter's signatories: what it did, and the names it couldn't place. */
function ControlAiRun({ run, open, bare }: { run: ControlAiImport; open?: boolean; bare?: boolean }) {
  if (run.status === "failed") return <RunBox run={run} summary={null} open={open} bare={bare} />;
  const { result } = run;
  return (
    <RunBox
      run={run}
      summary={staffCopy.controlAi.result(result)}
      lines={result.problems.length}
      open={open}
      bare={bare}
    >
      {result.problems.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th>{staffCopy.controlAi.columns.name}</th>
              <th>{staffCopy.controlAi.columns.problem}</th>
            </tr>
          </thead>
          <tbody>
            {result.problems.map((problem) => (
              <tr key={problem.name}>
                <td>{problem.name}</td>
                <td>
                  {staffCopy.controlAi.kinds[problem.kind]}
                  {problem.candidates.length > 0 && <Muted> {problem.candidates.join(", ")}</Muted>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </RunBox>
  );
}

/** A copy of the Luma calendar: the counts, the hosts changed, the places looked up, and why it stopped early if it did. */
function LumaRun({ run, open, bare }: { run: LumaImport; open?: boolean; bare?: boolean }) {
  if (run.status === "failed") return <RunBox run={run} summary={null} open={open} bare={bare} />;
  const { stoppedBy, hostsChanged, contactPages, eventsTagged, places } = run.result;
  return (
    <RunBox
      run={run}
      open={open}
      bare={bare}
      summary={
        <>
          {staffCopy.luma.result(run.result)}
          {hostsChanged !== undefined && <> {staffCopy.luma.hostsChanged(hostsChanged)}</>}
          {contactPages !== undefined && <> {staffCopy.luma.contactPages(contactPages)}</>}
          {Boolean(eventsTagged) && <> {staffCopy.luma.eventsTagged(eventsTagged!)}</>}
          {places && <> {staffCopy.luma.places(places)}</>}
          {stoppedBy && <> {staffCopy.luma.stoppedBy[stoppedBy]}</>}
        </>
      }
    />
  );
}

/** A pull from CiviCRM: the counts, and why nobody was marked gone, if no one was. */
function CivicrmRun({ run, open, bare }: { run: CivicrmImport; open?: boolean; bare?: boolean }) {
  return (
    <RunBox
      run={run}
      summary={run.status === "failed" ? null : staffCopy.civicrm.result(run.result)}
      open={open}
      bare={bare}
    />
  );
}

/**
 * A read of Gmail: the totals, then each account's, with whether it
 * couldn't be read, or was disconnected; for the letters inbox, what it
 * relayed, and each message it couldn't account for, with a link to it in
 * Gmail; and in its summary, what its search for addresses staff added
 * found. One that stopped as another was reading says so, as the Luma
 * import's does.
 */
function GmailRun({ run, open, bare }: { run: GmailReading; open?: boolean; bare?: boolean }) {
  if (run.status === "failed") return <RunBox run={run} summary={null} open={open} bare={bare} />;
  if (run.result.stoppedBy) {
    return <RunBox run={run} summary={staffCopy.luma.stoppedBy[run.result.stoppedBy]} open={open} bare={bare} />;
  }
  const words = staffCopy.gmailReading;
  const inbox = staffCopy.lettersInbox;
  const { accounts, searched } = run.result;
  const lines = accounts.reduce((n, a) => n + 1 + (a.notUnderstood?.length ?? 0), 0);
  const summary = words.result(accounts);
  return (
    <RunBox
      run={run}
      summary={searched ? `${summary.replace(/\.?$/, ".")} ${words.searched(searched)}` : summary}
      lines={lines}
      open={open}
      bare={bare}
    >
      <ul>
        {accounts.map((a) => (
          <li key={a.account}>
            {words.account(a)}
            {a.relayed !== undefined &&
              ` ${inbox.result({ relayed: a.relayed, spam: a.spam!, uncertain: a.uncertain! })}`}
            {!!a.oneOffs && ` ${words.oneOffs(a.oneOffs)}`}
            {a.restarted && ` ${words.restarted}`}
            {a.error && <Muted> {a.disconnected ? words.disconnected : words.failed(a.error)}</Muted>}
            {!!a.notUnderstood?.length && (
              <>
                {" "}
                {inbox.notUnderstood}
                <ul>
                  {a.notUnderstood.map((m) => (
                    <li key={m.gmailMessageId}>
                      {m.from}, &ldquo;{m.subject}&rdquo;: {inbox.reasons[m.reason]}.{" "}
                      <ExternalLink href={gmailMessageLink(a.account, m.gmailMessageId)}>
                        {inbox.openInGmail}
                      </ExternalLink>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
    </RunBox>
  );
}

/** An hour's sending: the counts. */
function SendingRun({ run, open, bare }: { run: Sending; open?: boolean; bare?: boolean }) {
  return (
    <RunBox
      run={run}
      summary={run.status === "failed" ? null : staffCopy.sending.result(run.result)}
      open={open}
      bare={bare}
    />
  );
}

/** A night's tidying: the counts. */
function TidyingRun({ run, open, bare }: { run: Tidying; open?: boolean; bare?: boolean }) {
  return (
    <RunBox
      run={run}
      summary={run.status === "failed" ? null : staffCopy.tidying.result(run.result)}
      open={open}
      bare={bare}
    />
  );
}

/**
 * One run from the import log, as its job's page shows it; `open` says
 * whether its detail starts unfolded, and left out, its length does.
 * `bare`: in a row of a table, without the box (RunBox).
 */
export default function Run({
  run,
  decide,
  open,
  bare,
}: {
  run: AnyImportRun;
  decide?: Decide;
  open?: boolean;
  bare?: boolean;
}) {
  switch (run.job) {
    case "import-parliament":
    case "import-scottish-parliament":
    case "import-senedd":
    case "import-ni-assembly":
      return <PoliticianImportRun run={run} decide={decide} open={open} bare={bare} />;
    case "import-controlai":
      return <ControlAiRun run={run} open={open} bare={bare} />;
    case "import-controlai-statement":
      return <ControlAiStatementRun run={run} open={open} bare={bare} />;
    case "import-luma":
      return <LumaRun run={run} open={open} bare={bare} />;
    case "import-civicrm":
      return <CivicrmRun run={run} open={open} bare={bare} />;
    case "read-gmail":
      return <GmailRun run={run} open={open} bare={bare} />;
    case "send-mailings":
      return <SendingRun run={run} open={open} bare={bare} />;
    case "tidy-logs":
      return <TidyingRun run={run} open={open} bare={bare} />;
  }
}
