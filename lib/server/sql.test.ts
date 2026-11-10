import { describe, expect, it } from "vitest";
import { render, sql } from "./sql";

describe("sql", () => {
  it("sends each value as a parameter, numbered in order", () => {
    expect(render(sql`SELECT * FROM letters WHERE id = ${7} AND status = ${"sent"}`)).toEqual({
      text: "SELECT * FROM letters WHERE id = $1 AND status = $2",
      values: [7, "sent"],
    });
  });

  it("puts a piece of SQL in another, its values numbered where they land", () => {
    const status = sql`status = ${"sent"}`;
    expect(render(sql`SELECT ${1} WHERE ${status} AND id = ${2}`)).toEqual({
      text: "SELECT $1 WHERE status = $2 AND id = $3",
      values: [1, "sent", 2],
    });
  });

  it("sends a piece put in twice once, with the same number each time", () => {
    const like = sql`${"%jane%"}`;
    expect(render(sql`name ILIKE ${like} OR email ILIKE ${like} OR id = ${3}`)).toEqual({
      text: "name ILIKE $1 OR email ILIKE $1 OR id = $2",
      values: ["%jane%", 3],
    });
  });

  it("keeps text written in the code as it is", () => {
    expect(render(sql`ORDER BY ${sql.raw("n.name DESC")}`)).toEqual({ text: "ORDER BY n.name DESC", values: [] });
  });

  it("joins conditions, each in brackets: all, any, or a WHERE clause", () => {
    const one = sql`a = ${1}`;
    const two = sql`b = ${2} OR c`;
    expect(render(sql.and([one, two])).text).toBe("(a = $1) AND (b = $2 OR c)");
    expect(render(sql.or([one, two])).text).toBe("(a = $1) OR (b = $2 OR c)");
    expect(render(sql.where([one])).text).toBe("WHERE (a = $1)");
    expect(render(sql.join([one, two], ", "))).toEqual({ text: "a = $1, b = $2 OR c", values: [1, 2] });
  });

  it("is true with no conditions to all, false with none to any, and no WHERE clause at all", () => {
    expect(render(sql.and([])).text).toBe("TRUE");
    expect(render(sql.or([])).text).toBe("FALSE");
    expect(render(sql.where([])).text).toBe("");
  });
});
