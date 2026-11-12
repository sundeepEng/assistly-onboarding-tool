/**
 * Add Compliance Guest — components/compliance/add-compliance-guest.tsx
 *
 * The compliance module's only write path from CRM: a PCHO invites an external
 * auditor, who then gets a training-only account. The component drives the real
 * form (react-hook-form + `CreateComplianceGuestSchema`) with axios mocked, so
 * this covers field validation, the fields the handler derives (`name`, `role`,
 * `home`, `homeId`), the popover feedback and the redirect.
 */

import axios from "axios";

import AddComplianceGuest from "../../../components/compliance/add-compliance-guest";
import { homePath, UserPath, userRoles } from "../../../utils/constants";
import { clearAuthSession, setAuthSession, TEST_HOME_ID } from "../../test-utils/auth";
import { resetRouterMock, routerMock } from "../../test-utils/next-router-mock";
import {
  renderWithProviders,
  screen,
  setupUser,
  waitFor,
  type TestUser,
} from "../../test-utils/render";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const API = process.env.NEXT_PUBLIC_BASE_URL;

const field = (name: string) =>
  document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: /save/i });

/** The component reads the home only to copy its name onto the payload. */
const stubHome = (homeName = "Comfort Cove") => {
  mockedAxios.get.mockResolvedValue({ data: { home: { homeName, homeId: TEST_HOME_ID } } });
};

const fillGuest = async (
  user: TestUser,
  {
    firstName = "Cora",
    middleName = "",
    lastName = "Guest",
    email = "cora.guest@assistly.com",
    mobile = "5550001111",
  }: Partial<Record<string, string>> = {}
) => {
  if (firstName) await user.type(field("firstName"), firstName);
  if (middleName) await user.type(field("middleName"), middleName);
  if (lastName) await user.type(field("lastName"), lastName);
  if (email) await user.type(field("email"), email);
  if (mobile) await user.type(field("mobile"), mobile);
};

const renderScreen = () => renderWithProviders(<AddComplianceGuest />, { role: "PCHO" });

/** The body of the POST the component made. */
const postedBody = () => mockedAxios.post.mock.calls[0][1] as Record<string, any>;

beforeEach(() => {
  clearAuthSession();
  setAuthSession("PCHO");
  resetRouterMock();
  stubHome();
});

// ─── Structure ───────────────────────────────────────────────────────────────

describe("the form", () => {
  it("renders the five guest fields", () => {
    renderScreen();
    ["firstName", "middleName", "lastName", "email", "mobile"].forEach((name) => {
      expect(field(name)).toBeInTheDocument();
    });
  });

  it("marks the four mandatory fields with an asterisk", () => {
    renderScreen();
    ["First Name *", "Last Name *", "Email *", "Phone Number *"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("leaves the middle name unmarked", () => {
    renderScreen();
    expect(screen.getByText("Middle Name")).toBeInTheDocument();
  });

  it("renders a Save button", () => {
    renderScreen();
    expect(saveButton()).toBeInTheDocument();
  });

  it("fetches the home so the payload can carry its name", async () => {
    renderScreen();
    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API}${homePath}/${TEST_HOME_ID}`,
        expect.anything()
      )
    );
  });
});

// ─── Validation gating ───────────────────────────────────────────────────────

describe("validation", () => {
  it("does not POST when the form is empty", async () => {
    const user = setupUser();
    renderScreen();

    await user.click(saveButton());

    // One message per empty mandatory field — first name, last name, email, phone.
    await waitFor(() =>
      expect(screen.getAllByText(/required|character/i).length).toBeGreaterThanOrEqual(4)
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("blocks Save on an invalid email", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user, { email: "cora.guest" });
    await user.click(saveButton());

    await waitFor(() => expect(screen.getByText("Invalid email")).toBeInTheDocument());
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("blocks Save on a short phone number", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user, { mobile: "555000" });
    await user.click(saveButton());

    await waitFor(() =>
      expect(screen.getByText("Mobile number must be exactly 10 digits")).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("blocks Save on a name containing punctuation", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user, { firstName: "O'Brien" });
    await user.click(saveButton());

    await waitFor(() =>
      expect(
        screen.getByText("First Name accepts only alphabets and numbers")
      ).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("blocks Save when the last name is missing", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user, { lastName: "" });
    await user.click(saveButton());

    // The message depends on whether the untouched field reaches zod as
    // undefined or "" (the second carries the schema's own typo).
    await waitFor(() =>
      expect(
        screen.getByText(/^Last Name (is required|shoudld be more than \(1\) character)$/)
      ).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("submits once every field is valid", async () => {
    const user = setupUser();
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });
    renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledTimes(1));
  });
});

// ─── The request ─────────────────────────────────────────────────────────────

describe("the created guest", () => {
  beforeEach(() => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });
  });

  it("POSTs to /v1/user", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${UserPath}`);
  });

  it("sends the typed fields verbatim", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({
      firstName: "Cora",
      lastName: "Guest",
      mobile: "5550001111",
    });
  });

  it("stamps the role as ComplianceGuest", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(postedBody().role).toBe(userRoles.COMPLIANCE_GUEST);
  });

  it("derives `name` by joining the name parts", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user, { middleName: "Ann" });
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(postedBody().name).toBe("Cora Ann Guest");
  });

  it("omits the middle name from `name` when it is blank — no double space", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(postedBody().name).toBe("Cora Guest");
  });

  it("attaches the caller's home id", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(postedBody().homeId).toBe(TEST_HOME_ID);
  });

  it("attaches the home name fetched from /v1/home", async () => {
    const user = setupUser();
    stubHome("Sunrise Manor");
    renderScreen();

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(postedBody().home).toBe("Sunrise Manor");
  });

  it("normalises the email to lower case and trims it", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user, { email: "Cora.Guest@Assistly.com" });
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(postedBody().email).toBe("cora.guest@assistly.com");
  });

  it("authenticates with the session id token", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    const config = mockedAxios.post.mock.calls[0][2] as any;
    expect(config.headers.Authorization).toMatch(/^Bearer /);
  });

  /**
   * Pinned: the handler builds `name` and adds it to the payload, but
   * `CreateComplianceGuestSchema` is `.strict()` and declares no `name` field.
   * Validation runs *before* the handler, on the raw form values, so the schema
   * never sees the object that is actually sent — the two have drifted apart and
   * nothing catches it.
   */
  it("sends a payload its own schema would reject", () => {
    const {
      CreateComplianceGuestSchema,
    } = require("../../../model/crm/user.model");
    const asSent = {
      firstName: "Cora",
      lastName: "Guest",
      email: "cora.guest@assistly.com",
      mobile: "5550001111",
      name: "Cora Guest",
      role: "ComplianceGuest",
      home: "Comfort Cove",
      homeId: TEST_HOME_ID,
    };
    expect(CreateComplianceGuestSchema.safeParse(asSent).success).toBe(false);
  });
});

// ─── Feedback ────────────────────────────────────────────────────────────────

describe("after a successful save", () => {
  beforeEach(() => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: {} });
  });

  it("announces the success through the popover", async () => {
    const user = setupUser();
    const { store } = renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() =>
      expect(store.getState().exceptionPopover.popoverMessage).toBe(
        "Compliance Guest Added Successfully"
      )
    );
  });

  it("opens the popover", async () => {
    const user = setupUser();
    const { store } = renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(store.getState().exceptionPopover.isPopoverVisible).toBe(true));
  });

  it("redirects to the compliance guest list", async () => {
    const user = setupUser();
    renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/crm/complianceguest"));
  });

  it("closes the Add Guest modal", async () => {
    const user = setupUser();
    const { store } = renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(store.getState().modal.isAddComplianceModalOpen).toBe(false));
  });
});

describe("after a failed save", () => {
  it("surfaces the API's error string", async () => {
    const user = setupUser();
    mockedAxios.post.mockRejectedValue({
      response: { data: { error: "A user with this email already exists" } },
    });
    const { store } = renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() =>
      expect(store.getState().exceptionPopover.popoverMessage).toBe(
        "A user with this email already exists"
      )
    );
  });

  it("falls back to friendly copy when the API returns an array of errors", async () => {
    const user = setupUser();
    mockedAxios.post.mockRejectedValue({
      response: { data: { error: ["mobile invalid", "email invalid"] } },
    });
    const { store } = renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() =>
      expect(store.getState().exceptionPopover.popoverMessage).toBe(
        "Failed to add Compliance Guest."
      )
    );
  });

  it("offers the close option on failure", async () => {
    const user = setupUser();
    mockedAxios.post.mockRejectedValue({ response: { data: { error: "boom" } } });
    const { store } = renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(store.getState().exceptionPopover.popoverCloseOptions).toBe(true));
  });

  it("does not redirect", async () => {
    const user = setupUser();
    mockedAxios.post.mockRejectedValue({ response: { data: { error: "boom" } } });
    renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(routerMock.push).not.toHaveBeenCalledWith("/crm/complianceguest");
  });

  /**
   * Pinned: a network failure with no `response` leaves `error?.response?.data?.error`
   * undefined. It is not an array, so the ternary takes the first branch and the
   * popover message is set to `undefined` — the user sees an empty popover rather
   * than the "Failed to add Compliance Guest." fallback sitting right beside it.
   */
  it("shows an empty popover when the request fails with no response body", async () => {
    const user = setupUser();
    mockedAxios.post.mockRejectedValue(new Error("Network Error"));
    const { store } = renderScreen();

    await fillGuest(user);
    await user.click(saveButton());

    await waitFor(() => expect(store.getState().exceptionPopover.isPopoverVisible).toBe(true));
    expect(store.getState().exceptionPopover.popoverMessage).toBeUndefined();
  });
});
