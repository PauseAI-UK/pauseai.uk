import { expect, it } from "vitest";
import { mailingsCopy } from "./copy";

const LEAVE_THEM_OUT = 'Press "Leave them out" to remove them.';

it("says who the mailing leaves out, and why", () => {
  const { leftOut } = mailingsCopy.mailingPages;
  expect(leftOut(21, 1, true)).toBe(
    `21 of the ticked politicians have no email address, and 1 has a blocked address. ${LEAVE_THEM_OUT}`,
  );
  expect(leftOut(1, 0)).toBe(`1 of the politicians the filter found has no email address. ${LEAVE_THEM_OUT}`);
  expect(leftOut(0, 2, true)).toBe(`2 of the ticked politicians have blocked addresses. ${LEAVE_THEM_OUT}`);
});

it("says who among those it goes to already gave an answer to its ask", () => {
  const { alreadyAnswered } = mailingsCopy.mailingPages;
  expect(alreadyAnswered(3, "Edinburgh conference", ["1 going", "2 declined"], true)).toBe(
    `3 of the ticked politicians have already given an answer about Edinburgh conference (1 going, 2 declined). ${LEAVE_THEM_OUT}`,
  );
  expect(alreadyAnswered(1, "Edinburgh conference", ["1 going"])).toContain("of the politicians the filter found has");
});
