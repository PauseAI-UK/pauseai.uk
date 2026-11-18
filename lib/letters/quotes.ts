import { NodeRange, type Node } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { findWrapping, liftTarget } from "@tiptap/pm/transform";

// Quote, in a letter editor's toolbar: it quotes or unquotes whole blocks,
// paragraphs and bullet lists, never part of a list, so a list is quoted or
// unquoted with all its bullets, wherever in it the cursor is.

/** The quotes the selection is in or takes in, outermost only, with where each starts. */
function quotesIn(doc: Node, from: number, to: number): { node: Node; pos: number }[] {
  const found: { node: Node; pos: number }[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "blockquote") return true;
    found.push({ node, pos });
    return false;
  });
  return found;
}

/** Whether the selection is in a quote, or takes one in: Quote then unquotes it. */
export function isQuoted(state: EditorState): boolean {
  const { from, to } = state.selection;
  return quotesIn(state.doc, from, to).length > 0;
}

/**
 * Takes what's selected of each quote out of it: the paragraphs and lists
 * of the quote the selection reaches, whole, leaving any before or after
 * them quoted still.
 */
function unquote(tr: Transaction, quotes: { node: Node; pos: number }[]) {
  const { from, to } = tr.selection;
  // From the last, so taking one apart leaves the positions before it as they were.
  for (const { node, pos } of quotes.reverse()) {
    const spans: [number, number][] = [];
    node.forEach((child, offset) => spans.push([pos + 1 + offset, pos + 1 + offset + child.nodeSize]));
    const reached = spans.filter(([start, end]) => start < to && end > from);
    const $start = tr.doc.resolve(reached[0][0]);
    const range = new NodeRange($start, tr.doc.resolve(reached.at(-1)![1]), $start.depth);
    tr.lift(range, liftTarget(range)!);
  }
}

/**
 * Quotes the paragraphs and lists the selection reaches; in a list, the
 * whole list, as part of one can't be quoted on its own. Nothing, where a
 * quote can't go, as around a part only some recipients get.
 */
function quote(tr: Transaction) {
  const { $from, $to } = tr.selection;
  let range = $from.blockRange($to)!;
  while (range.parent.type.name === "bulletList" || range.parent.type.name === "listItem") {
    const depth = range.depth;
    range = new NodeRange(tr.doc.resolve(range.$from.before(depth)), tr.doc.resolve(range.$to.after(depth)), depth - 1);
  }
  const wrapping = findWrapping(range, tr.doc.type.schema.nodes.blockquote);
  if (wrapping) tr.wrap(range, wrapping);
}

/** Quote, as the toolbar's button presses it: unquotes what's selected of any quote it's in or takes in, or quotes it. */
export function toggleQuote(tr: Transaction): boolean {
  const quotes = quotesIn(tr.doc, tr.selection.from, tr.selection.to);
  if (quotes.length) unquote(tr, quotes);
  else quote(tr);
  return true;
}
