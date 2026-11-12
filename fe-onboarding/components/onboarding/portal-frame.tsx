import { useEffect, useMemo, useRef } from "react";
import Cookies from "js-cookie";
import { ACCESS_TOKEN, ID_TOKEN, USER_ID } from "../../utils/constants";
import { useOnboarding } from "./onboarding-provider";

const DASHBOARD_ORIGIN =
  process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN || "http://localhost:3001";
const DASHBOARD_PATH =
  process.env.NEXT_PUBLIC_DASHBOARD_PATH || "/crm";
const AUTH_MESSAGE_TYPE = "ASSISTLY_AUTH";

// Width of the dashboard's own side nav. The iframe is rendered wider than the
// container and shifted left, so the nav is clipped out of view. The dashboard
// also hides its sidebar itself while embedded — this is belt-and-braces.
const DASHBOARD_SIDEBAR_WIDTH = 240;

const PortalFrame = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { registerIframe } = useOnboarding();

  // Tokens are passed via the URL hash so the embedded app can read them
  // without them ever hitting its server logs, and also via postMessage
  // for apps that prefer a listener-based handshake.
  const src = useMemo(() => {
    const base = `${DASHBOARD_ORIGIN}${DASHBOARD_PATH}`;
    if (typeof window === "undefined") return base;
    const params = new URLSearchParams();
    const idToken = Cookies.get(ID_TOKEN);
    const accessToken = Cookies.get(ACCESS_TOKEN);
    const userId = Cookies.get(USER_ID);
    if (idToken) params.set("idToken", idToken);
    if (accessToken) params.set("accessToken", accessToken);
    if (userId) params.set("userId", userId);
    const homeId = Cookies.get("homeId");
    if (homeId) params.set("homeId", homeId);
    const hash = params.toString();
    return `${base}?embed=1${hash ? `#${hash}` : ""}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postAuth = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: AUTH_MESSAGE_TYPE,
        idToken: Cookies.get(ID_TOKEN),
        accessToken: Cookies.get(ACCESS_TOKEN),
        userId: Cookies.get(USER_ID),
        homeId: Cookies.get("homeId"),
      },
      DASHBOARD_ORIGIN
    );
  };

  useEffect(() => {
    registerIframe(iframeRef.current?.contentWindow ?? null);
    const attempts = [500, 1500, 3000].map((delay) =>
      setTimeout(postAuth, delay)
    );
    return () => {
      registerIframe(null);
      attempts.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full w-full overflow-scroll">
      <iframe
        ref={iframeRef}
        src={src}
        onLoad={() => {
          // contentWindow changes after every full navigation
          registerIframe(iframeRef.current?.contentWindow ?? null);
          postAuth();
        }}
        title="Assistly portal"
        className="h-full border-0"
        style={{
          width: `100%`,
        }}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default PortalFrame;
