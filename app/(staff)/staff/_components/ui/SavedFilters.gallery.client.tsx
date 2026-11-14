"use client";

// SavedFilters' examples that keep state or log what's pressed (SavedFilters.gallery.tsx).
import FilterBar from "./FilterBar";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import StaffPage from "./StaffPage";
import { savedFiltersProps } from "./SavedFilters";

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
