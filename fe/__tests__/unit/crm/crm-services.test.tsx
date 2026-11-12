/**
 * CRM data layer — services/{getAll,getById,create,update,delete}.ts
 *
 * These four hooks back every CRM screen. What matters is the request contract
 * (URL, method, Authorization header, params) and the cache invalidation that
 * makes a newly created lead show up in the list without a page reload.
 */

import { waitFor } from "@testing-library/react";
import axios from "axios";

import useCreate from "../../../services/create";
import useDelete from "../../../services/delete";
import useGetAll from "../../../services/getAll";
import useGetById, { fetchById } from "../../../services/getById";
import useUpdate from "../../../services/update";
import { GetUsersPath, UserPath, userRoles } from "../../../utils/constants";
import { bearer, clearAuthSession, setAuthSession, TEST_HOME_ID } from "../../test-utils/auth";
import {
  makeLeadInput,
  makeLeadRow,
  makeLeadsResponse,
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

// ─── Listing leads ───────────────────────────────────────────────────────────

describe("useGetAll — the CRM leads list", () => {
  const listLeads = () =>
    renderHookWithProviders(() =>
      useGetAll({
        key: userRoles.LEAD,
        params: { userType: userRoles.LEAD, homeId: TEST_HOME_ID },
        path: GetUsersPath,
      })
    );

  it("GETs {BASE_URL}/v1/users filtered to Leads in the caller's home", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeLeadsResponse() });

    const { result } = listLeads();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get).toHaveBeenCalledWith(
      `${API}${GetUsersPath}`,
      expect.objectContaining({
        params: { userType: "Lead", homeId: TEST_HOME_ID },
      })
    );
  });

  it("authenticates with the session id token", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeLeadsResponse() });

    const { result } = listLeads();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const config = mockedAxios.get.mock.calls[0][1] as any;
    expect(config.headers.Authorization).toBe(bearer(idToken));
    expect(config.headers["Content-Type"]).toBe("application/json");
  });

  it("returns the response body unwrapped", async () => {
    const body = makeLeadsResponse([makeLeadRow(), makeLeadRow({ name: "Second Lead" })]);
    mockedAxios.get.mockResolvedValue({ data: body });

    const { result } = listLeads();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.users).toHaveLength(2);
    expect(result.current.data.users[0].role).toBe("Lead");
  });

  it("omits the params object entirely when no filters are given", async () => {
    // axios would serialise `params: undefined` harmlessly, but the service
    // avoids the key so a paramless call cannot pick up a stale query string.
    mockedAxios.get.mockResolvedValue({ data: { users: [] } });

    const { result } = renderHookWithProviders(() =>
      useGetAll({ key: "no-params", path: GetUsersPath })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get.mock.calls[0][1]).not.toHaveProperty("params");
  });

  it("surfaces a 403 to the caller", async () => {
    mockedAxios.get.mockRejectedValue({
      response: { status: 403, data: { message: "Forbidden" } },
    });

    const { result } = listLeads();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as any).response.data.message).toBe("Forbidden");
  });

  it("keys the cache by path params so two filters do not share a result", async () => {
    mockedAxios.get.mockResolvedValue({ data: makeLeadsResponse() });
    const queryClient = makeTestQueryClient();

    const leads = renderHookWithProviders(
      () =>
        useGetAll({
          key: userRoles.LEAD,
          params: { userType: "Lead", homeId: TEST_HOME_ID },
          path: GetUsersPath,
        }),
      { queryClient }
    );
    await waitFor(() => expect(leads.result.current.isSuccess).toBe(true));

    renderHookWithProviders(
      () =>
        useGetAll({
          key: userRoles.LEAD,
          params: { userType: "Lead", homeId: "another-home" },
          path: GetUsersPath,
        }),
      { queryClient }
    );

    // A shared cache key would serve the first home's leads to the second.
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
  });
});

// ─── Reading one lead ────────────────────────────────────────────────────────

describe("useGetById — a single CRM record", () => {
  it("GETs {BASE_URL}/v1/user/{id} with the bearer token", async () => {
    mockedAxios.get.mockResolvedValue({ data: { user: makeLeadRow() } });

    const { result } = renderHookWithProviders(() =>
      useGetById({ key: "user", payload: { id: UUIDS.lead, path: UserPath } })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get.mock.calls[0][0]).toBe(`${API}${UserPath}/${UUIDS.lead}`);
    expect((mockedAxios.get.mock.calls[0][1] as any).headers.Authorization).toBe(
      bearer(idToken)
    );
  });

  it("unwraps `data.user` when the API nests the record", async () => {
    const lead = makeLeadRow();
    mockedAxios.get.mockResolvedValue({ data: { user: lead } });

    await expect(fetchById({ id: UUIDS.lead, path: UserPath })).resolves.toEqual(lead);
  });

  it("falls back to the raw body when the record is not nested", async () => {
    // /v1/home returns `{ home: {...} }` rather than `{ user: {...} }`.
    const home = { home: { homeName: "Comfort Cove", homeType: "In Home Care" } };
    mockedAxios.get.mockResolvedValue({ data: home });

    await expect(fetchById({ id: TEST_HOME_ID, path: "/v1/home" })).resolves.toEqual(
      home
    );
  });

  it("does not fire while `enabled` is false", async () => {
    // The Add Lead form guards on `enabled: !!homeId` so it never requests
    // `/v1/home/undefined` before the cookie is read.
    const { result } = renderHookWithProviders(() =>
      useGetById({
        key: "user",
        payload: { id: undefined as any, path: "/v1/home", enabled: false },
      })
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("propagates a 404", async () => {
    mockedAxios.get.mockRejectedValue({
      response: { status: 404, data: { message: "User not found" } },
      message: "Request failed",
    });

    const { result } = renderHookWithProviders(() =>
      useGetById({ key: "user", payload: { id: "missing", path: UserPath } })
    );
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as any).response.status).toBe(404);
  });
});

// ─── Creating a lead ─────────────────────────────────────────────────────────

describe("useCreate — adding a CRM record", () => {
  const create = (userData: Record<string, any> = makeLeadInput(), path = UserPath) => {
    const rendered = renderHookWithProviders(() => useCreate());
    rendered.result.current.mutate({ userData, path });
    return rendered;
  };

  it("POSTs the record to {BASE_URL}/v1/user with the bearer token", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: { userId: UUIDS.lead } });

    const { result } = create();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${UserPath}`);
    expect(mockedAxios.post.mock.calls[0][1]).toEqual(makeLeadInput());
    expect((mockedAxios.post.mock.calls[0][2] as any).headers.Authorization).toBe(
      bearer(idToken)
    );
  });

  it.each([200, 201, 202])("treats HTTP %i as success", async (status) => {
    mockedAxios.post.mockResolvedValue({ status, data: {} });

    const { result } = create();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rejects any other 2xx — an unexpected status is a contract break", async () => {
    mockedAxios.post.mockResolvedValue({ status: 204, data: {} });

    const { result } = create();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Failed to create user");
  });

  it("invalidates the Lead list so the new record appears without a reload", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const rendered = renderHookWithProviders(() => useCreate(), { queryClient });
    rendered.result.current.mutate({ userData: makeLeadInput(), path: UserPath });
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidate.mock.calls.map((c: any) => c[0].queryKey[0]);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        userRoles.LEAD,
        userRoles.REFERRAL,
        userRoles.SENIOR,
        userRoles.PCG,
        userRoles.COMPLIANCE_GUEST,
        userRoles.NURSELEAD,
      ])
    );
  });

  it("surfaces the API's validation error on a 400", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 400, data: { error: "Email already exists" } },
    });

    const { result } = create();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as any).response.data.error).toBe(
      "Email already exists"
    );
  });

  it("surfaces an array of field errors as-is — the UI renders a fallback for those", async () => {
    // components/add-lead.tsx checks `Array.isArray(error.response.data.error)`
    // and shows "Failed to add Senior Lead." instead of dumping the array.
    mockedAxios.post.mockRejectedValue({
      response: { status: 400, data: { error: ["firstName is required", "bad email"] } },
    });

    const { result } = create();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(Array.isArray((result.current.error as any).response.data.error)).toBe(true);
  });
});

// ─── Updating a lead ─────────────────────────────────────────────────────────

describe("useUpdate — editing a CRM record", () => {
  const update = (data: Record<string, any>, path = UserPath) => {
    const rendered = renderHookWithProviders(() => useUpdate());
    rendered.result.current.mutate({ data, path });
    return rendered;
  };

  it("PUTs to {BASE_URL}/v1/user/{userId}", async () => {
    mockedAxios.put.mockResolvedValue({ data: { updated: true } });

    const { result } = update({ userId: UUIDS.lead, firstName: "Janet" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.put.mock.calls[0][0]).toBe(`${API}${UserPath}/${UUIDS.lead}`);
  });

  it("sends the whole record as the body, id included", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });
    const payload = { userId: UUIDS.lead, milestone: ["tour"] };

    const { result } = update(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.put.mock.calls[0][1]).toEqual(payload);
  });

  it("falls back to homeId, then id, when there is no userId", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });

    const byHome = update({ homeId: TEST_HOME_ID, homeName: "Comfort Cove" }, "/v1/home");
    await waitFor(() => expect(byHome.result.current.isSuccess).toBe(true));
    expect(mockedAxios.put.mock.calls[0][0]).toBe(`${API}/v1/home/${TEST_HOME_ID}`);

    const byId = update({ id: 42, note: "hello" }, "/v1/note");
    await waitFor(() => expect(byId.result.current.isSuccess).toBe(true));
    expect(mockedAxios.put.mock.calls[1][0]).toBe(`${API}/v1/note/42`);
  });

  it("returns response.data, not the axios envelope", async () => {
    mockedAxios.put.mockResolvedValue({ data: { userId: UUIDS.lead, updated: true } });

    const { result } = update({ userId: UUIDS.lead });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ userId: UUIDS.lead, updated: true });
  });

  it("invalidates the lead and senior caches after a milestone change", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const rendered = renderHookWithProviders(() => useUpdate(), { queryClient });
    rendered.result.current.mutate({
      data: { userId: UUIDS.lead, milestone: ["tour"] },
      path: UserPath,
    });
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map((c: any) => c[0].queryKey[0]);
    expect(keys).toEqual(
      expect.arrayContaining([userRoles.LEAD, userRoles.SENIOR, "user"])
    );
  });

  it("surfaces a 409 conflict", async () => {
    mockedAxios.put.mockRejectedValue({
      response: { status: 409, data: { error: "Record was modified by someone else" } },
    });

    const { result } = update({ userId: UUIDS.lead });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as any).response.status).toBe(409);
  });
});

// ─── Deleting a lead ─────────────────────────────────────────────────────────

describe("useDelete — removing a CRM record", () => {
  const remove = (id: string, path = UserPath) => {
    const rendered = renderHookWithProviders(() => useDelete());
    rendered.result.current.mutate({ id, path });
    return rendered;
  };

  it("DELETEs {BASE_URL}/v1/user/{id} with the bearer token", async () => {
    mockedAxios.delete.mockResolvedValue({ data: { deleted: true } });

    const { result } = remove(UUIDS.lead);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.delete.mock.calls[0][0]).toBe(`${API}${UserPath}/${UUIDS.lead}`);
    expect((mockedAxios.delete.mock.calls[0][1] as any).headers.Authorization).toBe(
      bearer(idToken)
    );
  });

  it("refetches — rather than merely invalidating — the lead list", async () => {
    // A deleted row must disappear immediately, so delete uses `refetchQueries`.
    mockedAxios.delete.mockResolvedValue({ data: {} });
    const queryClient = makeTestQueryClient();
    const refetch = jest.spyOn(queryClient, "refetchQueries");

    const rendered = renderHookWithProviders(() => useDelete(), { queryClient });
    rendered.result.current.mutate({ id: UUIDS.lead, path: UserPath });
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    const keys = refetch.mock.calls.map((c: any) => c[0].queryKey[0]);
    expect(keys).toEqual(
      expect.arrayContaining([userRoles.LEAD, userRoles.REFERRAL, userRoles.PCG])
    );
  });

  it("surfaces a 403 without touching the cache", async () => {
    mockedAxios.delete.mockRejectedValue({
      response: { status: 403, data: { error: "Not permitted" } },
    });
    const queryClient = makeTestQueryClient();
    const refetch = jest.spyOn(queryClient, "refetchQueries");

    const rendered = renderHookWithProviders(() => useDelete(), { queryClient });
    rendered.result.current.mutate({ id: UUIDS.lead, path: UserPath });
    await waitFor(() => expect(rendered.result.current.isError).toBe(true));

    expect(refetch).not.toHaveBeenCalled();
  });
});
