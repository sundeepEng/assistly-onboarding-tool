/**
 * Login / password schemas — model/crm/user.model.ts
 *
 * These schemas are the only client-side gate before credentials leave the
 * browser, and their messages are asserted verbatim by the Cypress login suite.
 * Pinning them here means a schema edit fails fast in `jest` instead of showing
 * up as a mysterious E2E failure.
 */

import {
  activateAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  resetSchema,
  updatePasswordSchema,
} from "../../../model/crm/user.model";

/** First error message reported for `path`, or undefined if the field passed. */
const errorFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

const VALID_PASSWORD = "ValidPass@123";

describe("loginSchema", () => {
  describe("accepts valid credentials", () => {
    it("passes for a well-formed email and a complex password", () => {
      const result = loginSchema.safeParse({
        email: "testuser@assistly.com",
        password: VALID_PASSWORD,
      });
      expect(result.success).toBe(true);
    });

    it.each([
      ["plus addressing", "user+tag@assistly.com"],
      ["subdomain", "user@mail.assistly.co.uk"],
      ["dots and dashes", "first.last-name@assistly-care.com"],
    ])("accepts %s", (_label, email) => {
      expect(loginSchema.safeParse({ email, password: VALID_PASSWORD }).success).toBe(
        true
      );
    });

    it.each([
      ["@ special char", "Password@1"],
      ["# special char", "Password#1"],
      ["% special char", "Password%1"],
      ["! special char", "Password!1"],
      ["$ special char", "Password$1"],
      ["* special char", "Password*1"],
      ["? special char", "Password?1"],
      ["& special char", "Password&1"],
    ])("accepts a password using the %s", (_label, password) => {
      expect(
        loginSchema.safeParse({ email: "a@b.com", password }).success
      ).toBe(true);
    });
  });

  describe("email validation", () => {
    it("reports 'Email is required' for an empty string", () => {
      const result = loginSchema.safeParse({ email: "", password: VALID_PASSWORD });
      expect(errorFor(result, "email")).toBe("Email is required");
    });

    it.each([
      "plainaddress",
      "missing-at.assistly.com",
      "@no-local.com",
      "no-domain@",
      "spaces in@email.com",
      "double@@at.com",
    ])("rejects the malformed email %p", (email) => {
      const result = loginSchema.safeParse({ email, password: VALID_PASSWORD });
      expect(errorFor(result, "email")).toBe("Please enter a valid email address");
    });

    it("rejects an email with surrounding whitespace — trimming happens after validation", () => {
      const result = loginSchema.safeParse({
        email: "  testuser@assistly.com  ",
        password: VALID_PASSWORD,
      });
      expect(errorFor(result, "email")).toBe("Please enter a valid email address");
    });

    it("reports the generic type error when the field was never touched", () => {
      // The login form declares no defaultValues, so an untouched input submits
      // as `undefined` and zod's own "Required" surfaces instead of the custom
      // message. The Cypress suite asserts this exact string.
      const result = loginSchema.safeParse({ password: VALID_PASSWORD });
      expect(errorFor(result, "email")).toBe("Required");
    });
  });

  describe("password validation", () => {
    it("reports the length message for an empty password", () => {
      // `.min(8)` is chained before `.nonempty()`, so "Password is required!" is
      // unreachable for an empty string — the length message wins.
      const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
      expect(errorFor(result, "password")).toBe(
        "Password must be at least 8 characters"
      );
    });

    it("rejects a password shorter than 8 characters", () => {
      const result = loginSchema.safeParse({ email: "a@b.com", password: "Pa@1" });
      expect(errorFor(result, "password")).toBe(
        "Password must be at least 8 characters"
      );
    });

    const complexityMessage =
      "Password should be of minimum length 8 characters with atleast one uppercase, one lowercase, one number, one special character";

    it.each([
      ["no uppercase", "password@123"],
      ["no lowercase", "PASSWORD@123"],
      ["no number", "Password@abc"],
      ["no special character", "Password1234"],
      ["an unsupported special character", "Password^123"],
    ])("rejects a password with %s", (_label, password) => {
      const result = loginSchema.safeParse({ email: "a@b.com", password });
      expect(errorFor(result, "password")).toBe(complexityMessage);
    });

    it("reports the generic type error when the field was never touched", () => {
      const result = loginSchema.safeParse({ email: "a@b.com" });
      expect(errorFor(result, "password")).toBe("Required");
    });
  });

  describe("strictness", () => {
    it("rejects extra keys — the sign-in payload must be exactly email + password", () => {
      const result = loginSchema.safeParse({
        email: "a@b.com",
        password: VALID_PASSWORD,
        rememberMe: true,
      });
      expect(result.success).toBe(false);
    });

    it("flags both fields at once when both are invalid", () => {
      const result = loginSchema.safeParse({ email: "nope", password: "short" });
      expect(errorFor(result, "email")).toBeDefined();
      expect(errorFor(result, "password")).toBeDefined();
    });
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  it("reports 'Invalid Email' for a malformed address", () => {
    const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });
    expect(errorFor(result, "email")).toBe("Invalid Email");
  });

  it("rejects an empty email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });

  it("rejects extra keys", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "a@b.com", otp: "123456" }).success
    ).toBe(false);
  });
});

describe("resetSchema", () => {
  it("accepts two complex passwords", () => {
    const result = resetSchema.safeParse({
      newPassword: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    expect(result.success).toBe(true);
  });

  it("does NOT itself require the two passwords to match", () => {
    // Equality is enforced by the OTP screen's handler, not the schema. If this
    // ever moves into the schema, the component check becomes dead code.
    const result = resetSchema.safeParse({
      newPassword: VALID_PASSWORD,
      confirmPassword: "Different@123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a weak new password with the complexity message", () => {
    const result = resetSchema.safeParse({
      newPassword: "alllowercase1",
      confirmPassword: VALID_PASSWORD,
    });
    expect(errorFor(result, "newPassword")).toBe(
      "Password must have uppercase, lowercase, number, and special character."
    );
  });

  it("rejects a short new password with the length message", () => {
    const result = resetSchema.safeParse({
      newPassword: "Ab@1",
      confirmPassword: VALID_PASSWORD,
    });
    expect(errorFor(result, "newPassword")).toBe(
      "Password should be at least 8 characters."
    );
  });
});

describe("updatePasswordSchema", () => {
  const valid = {
    oldPassword: "OldPass@123",
    newPassword: "NewPass@123",
    reEnterNewPassword: "NewPass@123",
  };

  it("accepts a matching new password pair", () => {
    expect(updatePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("reports the mismatch on reEnterNewPassword", () => {
    const result = updatePasswordSchema.safeParse({
      ...valid,
      reEnterNewPassword: "Mismatch@123",
    });
    expect(errorFor(result, "reEnterNewPassword")).toBe("Passwords do not match.");
  });

  it("requires the old password", () => {
    const result = updatePasswordSchema.safeParse({ ...valid, oldPassword: "" });
    expect(errorFor(result, "oldPassword")).toBe(
      "Old password must be at least 8 characters."
    );
  });
});

describe("activateAccountSchema", () => {
  const valid = {
    email: "newuser@assistly.com",
    password: "Activate@123",
    confirmPassword: "Activate@123",
  };

  it("accepts a valid activation payload", () => {
    expect(activateAccountSchema.safeParse(valid).success).toBe(true);
  });

  it("reports the mismatch on confirmPassword", () => {
    const result = activateAccountSchema.safeParse({
      ...valid,
      confirmPassword: "Other@1234",
    });
    expect(errorFor(result, "confirmPassword")).toBe("Passwords do not match.");
  });

  it("rejects a malformed email", () => {
    const result = activateAccountSchema.safeParse({ ...valid, email: "bad" });
    expect(errorFor(result, "email")).toBe("Email has invalid format");
  });

  it("rejects extra keys — the activation token travels outside the form", () => {
    expect(
      activateAccountSchema.safeParse({ ...valid, token: "abc" }).success
    ).toBe(false);
  });
});
