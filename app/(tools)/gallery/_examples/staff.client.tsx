"use client";

// The staff screens' examples whose Server Actions are props: client
// components with no props, each action logged rather than sent.
import FilterBar from "@/app/(staff)/staff/_components/ui/FilterBar";
import Menu, { menuItemsClass } from "@/app/(staff)/staff/_components/ui/Menu";
import MenuSubmit from "@/app/(staff)/staff/_components/ui/MenuSubmit";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import { savedFiltersProps } from "@/app/(staff)/staff/_components/ui/SavedFilters";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DeleteTwice } from "@/app/(staff)/staff/_components/DeleteTwice";
import Notice from "@/app/(staff)/staff/_components/ui/Notice";
import { Logged } from "../_components/wiring";

/** A note, open, that its × closes, and opens again. */
export function NoticeExample() {
  const [open, setOpen] = useState(true);
  return (
    <span role="status">
      {open ? (
        <Notice close="Close" onClose={() => setOpen(false)}>
          Emailed sean@pauseai.uk and joseph@pauseai.uk to let them know sean@pauseai.uk now owns this event.
        </Notice>
      ) : (
        <Button variant="ghost" size="small" fit onClick={() => setOpen(true)}>
          Open it again
        </Button>
      )}
    </span>
  );
}

/** A delete pressed twice, logged; and one that can't be pressed. */
export function DeleteTwiceExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <DeleteTwice name="slug" value="winter-reception-dec-2026" label="Delete ask" action={log("delete")} />
          <DeleteTwice name="slug" value="frontier-ai-letter" label="Delete ask" disabled action={log("delete")} />
        </>
      )}
    </Logged>
  );
}

/** A menu holding an item that sends a form, logged. */
export function MenuSubmitExample() {
  return (
    <Logged>
      {(log) => (
        <Menu id="example-menu-submit" label="Choose">
          <form action={log("update")} className={menuItemsClass}>
            <MenuSubmit>Update for everyone</MenuSubmit>
          </form>
        </Menu>
      )}
    </Logged>
  );
}

const SAVED_ROWS = [
  {
    id: 1,
    name: "A very long saved filter name that goes on past where the chip stops",
    params: { party: "Labour" },
    createdBy: "jane.smith@example.com",
    createdAt: new Date("2026-10-28T10:00:00Z"),
    changedAt: new Date("2026-10-28T10:00:00Z"),
  },
];

const SAVED_STATES = {
  none: { values: {}, loaded: undefined },
  unsaved: { values: { party: "Labour" }, loaded: undefined },
  loaded: { values: { party: "Labour", saved: "1" }, loaded: { edited: false, gone: [] } },
  edited: { values: { party: "Green", saved: "1" }, loaded: { edited: true, gone: [] } },
  gone: { values: { party: "Labour", saved: "1" }, loaded: { edited: false, gone: ["party=Reform Group"] } },
};

/** A filter bar with saved filters, in one of its states. */
export function SavedFilterExample({ state }: { state: keyof typeof SAVED_STATES }) {
  const { values, loaded } = SAVED_STATES[state];
  return (
    <Logged>
      {(log) => (
        <StaffPage as="div">
          <FilterBar
            path="#"
            values={values}
            search={{ name: "q", label: "Name" }}
            filters={[
              {
                name: "party",
                label: "Party",
                repeat: true,
                options: ["Labour", "Green"].map((party) => ({ value: party, label: party })),
              },
            ]}
            saved={savedFiltersProps({
              list: "politicians",
              state: {
                rows: SAVED_ROWS,
                params: values,
                loaded: loaded && { ...SAVED_ROWS[0], ...loaded },
              },
              values,
              path: "/staff/politicians",
              name: "Party: Labour",
              summary: (params) => [`Party ${params.party}`],
              actions: { save: log("save"), update: log("update"), rename: log("rename"), remove: log("remove") },
            })}
          />
        </StaffPage>
      )}
    </Logged>
  );
}

/** The same, with part of the filter gone, which the bar says under itself. */
export function SavedFilterGoneExample() {
  return <SavedFilterExample state="gone" />;
}
