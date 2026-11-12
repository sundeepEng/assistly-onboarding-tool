/**
 * Sign-in service — services/authenticate-user.ts
 *
 * This hook owns the only write of the session cookies. If it stops persisting
 * them (or persists them from the wrong place in the body), the user appears to
 * log in and then every authenticated call 401s.
 */

import { waitFor } from "@testing-library/react";
import axios from "axios";
import Cookies from "js-cookie";

import useAuthenticateUser from "../../../services/authenticate-user";
import {
  userSigninPath,
  userSignUpPath,
  activateAccountPath,
} from "../../../utils/constants";
import { buildSigninResponse, clearAuthSession, setAuthSession } from "../../test-utils/auth";
import { renderHookWithProviders } from "../../test-utils/render";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// The URL the service builds — pinned by jest.setup.ts.
const API = process.env.NEXT_PUBLIC_BASE_URL;

/** Drive the mutation and resolve once react-query has settled. */
const signIn = async (
  userData: Record<string, unknown> = {
    email: "testuser@assistly.com",
    password: "ValidPass@123",
  },
  path: string = userSigninPath
) => {
  const { result } = renderHookWithProviders(() => useAuthenticateUser());
  result.current.mutate({ userData, path });
  return result;
};

beforeEach(() => {
  clearAuthSession();
});

describe("useAuthenticateUser — request", () => {
  it("POSTs to {BASE_URL}/signin with the credentials as the body", async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: buildSigninResponse() });

    const result = await signIn();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post).toHaveBeenCalledWith(
      `${API}${userSigninPath}`,
      { email: "testuser@assistly.com", password: "ValidPass@123" },
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("does NOT send an Authorization header on /signin", async () => {
    // Sign-in runs before a session exists. Leaking a stale token here makes a
    // second login silently reuse the previous user's identity.
    setAuthSession("PCHO"); // a stale cookie is present…
    mockedAxios.post.mockResolvedValue({ status: 200, data: buildSigninResponse() });

    const result = await signIn();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const config = mockedAxios.post.mock.calls[0][2] as any;
    expect(config.headers).not.toHaveProperty("Authorization");
  });

  it("DOES send Authorization on /signup — that endpoint creates users on behalf of an admin", async () => {
    const idToken = setAuthSession("PCHO");
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

    const result = await signIn({ email: "new@assistly.com" }, userSignUpPath);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const config = mockedAxios.post.mock.calls[0][2] as any;
    expect(config.headers.Authorization).toBe(`Bearer ${idToken}`);
  });

  it("builds the URL from the configured base URL and the caller's path", async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

    const result = await signIn({ email: "a@b.com" }, activateAccountPath);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${activateAccountPath}`);
  });
});

describe("useAuthenticateUser — session persistence", () => {
  it("writes idToken, accessToken, userId and homeId from response.data.cookies", async () => {
    const body = buildSigninResponse("PCHO");
    mockedAxios.post.mockResolvedValue({ status: 200, data: body });

    const result = await signIn();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Cookies.get("idToken")).toBe(body.cookies.idToken);
    expect(Cookies.get("accessToken")).toBe(body.cookies.accessToken);
    expect(Cookies.get("userId")).toBe(body.cookies.userId);
    expect(Cookies.get("homeId")).toBe(body.cookies.homeId);
  });

  it("persists the role claim so the router can resolve the initial route", async () => {
    const body = buildSigninResponse("Nurse");
    mockedAxios.post.mockResolvedValue({ status: 200, data: body });

    const result = await signIn();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { getUserRoleFromToken } = require("../../../utils/auth");
    expect(getUserRoleFromToken()).toBe("Nurse");
  });

  it("persists nothing when the 200 body has no `cookies` object", async () => {
    // A 200 without `cookies` is a malformed contract; the service must not
    // half-write a session that later reads as "logged in with no token".
    mockedAxios.post.mockResolvedValue({ status: 200, data: { message: "ok" } });

    const result = await signIn();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Cookies.get("idToken")).toBeUndefined();
    expect(Cookies.get("accessToken")).toBeUndefined();
  });

  it("returns the axios response so callers can read the body", async () => {
    const body = buildSigninResponse("PCHO");
    mockedAxios.post.mockResolvedValue({ status: 200, data: body });

    const result = await signIn();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((result.current.data as any).data).toEqual(body);
  });

  it("resolves to undefined for a non-200 success status, leaving no session", async () => {
    // Only a literal 200 is treated as an authenticated response.
    mockedAxios.post.mockResolvedValue({ status: 204, data: buildSigninResponse() });

    const result = await signIn();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeUndefined();
    expect(Cookies.get("idToken")).toBeUndefined();
  });
});

describe("useAuthenticateUser — failures", () => {
  it("surfaces a 401 to the caller as an error", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 401, data: { error: "Invalid email or password" } },
    });

    const result = await signIn();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as any).response.data.error).toBe(
      "Invalid email or password"
    );
  });

  it("writes no session cookies on a failed sign-in", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 401, data: { error: "Invalid email or password" } },
    });

    const result = await signIn();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(Cookies.get("idToken")).toBeUndefined();
    expect(Cookies.get("accessToken")).toBeUndefined();
    expect(Cookies.get("userId")).toBeUndefined();
    expect(Cookies.get("homeId")).toBeUndefined();
  });

  it("surfaces a network error (no response object)", async () => {
    mockedAxios.post.mockRejectedValue(new Error("Network Error"));

    const result = await signIn();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as Error).message).toBe("Network Error");
  });

  it("surfaces a 500 without clearing an existing session", async () => {
    // A server error during a re-login must not log the user out of the session
    // they already have.
    const idToken = setAuthSession("PCHO");
    mockedAxios.post.mockRejectedValue({
      response: { status: 500, data: { message: "Internal Server Error" } },
    });

    const result = await signIn();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(Cookies.get("idToken")).toBe(idToken);
  });
});
