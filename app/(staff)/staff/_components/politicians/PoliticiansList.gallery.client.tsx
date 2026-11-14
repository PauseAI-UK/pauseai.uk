"use client";

// PoliticiansList's examples that log what choosing who a mailing is for does (PoliticiansList.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import {
  emptyPoliticiansSearch,
  exampleChoosing,
  examplePasted,
  examplePoliticiansPage,
} from "./PoliticianTable.examples";
import PoliticiansList, { ChoosingHead, type ChoosingActions } from "./PoliticiansList";
import { exampleAsks } from "../campaigns/AsksList.examples";

/** What choosing who a mailing is for does, each logged. */
function choosingActions(log: (name: string) => (...args: unknown[]) => void): ChoosingActions {
  const logged =
    (name: string) =>
    async (...args: unknown[]) =>
      log(name)(...args);
  return {
    pick: logged("pickPolitician"),
    pickFound: logged("pickFound"),
    paste: logged("pasteNames"),
    pickMany: logged("pickMany"),
    untickAll: logged("untickAll"),
  };
}

/** The politicians list, New mailing and the ticks logged. */
export function PoliticiansListExample(props: Omit<Parameters<typeof PoliticiansList>[0], "newMailing" | "actions">) {
  return (
    <Logged>
      {(log) => (
        <PoliticiansList
          {...props}
          newMailing={log("newMailing") as (form: FormData) => Promise<void>}
          actions={choosingActions(log)}
        />
      )}
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
        ...(pasted && { tab: "pasted", pasted: examplePasted.map((one) => one.line) }),
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
        <ChoosingHead
          choosing={{ ...exampleChoosing, blank }}
          cancel={log("deleteMailingDraft") as (form: FormData) => Promise<void>}
        >
          <h1>Politicians</h1>
        </ChoosingHead>
      )}
    </Logged>
  );
}
