// The notes' words: the notes on a supporter's or a politician's page.

export const notesCopy = {
  // The notes on a supporter's or a politician's page, and the form to add one.
  notes: {
    title: "Notes",
    none: "No notes yet.",
    // After who wrote it and when, once it's been edited.
    edited: "edited",
    // The field's name, for a screen reader.
    note: "Note",
    // When the server wouldn't change a note, as its day is up: under its field, editing, or under its Delete.
    tooLate: {
      edit: "Notes can only be edited for 24 hours.",
      delete: "Notes can only be deleted for 24 hours.",
    },
    // Under the field of a new note or an edit, when it holds nothing but spaces.
    blank: "The note is empty.",
    // At the top of the page, for what has gone since the page loaded.
    gone: {
      // The note being edited, which someone has deleted.
      note: "Someone has deleted this note.",
      // Whoever a new note is about: a supporter, erased or merged into another, or a politician, removed.
      supporter: "The note wasn't added, because the supporter's record was erased or merged.",
      politician: "The note wasn't added, because this politician was removed.",
    },
    // The button that opens the field to write one, and the one that closes it unsent.
    write: "Write a note",
    cancel: "Cancel",
    add: "Add note",
    edit: "Edit",
    save: "Save",
    delete: "Delete",
    // A note's kind, before who wrote it: on the draft, and in a politician's history.
    kind: "Note",
    // Under the field on a supporter's page: what a note about them should be.
    guidance:
      "Only write notes you'd be happy for them to read (as they can via GDPR). Avoid writing about health, beliefs or private life.",
  },
};
