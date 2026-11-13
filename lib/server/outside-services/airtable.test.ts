import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { AirtableRequestError, fetchPoliticians, POLITICIAN_FIELDS, POLITICIANS_FORMULA } from "./airtable";

const AIRTABLE = "https://api.airtable.com/v0/*";

function record(fields: Record<string, unknown>, id = "rec1") {
  return { id, createdTime: "2024-01-01T00:00:00.000Z", fields };
}

/** Serves `pages` in order and records each request. */
function serve(...pages: unknown[]) {
  const requests: Request[] = [];
  server.use(
    http.get(AIRTABLE, ({ request }) => {
      requests.push(request);
      return HttpResponse.json(pages[requests.length - 1] as object);
    }),
  );
  return requests;
}

describe("fetchPoliticians", () => {
  it("pages through every politician but the test records, with only the fields it needs, by name", async () => {
    const requests = serve(
      {
        records: [
          record(
            {
              "Full name or Title": "Zed MSP",
              Salutation: "Mr Zedson",
              Email: " zed@parliament.example ",
              Body: "Scottish Parliament",
              Constituency: "Zetland",
              Party: "P",
              Country: "Scotland",
              Notes: "Met once.",
              Recommended: true,
              "Important target": true,
              "Personal connection": true,
              "Signed Frontier AI Letter": true,
              "Signed DeepMind Letter": true,
              "ControlAI Signatory": true,
              "Edinburgh Conference November 2026": "Passed on request",
              "Internal Notes": "not this",
            },
            "recZ",
          ),
        ],
        offset: "next",
      },
      {
        records: [
          // A peer: no Body, no constituency, only their title.
          record({ "Full name or Title": "Lord Ann", Status: "Died" }, "recA"),
          // Someone with a constituency but no Body.
          record({ "Full name or Title": "Bea", Constituency: "Bury", Status: "Retired" }, "recB"),
          record({ "Full name or Title": "Cy", Body: "Welsh Parliament", Status: "No longer in office" }, "recC"),
          record(
            {
              "Full name or Title": "Di",
              Body: "Northern Ireland Assembly",
              "Declined DeepMind Letter": true,
              "Edinburgh Conference November 2026": "Going",
            },
            "recD",
          ),
          record(
            {
              "Full name or Title": "Ed",
              Body: "House of Commons",
              Notes: " Just notes ",
              "Edinburgh Conference November 2026": "Declined",
            },
            "recE",
          ),
          record(
            {
              "Full name or Title": "Flo",
              Body: "House of Lords",
              Recommended: true,
              "Signed Frontier AI Letter": false,
            },
            "recF",
          ),
        ],
      },
    );
    const records = await fetchPoliticians("test-token");
    expect(records.map((r) => r.politician.airtableId)).toEqual([
      "recB",
      "recC",
      "recD",
      "recE",
      "recF",
      "recA",
      "recZ",
    ]);
    const by = (id: string) => records.find((r) => r.politician.airtableId === id)!;
    expect(by("recZ")).toEqual({
      politician: {
        airtableId: "recZ",
        name: "Zed MSP",
        salutation: "Mr Zedson",
        email: "zed@parliament.example",
        status: "in_office",
        house: "scottish-parliament",
        constituency: "Zetland",
        party: "P",
        country: "scotland",
        notes: "Met once.\nRecommended",
        importantTarget: true,
        personalConnection: true,
      },
    });
    expect(by("recA")).toEqual({
      politician: {
        airtableId: "recA",
        name: "Lord Ann",
        salutation: "",
        email: null,
        status: "died",
        house: "lords",
        constituency: null,
        party: "",
        country: null,
        notes: "",
        importantTarget: false,
        personalConnection: false,
      },
    });
    expect(
      records.map((r) => [r.politician.airtableId, r.politician.house, r.politician.status, r.politician.notes]),
    ).toEqual([
      ["recB", "other", "retired", ""],
      ["recC", "senedd", "left_office", ""],
      ["recD", "ni-assembly", "in_office", ""],
      ["recE", "commons", "in_office", "Just notes"],
      ["recF", "lords", "in_office", "Recommended"],
      ["recA", "lords", "died", ""],
      ["recZ", "scottish-parliament", "in_office", "Met once.\nRecommended"],
    ]);
    const url = new URL(requests[1].url);
    expect(url.hostname).toBe("api.airtable.com");
    expect(url.pathname).toBe("/v0/appBInVvIm6opJ1Ob/tblH3ks9wqQHLpYx3");
    expect(url.searchParams.get("offset")).toBe("next");
    expect(url.searchParams.get("filterByFormula")).toBe(POLITICIANS_FORMULA);
    expect(POLITICIANS_FORMULA).toBe("NOT({Test})");
    expect(url.searchParams.getAll("fields[]")).toEqual([...POLITICIAN_FIELDS]);
    expect(requests[0].headers.get("Authorization")).toBe("Bearer test-token");
    // Answers to asks aren't read: they're kept only here.
    expect(url.searchParams.getAll("fields[]")).not.toContain("Signed Frontier AI Letter");
  });

  it("refuses a Status or Country it doesn't know, rather than guess", async () => {
    serve({ records: [record({ "Full name or Title": "X", Status: "Suspended" })] });
    await expect(fetchPoliticians("t")).rejects.toThrow('Unknown Status "Suspended" on rec1');
    serve({ records: [record({ "Full name or Title": "X", Country: "Cornwall" })] });
    await expect(fetchPoliticians("t")).rejects.toThrow('Unknown Country "Cornwall" on rec1');
  });

  it("copes with a page without records", async () => {
    serve({});
    expect(await fetchPoliticians("t")).toEqual([]);
  });

  it("throws on errors, or on endless paging", async () => {
    server.use(
      http.get(AIRTABLE, () =>
        HttpResponse.json(
          { error: { type: "UNKNOWN_FIELD_NAME", message: 'Unknown field name: "Salutation"' } },
          { status: 422 },
        ),
      ),
    );
    await expect(fetchPoliticians("t")).rejects.toThrow(AirtableRequestError);
    await expect(fetchPoliticians("t")).rejects.toThrow(
      'status 422: {"error":{"type":"UNKNOWN_FIELD_NAME","message":"Unknown field name: \\"Salutation\\""}}',
    );

    server.use(http.get(AIRTABLE, () => HttpResponse.json({ records: [], offset: "again" })));
    await expect(fetchPoliticians("t")).rejects.toThrow("exceeded 100 pages");
  });
});
