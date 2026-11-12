/**
 * Staffing data layer — services/hcm-*-shift(s).ts
 *
 * Unlike the CRM services, the shifts endpoints have their own hooks with their
 * own quirks: a custom params serializer that repeats a key for array filters
 * (`?user_id=a&user_id=b`), a create that only accepts 201, and a query that is
 * disabled until its filters exist.
 */

import { waitFor } from "@testing-library/react";
import axios from "axios";

import useCreateShift from "../../../services/hcm-create-shift";
import useDeleteShift from "../../../services/hcm-delete-shift";
import useGetShiftById from "../../../services/hcm-get-shift";
import useGetAllShifts from "../../../services/hcm-getall-shifts";
import useUpdateShift from "../../../services/hcm-update-shift";
import { shiftsPath } from "../../../utils/constants";
import { bearer, clearAuthSession, setAuthSession, TEST_HOME_ID } from "../../test-utils/auth";
import { makeShiftInput, makeShiftRow, makeShiftsResponse, UUIDS } from "../../test-utils/factories";
import { makeTestQueryClient, renderHookWithProviders } from "../../test-utils/render";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const API = process.env.NEXT_PUBLIC_BASE_URL;
const SHIFT_PATH = "/v1/hcm/shift";

let idToken: string;
beforeEach(() => {
  clearAuthSession();
  idToken = setAuthSession("PCHO");
});

// ─── Listing shifts ──────────────────────────────────────────────────────────

describe("useGetAllShifts — the schedule", () => {
  const listShifts = (params: Record<string, string | string[]> = { home_id: TEST_HOME_ID }) =>
    renderHookWithProviders(() => useGetAllShifts({ key: "shifts", params }));

  it("GETs {BASE_URL}/v1/hcm/shifts", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeShiftsResponse() });

    const { result } = listShifts();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get.mock.calls[0][0]).toBe(`${API}${shiftsPath}`);
  });

  it("authenticates with the session id token", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeShiftsResponse() });

    const { result } = listShifts();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.get.mock.calls[0][1] as any).headers.Authorization).toBe(
      bearer(idToken)
    );
  });

  it("passes the week window through as params", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeShiftsResponse() });

    const { result } = listShifts({
      home_id: TEST_HOME_ID,
      shift_start_time: "2026-03-02T04:00:00.000Z",
      shift_end_time: "2026-03-09T03:59:59.999Z",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.get.mock.calls[0][1] as any).params).toMatchObject({
      home_id: TEST_HOME_ID,
      shift_start_time: "2026-03-02T04:00:00.000Z",
    });
  });

  describe("params serializer", () => {
    /**
     * Filtering the roster by several caregivers has to produce a repeated key,
     * not axios's default `user_id[]=`. The serializer is the only thing
     * standing between "show these three people" and "show nobody".
     */
    const serialize = (params: Record<string, any>) =>
      (mockedAxios.get.mock.calls[0][1] as any).paramsSerializer(params);

    beforeEach(async () => {
      mockedAxios.get.mockResolvedValue({ data: makeShiftsResponse() });
      const { result } = listShifts();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("repeats the key for an array value", () => {
      expect(serialize({ user_id: ["a", "b", "c"] })).toBe(
        "user_id=a&user_id=b&user_id=c"
      );
    });

    it("emits a scalar value once", () => {
      expect(serialize({ home_id: TEST_HOME_ID })).toBe(`home_id=${TEST_HOME_ID}`);
    });

    it("mixes arrays and scalars", () => {
      expect(serialize({ home_id: "h1", user_id: ["a", "b"] })).toBe(
        "home_id=h1&user_id=a&user_id=b"
      );
    });

    it("URL-encodes values", () => {
      expect(serialize({ shift_start_time: "2026-03-02T04:00:00.000Z" })).toBe(
        "shift_start_time=2026-03-02T04%3A00%3A00.000Z"
      );
    });

    it("emits nothing for an empty array", () => {
      expect(serialize({ user_id: [] })).toBe("");
    });
  });

  it("stays idle while `enabled` is false", () => {
    const { result } = renderHookWithProviders(() =>
      useGetAllShifts({ key: "shifts", params: { home_id: TEST_HOME_ID }, enabled: false })
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("stays idle until the params exist", () => {
    // The scheduling screen computes its week window in an effect, so the first
    // render has no params and must not fire an unfiltered request.
    const { result } = renderHookWithProviders(() =>
      useGetAllShifts({ key: "shifts", params: undefined })
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("queries a different path when one is supplied", async () => {
    mockedAxios.get.mockResolvedValue({ data: {} });

    const { result } = renderHookWithProviders(() =>
      useGetAllShifts({
        key: "roasters",
        params: { home_id: TEST_HOME_ID },
        path: "/v1/hcm/roasters",
      })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get.mock.calls[0][0]).toBe(`${API}/v1/hcm/roasters`);
  });

  it("surfaces a 500", async () => {
    mockedAxios.get.mockRejectedValue({
      response: { status: 500, data: { message: "Scheduling service unavailable" } },
      message: "Request failed",
    });

    const { result } = listShifts();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as any).response.status).toBe(500);
  });
});

// ─── Reading one shift ───────────────────────────────────────────────────────

describe("useGetShiftById", () => {
  it("GETs {BASE_URL}/v1/hcm/shift/{id}", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeShiftRow() });

    const { result } = renderHookWithProviders(() => useGetShiftById("101"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get.mock.calls[0][0]).toBe(`${API}${SHIFT_PATH}/101`);
    expect((mockedAxios.get.mock.calls[0][1] as any).headers.Authorization).toBe(
      bearer(idToken)
    );
  });

  it("returns the shift body as-is", async () => {
    const shift = makeShiftRow();
    mockedAxios.get.mockResolvedValue({ data: shift });

    const { result } = renderHookWithProviders(() => useGetShiftById("101"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(shift);
  });

  it("stays idle while disabled", () => {
    const { result } = renderHookWithProviders(() => useGetShiftById("101", false));

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});

// ─── Creating a shift ────────────────────────────────────────────────────────

describe("useCreateShift", () => {
  const createShift = (shift = makeShiftInput()) => {
    const rendered = renderHookWithProviders(() => useCreateShift());
    rendered.result.current.mutate(shift);
    return rendered;
  };

  it("POSTs to {BASE_URL}/v1/hcm/shift with the bearer token", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: makeShiftRow() });

    const { result } = createShift();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${SHIFT_PATH}`);
    expect((mockedAxios.post.mock.calls[0][2] as any).headers.Authorization).toBe(
      bearer(idToken)
    );
  });

  it("sends the shift exactly as given", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });

    const { result } = createShift();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post.mock.calls[0][1]).toEqual(makeShiftInput());
  });

  it("carries the assigned senior for an In-Home Care visit", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });

    const { result } = createShift(
      makeShiftInput({ assigned_to_user_id: UUIDS.senior })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.post.mock.calls[0][1] as any).assigned_to_user_id).toBe(
      UUIDS.senior
    );
  });

  it("treats a 200 as a failure — only 201 means the shift was created", async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

    const { result } = createShift();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Failed to create shift");
  });

  it("invalidates the shifts cache so the roster redraws", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const rendered = renderHookWithProviders(() => useCreateShift(), { queryClient });
    rendered.result.current.mutate(makeShiftInput());
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["shifts"] });
  });

  it("surfaces an overlapping-shift rejection", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 409, data: { error: "Shift overlaps an existing one" } },
    });

    const { result } = createShift();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as any).response.data.error).toBe(
      "Shift overlaps an existing one"
    );
  });

  it("leaves the cache alone when the create fails", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 400, data: { error: "shift_end_time is required" } },
    });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const rendered = renderHookWithProviders(() => useCreateShift(), { queryClient });
    rendered.result.current.mutate(makeShiftInput());
    await waitFor(() => expect(rendered.result.current.isError).toBe(true));

    expect(invalidate).not.toHaveBeenCalled();
  });
});

// ─── Updating a shift ────────────────────────────────────────────────────────

describe("useUpdateShift", () => {
  const updateShift = (data: Record<string, any> = { id: 101, pay_rate: 15 }) => {
    const rendered = renderHookWithProviders(() => useUpdateShift());
    rendered.result.current.mutate(data);
    return rendered;
  };

  it("PUTs to {BASE_URL}/v1/hcm/shift/{id}", async () => {
    mockedAxios.put.mockResolvedValue({ data: { updated: true } });

    const { result } = updateShift();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.put.mock.calls[0][0]).toBe(`${API}${SHIFT_PATH}/101`);
  });

  it("takes the id from the payload's own `id` field", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });

    const { result } = updateShift({ id: 999, shift_status: "vacation" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.put.mock.calls[0][0]).toBe(`${API}${SHIFT_PATH}/999`);
  });

  it("sends the whole shift as the body", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });
    const payload = { id: 101, shift_status: "timeoff", is_unavailability_approved: true };

    const { result } = updateShift(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.put.mock.calls[0][1]).toEqual(payload);
  });

  it("approves an unavailability request", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });

    const { result } = updateShift({
      id: 101,
      shift_status: "timeoff",
      is_unavailability_approved: true,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.put.mock.calls[0][1] as any).is_unavailability_approved).toBe(
      true
    );
  });

  it("records a clock-out on a timecard edit", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });

    const { result } = updateShift({
      id: 101,
      clock_in_timestamp: "2026-03-02T13:02:00.000Z",
      clock_out_timestamp: "2026-03-02T21:04:00.000Z",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.put.mock.calls[0][1] as any).clock_out_timestamp).toBe(
      "2026-03-02T21:04:00.000Z"
    );
  });

  it("returns response.data", async () => {
    mockedAxios.put.mockResolvedValue({ data: { id: 101, updated: true } });

    const { result } = updateShift();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ id: 101, updated: true });
  });

  it("invalidates the shifts cache", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const rendered = renderHookWithProviders(() => useUpdateShift(), { queryClient });
    rendered.result.current.mutate({ id: 101, pay_rate: 15 });
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["shifts"] });
  });

  it("surfaces a 404 for a shift that no longer exists", async () => {
    mockedAxios.put.mockRejectedValue({
      response: { status: 404, data: { error: "Shift not found" } },
    });

    const { result } = updateShift();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as any).response.status).toBe(404);
  });
});

// ─── Deleting a shift ────────────────────────────────────────────────────────

describe("useDeleteShift", () => {
  const deleteShift = (id = "101") => {
    const rendered = renderHookWithProviders(() => useDeleteShift());
    rendered.result.current.mutate(id);
    return rendered;
  };

  it("DELETEs {BASE_URL}/v1/hcm/shift/{id} with the bearer token", async () => {
    mockedAxios.delete.mockResolvedValue({ data: { deleted: true } });

    const { result } = deleteShift();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.delete.mock.calls[0][0]).toBe(`${API}${SHIFT_PATH}/101`);
    expect((mockedAxios.delete.mock.calls[0][1] as any).headers.Authorization).toBe(
      bearer(idToken)
    );
  });

  it("invalidates the shifts cache so the slot clears", async () => {
    mockedAxios.delete.mockResolvedValue({ data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const rendered = renderHookWithProviders(() => useDeleteShift(), { queryClient });
    rendered.result.current.mutate("101");
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["shifts"] });
  });

  it("surfaces a 403 and leaves the cache alone", async () => {
    mockedAxios.delete.mockRejectedValue({
      response: { status: 403, data: { error: "Not permitted" } },
    });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const rendered = renderHookWithProviders(() => useDeleteShift(), { queryClient });
    rendered.result.current.mutate("101");
    await waitFor(() => expect(rendered.result.current.isError).toBe(true));

    expect(invalidate).not.toHaveBeenCalled();
  });
});
