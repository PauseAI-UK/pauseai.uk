"use client";

// ChangesFilters's examples, whose saved filters are logged (ChangesFilters.gallery.tsx).
import { changesSearch } from "@/lib/staff-search";
import ChangesFilters from "./ChangesFilters";
import StaffPage from "../ui/StaffPage";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** The audit log's filters: several of who chosen, one of what left out, and how recent. */
export function ChangesFiltersExample() {
  return (
    <Logged>
      {(log) => (
        <StaffPage as="div">
          <ChangesFilters
            search={changesSearch({ actor: ["jo@pauseai.uk", "sync"], action: "!add note", when: "30" })}
            choices={{ actors: ["jo@pauseai.uk", "sync"], actions: ["add note", "edit event"] }}
            actions={{ save: log("save"), update: log("update"), rename: log("rename"), remove: log("remove") }}
          />
        </StaffPage>
      )}
    </Logged>
  );
}
