/**
 * RevOps data layer.
 *
 * RevOps has no services of its own — it reuses the generic CRUD hooks against
 * five endpoint constants (`invoicePath`, `budgetPath`, `payStubPath`,
 * `dashboardMetricsPath`, `revopsPaymentPath`) plus `useGetAllShifts`, which it
 * borrows from HCM purely for its repeated-key params serializer.
 *
 * What matters is the request contract and the cache invalidation that makes a
 * newly raised invoice appear without a reload.
 */

import { waitFor } from "@testing-library/react";
import axios from "axios";

import useCreate from "../../../services/create";
import useGetAll from "../../../services/getAll";
import useGetById from "../../../services/getById";
import useGetAllShifts from "../../../services/hcm-getall-shifts";
import useUpdate from "../../../services/update";
import { fetchStripeStatus } from "../../../services/stripe-status";
import { fetchStripeOnboardingLink } from "../../../services/stripe-onboarding-link";
import {
  budgetPath,
  dashboardMetricsPath,
  homePath,
  invoicePath,
  payStubPath,
  revopsPaymentPath,
  stripeOnboardingLinkPath,
  stripeStatusPath,
} from "../../../utils/constants";
import {
  bearer,
  clearAuthSession,
  setAuthSession,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../test-utils/auth";
import {
  makeBudgetEntry,
  makeDashboardMetrics,
  makeHomeWithThresholds,
  makeInvoiceRow,
  makeInvoicesResponse,
  makePayout,
  makePaymentRequest,
  UUIDS,
} from "../../test-utils/factories";
import { makeTestQueryClient, renderHookWithProviders } from "../../test-utils/render";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const API = process.env.NEXT_PUBLIC_BASE_URL;

let idToken: string;
beforeEach(() => {
  clearAuthSession();
  idToken = setAuthSession("PCHO");
});

// ─── Invoices ────────────────────────────────────────────────────────────────

describe("useGetAll — the invoices list", () => {
  const listInvoices = (params: Record<string, any> = { home_id: TEST_HOME_ID }) =>
    renderHookWithProviders(() => useGetAll({ key: "invoices", params, path: invoicePath }));

  it("GETs {BASE_URL}/v1/revops/invoice scoped to the caller's home", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeInvoicesResponse() });

    const { result } = listInvoices();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get).toHaveBeenCalledWith(
      `${API}${invoicePath}`,
      expect.objectContaining({ params: { home_id: TEST_HOME_ID } })
    );
  });

  it("authenticates with the session id token", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeInvoicesResponse() });

    const { result } = listInvoices();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const config = mockedAxios.get.mock.calls[0][1] as any;
    expect(config.headers.Authorization).toBe(bearer(idToken));
    expect(config.headers["Content-Type"]).toBe("application/json");
  });

  it("returns the invoices unwrapped", async () => {
    mockedAxios.get.mockResolvedValue({
      data: makeInvoicesResponse([makeInvoiceRow(), makeInvoiceRow({ id: 2, status: "PAID" })]),
    });

    const { result } = listInvoices();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.invoices).toHaveLength(2);
    expect(result.current.data.invoices[1].status).toBe("PAID");
  });

  it("passes a billing_period filter through", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeInvoicesResponse() });

    const { result } = listInvoices({ home_id: TEST_HOME_ID, billing_period: "2026-02" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.get.mock.calls[0][1] as any).params).toMatchObject({
      billing_period: "2026-02",
    });
  });

  it("serialises an array status filter without index brackets", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeInvoicesResponse() });

    const { result } = listInvoices({ home_id: TEST_HOME_ID, status: ["DUE", "OVERDUE"] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // `paramsSerializer: { indexes: null }` → `?status=DUE&status=OVERDUE`
    expect((mockedAxios.get.mock.calls[0][1] as any).paramsSerializer).toEqual({ indexes: null });
  });

  it("propagates a failure to the caller", async () => {
    mockedAxios.get.mockRejectedValue({ response: { status: 500, data: { error: "boom" } } });

    const { result } = renderHookWithProviders(
      () => useGetAll({ key: "invoices", params: { home_id: TEST_HOME_ID }, path: invoicePath }),
      { queryClient: makeTestQueryClient() }
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("keys the cache by params so two billing periods do not collide", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeInvoicesResponse() });
    const queryClient = makeTestQueryClient();

    const { result: feb } = renderHookWithProviders(
      () =>
        useGetAll({
          key: "invoices",
          params: { home_id: TEST_HOME_ID, billing_period: "2026-02" },
          path: invoicePath,
        }),
      { queryClient }
    );
    await waitFor(() => expect(feb.current.isSuccess).toBe(true));

    renderHookWithProviders(
      () =>
        useGetAll({
          key: "invoices",
          params: { home_id: TEST_HOME_ID, billing_period: "2026-01" },
          path: invoicePath,
        }),
      { queryClient }
    );

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
  });
});

describe("useCreate — raising an invoice", () => {
  it("POSTs to {BASE_URL}/v1/revops/invoice with the bearer token", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: { id: 1 } });

    const { result } = renderHookWithProviders(() => useCreate());
    result.current.mutate({ userData: makeInvoiceRow(), path: invoicePath });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post).toHaveBeenCalledWith(
      `${API}${invoicePath}`,
      expect.objectContaining({ billing_period: "2026-02" }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: bearer(idToken) }),
      })
    );
  });

  it("invalidates the invoices cache so the list refreshes", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useCreate(), { queryClient });
    result.current.mutate({ userData: makeInvoiceRow(), path: invoicePath });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["invoices"] });
  });

  it("invalidates the budget cache too — an invoice moves the income figure", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useCreate(), { queryClient });
    result.current.mutate({ userData: makeInvoiceRow(), path: invoicePath });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["budget"] });
  });

  /**
   * Pinned: `create` treats anything outside 200/201/202 as a failure by throwing
   * its own generic Error, losing the API's message. A 204 is a "success" status
   * the service rejects.
   */
  it("rejects a 204 with a generic message", async () => {
    mockedAxios.post.mockResolvedValue({ status: 204, data: {} });

    const { result } = renderHookWithProviders(() => useCreate());
    result.current.mutate({ userData: makeInvoiceRow(), path: invoicePath });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Failed to create user");
  });

  it("surfaces the API error body on a 400", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 400, data: { error: "billing_period already invoiced" } },
    });

    const { result } = renderHookWithProviders(() => useCreate());
    result.current.mutate({ userData: makeInvoiceRow(), path: invoicePath });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as any).response.data.error).toBe(
      "billing_period already invoiced"
    );
  });
});

describe("useUpdate — editing an invoice", () => {
  it("PUTs to {BASE_URL}/v1/revops/invoice/{id}", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });

    const { result } = renderHookWithProviders(() => useUpdate());
    result.current.mutate({ data: makeInvoiceRow({ id: 42 }), path: invoicePath });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.put.mock.calls[0][0]).toBe(`${API}${invoicePath}/42`);
  });

  /**
   * `update` derives the id as `userId || homeId || id`. Invoices use snake_case
   * (`user_id`, `home_id`), so neither of the first two matches and the numeric
   * `id` is used — which is the intended behaviour, but only by accident of
   * naming. An invoice that arrived without `id` would PUT to `/undefined`.
   */
  it("PUTs to /undefined when the payload carries no id at all", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });
    const invoice = makeInvoiceRow();
    delete (invoice as any).id;

    const { result } = renderHookWithProviders(() => useUpdate());
    result.current.mutate({ data: invoice, path: invoicePath });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedAxios.put.mock.calls[0][0]).toBe(`${API}${invoicePath}/undefined`);
  });

  it("invalidates invoices and budget on success", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useUpdate(), { queryClient });
    result.current.mutate({ data: makeInvoiceRow(), path: invoicePath });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["invoices"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["budget"] });
  });

  it("propagates a 403 rather than swallowing it", async () => {
    mockedAxios.put.mockRejectedValue({ response: { status: 403, data: { error: "forbidden" } } });

    const { result } = renderHookWithProviders(() => useUpdate());
    result.current.mutate({ data: makeInvoiceRow(), path: invoicePath });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as any).response.status).toBe(403);
  });
});

// ─── Payments ────────────────────────────────────────────────────────────────

describe("useCreate — recording a payment", () => {
  it("POSTs to {BASE_URL}/v1/revops/payment", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });

    const { result } = renderHookWithProviders(() => useCreate());
    result.current.mutate({
      userData: makePaymentRequest({ manual_method: "CHECK" }),
      path: revopsPaymentPath,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${revopsPaymentPath}`);
    expect(mockedAxios.post.mock.calls[0][1]).toMatchObject({
      subject_type: "INVOICE",
      provider: "MANUAL",
      manual_method: "CHECK",
    });
  });

  it("carries the initiating user through untouched", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });

    const { result } = renderHookWithProviders(() => useCreate());
    result.current.mutate({ userData: makePaymentRequest(), path: revopsPaymentPath });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.post.mock.calls[0][1] as any).initiated_by_user_id).toBe(TEST_USER_ID);
  });
});

// ─── Budget ──────────────────────────────────────────────────────────────────

describe("useGetAll — dashboard metrics", () => {
  it("GETs {BASE_URL}/v1/revops/budget/dashboard/metrics for the selected window", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeDashboardMetrics() });

    const { result } = renderHookWithProviders(() =>
      useGetAll({
        key: "dashboard-metrics",
        path: dashboardMetricsPath,
        params: { home_id: TEST_HOME_ID, start_date: "2026-02-01", end_date: "2026-02-28" },
      })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get).toHaveBeenCalledWith(
      `${API}${dashboardMetricsPath}`,
      expect.objectContaining({
        params: { home_id: TEST_HOME_ID, start_date: "2026-02-01", end_date: "2026-02-28" },
      })
    );
  });

  it("returns the cent-denominated totals the Budget screen divides by 100", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeDashboardMetrics() });

    const { result } = renderHookWithProviders(() =>
      useGetAll({
        key: "dashboard-metrics",
        path: dashboardMetricsPath,
        params: { home_id: TEST_HOME_ID },
      })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.total_income).toBe(1200000);
    expect(result.current.data.total_income / 100).toBe(12000);
  });

  /**
   * The Budget screen fires this query on first paint, before the `homeId` cookie
   * has necessarily resolved, so `home_id` can go out empty. The request is not
   * suppressed — `useGetAll` has no `enabled` guard.
   */
  it("still fires with an empty home_id — there is no enabled guard", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeDashboardMetrics() });

    const { result } = renderHookWithProviders(() =>
      useGetAll({
        key: "dashboard-metrics",
        path: dashboardMetricsPath,
        params: { home_id: "", start_date: "", end_date: "" },
      })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.get.mock.calls[0][1] as any).params.home_id).toBe("");
  });
});

describe("useGetAllShifts — the budget expense query", () => {
  /**
   * The Budget screen reaches for the *shifts* hook rather than `useGetAll` for
   * one reason: `transaction_date` is an array (a start/end pair) and this hook's
   * serializer repeats the key instead of emitting `transaction_date[]=`.
   */
  const listBudget = (params: Record<string, string | string[]>) =>
    renderHookWithProviders(() => useGetAllShifts({ key: "budget", params, path: budgetPath }));

  it("GETs {BASE_URL}/v1/revops/budget", async () => {
    mockedAxios.get.mockResolvedValue({ data: { expense_payroll: 250000 } });

    const { result } = listBudget({ home_id: TEST_HOME_ID, transaction_type: "expense" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get.mock.calls[0][0]).toBe(`${API}${budgetPath}`);
  });

  it("repeats transaction_date for the start/end pair", async () => {
    mockedAxios.get.mockResolvedValue({ data: {} });

    const { result } = listBudget({
      home_id: TEST_HOME_ID,
      transaction_date: ["2026-02-01T04:00:00.000Z", "2026-03-01T03:59:59.999Z"],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const serialize = (mockedAxios.get.mock.calls[0][1] as any).paramsSerializer;
    expect(serialize({ transaction_date: ["a", "b"] })).toBe(
      "transaction_date=a&transaction_date=b"
    );
  });

  it("authenticates with the session id token", async () => {
    mockedAxios.get.mockResolvedValue({ data: {} });

    const { result } = listBudget({ home_id: TEST_HOME_ID });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.get.mock.calls[0][1] as any).headers.Authorization).toBe(bearer(idToken));
  });

  it("returns the payroll figure the Expenses tab divides by 100", async () => {
    mockedAxios.get.mockResolvedValue({ data: { expense_payroll: 250000 } });

    const { result } = listBudget({ home_id: TEST_HOME_ID });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.expense_payroll / 100).toBe(2500);
  });

  it("stays idle when params are missing", () => {
    const { result } = renderHookWithProviders(() =>
      useGetAllShifts({ key: "budget", params: undefined, path: budgetPath })
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});

describe("useCreate — a budget entry", () => {
  it("POSTs to {BASE_URL}/v1/revops/budget", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });

    const { result } = renderHookWithProviders(() => useCreate());
    result.current.mutate({ userData: makeBudgetEntry(), path: budgetPath });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${budgetPath}`);
    expect(mockedAxios.post.mock.calls[0][1]).toMatchObject({
      transaction_type: "expense",
      amount_cents: 15000,
    });
  });

  it("invalidates the budget cache", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useCreate(), { queryClient });
    result.current.mutate({ userData: makeBudgetEntry(), path: budgetPath });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["budget"] });
  });

  /**
   * Pinned: `useCreate` does *not* invalidate `dashboard-metrics`, so the four
   * stat cards at the top of the Budget screen keep showing pre-save totals until
   * the period is changed or the page reloaded.
   */
  it("does not invalidate dashboard-metrics, so the stat cards go stale", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useCreate(), { queryClient });
    result.current.mutate({ userData: makeBudgetEntry(), path: budgetPath });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ["dashboard-metrics"] });
  });
});

// ─── Thresholds live on the home record ──────────────────────────────────────

describe("useGetById — the home record behind thresholds and alerts", () => {
  it("GETs {BASE_URL}/v1/home/{id}", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeHomeWithThresholds() });

    const { result } = renderHookWithProviders(() =>
      useGetById({ key: "home", payload: { id: TEST_HOME_ID, path: homePath, enabled: true } })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get.mock.calls[0][0]).toBe(`${API}${homePath}/${TEST_HOME_ID}`);
  });

  it("stays idle while the home id is unknown", () => {
    const { result } = renderHookWithProviders(() =>
      useGetById({ key: "home", payload: { id: "", path: homePath, enabled: false } })
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("returns the thresholds nested under `home`", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeHomeWithThresholds() });

    const { result } = renderHookWithProviders(() =>
      useGetById({ key: "home", payload: { id: TEST_HOME_ID, path: homePath, enabled: true } })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.home.thresholds["2026"].feb.groceries.fixedAmount).toBe(2000);
  });

  /** Saving a threshold is a PUT of the whole home record, not a dedicated endpoint. */
  it("saves thresholds by PUTting the whole home back", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });
    const { home } = makeHomeWithThresholds();

    const { result } = renderHookWithProviders(() => useUpdate());
    result.current.mutate({ data: home, path: homePath });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.put.mock.calls[0][0]).toBe(`${API}${homePath}/${TEST_HOME_ID}`);
  });
});

// ─── Payroll / pay stubs ─────────────────────────────────────────────────────

describe("useGetAll — pay stubs", () => {
  it("GETs {BASE_URL}/v1/revops/payout scoped to one caregiver", async () => {
    mockedAxios.get.mockResolvedValue({ data: { payouts: [makePayout()] } });

    const { result } = renderHookWithProviders(() =>
      useGetAll({
        key: "payouts",
        params: { pcg_user_id: UUIDS.pcg, home_id: TEST_HOME_ID },
        path: payStubPath,
      })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get).toHaveBeenCalledWith(
      `${API}${payStubPath}`,
      expect.objectContaining({
        params: { pcg_user_id: UUIDS.pcg, home_id: TEST_HOME_ID },
      })
    );
  });

  it("scopes to the whole home for the employer view", async () => {
    mockedAxios.get.mockResolvedValue({ data: { payouts: [] } });

    const { result } = renderHookWithProviders(() =>
      useGetAll({
        key: "payouts",
        params: { home_id: TEST_HOME_ID, pcho_user_id: UUIDS.pcho },
        path: payStubPath,
      })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.get.mock.calls[0][1] as any).params).toMatchObject({
      pcho_user_id: UUIDS.pcho,
    });
  });

  it("returns amounts in cents", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { payouts: [makePayout({ total_amount_cents: 96000 })] },
    });

    const { result } = renderHookWithProviders(() =>
      useGetAll({ key: "payouts", params: { home_id: TEST_HOME_ID }, path: payStubPath })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.payouts[0].total_amount_cents / 100).toBe(960);
  });
});

// ─── Stripe onboarding ───────────────────────────────────────────────────────

describe("Stripe services", () => {
  it("fetchStripeStatus POSTs the email to {BASE_URL}/v1/revops/stripe/status", async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: "ACTIVE" } });

    const data = await fetchStripeStatus({ email: "owner@assistly.com" });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      `${API}${stripeStatusPath}`,
      { email: "owner@assistly.com" },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: bearer(idToken) }),
      })
    );
    expect(data.status).toBe("ACTIVE");
  });

  it("fetchStripeOnboardingLink POSTs to the onboarding-link endpoint", async () => {
    mockedAxios.post.mockResolvedValue({ data: { url: "https://connect.stripe.com/setup/x" } });

    const data = await fetchStripeOnboardingLink({ email: "owner@assistly.com" });

    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${stripeOnboardingLinkPath}`);
    expect(data.url).toContain("connect.stripe.com");
  });

  it("refuses to call out without a session token", async () => {
    clearAuthSession();
    await expect(fetchStripeStatus({ email: "owner@assistly.com" })).rejects.toThrow(
      "Unauthorized: No ID Token found."
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("refuses to call out without an email", async () => {
    await expect(fetchStripeStatus({ email: "" })).rejects.toThrow("Missing email.");
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("propagates a Stripe API failure", async () => {
    mockedAxios.post.mockRejectedValue({ response: { status: 502, data: { error: "stripe down" } } });

    await expect(fetchStripeStatus({ email: "owner@assistly.com" })).rejects.toMatchObject({
      response: { status: 502 },
    });
  });
});
