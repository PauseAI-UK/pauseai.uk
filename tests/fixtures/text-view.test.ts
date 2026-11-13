import { expect, it } from "vitest";
import { textView } from "./text-view";

const FROM = { name: "PauseAI UK", number: "+44 7700 900000" };

it("shows the chat with our name and number, and a template's text with its footer and button, escaped", () => {
  const html = textView(FROM, { words: "Hi Jane, <bring> a friend & a flag.", footer: "Press Stop", button: "Stop" });
  expect(html).toContain("<title>PauseAI UK</title>");
  expect(html).toContain("<strong>PauseAI UK</strong><small>+44 7700 900000</small>");
  expect(html).toContain('<p class="words">Hi Jane, &lt;bring&gt; a friend &amp; a flag.</p>');
  expect(html).toContain('<p class="footer">Press Stop</p>');
  expect(html).toContain('<div class="button">↩ Stop</div>');
  expect(html).not.toContain('class="note"');
});

it("shows words of our own alone, and a note above the text where there is one", () => {
  const html = textView(FROM, { words: "Yes, there's a lift." }, "Sent to WhatsApp for approval: march_1");
  expect(html).toContain('<p class="note">Sent to WhatsApp for approval: march_1</p>');
  expect(html).not.toContain('class="footer"');
  expect(html).not.toContain('class="button"');
});
