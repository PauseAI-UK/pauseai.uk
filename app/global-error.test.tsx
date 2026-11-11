import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import GlobalError from "./global-error";

it("is Next's own error page, a whole document", () => {
  const html = renderToStaticMarkup(<GlobalError error={new Error("The page threw")} />);
  expect(html).toMatch(/^<html id="__next_error__">/);
  expect(html).toContain("This page couldn’t load");
});
