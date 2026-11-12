/**
 * Login — useCookieListener
 *
 *   utils/auth.ts
 *
 * The hook that keeps a signed-in tab honest: it polls
 * `checkAndCleanExpiredTokens` on an interval and returns whether the session
 * is still valid, so a tab left open overnight notices that its token has
 * expired rather than issuing requests that will 401.
 *
 * `auth-utils.test.ts` covers the token helpers themselves; this is the hook
 * around them, and the last uncovered export in the file.
 *
 * WHAT IT ACTUALLY WATCHES
 *   Despite the name and the `cookieNames` argument, it does NOT watch those
 *   cookies. The names are read ONCE into state on mount and then only used
 *   as an effect dependency — nothing ever calls `setCookies`, so that state
 *   never changes and the effect never re-runs because of it. The interval is
 *   the only thing driving the hook, and it re-checks the SESSION rather than
 *   the named cookies. Pinned below, because the signature strongly implies
 *   otherwise.
 */

import { act, renderHook } from "@testing-library/react";
import Cookies from "js-cookie";
import { useCookieListener } from "../../../utils/auth";
import { clearAuthSession, setAuthSession } from "../../test-utils/auth";

beforeEach(() => {
  jest.useFakeTimers();
  clearAuthSession();
});

afterEach(() => {
  jest.useRealTimers();
  clearAuthSession();
});

describe("useCookieListener", () => {
  it("reports an invalid session when there are no cookies", () => {
    const { result } = renderHook(() => useCookieListener(["idToken"]));
    expect(result.current).toBe(false);
  });

  it("reports a valid session for a live token", () => {
    setAuthSession("PCHO");
    const { result } = renderHook(() => useCookieListener(["idToken"]));
    expect(result.current).toBe(true);
  });

  it("re-checks on the interval", () => {
    setAuthSession("PCHO");
    const { result } = renderHook(() => useCookieListener(["idToken"], 1000));
    expect(result.current).toBe(true);

    // Expire the session behind the hook's back, as a clock rollover would.
    Cookies.remove("idToken");
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });

  it("does not notice before the interval elapses", () => {
    setAuthSession("PCHO");
    const { result } = renderHook(() => useCookieListener(["idToken"], 5000));
    Cookies.remove("idToken");

    act(() => {
      jest.advanceTimersByTime(4999);
    });
    expect(result.current).toBe(true);
  });

  it("keeps polling, not just once", () => {
    setAuthSession("PCHO");
    const { result } = renderHook(() => useCookieListener(["idToken"], 1000));

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(true);

    Cookies.remove("idToken");
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });

  it("defaults to a five-second interval", () => {
    setAuthSession("PCHO");
    const { result } = renderHook(() => useCookieListener(["idToken"]));
    Cookies.remove("idToken");

    act(() => {
      jest.advanceTimersByTime(4999);
    });
    expect(result.current).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it("clears its interval on unmount", () => {
    const clearSpy = jest.spyOn(global, "clearInterval");
    setAuthSession("PCHO");
    const { unmount } = renderHook(() => useCookieListener(["idToken"]));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("does not keep polling after unmount", () => {
    setAuthSession("PCHO");
    const { unmount } = renderHook(() => useCookieListener(["idToken"], 1000));
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    unmount();
    // A surviving interval would still be registered with the fake clock.
    // (Advancing time on its own proves nothing: a stray interval firing on a
    // torn-down hook does not throw.)
    expect(jest.getTimerCount()).toBe(0);
    expect(() => {
      act(() => {
        jest.advanceTimersByTime(10_000);
      });
    }).not.toThrow();
  });

  it("[as-built] ignores the cookie names it is handed", () => {
    // Nothing ever calls `setCookies`, so the names are inert — the hook
    // reports on the SESSION regardless of which cookies were named.
    setAuthSession("PCHO");
    const { result } = renderHook(() => useCookieListener(["somethingElse"], 1000));
    expect(result.current).toBe(true);

    Cookies.remove("idToken");
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });

  it("[as-built] does not react to a named cookie changing", () => {
    // A cookie appearing or vanishing raises no event; only the interval
    // moves the hook.
    setAuthSession("PCHO");
    const { result } = renderHook(() => useCookieListener(["homeId"], 1000));

    act(() => {
      Cookies.remove("homeId");
    });
    expect(result.current).toBe(true);
  });

  it("accepts an empty list of names", () => {
    setAuthSession("PCHO");
    const { result } = renderHook(() => useCookieListener([]));
    expect(result.current).toBe(true);
  });

  it("[as-built] reports the session valid again once its cookies return", () => {
    // Once invalid it can flip back to valid if the cookies return, because
    // the check is re-run wholesale rather than latched.
    const { result } = renderHook(() => useCookieListener(["idToken"], 1000));
    expect(result.current).toBe(false);

    setAuthSession("PCHO");
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(true);
  });
});
