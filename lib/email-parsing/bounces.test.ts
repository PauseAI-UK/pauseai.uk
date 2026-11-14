import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readBounce } from "./bounces";

const fixture = (name: string) => readFileSync(join(process.cwd(), "tests/fixtures/gmail", name), "latin1");

describe("readBounce", () => {
  it("reads Gmail's own bounce: the address from its report, and the letter from the copy it carries", () => {
    expect(readBounce(fixture("gmail-hard-bounce.eml"))).toEqual({
      addresses: [
        {
          address: "gone@example.org",
          status: "5.1.1",
          reason: "550 5.1.1 The email account that you tried to reach does not exist.",
          delayed: false,
        },
      ],
      messageId: "letter-1@pauseai.uk",
    });
  });

  it("reads another server's delay, from its original recipient, and the letter from the headers it carries", () => {
    expect(readBounce(fixture("other-server-delay.eml"))).toEqual({
      addresses: [{ address: "full@example.net", status: "4.2.2", reason: "4.2.2", delayed: true }],
      messageId: "letter-2@pauseai.uk",
    });
  });

  it("falls back on X-Failed-Recipients, and on what the bounce answers", () => {
    expect(readBounce(fixture("bare-bounce.eml"))).toEqual({
      addresses: [
        { address: "a@example.com", status: "", reason: "", delayed: false },
        { address: "b@example.com", status: "", reason: "", delayed: false },
      ],
      messageId: "letter-3@pauseai.uk",
    });
    expect(readBounce("Subject: nothing\r\n\r\nNo report.")).toEqual({ addresses: [], messageId: undefined });
    // A report's block with no action is passed over; one failed with no status is still a failure.
    const report = [
      'Content-Type: multipart/report; boundary="b"',
      "",
      "--b",
      "Content-Type: message/delivery-status",
      "",
      "Final-Recipient: rfc822; quiet@example.org",
      "",
      "Final-Recipient: rfc822; failed@example.org",
      "Action: failed",
      "--b--",
    ].join("\r\n");
    expect(readBounce(report).addresses).toEqual([
      { address: "failed@example.org", status: "", reason: "", delayed: false },
    ]);
  });
});
