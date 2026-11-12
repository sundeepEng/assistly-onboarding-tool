import { TEST_HOME_ID, TEST_LEAD_ID } from "../constants";

/** A CRM user row as GET /v1/users returns it. */
export const buildUserRow = (overrides: Record<string, any> = {}) => ({
  userId: TEST_LEAD_ID,
  name: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@assistly.com",
  mobile: "5551234567",
  role: "Lead",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact"],
  createdAt: "2026-01-15T10:00:00.000Z",
  modifiedAt: "2026-02-18T10:00:00.000Z",
  documents: [],
  ...overrides,
});
