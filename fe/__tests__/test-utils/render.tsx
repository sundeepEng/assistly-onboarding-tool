/**
 * Provider-aware render + hook helpers.
 *
 * Components under test reach for three things that only exist inside the app
 * shell: a react-query client, the Redux store, and `RoleContext`. Wrapping them
 * here keeps individual specs free of boilerplate — and, importantly, gives each
 * test a *fresh* QueryClient and store so cached data cannot leak across tests.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import {
  render as rtlRender,
  renderHook as rtlRenderHook,
  RenderOptions,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider as ReduxProvider } from "react-redux";

import { RoleContext } from "../../components/role-provider";
import dashboardTabReducer from "../../redux/slices/dashboard-tab-slice";
import exampleReducer from "../../redux/slices/exampleSlice";
import exceptionPopoverReducer from "../../redux/slices/exception-popover-slice";
import medicationExtractionReducer from "../../redux/slices/medication-extraction-slice";
import modalReducer from "../../redux/slices/modal-slice";
import scheduleDateReducer from "../../redux/slices/schedule-date-slice";
import sidebarCollapseReducer from "../../redux/slices/sidebar-slice";
import tabReducer from "../../redux/slices/tab-slice";
import teamMemberTabReducer from "../../redux/slices/team-tab-slices";
import type { Role } from "../../utils/roles";

/** Mirrors redux/store.ts, but a new instance per test. */
export const makeTestStore = () =>
  configureStore({
    reducer: {
      modal: modalReducer,
      example: exampleReducer,
      tab: tabReducer,
      dashboardTab: dashboardTabReducer,
      exceptionPopover: exceptionPopoverReducer,
      teamMemberTab: teamMemberTabReducer,
      scheduleDate: scheduleDateReducer,
      sidebarCollapse: sidebarCollapseReducer,
      medicationExtraction: medicationExtractionReducer,
    },
  });

/**
 * Retries and background refetching make failures non-deterministic and slow, so
 * both are off. `gcTime: Infinity` keeps results alive for the test's lifetime.
 */
export const makeTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

export type TestStore = ReturnType<typeof makeTestStore>;

export interface ProviderOptions {
  /** Value handed to `RoleContext` — components prefer it over the cookie role. */
  role?: Role | null;
  queryClient?: QueryClient;
  store?: TestStore;
}

export const makeWrapper = ({
  role = null,
  queryClient = makeTestQueryClient(),
  store = makeTestStore(),
}: ProviderOptions = {}) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <RoleContext.Provider value={{ role, setRole: () => {} }}>
          {children}
        </RoleContext.Provider>
      </QueryClientProvider>
    </ReduxProvider>
  );
  return { Wrapper, queryClient, store };
};

/** `render` with the app's providers. Returns the store/client for assertions. */
export const renderWithProviders = (
  ui: React.ReactElement,
  { role, queryClient, store, ...options }: ProviderOptions & Omit<RenderOptions, "wrapper"> = {}
) => {
  const w = makeWrapper({ role, queryClient, store });
  return {
    ...rtlRender(ui, { wrapper: w.Wrapper, ...options }),
    store: w.store,
    queryClient: w.queryClient,
  };
};

/** `renderHook` with the app's providers — used for the service hooks. */
export const renderHookWithProviders = <TResult, TProps>(
  callback: (props: TProps) => TResult,
  { role, queryClient, store, ...options }: ProviderOptions & Record<string, any> = {}
) => {
  const w = makeWrapper({ role, queryClient, store });
  return {
    ...rtlRenderHook(callback, { wrapper: w.Wrapper, ...options }),
    store: w.store,
    queryClient: w.queryClient,
  };
};

/**
 * `userEvent.setup()` for the form suites, without the per-keystroke delay.
 *
 * The default `delay: 0` still yields a macrotask between every key, and the
 * forms here revalidate their whole zod schema on each change — so typing a
 * single email address costs dozens of event-loop turns. `delay: null` drives
 * the same events in the same order without yielding, which cut add-lead's
 * runtime from ~25s to ~10s with every assertion unchanged.
 */
export const setupUser = () => userEvent.setup({ delay: null });

export type TestUser = ReturnType<typeof setupUser>;

export * from "@testing-library/react";
