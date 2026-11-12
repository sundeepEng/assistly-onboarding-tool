/**
 * Login screen — components/login/desktop-login.tsx
 *
 * Renders the real component against a mocked axios so the assertions cover the
 * wiring the Cypress suite exercises end-to-end: validation gating, the exact
 * payload sent to /signin, the popover messages, and the post-login redirect.
 */

import axios from "axios";
import Cookies from "js-cookie";

import DesktopLogin from "../../../components/login/desktop-login";
import {
  resetPasswordPath,
  salesDashboardPath,
  userSigninPath,
} from "../../../utils/constants";
import { buildSigninResponse, clearAuthSession } from "../../test-utils/auth";
import { resetRouterMock, routerMock } from "../../test-utils/next-router-mock";
import {
  renderWithProviders,
  screen,
  setupUser,
  waitFor,
  within,
  type TestUser,
} from "../../test-utils/render";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const API = process.env.NEXT_PUBLIC_BASE_URL;
const VALID_EMAIL = "testuser@assistly.com";
const VALID_PASSWORD = "ValidPass@123";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const renderLogin = () => renderWithProviders(<DesktopLogin />);

const emailInput = () => document.querySelector('input[name="email"]') as HTMLInputElement;
const passwordInput = () =>
  document.querySelector('input[name="password"]') as HTMLInputElement;
const signInButton = () => screen.getByRole("button", { name: /sign in/i });

const fillLoginForm = async (
  user: TestUser,
  email: string,
  password: string
) => {
  await user.clear(emailInput());
  if (email) await user.type(emailInput(), email);
  await user.clear(passwordInput());
  if (password) await user.type(passwordInput(), password);
};

/** The popover message currently held in the exception-popover slice. */
const popoverMessage = (store: any) => store.getState().exceptionPopover.popoverMessage;

/**
 * After a successful sign-in the handler GETs /v1/home to learn whether the home
 * runs a sales pipeline, caches it in a cookie, and routes on it. Every success
 * path therefore needs this stubbed.
 */
const stubHome = (isSalesRequired: boolean) =>
  mockedAxios.get.mockResolvedValue({
    data: { home: { homeName: "Comfort Cove", isSalesRequired } },
  });

beforeEach(() => {
  clearAuthSession();
  resetRouterMock();
  stubHome(false);
});

// ─── 1. Structure ────────────────────────────────────────────────────────────

describe("Login screen — structure", () => {
  it("renders the Login heading and subtitle", () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(
      screen.getByText("Access your assistly account securely.")
    ).toBeInTheDocument();
  });

  it("renders email and password fields with their placeholders", () => {
    renderLogin();
    expect(emailInput()).toHaveAttribute("placeholder", "Enter your email");
    expect(passwordInput()).toHaveAttribute("placeholder", "Enter your password");
  });

  it("masks the password field by default", () => {
    renderLogin();
    expect(passwordInput()).toHaveAttribute("type", "password");
  });

  it("renders the Sign in submit button and the Forgot password link", () => {
    renderLogin();
    expect(signInButton()).toBeInTheDocument();
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
  });

  it("renders the Assistly logo", () => {
    renderLogin();
    expect(screen.getByAltText("Assistly")).toBeInTheDocument();
  });
});

// ─── 2. UX behaviour ─────────────────────────────────────────────────────────

describe("Login screen — UX behaviour", () => {
  it("reveals and re-masks the password via the toggle button", async () => {
    const user = setupUser();
    renderLogin();

    await user.type(passwordInput(), "MySecret@1");
    expect(passwordInput()).toHaveAttribute("type", "password");

    // FormInputFieldComponent falls back to `props.type` (undefined here) when
    // revealed, so the attribute is dropped rather than set to "text".
    const toggle = within(passwordInput().parentElement!).getByRole("button");
    await user.click(toggle);
    expect(passwordInput()).not.toHaveAttribute("type", "password");
    expect(passwordInput()).toHaveValue("MySecret@1");

    await user.click(toggle);
    expect(passwordInput()).toHaveAttribute("type", "password");
  });

  it("trims whitespace typed into the password field", async () => {
    const user = setupUser();
    renderLogin();

    await user.type(passwordInput(), "  Spaced@1  ");
    expect(passwordInput()).toHaveValue("Spaced@1");
  });

  it("navigates to the Forgot Password screen and back", async () => {
    const user = setupUser();
    renderLogin();

    await user.click(screen.getByText("Forgot password?"));
    expect(screen.getByText("Forgot Your Password?")).toBeInTheDocument();
    expect(
      screen.getByText("Provide your email to receive a password reset OTP")
    ).toBeInTheDocument();

    await user.click(screen.getByText("Back to login"));
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });
});

// ─── 3. Validation gating ────────────────────────────────────────────────────

describe("Login screen — validation", () => {
  it("blocks submission and flags both fields when the form is untouched", async () => {
    const user = setupUser();
    renderLogin();

    await user.click(signInButton());

    await waitFor(() => expect(screen.getAllByText("Required")).toHaveLength(2));
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("does not call the API when the email is malformed", async () => {
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, "bad-email", VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() =>
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("does not call the API when the password fails the complexity rule", async () => {
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, VALID_EMAIL, "alllowercase1");
    await user.click(signInButton());

    await waitFor(() =>
      expect(
        screen.getByText(
          "Password should be of minimum length 8 characters with atleast one uppercase, one lowercase, one number, one special character"
        )
      ).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("clears the email error once a valid address is entered", async () => {
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, "bad-email", VALID_PASSWORD);
    await user.click(signInButton());
    await waitFor(() =>
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument()
    );

    await user.clear(emailInput());
    await user.type(emailInput(), VALID_EMAIL);

    await waitFor(() =>
      expect(
        screen.queryByText("Please enter a valid email address")
      ).not.toBeInTheDocument()
    );
  });
});

// ─── 4. Successful login ─────────────────────────────────────────────────────

describe("Login screen — successful login", () => {
  beforeEach(() => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: buildSigninResponse("PCHO"),
    });
  });

  it("POSTs the credentials to the /signin endpoint", async () => {
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledTimes(1));
    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${userSigninPath}`);
  });

  it("lowercases the email but sends the password verbatim", async () => {
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, "TestUser@Assistly.com", VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(mockedAxios.post.mock.calls[0][1]).toEqual({
      email: "testuser@assistly.com",
      password: VALID_PASSWORD,
    });
  });

  it("rejects a padded email outright — the handler's trim runs after validation", async () => {
    // The email field does no trimming of its own (only password fields do), and
    // `loginSchema` sees the raw value, so the whitespace never reaches the API.
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, "  TestUser@Assistly.com  ", VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() =>
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("persists the session cookies returned by the API", async () => {
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() =>
      expect(Cookies.get("idToken")).toBe(buildSigninResponse("PCHO").cookies.idToken)
    );
    expect(Cookies.get("accessToken")).toBe("test-access-token");
  });

  it("shows the 'Login Successful!' popover", async () => {
    const user = setupUser();
    const { store } = renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() => expect(popoverMessage(store)).toBe("Login Successful!"));
    expect(store.getState().exceptionPopover.isPopoverVisible).toBe(true);
  });

  it("sends a PCHO at a non-sales home to the senior leads list", async () => {
    stubHome(false);
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    // `getInitialRoute` overrides the PCHO's own INITIAL_ROUTE ("/") once
    // `isSalesRequired` is known — see utils/roleAccess.ts.
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/crm"));
  });

  it("sends a PCHO at a sales home to the sales dashboard", async () => {
    stubHome(true);
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(salesDashboardPath)
    );
  });

  it("caches the home's isSalesRequired flag in a cookie", async () => {
    stubHome(true);
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() => expect(Cookies.get("isSalesRequired")).toBe("true"));
  });

  it("falls back to the senior leads list when the home lookup fails", async () => {
    // The handler swallows the error, leaving the cookie unwritten — so
    // `isSalesRequired` reads false and the PCHO lands on /crm rather than
    // being stranded on the login screen.
    mockedAxios.get.mockRejectedValue(new Error("home service down"));
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/crm"));
  });

  it("redirects a Lead to their own CRM record", async () => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: buildSigninResponse("Lead"),
    });
    const user = setupUser();
    renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    // Lead INITIAL_ROUTE is `/crm/${userId}` — the id comes from the cookie the
    // sign-in response just wrote.
    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        expect.stringMatching(/^\/crm\/.+/)
      )
    );
  });
});

// ─── 5. API error handling ───────────────────────────────────────────────────

describe("Login screen — API errors", () => {
  it("surfaces the API's message on a 401", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 401, data: { error: "Invalid email or password" } },
    });
    const user = setupUser();
    const { store } = renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() =>
      expect(popoverMessage(store)).toBe("Invalid email or password")
    );
  });

  it("marks the popover as an error so it does not auto-dismiss", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 401, data: { error: "User not found" } },
    });
    const user = setupUser();
    const { store } = renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    // `popoverCloseOptions` is what keeps an error popover on screen; success
    // popovers leave it false and a timer closes them after 2s.
    await waitFor(() =>
      expect(store.getState().exceptionPopover.popoverCloseOptions).toBe(true)
    );
  });

  it("falls back to 'Failed to Signin' when the error body has no `error` key", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 500, data: { message: "Internal Server Error" } },
    });
    const user = setupUser();
    const { store } = renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() => expect(popoverMessage(store)).toBe("Failed to Signin"));
  });

  it("falls back to 'Failed to Signin' on a network failure", async () => {
    mockedAxios.post.mockRejectedValue(new Error("Network Error"));
    const user = setupUser();
    const { store } = renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() => expect(popoverMessage(store)).toBe("Failed to Signin"));
  });

  it("does not navigate away and writes no cookies after a failed login", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 401, data: { error: "Invalid email or password" } },
    });
    const user = setupUser();
    const { store } = renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() =>
      expect(popoverMessage(store)).toBe("Invalid email or password")
    );
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(Cookies.get("idToken")).toBeUndefined();
  });

  it("re-enables the Sign in button after an error so the user can retry", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 401, data: { error: "Invalid email or password" } },
    });
    const user = setupUser();
    const { store } = renderLogin();

    await fillLoginForm(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(signInButton());

    await waitFor(() =>
      expect(popoverMessage(store)).toBe("Invalid email or password")
    );
    expect(signInButton()).not.toBeDisabled();
  });
});

// ─── 6. Forgot password ──────────────────────────────────────────────────────

describe("Login screen — forgot password", () => {
  const goToForgotPassword = async (user: TestUser) => {
    await user.click(screen.getByText("Forgot password?"));
    expect(screen.getByText("Forgot Your Password?")).toBeInTheDocument();
  };

  it("rejects a malformed email before calling the API", async () => {
    const user = setupUser();
    renderLogin();
    await goToForgotPassword(user);

    await user.type(emailInput(), "not-an-email");
    await user.click(screen.getByRole("button", { name: /send email/i }));

    await waitFor(() => expect(screen.getByText("Invalid Email")).toBeInTheDocument());
    expect(mockedAxios.put).not.toHaveBeenCalled();
  });

  it("PUTs the lowercased email to /reset-password and moves to the OTP screen", async () => {
    // useUpdatePassword sends FORGOT_PASSWORD as a PUT, not a POST.
    mockedAxios.put.mockResolvedValue({ status: 200, data: { message: "OTP sent" } });
    const user = setupUser();
    const { store } = renderLogin();
    await goToForgotPassword(user);

    await user.type(emailInput(), "TestUser@Assistly.com");
    await user.click(screen.getByRole("button", { name: /send email/i }));

    await waitFor(() => expect(mockedAxios.put).toHaveBeenCalled());
    expect(mockedAxios.put.mock.calls[0][0]).toBe(`${API}${resetPasswordPath}`);
    expect(mockedAxios.put.mock.calls[0][1]).toEqual({
      email: "testuser@assistly.com",
    });

    await waitFor(() => expect(popoverMessage(store)).toBe("Otp sent to email!"));
    expect(screen.getByText("Enter OTP & Reset Password")).toBeInTheDocument();
  });

  it("stays on the screen and shows the API error when the request fails", async () => {
    // The service rethrows `error.response.data`, so the component reads `.error`.
    mockedAxios.put.mockRejectedValue({
      response: { status: 404, data: { error: "User not found" } },
    });
    const user = setupUser();
    const { store } = renderLogin();
    await goToForgotPassword(user);

    await user.type(emailInput(), "unknown@assistly.com");
    await user.click(screen.getByRole("button", { name: /send email/i }));

    await waitFor(() => expect(popoverMessage(store)).toBe("User not found"));
    expect(screen.getByText("Forgot Your Password?")).toBeInTheDocument();
  });
});
