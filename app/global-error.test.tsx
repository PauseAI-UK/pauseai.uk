import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import GlobalError from "./global-error";

it("is a whole document of its own, with the error page in it", () => {
  const html = renderToStaticMarkup(<GlobalError error={new Error("The layout threw")} retry={() => {}} />);
  expect(html).toMatch(/^<html lang="en"><head><\/head><body><main>/);
  expect(html).toContain("<h1>");
  expect(html).toContain("<button");
});
