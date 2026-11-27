"use client";

// useRecipientChoice's example (RecipientChoice.gallery.tsx): the choice, and whose letter it picks.
import { useRecipientChoice } from "./RecipientChoice";
import { exampleCampaignDraft, exampleMps } from "./CampaignLetterWriter.examples";

/** Two MPs and a letter with a part for those who signed ControlAI's letter: the choice, then who's chosen. */
export function RecipientChoiceExample() {
  const { recipient, choice } = useRecipientChoice({
    recipients: exampleMps,
    body: exampleCampaignDraft.body,
    labels: { "controlai-letter:signed": "signed ControlAI's letter to the Prime Minister" },
  });
  return (
    <>
      {choice}
      <p>{recipient ? `Shown for ${recipient.name}` : "No one has the answers pressed"}</p>
    </>
  );
}
