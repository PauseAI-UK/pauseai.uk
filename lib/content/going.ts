// Who's going to an event, as Luma puts it: "1,113 going", and the guests
// it features, "Jane, Sam and 1,111 others" (lib/going.ts).
export const goingCopy = {
  count: (count: string) => `${count} going`,
  others: (count: string, one: boolean) => (one ? `${count} other` : `${count} others`),
};
