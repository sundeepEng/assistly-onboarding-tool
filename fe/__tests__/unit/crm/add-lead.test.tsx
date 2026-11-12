/**
 * Add Senior Lead workflow — components/add-lead.tsx
 *
 * The primary CRM write path: the PCHO opens the modal from /crm, fills the
 * form, and the lead is created against POST /v1/user. This suite drives the
 * real form (react-hook-form + CreateLeadSchema) with axios mocked, so it covers
 * the field-level validation, the derived fields the handler adds (name,
 * homeId, role, milestone), the success/failure feedback, and the modal close.
 */

import axios from "axios";

import Cookies from "js-cookie";

import { AddLeadFormWrapper } from "../../../components/add-lead";
import { UserPath } from "../../../utils/constants";
import {
  clearAuthSession,
  setAuthSession,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../test-utils/auth";
import { routerMock, resetRouterMock } from "../../test-utils/next-router-mock";
import {
  renderWithProviders,
  screen,
  setupUser,
  waitFor,
  type TestUser,
} from "../../test-utils/render";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Seeding onboarding documents talks to S3, which is out of scope for the form's
// contract — stub it so the test asserts what the CRM API receives.
jest.mock("../../../utils/createDocumentsFromS3", () => ({
  createDocumentObjectsFromS3Folder: jest.fn(() =>
    Promise.resolve([{ name: "admission_agreement", url: "s3://doc" }])
  ),
}));

const API = process.env.NEXT_PUBLIC_BASE_URL;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const field = (name: string) =>
  document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: /save/i });

/**
 * The wrapper issues two kinds of GET:
 *   - /v1/home  — `useGetHomeType` and the wrapper's own `useGetById`
 *   - /v1/users — three calls (PCHO, sales director, sales rep) that build the
 *                 Lead Owner options, and from them `defaultLeadOwner`
 *
 * `leadOwners` defaults to the signed-in user so `defaultLeadOwner` resolves to a
 * real UUID — see the note on `renderSettled` for why that matters.
 */
const stubHome = (
  homeType = "Residential",
  homeName = "Comfort Cove",
  leadOwners: { name: string; userId: string }[] = [
    { name: "Test User", userId: TEST_USER_ID },
  ]
) => {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.includes("/v1/home"))
      return Promise.resolve({ data: { home: { homeName, homeType } } });
    if (url.includes("/v1/users"))
      return Promise.resolve({ data: { users: leadOwners } });
    return Promise.resolve({ data: {} });
  });
};

const fillLead = async (
  user: TestUser,
  {
    firstName = "Jane",
    middleName = "",
    lastName = "Doe",
    email = "jane.doe@assistly.com",
    mobile = "5551234567",
  } = {}
) => {
  if (firstName) await user.type(field("firstName"), firstName);
  if (middleName) await user.type(field("middleName"), middleName);
  if (lastName) await user.type(field("lastName"), lastName);
  if (email) await user.type(field("email"), email);
  if (mobile) await user.type(field("mobile"), mobile);
};

const popover = (store: any) => store.getState().exceptionPopover;

const renderAddLead = () => renderWithProviders(<AddLeadFormWrapper />, { role: "PCHO" });

/**
 * Render and wait for every query to settle before touching the form.
 *
 * The wrapper keys the `<Form>` on `leadOwnerOptions.length`, so the moment the
 * three /v1/users calls resolve the form is torn down and remounted — anything
 * typed before that point is silently discarded. Waiting on `isFetching()` is
 * the deterministic signal that the options (and therefore `defaultLeadOwner`
 * and the form's `defaultValues`) have reached their final value.
 */
const renderSettled = async () => {
  const rendered = renderAddLead();
  await waitFor(() => expect(rendered.queryClient.isFetching()).toBe(0));
  return rendered;
};

beforeEach(() => {
  clearAuthSession();
  setAuthSession("PCHO");
  resetRouterMock();
  stubHome();
});

// ─── 1. Form structure ───────────────────────────────────────────────────────

describe("Add Lead — form structure", () => {
  it("renders every lead field", () => {
    renderAddLead();

    ["firstName", "middleName", "lastName", "email", "mobile"].forEach((name) =>
      expect(field(name)).toBeInTheDocument()
    );
    expect(saveButton()).toBeInTheDocument();
  });

  it("marks first and last name as required in the labels", () => {
    renderAddLead();
    expect(screen.getByText("First Name *")).toBeInTheDocument();
    expect(screen.getByText("Last Name *")).toBeInTheDocument();
  });

  it("labels the phone number optional for a residential home", async () => {
    renderAddLead();
    await waitFor(() => expect(screen.getByText("Phone Number")).toBeInTheDocument());
  });

  it("labels the phone number required for an In-Home Care home", async () => {
    stubHome("In Home Care");
    renderAddLead();
    await waitFor(() =>
      expect(screen.getByText("Phone Number *")).toBeInTheDocument()
    );
  });
});

// ─── 2. Validation ───────────────────────────────────────────────────────────

describe("Add Lead — validation", () => {
  it("blocks submission of an empty form and flags both names", async () => {
    const user = setupUser();
    await renderSettled();

    await user.click(saveButton());

    await waitFor(() =>
      expect(screen.getByText("First Name is required")).toBeInTheDocument()
    );
    expect(screen.getByText("Last Name is required")).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("requires a last name when only the first name is given", async () => {
    const user = setupUser();
    await renderSettled();

    await user.type(field("firstName"), "Jane");
    await user.click(saveButton());

    await waitFor(() =>
      expect(screen.getByText("Last Name is required")).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("rejects a name containing punctuation", async () => {
    const user = setupUser();
    await renderSettled();

    await fillLead(user, { firstName: "Jane@" });
    await user.click(saveButton());

    await waitFor(() =>
      expect(
        screen.getByText("First Name accepts only alphabets and numbers")
      ).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const user = setupUser();
    await renderSettled();

    await fillLead(user, { email: "not-an-email" });
    await user.click(saveButton());

    await waitFor(() => expect(screen.getByText("Invalid email")).toBeInTheDocument());
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("rejects a phone number that is not 10 digits", async () => {
    const user = setupUser();
    await renderSettled();

    await fillLead(user, { mobile: "55512" });
    await user.click(saveButton());

    await waitFor(() =>
      expect(
        screen.getByText("Mobile number must be exactly 10 digits")
      ).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("rejects a formatted phone number — digits only", async () => {
    const user = setupUser();
    await renderSettled();

    await fillLead(user, { mobile: "555-123-4567" });
    await user.click(saveButton());

    await waitFor(() =>
      expect(screen.getByText("Only numbers are allowed")).toBeInTheDocument()
    );
  });

  it("blocks an In-Home Care lead with no phone number", async () => {
    stubHome("In Home Care");
    const user = setupUser();
    await renderSettled();
    await waitFor(() => expect(screen.getByText("Phone Number *")).toBeInTheDocument());

    await fillLead(user, { mobile: "" });
    await user.click(saveButton());

    // zod's own "Required" for an undefined field, the regex message for "".
    await waitFor(() =>
      expect(screen.getByText(/^(Required|Only numbers are allowed)$/)).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("clears an error once the field is corrected", async () => {
    const user = setupUser();
    await renderSettled();

    await fillLead(user, { email: "bad" });
    await user.click(saveButton());
    await waitFor(() => expect(screen.getByText("Invalid email")).toBeInTheDocument());

    await user.clear(field("email"));
    await user.type(field("email"), "jane.doe@assistly.com");

    await waitFor(() =>
      expect(screen.queryByText("Invalid email")).not.toBeInTheDocument()
    );
  });
});

// ─── 3. Successful creation ──────────────────────────────────────────────────

describe("Add Lead — successful creation", () => {
  beforeEach(() => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: { userId: "new-lead" } });
  });

  const submitValidLead = async (overrides = {}) => {
    const user = setupUser();
    const rendered = await renderSettled();
    await fillLead(user, overrides);
    await user.click(saveButton());
    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    return { ...rendered, body: mockedAxios.post.mock.calls[0][1] as any };
  };

  it("POSTs to the CRM user endpoint", async () => {
    await submitValidLead();
    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${API}${UserPath}`);
  });

  it("sends the typed fields through unchanged", async () => {
    const { body } = await submitValidLead();
    expect(body).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      mobile: "5551234567",
    });
  });

  it("lowercases the email", async () => {
    const { body } = await submitValidLead({ email: "Jane.Doe@Assistly.com" });
    expect(body.email).toBe("jane.doe@assistly.com");
  });

  it("derives the display name from the name parts", async () => {
    const { body } = await submitValidLead({ middleName: "Q" });
    expect(body.name).toBe("Jane Q Doe");
  });

  it("omits a blank middle name from the derived display name", async () => {
    const { body } = await submitValidLead();
    expect(body.name).toBe("Jane Doe");
  });

  it("stamps the creator's homeId and the home's name onto the record", async () => {
    const { body } = await submitValidLead();
    expect(body.homeId).toBe(TEST_HOME_ID);
    expect(body.home).toBe("Comfort Cove");
  });

  it("creates the record with the Lead role at the 'initial contact' milestone", async () => {
    const { body } = await submitValidLead();
    expect(body.role).toBe("Lead");
    expect(body.milestone).toEqual(["initial contact"]);
  });

  it("attaches the onboarding documents seeded for the home", async () => {
    const { body } = await submitValidLead();
    expect(body.documents).toEqual([
      { name: "admission_agreement", url: "s3://doc" },
    ]);
  });

  it("shows the success popover", async () => {
    const { store } = await submitValidLead();
    await waitFor(() =>
      expect(popover(store).popoverMessage).toBe("New Senior Lead added successfully!")
    );
    expect(popover(store).isPopoverVisible).toBe(true);
  });

  it("closes the Add Lead modal", async () => {
    const { store } = await submitValidLead();
    await waitFor(() => expect(store.getState().modal.isAddLeadModalOpen).toBe(false));
  });

  it("returns the user to the CRM list", async () => {
    await submitValidLead();
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/crm"));
  });
});

// ─── 4. Failure handling ─────────────────────────────────────────────────────

describe("Add Lead — failures", () => {
  const submitAgainstFailure = async () => {
    const user = setupUser();
    const rendered = await renderSettled();
    await fillLead(user);
    await user.click(saveButton());
    return rendered;
  };

  it("surfaces the API's message and keeps the modal open", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 400, data: { error: "Email already exists" } },
    });

    const { store } = await submitAgainstFailure();

    await waitFor(() =>
      expect(popover(store).popoverMessage).toBe("Email already exists")
    );
    expect(popover(store).popoverCloseOptions).toBe(true);
    expect(routerMock.push).not.toHaveBeenCalledWith("/crm");
  });

  it("stringifies an array of field errors — the generic fallback never reaches the user", async () => {
    // `handleSubmitAddLeadData` wraps the mutation in a promise whose `onError`
    // dispatches "Failed to add Senior Lead." and then rejects. The rejection is
    // caught by the surrounding try/catch, which immediately dispatches
    // `String(error.response.data.error)` over the top — so the array is shown
    // comma-joined and the friendly fallback is dead code. Worth fixing in the
    // component; asserted here so the current behaviour is not mistaken for the
    // intended one.
    mockedAxios.post.mockRejectedValue({
      response: { status: 400, data: { error: ["firstName invalid", "email taken"] } },
    });

    const { store } = await submitAgainstFailure();

    await waitFor(() =>
      expect(popover(store).popoverMessage).toBe("firstName invalid,email taken")
    );
  });

  it("re-enables Save after a failure so the user can retry", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 500, data: { error: "Internal Server Error" } },
    });

    const { store } = await submitAgainstFailure();

    await waitFor(() =>
      expect(popover(store).popoverMessage).toBe("Internal Server Error")
    );
    expect(saveButton()).not.toBeDisabled();
  });

  it("does not close the modal on failure", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 500, data: { error: "boom" } },
    });

    const { store } = await submitAgainstFailure();

    await waitFor(() => expect(popover(store).popoverMessage).toBe("boom"));
    expect(store.getState().modal.isAddLeadModalOpen).toBe(false); // starts closed
    expect(routerMock.push).not.toHaveBeenCalledWith("/crm");
  });
});

// ─── 5. Lead owner ───────────────────────────────────────────────────────────

describe("Add Lead — lead owner", () => {
  beforeEach(() => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: { userId: "new-lead" } });
  });

  it("hides the Lead Owner select when the home does not run sales", async () => {
    await renderSettled();
    expect(document.querySelector('select[name="isReferredByUserId"]')).toBeNull();
  });

  it("shows the Lead Owner select when the home runs sales", async () => {
    Cookies.set("isSalesRequired", "true");
    await renderSettled();
    expect(
      document.querySelector('select[name="isReferredByUserId"]')
    ).toBeInTheDocument();
  });

  it("lists the home's PCHOs, sales directors and sales reps as owners", async () => {
    Cookies.set("isSalesRequired", "true");
    stubHome("Residential", "Comfort Cove", [
      { name: "Test User", userId: TEST_USER_ID },
    ]);
    await renderSettled();

    // Three /v1/users calls each return the stub, so the signed-in user appears
    // once per role bucket.
    expect(screen.getAllByRole("option", { name: "Test User" })).toHaveLength(3);
  });

  it("defaults the owner to the signed-in user and sends it on create", async () => {
    const user = setupUser();
    await renderSettled();
    await fillLead(user);
    await user.click(saveButton());

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect((mockedAxios.post.mock.calls[0][1] as any).isReferredByUserId).toBe(
      TEST_USER_ID
    );
  });

  /**
   * Known defect — pinned so a fix is a deliberate, visible change.
   *
   * `AddLeadFormWrapper` seeds `defaultValues={{ isReferredByUserId: defaultLeadOwner }}`,
   * and `defaultLeadOwner` falls back to `""` whenever the signed-in user is not
   * among the fetched owners — e.g. a HomeAdmin or Nurse, or any home whose
   * /v1/users calls come back empty. `""` fails the schema's `.uuid()` check, so
   * zodResolver blocks the submit; and because the Lead Owner select only renders
   * when `isSalesRequired`, the "Lead owner is required" message has nowhere to
   * appear. The result is a Save button that does nothing at all, with no feedback.
   *
   * Fix would be to omit the key when no owner resolves:
   *   defaultValues={defaultLeadOwner ? { isReferredByUserId: defaultLeadOwner } : {}}
   */
  it("silently blocks Save when no lead owner resolves for the signed-in user", async () => {
    stubHome("Residential", "Comfort Cove", []); // signed-in user not an owner
    const user = setupUser();
    await renderSettled();

    await fillLead(user);
    await user.click(saveButton());

    await waitFor(() => expect(saveButton()).toBeInTheDocument());
    expect(mockedAxios.post).not.toHaveBeenCalled();
    // Nothing tells the user why — the error has no field to render against.
    expect(screen.queryByText("Lead owner is required")).not.toBeInTheDocument();
  });

  it("surfaces that same error once the select is on screen", async () => {
    // Owners exist but none of them is the signed-in user, so `defaultLeadOwner`
    // is still "" — the difference is that the select now renders, giving the
    // error somewhere to appear.
    Cookies.set("isSalesRequired", "true");
    stubHome("Residential", "Comfort Cove", [
      { name: "Someone Else", userId: "33333333-3333-4333-8333-333333333333" },
    ]);
    const user = setupUser();
    await renderSettled();

    await fillLead(user);
    await user.click(saveButton());

    await waitFor(() =>
      expect(screen.getByText("Lead owner is required")).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  /**
   * Known defect — pinned rather than fixed.
   *
   * `isLoadingLeadOwnerOptions` is `isSalesRequired && leadOwnerOptions.length === 0`,
   * which cannot distinguish "still loading" from "loaded, and there are none".
   * A sales home whose /v1/users calls return no PCHO, sales director or sales
   * rep therefore sits on the loader forever and can never add a lead.
   */
  it("never renders the form for a sales home with no owners at all", async () => {
    Cookies.set("isSalesRequired", "true");
    stubHome("Residential", "Comfort Cove", []);

    const { queryClient } = await renderSettled();

    expect(queryClient.isFetching()).toBe(0); // nothing left in flight
    expect(field("firstName")).toBeNull();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });
});
