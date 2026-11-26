import { describe, expect, it } from "vitest";
import { moreToDo, moreToRead, moreToSend } from "./more-to-do";

describe("moreToRead", () => {
  const CALL = { searched: 0, read: 0, known: 0, unreadable: 0, left: 0 };

  it("is while finds are left and the last call searched, or read, found known or failed to read some", () => {
    expect(moreToRead({ ...CALL, left: 2, read: 1 })).toBe(true);
    // A call whose time went on searching, as the night's first can, has read none yet, and Google has answered it.
    expect(moreToRead({ ...CALL, left: 26, searched: 3 })).toBe(true);
    expect(moreToRead({ ...CALL, left: 2, known: 1 })).toBe(true);
    expect(moreToRead({ ...CALL, left: 2, unreadable: 1 })).toBe(true);
    expect(moreToRead({ ...CALL, left: 2 })).toBe(false);
    expect(moreToRead({ ...CALL, read: 3 })).toBe(false);
  });

  it("isn't when another run was going, which answers without counts", () => {
    expect(moreToRead({})).toBe(false);
  });
});

describe("moreToSend", () => {
  const RUN = { sent: 0, skipped: 0, failed: 0, left: 0 };

  it("is while letters are left and the last call sent, skipped or failed some", () => {
    expect(moreToSend({ ...RUN, left: 2, sent: 1 })).toBe(true);
    expect(moreToSend({ ...RUN, left: 2, skipped: 1 })).toBe(true);
    expect(moreToSend({ ...RUN, left: 2, failed: 1 })).toBe(true);
    expect(moreToSend({ ...RUN, left: 2 })).toBe(false);
    expect(moreToSend({ ...RUN, sent: 3 })).toBe(false);
  });

  it("is while broadcasts' copies are left too, and the last call got through some of anything", () => {
    const broadcasts = { sent: 0, skipped: 0, failed: 0, left: 500 };
    expect(moreToSend({ ...RUN, broadcasts: { ...broadcasts, sent: 500 } })).toBe(true);
    expect(moreToSend({ ...RUN, broadcasts: { ...broadcasts, skipped: 1 } })).toBe(true);
    expect(moreToSend({ ...RUN, broadcasts: { ...broadcasts, failed: 1 } })).toBe(true);
    expect(moreToSend({ ...RUN, broadcasts })).toBe(false);
    expect(moreToSend({ ...RUN, sent: 1, broadcasts })).toBe(true);
  });

  it("isn't when another run was going, which answers without counts", () => {
    expect(moreToSend({})).toBe(false);
  });
});

describe("moreToDo", () => {
  it("asks the press survey and the sending, and has every other job done in a call", () => {
    expect(moreToDo("import-press", { read: 1, left: 1 })).toBe(true);
    expect(moreToDo("send-mailings", { sent: 1, left: 1 })).toBe(true);
    expect(moreToDo("send-mailings", { sent: 1, left: 0 })).toBe(false);
    expect(moreToDo("import-luma", { read: 1, left: 1, sent: 1 })).toBe(false);
  });
});
