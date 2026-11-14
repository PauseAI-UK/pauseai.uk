import { describe, expect, it } from "vitest";
import { type DownloadColumn } from "@/lib/staff-list";
import { supportersCopy } from "@/lib/supporters/copy";
import { blockColumns } from "./oversight/EmailBlocksTable";
import { exampleBlock, exampleComplaint, exampleGmailBlock } from "./oversight/EmailBlocksTable.examples";
import { emailCopy } from "@/lib/email/copy";

describe("each list's download values and contact cards", () => {
  const values = <Row,>(columns: DownloadColumn<Row>[], row: Row) =>
    Object.fromEntries(columns.filter((c) => c.text).map((c) => [c.key, c.text!(row)]));

  it("blocked addresses: whose, and the email that found them out, or nothing", () => {
    const columns = blockColumns(false);
    expect(values(columns, exampleBlock)).toMatchObject({
      whose: "Bouncy McTestface MP",
      sent: `${emailCopy.emails.letterTo} Bouncy McTestface MP`,
    });
    expect(values(columns, exampleComplaint).sent).toBe(emailCopy.emails.purposes["forwarded-reply"]);
    expect(values(columns, { ...exampleComplaint, politicians: exampleBlock.politicians }).whose).toBe(
      "Bouncy McTestface MP; Jane Example",
    );
    expect(values(columns, { ...exampleComplaint, supporters: [{ id: 8, name: null }] }).whose).toBe(
      supportersCopy.supporters.noName,
    );
    expect(values(columns, { ...exampleComplaint, purpose: null }).sent).toBeNull();
    // After its reason, in brackets, who told us.
    expect(values(columns, exampleBlock).reason).toBe(`${exampleBlock.reason} (${emailCopy.emails.from.postmark})`);
    expect(values(columns, exampleGmailBlock).reason).toBe(
      `${exampleGmailBlock.reason} (${emailCopy.emails.from.gmail})`,
    );
  });
});
