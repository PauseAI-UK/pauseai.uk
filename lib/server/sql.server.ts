import "server-only";

// SQL written as a tagged template, sql`… = ${value}`: each value goes to
// the database as a parameter, never into the text, and a piece of SQL
// put in another joins it, its values with it, so a query can be built
// from conditions written apart. The $1-style numbers are given only
// when it's run (query() in db.server.ts). Still plain SQL: no ORM.

/** One piece of a statement: its text, or a value to send as a parameter. */
type Part = string | { value: unknown };

/** A piece of SQL and its values, to put in another or to run. */
export class Sql {
  constructor(readonly parts: readonly Part[]) {}
}

/** SQL with each `${value}` a parameter, and each `${sql`…`}` part of the text. */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Sql {
  return new Sql(
    strings.flatMap((text, i) => {
      if (i === values.length) return [text];
      const value = values[i];
      return [text, ...(value instanceof Sql ? value.parts : [{ value }])];
    }),
  );
}

/**
 * Text that goes into the SQL as it is: a column's name or a condition
 * written in the code, never anything typed by someone.
 */
sql.raw = (text: string): Sql => new Sql([text]);

/** The pieces, with `separator` between them. */
sql.join = (pieces: readonly Sql[], separator: string): Sql =>
  new Sql(pieces.flatMap((piece, i) => (i ? [separator, ...piece.parts] : piece.parts)));

/** True when every one of `conditions` is, each in brackets; true with none. */
sql.and = (conditions: readonly Sql[]): Sql =>
  conditions.length ? sql.join(conditions.map(bracketed), " AND ") : sql.raw("TRUE");

/** True when any of `conditions` is, each in brackets; false with none. */
sql.or = (conditions: readonly Sql[]): Sql =>
  conditions.length ? sql.join(conditions.map(bracketed), " OR ") : sql.raw("FALSE");

/** A WHERE clause of `conditions`, all of which must be true; nothing with none. */
sql.where = (conditions: readonly Sql[]): Sql => (conditions.length ? sql`WHERE ${sql.and(conditions)}` : sql.raw(""));

function bracketed(condition: Sql): Sql {
  return sql`(${condition})`;
}

/**
 * The statement's text, its values numbered $1, $2… in order, and those
 * values. A piece put in more than once sends its values once, each time
 * with the same number, so a long list used twice isn't sent twice.
 */
export function render(statement: Sql): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const numbers = new Map<Part, number>();
  const text = statement.parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (!numbers.has(part)) numbers.set(part, values.push(part.value));
      return `$${numbers.get(part)}`;
    })
    .join("");
  return { text, values };
}
