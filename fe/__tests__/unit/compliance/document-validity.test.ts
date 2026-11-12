/**
 * Document expiry and requirement helpers.
 *
 * `CheckValidityOfDocument` (utils/checkValidityOfDocument.ts) is what turns a
 * stored expiry date into the amber/red banner on every compliance document
 * card — TB tests, CPR certificates, fire alarm inspections. Getting its
 * boundaries wrong means a home is told a lapsed certificate is fine.
 *
 * Every expiry in these tests is built *relative to the local today* rather than
 * hardcoded, because the helper compares local midnights — a fixed string would
 * make the suite timezone-dependent.
 */

import { CheckValidityOfDocument } from "../../../utils/checkValidityOfDocument";
import { isDocumentRequired } from "../../../utils/documentUtils";
import {
  documentRequiredForNurse,
  documentRequiredForPCG,
  documentRequiredForSenior,
} from "../../../utils/constants";

/** A "YYYY-MM-DD" string `offsetDays` from today in the runner's own timezone. */
const localDate = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

// ─── CheckValidityOfDocument ─────────────────────────────────────────────────

describe("CheckValidityOfDocument", () => {
  describe("no expiry", () => {
    it("returns null when the expiration date is empty", () => {
      expect(CheckValidityOfDocument({ expirationDate: "" })).toBeNull();
    });

    it("returns null when the expiration date is undefined", () => {
      expect(CheckValidityOfDocument({ expirationDate: undefined as any })).toBeNull();
    });
  });

  describe("outside the alert window", () => {
    it("stays silent when the expiry is beyond the alert period", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 30, expirationDate: localDate(60) })
      ).toBeNull();
    });

    it("stays silent one day outside the window", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 30, expirationDate: localDate(31) })
      ).toBeNull();
    });

    /**
     * The alert period defaults to 0 and the guard is `remainingDays > alertPeriod`,
     * so a document with no configured alert window says nothing until the day it
     * expires — not even "expires tomorrow".
     */
    it("defaults the alert period to 0, so nothing is said before expiry day", () => {
      expect(CheckValidityOfDocument({ expirationDate: localDate(1) })).toBeNull();
      expect(CheckValidityOfDocument({ expirationDate: localDate(2) })).toBeNull();
      expect(CheckValidityOfDocument({ expirationDate: localDate(0) })).toMatchObject({
        message: "Document expires today",
      });
    });
  });

  describe("approaching expiry — amber", () => {
    it("warns on the first day inside the window", () => {
      const result = CheckValidityOfDocument({
        alertPeriodInDays: 30,
        expirationDate: localDate(30),
      });
      expect(result).toMatchObject({
        message: "Document will expire in 30 days",
        color: "text-yellow-500",
      });
    });

    it("counts down as the expiry approaches", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 30, expirationDate: localDate(7) })?.message
      ).toBe("Document will expire in 7 days");
    });

    it("switches to 'tomorrow' at one day out", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 30, expirationDate: localDate(1) })?.message
      ).toBe("Document will expire tomorrow");
    });

    it("says 'today' on the expiry date itself", () => {
      const result = CheckValidityOfDocument({
        alertPeriodInDays: 30,
        expirationDate: localDate(0),
      });
      expect(result).toMatchObject({
        message: "Document expires today",
        color: "text-yellow-500",
      });
    });

    it("keeps the day of expiry amber, not red", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 30, expirationDate: localDate(0) })?.border
      ).toBe("border-[yellow]");
    });

    it("never says 'in 2 days' at the singular boundary", () => {
      // remainingDays === 2 is the smallest value the plural branch handles.
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 30, expirationDate: localDate(2) })?.message
      ).toBe("Document will expire in 2 days");
    });
  });

  describe("lapsed — red", () => {
    it("says 'yesterday' one day after expiry", () => {
      const result = CheckValidityOfDocument({
        alertPeriodInDays: 30,
        expirationDate: localDate(-1),
      });
      expect(result).toMatchObject({
        message: "Document expired yesterday",
        color: "text-red-600",
        border: "border-red-500",
      });
    });

    it("counts the days since expiry", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 30, expirationDate: localDate(-45) })?.message
      ).toBe("Document expired 45 days ago");
    });

    it("turns red regardless of the alert period", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 0, expirationDate: localDate(-10) })?.color
      ).toBe("text-red-600");
    });

    /**
     * Pinned: the "expired N days ago" branch returns `border-red-500 ` with a
     * trailing space, while "expired yesterday" does not. Any test or style rule
     * matching the class exactly has to account for both spellings.
     */
    it("returns the red border with a trailing space on the plural branch", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 30, expirationDate: localDate(-45) })?.border
      ).toBe("border-red-500 ");
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 30, expirationDate: localDate(-1) })?.border
      ).toBe("border-red-500");
    });
  });

  describe("date formats", () => {
    it("accepts a bare YYYY-MM-DD", () => {
      expect(CheckValidityOfDocument({ expirationDate: localDate(0) })?.message).toBe(
        "Document expires today"
      );
    });

    it("accepts a full ISO datetime by taking only the date part", () => {
      expect(
        CheckValidityOfDocument({ expirationDate: `${localDate(0)}T23:59:59.999Z` })?.message
      ).toBe("Document expires today");
    });

    /**
     * Splitting on "T" and comparing local midnights is what keeps the banner
     * stable — an ISO timestamp late in the day does not roll the document into
     * "expires tomorrow" the way `new Date(iso)` arithmetic would.
     */
    it("gives the same verdict for a date and its ISO form", () => {
      const plain = CheckValidityOfDocument({ expirationDate: localDate(3), alertPeriodInDays: 30 });
      const iso = CheckValidityOfDocument({
        expirationDate: `${localDate(3)}T00:00:00.000Z`,
        alertPeriodInDays: 30,
      });
      expect(iso).toEqual(plain);
    });

    /**
     * Pinned: an unparseable date produces NaN arithmetic. `NaN > alertPeriod` is
     * false and every equality check fails, so it falls through to the final
     * branch and renders "Document expired NaN days ago" rather than throwing or
     * returning null.
     */
    it("renders 'expired NaN days ago' for an unparseable date", () => {
      expect(CheckValidityOfDocument({ expirationDate: "not-a-date" })).toMatchObject({
        message: "Document expired NaN days ago",
        color: "text-red-600",
      });
    });
  });

  describe("the alert periods the app actually configures", () => {
    // utils/constants.ts: TB Test and CPR use 30 days; PCHO's TB Test uses 7.
    it("warns 30 days out for a TB test", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 30, expirationDate: localDate(29) })?.message
      ).toBe("Document will expire in 29 days");
    });

    it("stays silent 8 days out for a 7-day alert period", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 7, expirationDate: localDate(8) })
      ).toBeNull();
    });

    it("warns 7 days out for a 7-day alert period", () => {
      expect(
        CheckValidityOfDocument({ alertPeriodInDays: 7, expirationDate: localDate(7) })?.message
      ).toBe("Document will expire in 7 days");
    });
  });
});

// ─── isDocumentRequired ──────────────────────────────────────────────────────

describe("isDocumentRequired", () => {
  it("strips the extension before matching", () => {
    expect(isDocumentRequired("tb_test.pdf", documentRequiredForPCG)).toBe(true);
    expect(isDocumentRequired("tb_test", documentRequiredForPCG)).toBe(true);
  });

  it("reports the caregiver documents that are mandatory", () => {
    expect(isDocumentRequired("tb_test.pdf", documentRequiredForPCG)).toBe(true);
    expect(isDocumentRequired("cpr_and_first_aid.pdf", documentRequiredForPCG)).toBe(true);
    expect(isDocumentRequired("background_check.pdf", documentRequiredForPCG)).toBe(true);
  });

  it("reports the caregiver documents that are optional", () => {
    expect(isDocumentRequired("dl.pdf", documentRequiredForPCG)).toBe(false);
    expect(isDocumentRequired("ssn.pdf", documentRequiredForPCG)).toBe(false);
    expect(isDocumentRequired("resume.pdf", documentRequiredForPCG)).toBe(false);
  });

  it("reports the nurse's hospice agreement as mandatory", () => {
    expect(isDocumentRequired("hospice_agreement.pdf", documentRequiredForNurse)).toBe(true);
  });

  /**
   * `false` (known but optional) and `null` (not in the list at all) are distinct
   * results, and callers have to tell them apart — a loose `!isDocumentRequired()`
   * check collapses the two.
   */
  it("returns null — not false — for a document that is not in the list", () => {
    expect(isDocumentRequired("passport.pdf", documentRequiredForPCG)).toBeNull();
  });

  it("distinguishes null from false", () => {
    expect(isDocumentRequired("dl.pdf", documentRequiredForPCG)).not.toBeNull();
    expect(isDocumentRequired("passport.pdf", documentRequiredForPCG)).not.toBe(false);
  });

  it("defaults to the senior document list", () => {
    expect(isDocumentRequired("dl.pdf")).toBe(false);
    expect(isDocumentRequired("medication_list.pdf")).toBe(false);
  });

  /**
   * Pinned: every entry currently left uncommented in `documentRequiredForSenior`
   * has `required: false`, so the default list can never answer `true`. The
   * mandatory senior documents (admission agreement, house rules, resident
   * rights…) are all commented out in utils/constants.ts.
   */
  it("can never report a senior document as required — the list has no required entries", () => {
    documentRequiredForSenior.forEach((doc) => {
      expect(isDocumentRequired(`${doc.name}.pdf`)).toBe(false);
    });
  });

  it("returns null for the commented-out senior onboarding documents", () => {
    expect(isDocumentRequired("admission_agreement.pdf")).toBeNull();
    expect(isDocumentRequired("house_rules.pdf")).toBeNull();
  });

  /**
   * Matching splits on the *first* dot, so anything after it — a version suffix,
   * a double extension — is ignored rather than breaking the match.
   */
  it("ignores everything after the first dot", () => {
    expect(isDocumentRequired("tb_test.v2.pdf", documentRequiredForPCG)).toBe(true);
    expect(isDocumentRequired("tb_test.tar.gz", documentRequiredForPCG)).toBe(true);
  });

  /**
   * Pinned: the flip side is that a document whose *name* contains a dot could
   * never be matched, because the lookup only ever sees the part before it. No
   * entry is currently named that way, so this is latent rather than live.
   */
  it("could not match an entry whose name contained a dot", () => {
    expect(isDocumentRequired("tb.test.pdf", documentRequiredForPCG)).toBeNull();
  });

  it("is case-sensitive", () => {
    expect(isDocumentRequired("TB_TEST.pdf", documentRequiredForPCG)).toBeNull();
  });

  it("returns null for an empty filename", () => {
    expect(isDocumentRequired("", documentRequiredForPCG)).toBeNull();
  });
});
