"use client";

import { EditorContent, Node, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import { NodeRange } from "@tiptap/pm/model";
import { Plugin, type EditorState, type Transaction } from "@tiptap/pm/state";
import { liftTarget } from "@tiptap/pm/transform";
import type { EditorView } from "@tiptap/pm/view";
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFollowScroll } from "@/components/ui/useFollowScroll";
import { LinkIcon, QuoteIcon } from "@/components/ui/EditorIcons";
import LinkBar from "@/components/ui/LinkBar";
import LinkPeek from "@/components/ui/LinkPeek";
import { isLinkKey, letterExtensions, unlinkedExtensions, withoutLinks } from "@/lib/letters/extensions";
import { isQuoted, toggleQuote } from "@/lib/letters/quotes";
import { NOT_CONDITION } from "@/lib/mailings/doc";
import { partFor, type MailingChoice } from "@/lib/mailings/fields";
import ConditionMenu from "./ConditionMenu";
import { menuClass, menuItemClass, menuItemsClass } from "../ui/Menu";
import styles from "./MailingEditor.module.css";
import { partBox } from "./PartBox";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.mailingEditor;

type Props = {
  initial: JSONContent;
  onChange: (doc: JSONContent) => void;
  /** The merge fields it offers; those some recipients lack a value for, ghosted. */
  fields: MailingChoice[];
  /** Who a part can be only for, such as those who signed an ask, each with how many it covers. */
  conditions: MailingChoice[];
  /**
   * A WhatsApp template's words: the same for everyone, so no parts only some
   * get, and WhatsApp's formatting, which has no links, as a web address
   * shows as it is.
   */
  whatsApp?: boolean;
  /**
   * Under the fields, in place of the parts a template's words can't have: a
   * text's own (BroadcastWriter), such as a second version for some.
   */
  textParts?: ReactNode;
  /** How many recipients there are, to say how many all but some is. */
  recipients?: number;
  /** The ID of the label naming it. */
  labelledBy: string;
  /** An email to one person, such as an answer to a reply: the formatting alone, with no merge fields or parts, so no sidebar. */
  plain?: boolean;
  /** Puts the cursor in it as it appears, as when it was opened to write in: at its end, or at a position in it. */
  autoFocus?: boolean | number;
};

/** Whether a field can be used: every recipient has a value for it, those without get its fallback, or it can go in a part only for those with it. */
const usable = (field: MailingChoice) => !field.lacking || Boolean(field.fallback) || Boolean(field.onlyInPart);

/** What hovering a field says: why it can't be used, while some recipients lack it; how to put it in, otherwise. */
const fieldHint = (field: MailingChoice) => (usable(field) ? copy.dragHint : copy.lacking(field.lacking!));

/**
 * A group of fields, such as a link for each campaign, as one lozenge, "Link
 * to write to their MP ▸", that opens a menu of its fields by their option,
 * the campaign; choosing one calls `choose`. Pressing it keeps the focus
 * where it was, so a letter being written keeps its cursor.
 */
function FieldMenu({
  group,
  fields,
  choose,
}: {
  group: string;
  fields: MailingChoice[];
  choose: (field: MailingChoice) => void;
}) {
  const id = `${useId().replace(/:/g, "")}-fields`;
  const menu = useRef<HTMLDivElement>(null);
  const keep = (event: React.MouseEvent) => event.preventDefault();
  return (
    <>
      <button
        type="button"
        className={`${styles.fieldLozenge} ${styles.fieldGroup}`}
        popoverTarget={id}
        title={fieldHint(fields[0])}
        onMouseDown={keep}
        style={{ anchorName: `--${id}` } as React.CSSProperties}
      >
        {group}
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        className={menuClass}
        role="menu"
        aria-label={group}
        style={{ positionAnchor: `--${id}` } as React.CSSProperties}
      >
        <p className={styles.fieldMenuTitle}>{copy.fieldGroupIn(group)}</p>
        <ul className={menuItemsClass}>
          {fields.map((field) => (
            <li key={field.id}>
              <button
                type="button"
                role="menuitem"
                className={menuItemClass}
                onMouseDown={keep}
                onClick={() => {
                  menu.current?.hidePopover();
                  choose(field);
                }}
              >
                {field.option}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** A choice's label, or its ID when it has none, as for a field no longer offered. */
function labelOf(choices: Record<string, string>, id: string): string {
  return choices[id] ?? id;
}

// A merge field: a chip in the text, filled in for each recipient. It's one
// piece, so it's deleted, copied and dragged whole and can't be half-edited.
const MergeField = Node.create<{ labels: Record<string, string> }>({
  name: "field",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,
  addOptions: () => ({ labels: {} }),
  addAttributes: () => ({
    field: {
      default: "",
      parseHTML: (element) => element.getAttribute("data-field"),
      renderHTML: (attributes) => ({ "data-field": attributes.field }),
    },
  }),
  parseHTML: () => [{ tag: "span[data-field]" }],
  renderHTML({ node, HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, class: styles.field }, labelOf(this.options.labels, node.attrs.field)];
  },
  renderText({ node }) {
    return labelOf(this.options.labels, node.attrs.field);
  },
});

/** Takes everything in the part only for some whose × is `button` out of it, for everyone. */
function forEveryone(view: EditorView, button: Element) {
  const $start = view.state.doc.resolve(view.posAtDOM(button.parentElement!.querySelector("[data-body]")!, 0));
  const range = new NodeRange($start, view.state.doc.resolve($start.end()), $start.depth);
  view.dispatch(view.state.tr.lift(range, liftTarget(range)!));
  view.focus();
}

/**
 * Puts the paragraphs, lists or quotes the selection is in, whole, in a
 * part for those `condition` picks out: a part can't be in a list or a
 * quote, so a line of one takes the whole list or quote in.
 */
function wrapInPart(tr: Transaction, condition: string): boolean {
  const { $from, $to } = tr.selection;
  const range = new NodeRange(tr.doc.resolve($from.before(1)), tr.doc.resolve($to.after(1)), 0);
  tr.wrap(range, [{ type: tr.doc.type.schema.nodes.onlyFor, attrs: { condition } }]);
  return true;
}

/**
 * Takes the paragraphs, lists or quotes of a part the selection is in out
 * of it, whole, for everyone: a line of a list or quote takes the whole
 * list or quote out, as a part holds them whole.
 */
function liftOutOfPart(tr: Transaction): boolean {
  const { $from, $to } = tr.selection;
  let depth = $from.depth;
  while ($from.node(depth).type.name !== "onlyFor") depth--;
  const range = new NodeRange(tr.doc.resolve($from.before(depth + 1)), tr.doc.resolve($to.after(depth + 1)), depth);
  tr.lift(range, liftTarget(range)!);
  return true;
}

// A part only some recipients get: paragraphs, lists or quotes in a box, with who
// it's for on the box, and an × at its top right that makes it for everyone,
// keeping its words. Enter on an empty last line takes it out of the box,
// as ProseMirror does for any such box. So does Backspace at the box's start:
// left to ProseMirror, it would join the box to one just before it, and its
// text would quietly go to that box's recipients instead.
const OnlyFor = Node.create<{ labels: Record<string, string> }>({
  name: "onlyFor",
  group: "block",
  content: "(paragraph | bulletList | blockquote)+",
  defining: true,
  addOptions: () => ({ labels: {} }),
  addProseMirrorPlugins: () => [
    new Plugin({
      props: {
        handleDOMEvents: {
          // Not to ProseMirror, which would put the cursor where it was pressed.
          mousedown: (_, event) => {
            if (!(event.target as Element).closest("[data-for-everyone]")) return false;
            event.preventDefault();
            return true;
          },
          // Enter or space on the × is the button's, to press it, not ProseMirror's.
          keydown: (_, event) => Boolean((event.target as Element).closest("[data-for-everyone]")),
          // A press, or Enter or space on it.
          click: (view, event) => {
            const button = (event.target as Element).closest("[data-for-everyone]");
            if (!button) return false;
            forEveryone(view, button);
            return true;
          },
        },
      },
    }),
  ],
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        const box = $from.depth - 1;
        if (!empty || $from.parentOffset > 0 || $from.node(box).type.name !== this.name || $from.index(box) > 0)
          return false;
        return editor.commands.lift(this.name);
      },
    };
  },
  addAttributes: () => ({
    condition: {
      default: "",
      parseHTML: (element) => element.getAttribute("data-condition"),
      renderHTML: (attributes) => ({ "data-condition": attributes.condition }),
    },
  }),
  parseHTML: () => [{ tag: "div[data-condition]", contentElement: "div[data-body]" }],
  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      {
        ...HTMLAttributes,
        class: partBox.box,
        "data-except": node.attrs.condition.startsWith(NOT_CONDITION) ? "" : undefined,
        "data-closable": "",
      },
      ["div", { class: partBox.label, contenteditable: "false" }, partFor(node.attrs.condition, this.options.labels)],
      [
        "button",
        {
          type: "button",
          class: partBox.close,
          contenteditable: "false",
          "data-for-everyone": "",
          "aria-label": copy.forEveryone,
          title: copy.forEveryone,
        },
        "×",
      ],
      ["div", { class: partBox.body, "data-body": "" }, 0],
    ];
  },
});

/**
 * Bold, italic, links, bullets and quotes, and in a part for only some, the
 * button that makes it for everyone. Link opens the link bar under it, or
 * closes it; with no `onLink`, as in WhatsApp, there's no Link.
 */
/** Which formatting the cursor or selection has, each orange in the toolbar. */
function useActive(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      link: editor.isActive("link"),
      bulletList: editor.isActive("bulletList"),
      blockquote: isQuoted(editor.state),
      onlyFor: editor.isActive("onlyFor"),
      except: String(editor.getAttributes("onlyFor").condition ?? "").startsWith(NOT_CONDITION),
    }),
  });
}

/**
 * The toolbar's buttons: each one's name, what it shows, whether it's
 * pressed (orange) and what pressing it does. Only those (Except those, in a part all
 * but some get) shows only in such a part, always pressed, and pressing it
 * takes the part out of its box.
 */
function formats(editor: Editor, active: ReturnType<typeof useActive>, onLink?: () => void) {
  const toggleQuoted = () =>
    editor
      .chain()
      .focus()
      .command(({ tr }) => toggleQuote(tr))
      .run();
  const forEveryone = () =>
    editor
      .chain()
      .focus()
      .command(({ tr }) => liftOutOfPart(tr))
      .run();
  return [
    {
      title: copy.bold,
      label: <strong>B</strong>,
      pressed: active.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      title: copy.italic,
      label: <em>i</em>,
      pressed: active.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    ...(onLink
      ? [
          {
            title: copy.link,
            label: (
              <>
                <LinkIcon />
                {copy.linkLabel}
              </>
            ),
            pressed: active.link,
            run: onLink,
          },
        ]
      : []),
    {
      title: copy.bulletList,
      label: "• List",
      pressed: active.bulletList,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      title: copy.quote,
      label: (
        <>
          <QuoteIcon />
          {copy.quote}
        </>
      ),
      pressed: active.blockquote,
      run: toggleQuoted,
    },
    ...(active.onlyFor
      ? [
          {
            title: copy.forEveryone,
            label: active.except ? copy.exceptThose : copy.onlyThose,
            pressed: true,
            run: forEveryone,
          },
        ]
      : []),
  ];
}

/**
 * Bold, italic, links, bullets and quotes, and in a part for only some,
 * Only those, which makes it for everyone. Link opens the link bar under
 * it, or closes it; with no `onLink`, as in WhatsApp, there's no Link.
 */
function Toolbar({ editor, onLink }: { editor: Editor; onLink?: () => void }) {
  const active = useActive(editor);
  return (
    <div className={styles.toolbar} role="toolbar" aria-label={copy.formatting}>
      {formats(editor, active, onLink).map((mark) => (
        <button
          key={mark.title}
          type="button"
          title={mark.title}
          aria-label={mark.title}
          aria-pressed={mark.pressed}
          onClick={mark.run}
        >
          {mark.label}
        </button>
      ))}
    </div>
  );
}

/** Whether the selection takes in a whole line or more. */
function hasWholeLine(state: EditorState): boolean {
  const { from, to } = state.selection;
  let whole = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock && node.content.size > 0 && from <= pos + 1 && pos + 1 + node.content.size <= to) whole = true;
    return !whole;
  });
  return whole;
}

/**
 * Under a whole line or more selected in a part for only some: Remove only
 * those (or except those), which takes the lines out of the part, as the
 * toolbar's Only those does. Less than a line selected, it doesn't show, as
 * it takes whole lines out. It's in the page's top layer, hung from the
 * selection's end, and follows it as the page scrolls.
 */
function SelectionMenu({ editor }: { editor: Editor }) {
  const at = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor.isFocused && editor.isActive("onlyFor") && hasWholeLine(editor.state) ? editor.state.selection.to : null,
  });
  const except = useEditorState({
    editor,
    selector: ({ editor }) => String(editor.getAttributes("onlyFor").condition ?? "").startsWith(NOT_CONDITION),
  });
  useFollowScroll(at !== null);
  // Placed once it's drawn: under the selection's end, kept inside the window at its right.
  const box = useRef<HTMLDivElement>(null);
  const open = useCallback((menu: HTMLDivElement | null) => {
    box.current = menu;
    menu?.showPopover();
  }, []);
  useLayoutEffect(() => {
    if (at === null) return;
    const menu = box.current!;
    const end = editor.view.coordsAtPos(at);
    menu.style.top = `${end.bottom}px`;
    menu.style.left = `${Math.max(0, Math.min(end.left, document.documentElement.clientWidth - menu.offsetWidth))}px`;
  });
  if (at === null) return null;
  return (
    <div ref={open} popover="manual" role="menu" className={styles.selectionMenu}>
      <button
        type="button"
        role="menuitem"
        // So the letter keeps its selection.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() =>
          editor
            .chain()
            .focus()
            .command(({ tr }) => liftOutOfPart(tr))
            .run()
        }
      >
        {except ? copy.remove.except : copy.remove.onlyFor}
      </button>
    </div>
  );
}

/**
 * Beside the letter: the merge fields as lozenges, to click or drag in,
 * those some recipients lack a value for ghosted, saying how many; then the
 * menus of who a part can be only for, or for all but.
 */
function Sidebar({
  editor,
  fields,
  conditions,
  noParts,
  textParts,
  recipients,
}: {
  editor: Editor;
  fields: MailingChoice[];
  conditions: MailingChoice[];
  noParts?: boolean;
  textParts?: ReactNode;
  recipients?: number;
}) {
  const inBox = useEditorState({ editor, selector: ({ editor }) => editor.isActive("onlyFor") });
  const insert = (field: MailingChoice) =>
    usable(field) &&
    editor
      .chain()
      .focus()
      .insertContent({ type: "field", attrs: { field: field.id } })
      .run();
  // Fields in a group, such as a link for each campaign, are one lozenge, whose menu picks which.
  const groups = [...new Set(fields.flatMap((field) => field.group ?? []))];
  return (
    <div className={styles.sidebar}>
      <p className={styles.sideHeading}>{copy.fieldsHeading}</p>
      <ul className={styles.lozenges}>
        {fields
          .filter((field) => !field.group)
          .map((field) => (
            <li key={field.id}>
              {/* Not a <button>, which Firefox won't drag: a button's role, focus and keys. */}
              <span
                role="button"
                tabIndex={0}
                className={styles.fieldLozenge}
                aria-disabled={!usable(field) || undefined}
                title={fieldHint(field)}
                draggable={usable(field)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "copy";
                  event.dataTransfer.setData("text/html", `<span data-field="${field.id}">${field.label}</span>`);
                  event.dataTransfer.setData("text/plain", field.label);
                }}
                onClick={() => insert(field)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  insert(field);
                }}
              >
                {field.label}
              </span>
            </li>
          ))}
        {groups.map((group) => (
          <li key={group}>
            <FieldMenu
              group={group}
              fields={fields.filter((field) => field.group === group)}
              choose={(field) => insert(field)}
            />
          </li>
        ))}
      </ul>
      {(!noParts || textParts) && <p className={styles.sideHeading}>{copy.partsHeading}</p>}
      {noParts ? (
        textParts
      ) : conditions.length === 0 ? (
        <p className={styles.sideNote}>{copy.noConditions}</p>
      ) : (
        <div className={styles.partMenus}>
          {([false, true] as const).map((not) => (
            <ConditionMenu
              key={String(not)}
              not={not}
              conditions={conditions}
              recipients={recipients}
              choose={(condition) =>
                inBox
                  ? editor.chain().focus().updateAttributes("onlyFor", { condition }).run()
                  : editor
                      .chain()
                      .focus()
                      .command(({ tr }) => wrapInPart(tr, condition))
                      .run()
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A mailing's letter, or a broadcast's (BroadcastWriter): bold, italic, links (none in WhatsApp), bullets and quotes as in a supporter's letter,
 * merge fields as chips, and parts in a box that only some recipients get,
 * with the fields and who a part can be for beside it. Typing { offers the
 * fields every recipient has at the cursor.
 */
export default function MailingEditor({
  initial,
  onChange,
  fields,
  conditions,
  whatsApp,
  textParts,
  recipients,
  labelledBy,
  plain = false,
  autoFocus = false,
}: Props) {
  const frame = useRef<HTMLDivElement>(null);
  // Where the { was typed, and where to show the menu of fields.
  const [picker, setPicker] = useState<{ from: number; to: number; top: number; left: number }>();
  const [linking, setLinking] = useState(false);
  const extensions = useMemo(
    () => [
      ...(whatsApp ? unlinkedExtensions : letterExtensions),
      MergeField.configure({ labels: Object.fromEntries(fields.map((field) => [field.id, field.label])) }),
      OnlyFor.configure({ labels: Object.fromEntries(conditions.map((condition) => [condition.id, condition.label])) }),
    ],
    [fields, conditions, whatsApp],
  );
  const editor = useEditor({
    extensions,
    content: whatsApp ? withoutLinks(initial) : initial,
    autofocus: autoFocus === true ? "end" : autoFocus,
    // Rendered on the server too, where there's no editor yet.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        class: whatsApp ? `${styles.editor} ${styles.short}` : styles.editor,
      },
      handleKeyDown: (_, event) => {
        if (whatsApp || !isLinkKey(event)) return false;
        setLinking(true);
        return true;
      },
      handleTextInput: (view, from, to, text) => {
        if (text !== "{" || !fields.some(usable)) return false;
        const at = view.coordsAtPos(from);
        const box = frame.current!.getBoundingClientRect();
        setPicker({ from, to, top: at.bottom - box.top, left: at.left - box.left });
        return true;
      },
    },
    // As plain JSON: ProseMirror's attributes are objects with no prototype,
    // which a Server Action's arguments leave out.
    onUpdate: ({ editor }) => onChange(JSON.parse(JSON.stringify(editor.getJSON()))),
  });

  function close() {
    setPicker(undefined);
    editor!.commands.focus();
  }

  return (
    <div className={styles.layout}>
      <div className={styles.editorFrame} ref={frame}>
        {editor && (
          <Toolbar
            editor={editor}
            onLink={
              whatsApp
                ? undefined
                : () => {
                    // Shut, the cursor goes back to the letter, as the bar's own Cancel does.
                    if (linking) editor.commands.focus();
                    setLinking(!linking);
                  }
            }
          />
        )}
        {editor && linking && <LinkBar editor={editor} words={copy.linkBar} onClose={() => setLinking(false)} />}
        {editor && !linking && !whatsApp && (
          <LinkPeek editor={editor} words={copy.linkBar} onEdit={() => setLinking(true)} />
        )}
        <EditorContent editor={editor} />
        {editor && <SelectionMenu editor={editor} />}
        {picker && (
          <div
            className={styles.picker}
            role="menu"
            aria-label={copy.pickField}
            style={{ top: picker.top, left: picker.left }}
            onKeyDown={(event) => {
              if (event.key === "Escape") return close();
              const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
              if (!step) return;
              event.preventDefault();
              const items = [...event.currentTarget.querySelectorAll("button")];
              const at = items.indexOf(document.activeElement as HTMLButtonElement);
              items[(at + step + items.length) % items.length].focus();
            }}
          >
            {fields.filter(usable).map((field, i) => (
              <button
                key={field.id}
                type="button"
                role="menuitem"
                autoFocus={i === 0}
                onClick={() => {
                  editor!
                    .chain()
                    .insertContentAt(
                      { from: picker.from, to: picker.to },
                      { type: "field", attrs: { field: field.id } },
                    )
                    .run();
                  close();
                }}
              >
                {field.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {editor && !plain && (
        <Sidebar
          editor={editor}
          fields={fields}
          conditions={conditions}
          noParts={whatsApp}
          textParts={textParts}
          recipients={recipients}
        />
      )}
    </div>
  );
}
