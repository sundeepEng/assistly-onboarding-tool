/**
 * Clinical data layer — the shared services pointed at /v1/clinical/user.
 *
 * Clinical records go through the same `useCreate`/`useUpdate`/`useGetAll` hooks
 * as CRM, only with a different path. What is worth pinning is the clinical
 * usage: the seniors list is filtered by role, medication and med-pass writes go
 * to the clinical path, and moving a lead into clinical is a two-call sequence
 * that must not half-apply.
 */

import { waitFor } from "@testing-library/react";
import axios from "axios";

import useCreate from "../../../services/create";
import useGetAll from "../../../services/getAll";
import useGetById from "../../../services/getById";
import useUpdate from "../../../services/update";
import {
  ClinicalUserPath,
  GetUsersPath,
  UserPath,
  userRoles,
} from "../../../utils/constants";
import { bearer, clearAuthSession, setAuthSession, TEST_HOME_ID } from "../../test-utils/auth";
import {
  makeMedication,
  makeMedPassService,
  makeSeniorRow,
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

// ─── Seniors list ────────────────────────────────────────────────────────────

describe("Clinical seniors list", () => {
  const listSeniors = () =>
    renderHookWithProviders(() =>
      useGetAll({
        key: userRoles.SENIOR,
        params: { userType: userRoles.SENIOR, homeId: TEST_HOME_ID },
        path: GetUsersPath,
      })
    );

  it("GETs /v1/users filtered to Seniors in the caller's home", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users: [makeSeniorRow()] } });

    const { result } = listSeniors();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get).toHaveBeenCalledWith(
      `${API}${GetUsersPath}`,
      expect.objectContaining({
        params: { userType: "Senior", homeId: TEST_HOME_ID },
      })
    );
  });

  it("authenticates with the session id token", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users: [] } });

    const { result } = listSeniors();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.get.mock.calls[0][1] as any).headers.Authorization).toBe(
      bearer(idToken)
    );
  });

  it("returns each senior's clinical block alongside the CRM fields", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { users: [makeSeniorRow({ clinical: { roomNumber: 7, status: "In Home" } })] },
    });

    const { result } = listSeniors();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.users[0].clinical).toEqual({
      roomNumber: 7,
      status: "In Home",
    });
  });

  it("surfaces a 500", async () => {
    mockedAxios.get.mockRejectedValue({
      response: { status: 500, data: { message: "Clinical service unavailable" } },
    });

    const { result } = listSeniors();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as any).response.status).toBe(500);
  });
});

// ─── Reading one senior ──────────────────────────────────────────────────────

describe("Reading a senior's clinical record", () => {
  it("GETs /v1/user/{id} and unwraps the nested user", async () => {
    const senior = makeSeniorRow();
    mockedAxios.get.mockResolvedValue({ data: { user: senior } });

    const { result } = renderHookWithProviders(() =>
      useGetById({ key: "user", payload: { id: UUIDS.senior, path: UserPath } })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.get.mock.calls[0][0]).toBe(`${API}${UserPath}/${UUIDS.senior}`);
    expect(result.current.data).toEqual(senior);
  });

  it("does not fire until the senior id is known", async () => {
    const { result } = renderHookWithProviders(() =>
      useGetById({
        key: "user",
        payload: { id: undefined as any, path: UserPath, enabled: false },
      })
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});

// ─── Medication ──────────────────────────────────────────────────────────────

describe("Adding a medication", () => {
  const addMedication = (medication = makeMedication()) => {
    const rendered = renderHookWithProviders(() => useCreate());
    rendered.result.current.mutate({
      userData: { userId: UUIDS.senior, medication },
      path: ClinicalUserPath,
    });
    return rendered;
  };

  it("POSTs the medication to the clinical endpoint, not the CRM one", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });

    const { result } = addMedication();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${ClinicalUserPath}`);
    expect(mockedAxios.post.mock.calls[0][0]).not.toContain(`${API}${UserPath}?`);
  });

  it("sends the medication nested under the senior's userId", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });

    const { result } = addMedication();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post.mock.calls[0][1]).toEqual({
      userId: UUIDS.senior,
      medication: makeMedication(),
    });
  });

  it("authenticates with the session id token", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });

    const { result } = addMedication();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((mockedAxios.post.mock.calls[0][2] as any).headers.Authorization).toBe(
      bearer(idToken)
    );
  });

  it("invalidates the Senior cache so the medication list refreshes", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });
    const queryClient = makeTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const rendered = renderHookWithProviders(() => useCreate(), { queryClient });
    rendered.result.current.mutate({
      userData: { userId: UUIDS.senior, medication: makeMedication() },
      path: ClinicalUserPath,
    });
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map((c: any) => c[0].queryKey[0]);
    expect(keys).toContain(userRoles.SENIOR);
  });

  it("surfaces a duplicate-medication rejection", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 409, data: { error: "Medication already prescribed" } },
    });

    const { result } = addMedication();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as any).response.data.error).toBe(
      "Medication already prescribed"
    );
  });
});

// ─── Med pass ────────────────────────────────────────────────────────────────

describe("Recording a med pass", () => {
  const recordMedPass = (services = [makeMedPassService()]) => {
    const rendered = renderHookWithProviders(() => useUpdate());
    rendered.result.current.mutate({
      data: { userId: UUIDS.senior, medPass: { services } },
      path: ClinicalUserPath,
    });
    return rendered;
  };

  it("PUTs the med pass to /v1/clinical/user/{seniorId}", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });

    const { result } = recordMedPass();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.put.mock.calls[0][0]).toBe(
      `${API}${ClinicalUserPath}/${UUIDS.senior}`
    );
  });

  it("carries the Pass/Refuse outcome and the administering caregiver", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });

    const { result } = recordMedPass([
      makeMedPassService({ passOrRefuse: "Refuse", remarks: "Resident declined" }),
    ]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const body = mockedAxios.put.mock.calls[0][1] as any;
    expect(body.medPass.services[0]).toMatchObject({
      passOrRefuse: "Refuse",
      remarks: "Resident declined",
      providedBy: UUIDS.pcg,
    });
  });

  it("surfaces a rejection without retrying — a dose must not be double-recorded", async () => {
    mockedAxios.put.mockRejectedValue({
      response: { status: 400, data: { error: "Med pass already recorded" } },
    });

    const { result } = recordMedPass();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedAxios.put).toHaveBeenCalledTimes(1);
  });
});

// ─── Moving a lead into clinical ─────────────────────────────────────────────

describe("Moving a senior lead into clinical", () => {
  /**
   * components/lead-action-cell.tsx writes the clinical record first and only
   * writes the CRM record (role -> Senior, milestone -> contract) from the
   * clinical call's `onSuccess`. Both halves are asserted because a lead that
   * lands in one system but not the other is invisible to its care team.
   */
  it("PUTs the clinical record, then the CRM record", async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });
    const { result } = renderHookWithProviders(() => useUpdate());

    await new Promise<void>((resolve) => {
      result.current.mutate(
        {
          data: { userId: UUIDS.lead, status: "In Home" },
          path: ClinicalUserPath,
        },
        { onSuccess: () => resolve() }
      );
    });

    const { result: crm } = renderHookWithProviders(() => useUpdate());
    crm.current.mutate({
      data: {
        userId: UUIDS.lead,
        role: userRoles.SENIOR,
        milestone: ["initial contact", "tour", "contract"],
        contractCompletedOn: "2026-02-20",
      },
      path: UserPath,
    });
    await waitFor(() => expect(crm.current.isSuccess).toBe(true));

    expect(mockedAxios.put.mock.calls[0][0]).toBe(
      `${API}${ClinicalUserPath}/${UUIDS.lead}`
    );
    expect(mockedAxios.put.mock.calls[1][0]).toBe(`${API}${UserPath}/${UUIDS.lead}`);

    const crmBody = mockedAxios.put.mock.calls[1][1] as any;
    expect(crmBody.role).toBe("Senior");
    expect(crmBody.milestone).toContain("contract");
  });

  it("does not write the CRM record when the clinical write fails", async () => {
    mockedAxios.put.mockRejectedValue({
      response: { status: 500, data: { error: "Clinical service unavailable" } },
    });

    const { result } = renderHookWithProviders(() => useUpdate());
    result.current.mutate({
      data: { userId: UUIDS.lead, status: "In Home" },
      path: ClinicalUserPath,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    // Only the clinical attempt was made; the CRM follow-up hangs off onSuccess.
    expect(mockedAxios.put).toHaveBeenCalledTimes(1);
    expect(mockedAxios.put.mock.calls[0][0]).toContain(ClinicalUserPath);
  });
});

// ─── Incident report ─────────────────────────────────────────────────────────

describe("Filing an incident report", () => {
  it("POSTs the report against the senior's clinical record", async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });

    const { result } = renderHookWithProviders(() => useCreate());
    result.current.mutate({
      userData: {
        userId: UUIDS.senior,
        incidentReport: {
          incidentStartTime: "09:30:00",
          incidentDescription: "Resident slipped in the hallway",
        },
      },
      path: ClinicalUserPath,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${ClinicalUserPath}`);
    expect((mockedAxios.post.mock.calls[0][1] as any).incidentReport.incidentDescription)
      .toBe("Resident slipped in the hallway");
  });

  it("surfaces a validation error from the API", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 400, data: { error: "incidentDescription is required" } },
    });

    const { result } = renderHookWithProviders(() => useCreate());
    result.current.mutate({
      userData: { userId: UUIDS.senior, incidentReport: {} },
      path: ClinicalUserPath,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as any).response.data.error).toBe(
      "incidentDescription is required"
    );
  });
});
