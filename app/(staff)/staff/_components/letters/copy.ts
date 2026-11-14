// The words of letters that only the staff pages show: a letter in Gmail,
// a letter's thread, and what a supporter changed in their draft, with
// those the server uses too (lib/letters/copy.ts).
import { count } from "@/lib/content/plural";
import { lettersCopy as wordsTheServerUses } from "@/lib/letters/copy";

export const lettersCopy = {
  ...wordsTheServerUses,
  // A letter in Gmail, by its page's heading: a button that copies a
  // search for it, then says to paste it, and where.
  findInGmail: {
    copy: "Copy Gmail search",
    copied: "Copied!",
    // The × that closes the note, as a screen reader names it.
    close: "Close",
    // Then, in the note under it, what to do, in bold, "paste" stressed; under that, where.
    next: { before: "Next, ", stressed: "paste", after: " into Gmail search." },
    where: (mailbox: string) => `You must be in an inbox that can see ${mailbox}'s mail.`,
    // A supporter's letter sent before policy@ was a Gmail account, when it was a Google Group.
    policyGroup: "You must be in an inbox that got policy@'s mail when it was sent, such as Joseph's.",
    // A letter of PauseAI's copied from Airtable, which kept no record of the Gmail it went from.
    whereUnknown: "You must be in an inbox that sent it. Most of these went from Joseph's.",
  },
  // One of PauseAI's letters, and the replies in its thread.
  letterThread: {
    title: "Letter and replies",
    // Folds the mail a message quotes and its footer, under its text.
    quoted: "Quoted mail and footer",
    // Folds all of an automatic reply but its first paragraph: the rest, the mail it quotes and its footer.
    autoInFull: "Automated reply in full",
    // An imported letter, whose text Airtable didn't keep.
    noText: "Text not available, as sent from Airtable.",
    // Over the text of a letter that's built from the send before it and the person's earlier letter.
    approximate:
      "Approximate: rebuilt from an earlier letter found in Joseph's personal email. This isn't what they received, but it was probably much like this.",
    // A supporter's letter whose text the site doesn't have.
    supporterNoText: "Text not available.",
    noReplies: "No replies yet.",
    unreadable: "This message couldn't be read.",
    // Over each message, as an email shows them.
    headers: { from: "From", to: "To", cc: "Cc", date: "Date", subject: "Subject" },
  },
  // A supporter's letter on its page: what they changed in the draft the campaign gave them.
  letterChanges: {
    // Toggles to the letter as the MP got it, and back.
    asSent: "Show as sent",
    showChanges: "Show changes",
    // In place of paragraphs left as they were; a click unfolds them.
    folded: (n: number) => `${count(n, "paragraph", "paragraphs")} unchanged`,
  },
};
