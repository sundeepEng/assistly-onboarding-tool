import Cookies from "js-cookie";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef } from "react";
import {
  applyAuthTokens,
  AUTH_MESSAGE_TYPE,
  GIA_NAVIGATION_RESULT,
  GIA_PAGE_CHANGED,
  GIA_READY,
  isEmbedded,
  isGiaNavigate,
  ONBOARDING_ORIGIN,
  postToPortal,
  tokensFromHash,
} from "../utils/gia/embed";
import { pathForGiaStep, screenForPath } from "../utils/gia/registry";

/**
 * A page may register window.__GIA_NAV_GUARD__ = () => true | "reason"
 * to report unsaved changes. When it does, Gia-initiated navigation asks
 * the user before leaving; cancelling keeps the current screen.
 */
declare global {
  interface Window {
    __GIA_NAV_GUARD__?: () => boolean | string;
  }
}

const NAV_TIMEOUT_MS = 8000;

const GiaEmbedBridge = () => {
  const router = useRouter();
  const embedded = useRef(false);
  const pendingNav = useRef<{ requestId: string; stepId: string } | null>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportPage = useCallback(() => {
    if (!embedded.current) return;
    // Record-scoped detail routes: /crm/[leadId], /clinical/[seniorId], etc.
    const recordId = ["leadId", "seniorId", "pcgId", "nurseId"]
      .map((k) => router.query[k])
      .find((v) => typeof v === "string");
    postToPortal({
      type: GIA_PAGE_CHANGED,
      path: router.asPath?.split("?")[0] ?? router.pathname,
      screen_id: screenForPath(router.pathname),
      tab: typeof router.query.tab === "string" ? router.query.tab : null,
      record_id: recordId ?? null,
    });
  }, [router]);

  const sendResult = useCallback(
    (result: {
      request_id: string;
      status: "ok" | "blocked" | "cancelled" | "error";
      path?: string;
      screen_id?: string | null;
      message?: string;
    }) => {
      postToPortal({ type: GIA_NAVIGATION_RESULT, ...result });
    },
    []
  );

  const finishNav = useCallback(
    (status: "ok" | "error", message?: string) => {
      const nav = pendingNav.current;
      if (!nav) return;
      pendingNav.current = null;
      if (navTimer.current) clearTimeout(navTimer.current);
      sendResult({
        request_id: nav.requestId,
        status,
        path: router.asPath?.split("?")[0],
        screen_id: screenForPath(router.pathname),
        message,
      });
      reportPage();
    },
    [router, sendResult, reportPage]
  );

  // One-time embedded-mode bootstrap: credentials from hash + auth handshake.
  useEffect(() => {
    if (!isEmbedded()) return;
    embedded.current = true;
    document.body.classList.add("gia-embedded");

    const fromHash = tokensFromHash();
    if (fromHash) {
      applyAuthTokens(fromHash);
      // Strip tokens from the URL without a navigation.
      const clean = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", clean);
      router.reload();
      return;
    }

    const onAuth = (e: MessageEvent) => {
      if (e.origin !== ONBOARDING_ORIGIN || e.source !== window.parent) return;
      if (e.data?.type !== AUTH_MESSAGE_TYPE) return;
      const hadToken = !!Cookies.get("idToken");
      applyAuthTokens(e.data);
      if (!hadToken && e.data?.idToken) router.reload();
    };
    window.addEventListener("message", onAuth);

    // Application code signals saves through this window event; the bridge
    // forwards them to the portal. A save only triggers re-evaluation — it
    // can never mark a step verified by itself.
    const onSaved = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      postToPortal({
        type: "GIA_RECORD_SAVED",
        entity: detail.entity ?? null,
        record_id: detail.record_id ?? null,
      });
    };
    window.addEventListener("assistly:record-saved", onSaved);

    postToPortal({ type: GIA_READY });
    reportPage();
    return () => {
      window.removeEventListener("message", onAuth);
      window.removeEventListener("assistly:record-saved", onSaved);
      document.body.classList.remove("gia-embedded");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report every client-side page change.
  useEffect(() => {
    if (!embedded.current) return;
    router.events.on("routeChangeComplete", reportPage);
    return () => router.events.off("routeChangeComplete", reportPage);
  }, [router, reportPage]);

  // Resolve pending Gia navigation once the route actually changes.
  useEffect(() => {
    const done = () => finishNav("ok");
    const fail = () =>
      finishNav("error", "The screen could not be opened.");
    router.events.on("routeChangeComplete", done);
    router.events.on("routeChangeError", fail);
    return () => {
      router.events.off("routeChangeComplete", done);
      router.events.off("routeChangeError", fail);
    };
  }, [router, finishNav]);

  // Gia navigation requests.
  useEffect(() => {
    if (!embedded.current) return;
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== ONBOARDING_ORIGIN || e.source !== window.parent) return;
      if (!isGiaNavigate(e.data)) return;
      const { request_id, step_id } = e.data;

      const path = pathForGiaStep(step_id);
      if (!path) {
        sendResult({
          request_id,
          status: "blocked",
          message: "Unknown or unauthorized step.",
        });
        return;
      }

      const dirty = window.__GIA_NAV_GUARD__?.();
      if (dirty) {
        const reason = typeof dirty === "string" ? dirty : "unsaved changes";
        if (!window.confirm(`You have ${reason}. Leave this page anyway?`)) {
          sendResult({ request_id, status: "cancelled" });
          return;
        }
      }

      pendingNav.current = { requestId: request_id, stepId: step_id };
      if (navTimer.current) clearTimeout(navTimer.current);
      navTimer.current = setTimeout(
        () => finishNav("error", "Navigation timed out."),
        NAV_TIMEOUT_MS
      );

      const target = `${path}?embed=1`;
      if (router.pathname === path) {
        finishNav("ok");
      } else {
        router.push(target);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router, sendResult, finishNav]);

  return null;
};

export default GiaEmbedBridge;
