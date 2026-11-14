import { Fragment, type ReactNode } from "react";
import { Muted } from "@/components/ui/Text";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import type { FieldChange } from "@/lib/field-changes";
import CampaignName from "../CampaignName";
import { DotParts } from "../Logged";

/** A field's name, in bold before its value; one with no name in the copy, as logged, with a capital. */
export function fieldLabel(key: string): string {
  return (
    staffVocabulary.fields[key as keyof typeof staffVocabulary.fields] ??
    staffVocabulary.logged.labels[key] ??
    key[0].toUpperCase() + key.slice(1)
  );
}

/** A value as words: a house, a kind of problem, a status or a campaign by name, a mark on or off; anything else as it is. */
function Value({ name, value }: { name: string; value: unknown }) {
  if (value === null) return <Muted>{staffVocabulary.logged.empty}</Muted>;
  if (name === "house") return <>{staffVocabulary.houses[value as string] ?? String(value)}</>;
  if (name === "campaign") return <CampaignName slug={String(value)} />;
  if (typeof value === "string") return <>{value}</>;
  // A mark, on or off.
  if (typeof value === "boolean") return <>{value ? staffVocabulary.logged.on : staffVocabulary.logged.off}</>;
  return <>{JSON.stringify(value)}</>;
}

/** A logged value as words, as Value shows it, for the audit log's own fields. */
export function fieldValue(name: string, value: unknown): ReactNode {
  return <Value name={name} value={value} />;
}

/** What an edit changed: each field, before and after. */
export function FieldChanges({ changed }: { changed: Record<string, FieldChange> }) {
  return (
    <DotParts>
      {Object.entries(changed).map(([name, [before, after]]) => (
        <Fragment key={name}>
          <strong>{fieldLabel(name)}</strong> <Value name={name} value={before} /> → <Value name={name} value={after} />
        </Fragment>
      ))}
    </DotParts>
  );
}
