import { describe, expect, it } from "vitest";
import {
  filmTimes,
  frameAt,
  METRICS,
  parseArgs,
  reportHtml,
  summary,
  tableRows,
  textTable,
  weigh,
} from "./measure-page.mjs";

describe("parseArgs", () => {
  it("takes commits and addresses as versions, named or not", () => {
    const options = parseArgs(["origin/main", "fade=HEAD", "live=https://example.org/?a=b", "https://example.org"]);
    expect(options.versions).toEqual([
      { name: "origin/main", ref: "origin/main" },
      { name: "fade", ref: "HEAD" },
      { name: "live", url: "https://example.org/?a=b" },
      { name: "https://example.org", url: "https://example.org" },
    ]);
    expect(options).toMatchObject({ path: "/", runs: 5, images: "img", networks: ["slow-4g", "fast-4g"], film: true });
    expect(options.viewports).toEqual(["phone", "desktop"]);
    expect(options.http2).toBe(false);
  });

  it("takes the page, the runs, the images, the networks and whether to film", () => {
    const options = parseArgs([
      "--path",
      "/donate",
      "--runs",
      "9",
      "--images",
      ".hero img",
      "--network",
      "fast-4g",
      "--viewport",
      "phone",
      "--no-film",
      "--http2",
      "HEAD",
    ]);
    expect(options).toMatchObject({
      path: "/donate",
      runs: 9,
      images: ".hero img",
      networks: ["fast-4g"],
      film: false,
    });
    expect(options.viewports).toEqual(["phone"]);
    expect(options.http2).toBe(true);
  });

  it("refuses no versions, an unknown option, an unknown network and an unknown viewport", () => {
    expect(() => parseArgs([])).toThrow("Name the versions");
    expect(() => parseArgs(["--fast", "HEAD"])).toThrow("Unknown option --fast");
    expect(() => parseArgs(["--network", "3g", "HEAD"])).toThrow("Unknown network 3g");
    expect(() => parseArgs(["--viewport", "watch", "HEAD"])).toThrow("Unknown viewport watch");
  });
});

describe("weigh", () => {
  it("adds the requests up by kind, and those from other sites", () => {
    const kb = (count: number) => count * 1024;
    const weight = weigh(
      [
        { url: "http://localhost:3000/", kind: "Document", bytes: kb(10) },
        { url: "http://localhost:3000/a.js", kind: "Script", bytes: kb(100) },
        { url: "http://localhost:3000/a.avif", kind: "Image", bytes: kb(40) },
        { url: "http://localhost:3000/a.woff2", kind: "Font", bytes: kb(20) },
        { url: "https://example.org/embed.js", kind: "Script", bytes: kb(50) },
        { url: "https://example.org/embed", kind: "Document", bytes: kb(5) },
      ],
      "http://localhost:3000",
    );
    expect(weight).toEqual({
      requests: 6,
      kb: 225,
      kbImages: 40,
      kbScripts: 150,
      kbFonts: 20,
      kbRest: 15,
      kbElsewhere: 55,
    });
  });
});

describe("summary", () => {
  it("gives the median, with the range when the runs differ", () => {
    const runs = [{ last: 3000 }, { last: 1000 }, { last: 2000 }];
    expect(summary(runs, "last", "s")).toBe("2.00s (1.00–3.00)");
    expect(summary([{ kb: 100.2 }, { kb: 100.4 }], "kb", "")).toBe("100");
  });

  it("leaves out runs without the figure, and shows a dash when none has it", () => {
    expect(summary([{ last: null }, { last: 1500 }, {}], "last", "s")).toBe("1.50s");
    expect(summary([{ last: null }], "last", "s")).toBe("–");
  });
});

describe("the tables", () => {
  const results = [[{ fcp: 500, kb: 2000, kbImages: 900 }], [{ fcp: 400, kb: 1000, kbImages: 300 }]];

  it("have a row for each figure and a column for each version", () => {
    const rows = tableRows(["main", "HEAD"], results);
    expect(rows).toHaveLength(METRICS.length + 1);
    expect(rows[0]).toEqual(["", "main", "HEAD"]);
    expect(rows[1]).toEqual(["First paint", "0.50s", "0.40s"]);
    expect(rows.find((row) => row[0] === "  images")).toEqual(["  images", "900", "300"]);
  });

  it("line up as text", () => {
    const text = textTable("Phone, Slow 4G", tableRows(["main", "HEAD"], results)).split("\n");
    expect(text.slice(0, 5)).toEqual([
      "Phone, Slow 4G",
      "",
      "                      main   HEAD",
      "--------------------  -----  -----",
      "First paint           0.50s  0.40s",
    ]);
  });
});

describe("the filmstrip", () => {
  it("shows up to sixteen frames, in the smallest step that reaches the end", () => {
    expect(filmTimes(1400)).toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]);
    expect(filmTimes(9000)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(filmTimes(500_000)).toHaveLength(16);
    expect(filmTimes(500_000).at(-1)).toBe(80);
  });

  it("shows the last frame taken by each time", () => {
    const frames = [
      { file: "a.jpg", at: 300 },
      { file: "b.jpg", at: 900 },
    ];
    expect(frameAt(frames, 0.25)).toBeUndefined();
    expect(frameAt(frames, 0.5)?.file).toBe("a.jpg");
    expect(frameAt(frames, 2)?.file).toBe("b.jpg");
  });
});

describe("reportHtml", () => {
  it("has each section's table, and its filmstrip if it was filmed", () => {
    const html = reportHtml("/ on 4G", [
      {
        title: "Phone, Slow 4G",
        names: ["main <1>", "HEAD"],
        results: [[{ last: 1200, loaded: 3000 }], [{ last: null, loaded: 900 }]],
        films: [[{ file: "film-0/0000.jpg", at: 400 }], []],
      },
      { title: "Desktop, Slow 4G", names: ["main <1>", "HEAD"], results: [[{ last: 800 }], [{ last: 700 }]] },
    ]);
    expect(html).toContain("<title>/ on 4G</title>");
    expect(html).toContain("<h2>Phone, Slow 4G</h2>");
    expect(html).toContain("<th>main &lt;1&gt;</th>");
    expect(html).toContain("<td>1.20s</td>");
    expect(html).toContain('<tr class="part"><th>  images</th>');
    // The phone's filmstrip runs to its slowest load, and the desktop has none.
    expect(html).toContain("<th>1.25s</th>");
    expect(html.match(/<img src="film-0\/0000.jpg"/g)).toHaveLength(5);
    expect(html.match(/class="film"/g)).toHaveLength(1);
  });
});
