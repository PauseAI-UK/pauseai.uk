// Every word of politicians that only the staff pages show: the page of
// their blocked addresses, with those the server uses too
// (lib/politicians/copy.ts).
import { politiciansCopy as wordsTheServerUses } from "@/lib/politicians/copy";

export const politiciansCopy = {
  ...wordsTheServerUses,
  // The page of politicians' blocked addresses (/staff/politicians/addresses-to-fix), titled as the navigation
  // names it; the rest of its words are every blocked address's (staffCopy.emails).
  addressesToFix: {
    title: "Addresses to fix",
    // Under the title, what the page is.
    intro: "Politicians' bad emails: unblock them here, or correct a Lord's on their page",
  },
};
