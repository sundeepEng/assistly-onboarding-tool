/**
 * Optional-field helpers — utils/makeOptional.ts
 *
 * Three preprocessors that decide whether a blank field, a blank sub-form or a
 * blank table row counts as "not filled in". Every clinical and CRM schema
 * leans on them, and the incident report leans on all three at once, so their
 * exact edges determine what a half-filled regulatory form is allowed to save.
 *
 * They are easy to conflate. Stated plainly:
 *
 *   makeOptionalOnEmpty        "" → undefined, then the inner schema runs.
 *   makeOptionalOnEmptyObject  an object whose values are ALL blank → undefined.
 *                              One filled value and the whole object must be
 *                              valid.
 *   arrayOfNonEmpty            drops blank rows — but AFTER the item schema has
 *                              validated them, which is why a row with a
 *                              required field fails instead of being dropped.
 *
 * That last one is the subtle one, and the reason a blank witness row is
 * discarded while a blank notification row is rejected.
 */

import { z } from "zod";
import {
  arrayOfNonEmpty,
  makeOptionalOnEmpty,
  makeOptionalOnEmptyObject,
} from "../../../utils/makeOptional";

// ─── makeOptionalOnEmpty ─────────────────────────────────────────────────────

describe("makeOptionalOnEmpty", () => {
  const schema = makeOptionalOnEmpty(z.string().min(3));

  it("accepts an empty string by turning it into undefined", () => {
    const result = schema.safeParse("");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBeUndefined();
  });

  it("accepts undefined", () => {
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it("still applies the inner rule to a non-empty value", () => {
    expect(schema.safeParse("ab").success).toBe(false);
    expect(schema.safeParse("abc").success).toBe(true);
  });

  it("does NOT treat whitespace as empty", () => {
    // "  " is not "", so it reaches the inner schema and passes min(3) only by
    // being three characters of space. This is how blank-looking values slip
    // through a required field.
    expect(schema.safeParse("   ").success).toBe(true);
  });

  it("does not treat null as empty", () => {
    expect(schema.safeParse(null).success).toBe(false);
  });

  it("does not treat zero as empty", () => {
    const numeric = makeOptionalOnEmpty(z.number());
    expect(numeric.safeParse(0).success).toBe(true);
  });

  it("passes an email rule through unchanged", () => {
    const email = makeOptionalOnEmpty(z.string().email());
    expect(email.safeParse("").success).toBe(true);
    expect(email.safeParse("nope").success).toBe(false);
    expect(email.safeParse("a@b.com").success).toBe(true);
  });
});

// ─── makeOptionalOnEmptyObject ───────────────────────────────────────────────

describe("makeOptionalOnEmptyObject", () => {
  const inner = z.object({ name: z.string().min(1), city: z.string().optional() });
  const schema = makeOptionalOnEmptyObject(inner);

  it("collapses an empty object to undefined", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBeUndefined();
  });

  it("collapses an object whose values are all empty strings", () => {
    const result = schema.safeParse({ name: "", city: "" });
    expect(result.success && result.data).toBeUndefined();
  });

  it("collapses an object whose values are null or undefined", () => {
    expect(schema.safeParse({ name: null, city: undefined }).success).toBe(true);
  });

  it("collapses an object holding only an empty nested object", () => {
    const nested = makeOptionalOnEmptyObject(
      z.object({ inner: z.object({}).optional() })
    );
    expect(nested.safeParse({ inner: {} }).success).toBe(true);
  });

  it("validates the object once any value is filled", () => {
    // `city` alone means the object is no longer empty, so `name` is demanded.
    expect(schema.safeParse({ name: "", city: "Springfield" }).success).toBe(false);
  });

  it("accepts a properly filled object", () => {
    expect(schema.safeParse({ name: "John", city: "Springfield" }).success).toBe(true);
  });

  it("accepts undefined outright", () => {
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it("leaves an array alone rather than treating it as an object", () => {
    const arraySchema = makeOptionalOnEmptyObject(z.array(z.string()));
    expect(arraySchema.safeParse([]).success).toBe(true);
    expect(arraySchema.safeParse(["a"]).success).toBe(true);
  });

  it("does not collapse an object whose only value is false", () => {
    // `false` is not blank — a ticked-then-unticked checkbox keeps the object.
    const flags = makeOptionalOnEmptyObject(z.object({ agreed: z.boolean() }));
    const result = flags.safeParse({ agreed: false });
    expect(result.success && result.data).toEqual({ agreed: false });
  });

  it("does not collapse an object whose only value is zero", () => {
    const nums = makeOptionalOnEmptyObject(z.object({ count: z.number() }));
    const result = nums.safeParse({ count: 0 });
    expect(result.success && result.data).toEqual({ count: 0 });
  });
});

// ─── arrayOfNonEmpty ─────────────────────────────────────────────────────────

describe("arrayOfNonEmpty", () => {
  const allOptional = arrayOfNonEmpty(
    z.object({ name: z.string().optional(), phone: z.string().optional() })
  );

  it("accepts an empty array", () => {
    const result = allOptional.safeParse([]);
    expect(result.success && result.data).toEqual([]);
  });

  it("accepts undefined", () => {
    expect(allOptional.safeParse(undefined).success).toBe(true);
  });

  it("drops a row whose values are all empty strings", () => {
    const result = allOptional.safeParse([{ name: "", phone: "" }]);
    expect(result.success && result.data).toEqual([]);
  });

  it("drops a row that is an empty object", () => {
    const result = allOptional.safeParse([{}]);
    expect(result.success && result.data).toEqual([]);
  });

  it("keeps a row with any value filled", () => {
    const result = allOptional.safeParse([{ name: "Ruth", phone: "" }]);
    expect(result.success && result.data).toHaveLength(1);
  });

  it("keeps only the filled rows from a mixed table", () => {
    const result = allOptional.safeParse([
      { name: "", phone: "" },
      { name: "Ruth", phone: "" },
      { name: "", phone: "" },
      { name: "John", phone: "555" },
    ]);
    expect(result.success && result.data).toHaveLength(2);
  });

  it("validates items BEFORE dropping blanks", () => {
    // The crucial ordering. With a required field in the item schema, a blank
    // row fails validation and never reaches the filter — which is why blank
    // witness rows vanish but blank notification rows are rejected.
    const withRequired = arrayOfNonEmpty(
      z.object({ role: z.string(), name: z.string().optional() })
    );
    expect(withRequired.safeParse([{ name: "" }]).success).toBe(false);
  });

  it("keeps a row whose only value is false", () => {
    const flags = arrayOfNonEmpty(z.object({ agreed: z.boolean().optional() }));
    const result = flags.safeParse([{ agreed: false }]);
    // `false` is not blank, so the row survives the filter.
    expect(result.success && result.data).toHaveLength(1);
  });

  it("keeps a row holding a non-empty nested object", () => {
    const nested = arrayOfNonEmpty(
      z.object({ detail: z.object({ a: z.string() }).optional() })
    );
    const result = nested.safeParse([{ detail: { a: "x" } }]);
    expect(result.success && result.data).toHaveLength(1);
  });

  it("drops a row holding only an empty nested object", () => {
    const nested = arrayOfNonEmpty(
      z.object({ detail: z.object({}).optional() })
    );
    const result = nested.safeParse([{ detail: {} }]);
    expect(result.success && result.data).toEqual([]);
  });

  it("keeps a primitive item rather than inspecting it", () => {
    const strings = arrayOfNonEmpty(z.string());
    const result = strings.safeParse(["a", "b"]);
    expect(result.success && result.data).toEqual(["a", "b"]);
  });
});
