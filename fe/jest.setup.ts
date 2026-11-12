import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Environment the app reads at module scope
// ---------------------------------------------------------------------------

// services/* build URLs as `${process.env.NEXT_PUBLIC_BASE_URL}${path}`. Pin it so
// request-URL assertions are stable regardless of the developer's local .env.
process.env.NEXT_PUBLIC_BASE_URL = "https://api.test.assistly.local/dev";

// utils/constants.ts and utils/uploadToS3.ts read the S3 coordinates at module
// scope and throw "Missing bucket, region, or key" when they are absent — which
// fails the suite on any import chain that touches a constant, long before the
// test body runs. Pin harmless test values; no test asserts a real bucket URL.
process.env.NEXT_PUBLIC_AWS_REGION ??= "us-east-1";
process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME ??= "assistly-test-docs";

// Date helpers intentionally pass `undefined` as the locale to
// Intl.DateTimeFormat, which makes assertions depend on the developer machine's
// ICU (en-US gives "Fri, Sep 4"; other locales give "Fri, 4 Sept"). Default the
// locale to en-US so date assertions are stable everywhere.
const NativeDateTimeFormat = Intl.DateTimeFormat;
// @ts-expect-error — Intl.DateTimeFormat is both callable and constructible;
// the wrapper preserves both usages.
Intl.DateTimeFormat = function (locales?: unknown, options?: unknown) {
  return new NativeDateTimeFormat(
    (locales as Intl.LocalesArgument) ?? "en-US",
    options as Intl.DateTimeFormatOptions | undefined
  );
};

// ---------------------------------------------------------------------------
// next/router — `useRouter` throws outside a Next.js app, and nearly every
// screen and service hook calls it. Specs assert on `routerMock` directly.
// ---------------------------------------------------------------------------
jest.mock("next/router", () => {
  const { routerMock } = require("./__tests__/test-utils/next-router-mock");
  return {
    __esModule: true,
    useRouter: () => routerMock,
    default: routerMock,
    withRouter: (C: any) => C,
  };
});

// ---------------------------------------------------------------------------
// next/image — renders a plain <img> so alt/src assertions work in jsdom
// ---------------------------------------------------------------------------
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { priority, fill, ...rest } = props;
    return require("react").createElement("img", rest);
  },
}));

// ---------------------------------------------------------------------------
// Browser APIs jsdom does not implement but the component tree touches
// ---------------------------------------------------------------------------

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });
}

if (!(global as any).ResizeObserver) {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.scrollTo) {
  window.scrollTo = jest.fn() as any;
}

// react-query's retry/logger noise and expected `console.error` calls from the
// services under test would otherwise drown the reporter output. Individual
// tests that assert on logging re-spy locally.
const originalError = console.error;
const originalLog = console.log;
beforeAll(() => {
  // services/hcm-create-shift.ts logs every rejected create; the error itself is
  // asserted by the test that provoked it.
  jest.spyOn(console, "log").mockImplementation((...args) => {
    const first = args[0];
    if (typeof first === "string" && /^Error /.test(first)) return;
    originalLog(...args);
  });
  jest.spyOn(console, "error").mockImplementation((...args) => {
    const first = args[0];
    if (typeof first === "string" && /not wrapped in act|Warning:/.test(first)) {
      return;
    }
    // Service-layer logging is intentional; keep it out of the report.
    if (typeof first === "string" && /^Error /.test(first)) return;
    originalError(...args);
  });
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore?.();
  (console.log as jest.Mock).mockRestore?.();
});
