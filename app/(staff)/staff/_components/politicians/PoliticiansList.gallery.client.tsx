"use client";

// PoliticiansList's examples that log what choosing who a mailing is for does (PoliticiansList.gallery.tsx).
import { Logged, type Log } from "@/app/(tools)/gallery/_components/wiring";
import {
  emptyPoliticiansSearch,
  exampleChoosing,
  examplePasted,
  examplePoliticiansPage,
} from "./PoliticianTable.examples";
import PoliticiansList, { ChoosingHead, type ChoosingActions } from "./PoliticiansList";
import { exampleAsks } from "../asks/AsksList.examples";

/** An action that logs what it's sent as `name`, and is done. */
const logged =
  (log: Log, name: string) =>
  (...args: unknown[]) => {
    log(name)(...args);
    return Promise.resolve({ ok: true as const });
  };

/** What choosing who a mailing is for does, each logged. */
function choosingActions(log: Log): ChoosingActions {
  return {
    pick: logged(log, "pickPolitician"),
    pickFound: logged(log, "pickFound"),
    paste: logged(log, "pasteNames"),
    pickMany: logged(log, "pickMany"),
    untickAll: logged(log, "untickAll"),
  };
}

/** The politicians list, New mailing and the ticks logged. */
export function PoliticiansListExample(props: Omit<Parameters<typeof PoliticiansList>[0], "newMailing" | "actions">) {
  return (
    <Logged>
      {(log) => <PoliticiansList {...props} newMailing={logged(log, "newMailing")} actions={choosingActions(log)} />}
    </Logged>
  );
}

/** The politicians list choosing who the draft "Edinburgh thank-you" goes to: Polly ticked, of the Commons. */
export function ChoosingListExample({ pasted = false }: { pasted?: boolean }) {
  return (
    <PoliticiansListExample
      list={examplePoliticiansPage}
      search={{
        ...emptyPoliticiansSearch,
        house: "commons",
        mailing: "12",
        ...(pasted && { tab: "pasted" }),
      }}
      asks={exampleAsks}
      choosing={exampleChoosing}
      tickedHere={1}
      pasted={pasted ? examplePasted : []}
    />
  );
}

/** The strip over the list while it's choosing who a mailing is for: a new one's, or a draft's; Cancel logged. */
export function ChoosingHeadExample({ blank }: { blank: boolean }) {
  return (
    <Logged>
      {(log) => (
        <ChoosingHead choosing={{ ...exampleChoosing, blank }} cancel={logged(log, "deleteMailingDraft")}>
          <h1>Politicians</h1>
        </ChoosingHead>
      )}
    </Logged>
  );
}
