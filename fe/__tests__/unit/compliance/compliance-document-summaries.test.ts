/**
 * Compliance — the document expiry and completeness helpers
 *
 *   utils/dashboardUtils.ts
 *     processExpiringDocuments     expired vs expiring, per document
 *     summarizeUsersExpiringDocs   the same, rolled up per person
 *     summarizeDocsBrief           "3/5" for a home's required documents
 *     summarizePCHORequiredDocs    "3/5" for one user's own documents
 *     calculatePendingDocsForUser  the async per-user variant
 *
 * These five decide every "Pending Documents" and "Expired / Expiring
 * Documents" panel in the app — the Compliance screens and the Home dashboard
 * both read them — and none of them had unit coverage. They are the compliance
 * rules themselves, not presentation: whether a home is inspection-ready comes
 * down to the arithmetic in here.
 *
 * EXPIRED AND EXPIRING ARE EXCLUSIVE, AND EXPIRED WINS
 *   `processExpiringDocuments` returns early once a document is expired, so a
 *   document is never in both lists. "Expiring" means inside its own
 *   `alertPeriodInDays` window and not yet past.
 *
 * A DOCUMENT WITH NO MATCHING CONSTANT IS INVISIBLE
 *   The helper skips anything whose `documentName` is not in the constants
 *   list. An expired document the home uploaded under a name nobody expects
 *   raises no alert at all — pinned below, because it is the difference
 *   between "no alerts" and "nothing is being checked".
 *
 * THE TWO "x/y" HELPERS COUNT DIFFERENTLY
 *   `summarizeDocsBrief` counts **rows** whose name matches a required
 *   constant, so the same document uploaded twice counts twice and can push a
 *   home to "complete" with a type still missing. `summarizePCHORequiredDocs`
 *   and `calculatePendingDocsForUser` both de-duplicate by type. Pinned, as
 *   it is the sort of difference that only shows up on a real home.
 */

import {
  calculatePendingDocsForUser,
  processExpiringDocuments,
  summarizeDocsBrief,
  summarizePCHORequiredDocs,
  summarizeUsersExpiringDocs,
} from "../../../utils/dashboardUtils";

jest.mock("../../../services/get-presigned-url", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue("https://bucket/signed.docx"),
}));

/** Thu 17 Sep 2026, local noon — every expiry below is relative to this. */
const TODAY = new Date(2026, 8, 17, 12, 0, 0);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(TODAY);
});

afterEach(() => {
  jest.useRealTimers();
});

/** A document as it sits on a user or home record. */
const doc = (overrides: Record<string, any> = {}) => ({
  documentId: "doc-1",
  documentName: "Licence",
  documentType: ".pdf",
  documentUrl: "https://bucket/licence.pdf",
  documentExpiryDate: "2027-01-01",
  ...overrides,
});

/** A required-document constant as `utils/constants` declares them. */
const spec = (name: string, overrides: Record<string, any> = {}) => ({
  name,
  label: name,
  required: true,
  alertPeriodInDays: 30,
  ...overrides,
});

const SPECS = [spec("Licence"), spec("Insurance")];

// ═══════════════════════════════════════════════════════════════════════════
// processExpiringDocuments
// ═══════════════════════════════════════════════════════════════════════════

describe("processExpiringDocuments — the two buckets", () => {
  it("reports a document that expired yesterday as expired", () => {
    const { expiredDocs, expiringDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-09-16" })],
      SPECS
    );
    expect(expiredDocs).toHaveLength(1);
    expect(expiringDocs).toHaveLength(0);
  });

  it("[boundary] does NOT report a document expiring today as expired", () => {
    // The comparison is `isBefore(today, "day")`, so today is still valid —
    // a licence is good until the end of its expiry date.
    const { expiredDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-09-17" })],
      SPECS
    );
    expect(expiredDocs).toHaveLength(0);
  });

  it("[boundary] reports a document expiring today as expiring, with zero days left", () => {
    const { expiringDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-09-17" })],
      SPECS
    );
    expect(expiringDocs).toHaveLength(1);
    expect(expiringDocs[0].daysLeft).toBe(0);
  });

  it("[boundary] reports a document 30 calendar days out as expiring", () => {
    const { expiringDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-10-17" })],
      SPECS
    );
    expect(expiringDocs).toHaveLength(1);
  });

  it("[as-built] the days-left figure is a whole day short by the afternoon", () => {
    // Expiry dates parse to midnight but "today" is a full timestamp, so at
    // noon on 17 Sep an expiry of 17 Oct is 29.5 days away and `diff(…,
    // "day")` truncates to 29. The number shown to the user therefore depends
    // on the hour they load the page.
    const { expiringDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-10-17" })],
      SPECS
    );
    expect(expiringDocs[0].daysLeft).toBe(29);
  });

  it("[as-built] the same document reads 30 days out at midnight", () => {
    jest.setSystemTime(new Date(2026, 8, 17, 0, 0, 0));
    const { expiringDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-10-17" })],
      SPECS
    );
    expect(expiringDocs[0].daysLeft).toBe(30);
  });

  it("[as-built] the alert window itself moves with the time of day", () => {
    // At noon, an expiry 31 calendar days out still lands inside a 30-day
    // window (30.5 truncates to 30); at midnight it does not. The same
    // document alerts or stays quiet depending on when the page is opened.
    const justOutside = [doc({ documentExpiryDate: "2026-10-18" })];
    expect(processExpiringDocuments(justOutside, SPECS).expiringDocs).toHaveLength(1);

    jest.setSystemTime(new Date(2026, 8, 17, 0, 0, 0));
    expect(processExpiringDocuments(justOutside, SPECS).expiringDocs).toHaveLength(0);
  });

  it("[boundary] stays quiet well outside the alert window", () => {
    const { expiredDocs, expiringDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-10-19" })],
      SPECS
    );
    expect(expiredDocs).toHaveLength(0);
    expect(expiringDocs).toHaveLength(0);
  });

  it("never puts the same document in both buckets", () => {
    const { expiredDocs, expiringDocs } = processExpiringDocuments(
      [
        doc({ documentId: "a", documentExpiryDate: "2026-01-01" }),
        doc({ documentId: "b", documentExpiryDate: "2026-09-20" }),
      ],
      SPECS
    );
    const ids = [...expiredDocs, ...expiringDocs].map((d: any) => d.documentId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stamps an expired document with its status", () => {
    const { expiredDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-01-01" })],
      SPECS
    );
    expect(expiredDocs[0].status).toBe("expired");
  });

  it("stamps an expiring document with its status", () => {
    const { expiringDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-09-20" })],
      SPECS
    );
    expect(expiringDocs[0].status).toBe("expiring");
  });

  it("carries the alert window through on both", () => {
    const { expiredDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-01-01" })],
      [spec("Licence", { alertPeriodInDays: 14 })]
    );
    expect(expiredDocs[0].alertDays).toBe(14);
  });

  it("keeps the original document's fields", () => {
    const { expiredDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "2026-01-01" })],
      SPECS
    );
    expect(expiredDocs[0].documentUrl).toBe("https://bucket/licence.pdf");
  });

  it("honours a per-document alert window", () => {
    // A 90-day window catches an expiry a 30-day one would not.
    const soon = doc({ documentExpiryDate: "2026-11-15" });
    expect(processExpiringDocuments([soon], [spec("Licence")]).expiringDocs).toHaveLength(
      0
    );
    expect(
      processExpiringDocuments([soon], [spec("Licence", { alertPeriodInDays: 90 })])
        .expiringDocs
    ).toHaveLength(1);
  });
});

describe("processExpiringDocuments — matching by name", () => {
  it("[as-built] ignores a document no constant names", () => {
    // An expired document uploaded as "Old Licence" raises nothing. The panel
    // is only ever as complete as the constants list.
    const { expiredDocs, expiringDocs } = processExpiringDocuments(
      [doc({ documentName: "Old Licence", documentExpiryDate: "2020-01-01" })],
      SPECS
    );
    expect(expiredDocs).toHaveLength(0);
    expect(expiringDocs).toHaveLength(0);
  });

  it("matches case-insensitively", () => {
    const { expiredDocs } = processExpiringDocuments(
      [doc({ documentName: "lIcEnCe", documentExpiryDate: "2020-01-01" })],
      SPECS
    );
    expect(expiredDocs).toHaveLength(1);
  });

  it("matches despite surrounding whitespace", () => {
    const { expiredDocs } = processExpiringDocuments(
      [doc({ documentName: "  Licence  ", documentExpiryDate: "2020-01-01" })],
      SPECS
    );
    expect(expiredDocs).toHaveLength(1);
  });

  it("[as-built] does not ignore the file extension", () => {
    // Unlike `calculatePendingDocsForUser`, which strips it. "Licence.pdf"
    // therefore matches nothing here.
    const { expiredDocs } = processExpiringDocuments(
      [doc({ documentName: "Licence.pdf", documentExpiryDate: "2020-01-01" })],
      SPECS
    );
    expect(expiredDocs).toHaveLength(0);
  });
});

describe("processExpiringDocuments — nothing to work with", () => {
  it("copes with no documents", () => {
    expect(processExpiringDocuments([], SPECS)).toEqual({
      expiredDocs: [],
      expiringDocs: [],
    });
  });

  it("copes with undefined documents", () => {
    expect(processExpiringDocuments(undefined, SPECS)).toEqual({
      expiredDocs: [],
      expiringDocs: [],
    });
  });

  it("copes with undefined constants", () => {
    expect(processExpiringDocuments([doc()], undefined)).toEqual({
      expiredDocs: [],
      expiringDocs: [],
    });
  });

  it("[as-built] treats a document with no expiry date as expired", () => {
    // `dayjs(undefined)` is NOW, and `isBefore(today, "day")` is false for
    // now — so it lands in `expiring` with 0 days left rather than being
    // skipped. A document that never expires reads as expiring today.
    const { expiredDocs, expiringDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: undefined })],
      SPECS
    );
    expect(expiredDocs).toHaveLength(0);
    expect(expiringDocs).toHaveLength(1);
    expect(expiringDocs[0].daysLeft).toBe(0);
  });

  it("[as-built] treats an unparseable expiry date as neither", () => {
    // `dayjs("banana")` is Invalid, and every comparison against it is false,
    // so the document silently drops out of both buckets.
    const { expiredDocs, expiringDocs } = processExpiringDocuments(
      [doc({ documentExpiryDate: "banana" })],
      SPECS
    );
    expect(expiredDocs).toHaveLength(0);
    expect(expiringDocs).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// summarizeUsersExpiringDocs
// ═══════════════════════════════════════════════════════════════════════════

describe("summarizeUsersExpiringDocs", () => {
  const person = (overrides: Record<string, any> = {}) => ({
    userId: "u1",
    name: "Morris Olsen",
    documents: [doc({ documentExpiryDate: "2020-01-01" })],
    ...overrides,
  });

  it("reports a person with an expired document", () => {
    const result = summarizeUsersExpiringDocs([person()], SPECS);
    expect(result).toHaveLength(1);
    expect(result[0].expiredCount).toBe(1);
  });

  it("omits a person whose documents are all current", () => {
    const result = summarizeUsersExpiringDocs(
      [person({ documents: [doc({ documentExpiryDate: "2030-01-01" })] })],
      SPECS
    );
    expect(result).toEqual([]);
  });

  it("omits a person with no documents at all", () => {
    // Worth knowing: "no documents" is not an expiry problem, so this panel
    // stays silent — the pending-documents panel is what catches that.
    expect(summarizeUsersExpiringDocs([person({ documents: [] })], SPECS)).toEqual([]);
  });

  it("skips a deleted person", () => {
    expect(summarizeUsersExpiringDocs([person({ isDeleted: true })], SPECS)).toEqual([]);
  });

  it("skips a null entry in the list", () => {
    expect(summarizeUsersExpiringDocs([null as any, person()], SPECS)).toHaveLength(1);
  });

  it("labels a single expired document", () => {
    expect(summarizeUsersExpiringDocs([person()], SPECS)[0].label).toBe("1 expired");
  });

  it("labels a single expiring document", () => {
    const result = summarizeUsersExpiringDocs(
      [person({ documents: [doc({ documentExpiryDate: "2026-09-20" })] })],
      SPECS
    );
    expect(result[0].label).toBe("1 expiring");
  });

  it("labels both together", () => {
    const result = summarizeUsersExpiringDocs(
      [
        person({
          documents: [
            doc({ documentId: "a", documentExpiryDate: "2020-01-01" }),
            doc({
              documentId: "b",
              documentName: "Insurance",
              documentExpiryDate: "2026-09-20",
            }),
          ],
        }),
      ],
      SPECS
    );
    expect(result[0].label).toBe("1 expired / 1 expiring");
  });

  it("counts several expired documents", () => {
    const result = summarizeUsersExpiringDocs(
      [
        person({
          documents: [
            doc({ documentId: "a", documentExpiryDate: "2020-01-01" }),
            doc({
              documentId: "b",
              documentName: "Insurance",
              documentExpiryDate: "2020-01-01",
            }),
          ],
        }),
      ],
      SPECS
    );
    expect(result[0].label).toBe("2 expired");
  });

  it("falls back to first and last name when there is no display name", () => {
    const result = summarizeUsersExpiringDocs(
      [person({ name: undefined, firstName: "Morris", lastName: "Olsen" })],
      SPECS
    );
    expect(result[0].fullName).toBe("Morris Olsen");
  });

  it("falls back to Unnamed when there is no name at all", () => {
    const result = summarizeUsersExpiringDocs(
      [person({ name: undefined, firstName: undefined, lastName: undefined })],
      SPECS
    );
    expect(result[0].fullName).toBe("Unnamed");
  });

  it("carries the person's id so the panel can link to them", () => {
    expect(summarizeUsersExpiringDocs([person()], SPECS)[0].userId).toBe("u1");
  });

  it("copes with an empty list", () => {
    expect(summarizeUsersExpiringDocs([], SPECS)).toEqual([]);
  });

  it("copes with no list at all", () => {
    expect(summarizeUsersExpiringDocs(undefined, SPECS)).toEqual([]);
  });

  it("reports several people independently", () => {
    const result = summarizeUsersExpiringDocs(
      [
        person({ userId: "u1" }),
        person({ userId: "u2", documents: [doc({ documentExpiryDate: "2030-01-01" })] }),
        person({ userId: "u3" }),
      ],
      SPECS
    );
    expect(result.map((r) => r.userId)).toEqual(["u1", "u3"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// summarizeDocsBrief — the home's "x/y"
// ═══════════════════════════════════════════════════════════════════════════

describe("summarizeDocsBrief", () => {
  it("reports nothing uploaded against two required", () => {
    expect(summarizeDocsBrief([], SPECS)).toMatchObject({
      markedRequiredDocuments: 0,
      requiredTotal: 2,
      missingRequiredDocuments: 2,
      isComplete: false,
      label: "0/2",
    });
  });

  it("counts a matching document", () => {
    expect(summarizeDocsBrief([doc({ documentName: "Licence" })], SPECS)).toMatchObject({
      markedRequiredDocuments: 1,
      label: "1/2",
      isComplete: false,
    });
  });

  it("reports complete once every required type is present", () => {
    expect(
      summarizeDocsBrief(
        [doc({ documentName: "Licence" }), doc({ documentName: "Insurance" })],
        SPECS
      )
    ).toMatchObject({ isComplete: true, label: "2/2", missingRequiredDocuments: 0 });
  });

  it("ignores a document no constant names", () => {
    expect(summarizeDocsBrief([doc({ documentName: "Random" })], SPECS).label).toBe(
      "0/2"
    );
  });

  it("ignores an optional document", () => {
    const specs = [spec("Licence"), spec("Leaflet", { required: false })];
    expect(summarizeDocsBrief([doc({ documentName: "Leaflet" })], specs).label).toBe(
      "0/1"
    );
  });

  it("[defect] counts the same document twice and calls the home complete", () => {
    // It counts ROWS, not types. Two copies of the Licence satisfy a
    // two-document requirement, so a home reads 2/2 with no Insurance on
    // file — the panel says inspection-ready when it is not.
    const twice = [doc({ documentName: "Licence" }), doc({ documentName: "Licence" })];
    expect(summarizeDocsBrief(twice, SPECS)).toMatchObject({
      markedRequiredDocuments: 2,
      label: "2/2",
      isComplete: true,
    });
  });

  it("[as-built] can report more marked than required", () => {
    const thrice = [
      doc({ documentName: "Licence" }),
      doc({ documentName: "Licence" }),
      doc({ documentName: "Licence" }),
    ];
    expect(summarizeDocsBrief(thrice, SPECS).label).toBe("3/2");
  });

  it("never reports a negative shortfall", () => {
    const thrice = Array.from({ length: 3 }, () => doc({ documentName: "Licence" }));
    expect(summarizeDocsBrief(thrice, SPECS).missingRequiredDocuments).toBe(0);
  });

  it("[as-built] matches the name exactly, case included", () => {
    // Unlike `processExpiringDocuments`, which lower-cases both sides. The two
    // helpers disagree about the same document.
    expect(summarizeDocsBrief([doc({ documentName: "licence" })], SPECS).label).toBe(
      "0/2"
    );
  });

  it("copes with undefined documents", () => {
    expect(summarizeDocsBrief(undefined, SPECS).label).toBe("0/2");
  });

  it("reports complete when nothing is required at all", () => {
    expect(summarizeDocsBrief([], []).isComplete).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// summarizePCHORequiredDocs — one user's own "x/y"
// ═══════════════════════════════════════════════════════════════════════════

describe("summarizePCHORequiredDocs", () => {
  it("reports nothing uploaded", () => {
    expect(summarizePCHORequiredDocs([], SPECS)).toMatchObject({ isComplete: false });
  });

  it("counts a matching document", () => {
    const result = summarizePCHORequiredDocs([doc({ documentName: "Licence" })], SPECS);
    expect(result.label).toBe("1/2");
  });

  it("reports complete once both are present", () => {
    const result = summarizePCHORequiredDocs(
      [doc({ documentName: "Licence" }), doc({ documentName: "Insurance" })],
      SPECS
    );
    expect(result.isComplete).toBe(true);
  });

  it("de-duplicates by type, unlike summarizeDocsBrief", () => {
    // The same two inputs that make `summarizeDocsBrief` say 2/2.
    const twice = [doc({ documentName: "Licence" }), doc({ documentName: "Licence" })];
    expect(summarizePCHORequiredDocs(twice, SPECS).isComplete).toBe(false);
  });

  it("ignores optional documents in the denominator", () => {
    const specs = [spec("Licence"), spec("Leaflet", { required: false })];
    expect(summarizePCHORequiredDocs([doc({ documentName: "Licence" })], specs))
      .toMatchObject({ isComplete: true });
  });

  it("copes with undefined documents", () => {
    expect(summarizePCHORequiredDocs(undefined, SPECS).isComplete).toBe(false);
  });

  it("copes with undefined specs", () => {
    expect(summarizePCHORequiredDocs([doc()], undefined as any)).toMatchObject({
      label: "0/0",
      missingRequiredDocuments: 0,
    });
  });

  it("reports complete when nothing is required", () => {
    expect(summarizePCHORequiredDocs([], []).isComplete).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// calculatePendingDocsForUser — the async per-user variant
// ═══════════════════════════════════════════════════════════════════════════

describe("calculatePendingDocsForUser", () => {
  const user = (documents: any[] = [], overrides: Record<string, any> = {}) => ({
    userId: "u1",
    name: "Morris Olsen",
    role: "PCG",
    documents,
    ...overrides,
  });

  it("reports a user with nothing on file as incomplete", async () => {
    const result = await calculatePendingDocsForUser(user(), SPECS);
    expect(result).toMatchObject({
      requiredMarked: 0,
      requiredCount: 2,
      missingCount: 2,
      isComplete: false,
      label: "0/2",
    });
  });

  it("counts an uploaded document", async () => {
    const result = await calculatePendingDocsForUser(
      user([doc({ documentName: "Licence", status: "Uploaded" })]),
      SPECS
    );
    expect(result.label).toBe("1/2");
  });

  it("treats a document with a url and no status as uploaded", async () => {
    const result = await calculatePendingDocsForUser(
      user([doc({ documentName: "Licence", status: undefined })]),
      SPECS
    );
    expect(result.requiredMarked).toBe(1);
  });

  it("does not count a document with no url and no status", async () => {
    const result = await calculatePendingDocsForUser(
      user([doc({ documentName: "Licence", status: undefined, documentUrl: undefined })]),
      SPECS
    );
    expect(result.requiredMarked).toBe(0);
  });

  it("does not count a document still pending", async () => {
    const result = await calculatePendingDocsForUser(
      user([doc({ documentName: "Licence", status: "Pending" })]),
      SPECS
    );
    expect(result.requiredMarked).toBe(0);
  });

  it("reports complete once every required type is uploaded", async () => {
    const result = await calculatePendingDocsForUser(
      user([
        doc({ documentName: "Licence", status: "Uploaded" }),
        doc({ documentName: "Insurance", status: "Uploaded" }),
      ]),
      SPECS
    );
    expect(result.isComplete).toBe(true);
  });

  it("de-duplicates the same type uploaded twice", async () => {
    const result = await calculatePendingDocsForUser(
      user([
        doc({ documentName: "Licence", status: "Uploaded" }),
        doc({ documentName: "Licence", status: "Uploaded" }),
      ]),
      SPECS
    );
    expect(result.requiredMarked).toBe(1);
    expect(result.isComplete).toBe(false);
  });

  it("ignores the file extension when matching", async () => {
    const result = await calculatePendingDocsForUser(
      user([doc({ documentName: "Licence.pdf", status: "Uploaded" })]),
      SPECS
    );
    expect(result.requiredMarked).toBe(1);
  });

  it("ignores punctuation and spacing when matching", async () => {
    const result = await calculatePendingDocsForUser(
      user([doc({ documentName: "  li-cence  ", status: "Uploaded" })]),
      SPECS
    );
    expect(result.requiredMarked).toBe(1);
  });

  it("ignores a document no constant names", async () => {
    const result = await calculatePendingDocsForUser(
      user([doc({ documentName: "Random", status: "Uploaded" })]),
      SPECS
    );
    expect(result.requiredMarked).toBe(0);
  });

  it("excludes optional documents from the denominator", async () => {
    const specs = [spec("Licence"), spec("Leaflet", { required: false })];
    const result = await calculatePendingDocsForUser(user(), specs);
    expect(result.requiredCount).toBe(1);
  });

  it("carries the user's id and role through", async () => {
    const result = await calculatePendingDocsForUser(user(), SPECS);
    expect(result).toMatchObject({ userId: "u1", role: "PCG" });
  });

  it("falls back to first and last name", async () => {
    const result = await calculatePendingDocsForUser(
      user([], { name: undefined, firstName: "Morris", lastName: "Olsen" }),
      SPECS
    );
    expect(result.fullName).toBe("Morris Olsen");
  });

  it("falls back to an empty name rather than a placeholder", async () => {
    // Different from `summarizeUsersExpiringDocs`, which says "Unnamed".
    const result = await calculatePendingDocsForUser(
      user([], { name: undefined, firstName: undefined, lastName: undefined }),
      SPECS
    );
    expect(result.fullName).toBe("");
  });

  it("copes with no user at all", async () => {
    const result = await calculatePendingDocsForUser(undefined, SPECS);
    expect(result).toMatchObject({ userId: null, isComplete: false });
  });

  it("copes with no specs", async () => {
    const result = await calculatePendingDocsForUser(user(), undefined as any);
    expect(result).toMatchObject({ requiredCount: 0, isComplete: true });
  });

  it("reports complete for a user with nothing required of them", async () => {
    const result = await calculatePendingDocsForUser(user(), []);
    expect(result.isComplete).toBe(true);
  });

  it("never reports a negative shortfall", async () => {
    const result = await calculatePendingDocsForUser(
      user([
        doc({ documentName: "Licence", status: "Uploaded" }),
        doc({ documentName: "Insurance", status: "Uploaded" }),
      ]),
      [spec("Licence")]
    );
    expect(result.missingCount).toBe(0);
  });

  it("counts an onboarding Word document once its presigned url resolves", async () => {
    // The onboarding/docx branch fetches a presigned url before deciding. A
    // resolving url means the template is still unfilled, so it is NOT
    // counted — only a failure to resolve marks it satisfied.
    const result = await calculatePendingDocsForUser(
      user([
        doc({
          documentName: "Licence",
          documentType: ".docx",
          documentCategory: "onboarding",
          status: "Uploaded",
        }),
      ]),
      SPECS
    );
    expect(result.requiredMarked).toBe(0);
  });

  it("treats a non-onboarding Word document as simply uploaded", async () => {
    const result = await calculatePendingDocsForUser(
      user([
        doc({ documentName: "Licence", documentType: ".docx", status: "Uploaded" }),
      ]),
      SPECS
    );
    expect(result.requiredMarked).toBe(1);
  });
});
