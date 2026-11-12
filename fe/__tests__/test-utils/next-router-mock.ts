/**
 * Shared `next/router` stub.
 *
 * `useRouter` throws outside a Next.js app ("NextRouter was not mounted"), and
 * almost every hook and screen in this codebase calls it. jest.setup.ts wires
 * this object in globally; specs import `routerMock` to assert navigation
 * (`expect(routerMock.push).toHaveBeenCalledWith("/crm")`) or to set `query`
 * before rendering a dynamic route.
 */

export const routerMock = {
  push: jest.fn(() => Promise.resolve(true)),
  replace: jest.fn(() => Promise.resolve(true)),
  prefetch: jest.fn(() => Promise.resolve()),
  back: jest.fn(),
  forward: jest.fn(),
  reload: jest.fn(),
  beforePopState: jest.fn(),
  pathname: "/",
  route: "/",
  asPath: "/",
  basePath: "",
  query: {} as Record<string, string | string[] | undefined>,
  isReady: true,
  isFallback: false,
  isPreview: false,
  isLocaleDomain: false,
  events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
};

/** Restore the default route/query. Call from a spec that mutated them. */
export const resetRouterMock = () => {
  routerMock.pathname = "/";
  routerMock.route = "/";
  routerMock.asPath = "/";
  routerMock.query = {};
  routerMock.isReady = true;
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
};

/** Point the router at a route, e.g. `setRoute("/crm/[leadId]", { leadId: "abc" })`. */
export const setRoute = (
  pathname: string,
  query: Record<string, string | string[]> = {}
) => {
  routerMock.pathname = pathname;
  routerMock.route = pathname;
  routerMock.query = query;
  routerMock.asPath = pathname;
};
