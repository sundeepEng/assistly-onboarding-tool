/// <reference types="cypress" />

/**
 * HCM — team communication & broadcasts
 *
 * Route under test: /hcm/team (pages/hcm/team/index.tsx)
 *
 * The roster footer renders BroadcastList unconditionally, and the floating
 * TeamCommunicationPopup is gated behind HCM_TEAM_BROADCAST/EDIT — so on this
 * page every roster-viewing role causes:
 *
 *     GET  /v1/hcm/broadcasts?home_id={id}     the broadcast feed
 *     POST /v1/hcm/broadcast                 "New Broadcast" → Send
 *     GET  /v1/users?userType=PCHO|PCG       the popup's member list (two calls)
 *     GET  /v1/hcm/communication/conversations?homeId=&userId=
 *     GET  /v1/hcm/communication/conversation/{id}/messages
 *
 * SENDING A MESSAGE IS NOT HTTP
 *   message-card.tsx posts chat payloads over a WebSocket
 *   (action:"sendMessage"), which cy.intercept cannot observe. The HTTP
 *   contract is therefore asserted up to the point the socket takes over:
 *   the conversations list and the per-conversation message fetch. The
 *   POST /v1/hcm/communication/conversation upsert path is defined in
 *   utils/constants but unused by the current send path — pinned as a note,
 *   not a test, so the suite documents as-built behaviour.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const TEAM_PATH = "/hcm/team";

/** Tuesday 8 September 2026, 10:00 local — the instant every HCM spec uses. */
const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();

const MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONVO_ID = "conv-0001";

const buildMember = (overrides: Record<string, any> = {}) => ({
  userId: MEMBER_ID,
  name: "Morris Olsen",
  firstName: "Morris",
  lastName: "Olsen",
  email: "morris.olsen@assistly.com",
  role: "PCG",
  homeId: TEST_HOME_ID,
  isDeleted: false,
  ...overrides,
});

const buildBroadcast = (overrides: Record<string, any> = {}) => ({
  id: "bc-1",
  home_id: TEST_HOME_ID,
  sender_user_id: TEST_USER_ID,
  user_name: "Admin User",
  message: "Handover at 3pm today.",
  created_at: "2026-09-08T08:00:00.000Z",
  ...overrides,
});

// ── Stubs ────────────────────────────────────────────────────────────────────

const stubMembers = (members: any[]) =>
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      // The popup queries PCHO and PCG separately; answer both with the list.
      body: { users: ["PCG", "PCHO"].includes(userType ?? "") ? members : [] },
    });
  }).as("getUsers");

const stubBroadcasts = (broadcasts: any[] = [buildBroadcast()]) =>
  cy.intercept("GET", "**/v1/hcm/broadcasts*", {
    statusCode: 200,
    body: { broadcasts },
  }).as("getBroadcasts");

const stubConversations = (conversations: any[] = []) =>
  cy.intercept("GET", "**/v1/hcm/communication/conversations*", {
    statusCode: 200,
    body: { conversations },
  }).as("getConversations");

const stubMessages = (messages: any[] = []) =>
  cy.intercept("GET", "**/v1/hcm/communication/conversation/*/messages*", {
    statusCode: 200,
    body: { messages },
  }).as("getMessages");

const stubSendBroadcast = () =>
  cy.intercept("POST", "**/v1/hcm/broadcast", {
    statusCode: 200,
    body: { message: "ok" },
  }).as("sendBroadcast");

const visitTeam = (
  role: any = "HomeAdmin",
  opts: { conversations?: any[] } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(role);
  cy.stubHome(buildHome());
  stubMembers([buildMember()]);
  stubBroadcasts();
  stubConversations(opts.conversations ?? []);
  stubMessages([
    {
      conversation_id: CONVO_ID,
      message_id: "m-1",
      message: "Shift covered, thanks!",
      sender_user_id: MEMBER_ID,
      created_at: "2026-09-08T09:00:00.000Z",
    },
  ]);
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts: [] },
  }).as("getShifts");
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(TEAM_PATH);
  cy.contains("Care Team", { timeout: 10000 }).should("be.visible");
};

/**
 * Open the floating team-communication popup. The trigger lives in the
 * `fixed bottom-20 right-40` container — the *other* floating button is Gia
 * (the AI assistant), so a positional "last button" click opens the wrong one.
 */
const openCommsPopup = () => {
  cy.get(".fixed.bottom-20.right-40 button", { timeout: 10000 })
    .first()
    .click();
};

// ── Suite ────────────────────────────────────────────────────────────────────

describe("HCM team communication", { tags: [Tags.REGRESSION] }, () => {
  // ── Broadcast feed — GET /v1/hcm/broadcasts ───────────────────────────────

  describe("GET /v1/hcm/broadcasts — the broadcast feed", { tags: [Tags.HOMEADMIN] }, () => {
    it("requests the broadcast feed when the roster loads", () => {
      visitTeam();
      cy.wait("@getBroadcasts").then(({ request }) => {
        expect(request.method).to.eq("GET");
        expect(request.url).to.include("/v1/hcm/broadcasts");
        expect(request.url).to.include(`home_id=${TEST_HOME_ID}`);
      });
    });

    it("sends the session token on the broadcast request", () => {
      visitTeam();
      cy.wait("@getBroadcasts").then(({ request }) => {
        expect(request.headers["authorization"]).to.match(/^Bearer .+/);
      });
    });

    it("renders the stubbed broadcasts", () => {
      visitTeam();
      cy.wait("@getBroadcasts");
      cy.contains("Handover at 3pm today.").should("be.visible");
      cy.contains("Admin User").should("be.visible");
    });

    it("posts the broadcast payload on send", () => {
      stubSendBroadcast();
      visitTeam();
      cy.wait("@getBroadcasts");
      cy.contains("button", "New Broadcast").click();
      cy.get('textarea[name="broadcastMessage"]').type("Fire drill at noon.");
      cy.contains("button", "Send").click();
      cy.wait("@sendBroadcast").then(({ request }) => {
        expect(request.method).to.eq("POST");
        expect(request.url).to.include("/v1/hcm/broadcast");
        expect(request.body.home_id).to.eq(TEST_HOME_ID);
        expect(request.body.sender_user_id).to.eq(TEST_USER_ID);
        expect(request.body.message).to.eq("Fire drill at noon.");
        expect(request.headers["authorization"]).to.match(/^Bearer .+/);
      });
      cy.contains("Broadcast sent successfully", { timeout: 8000 }).should(
        "be.visible"
      );
    });

    it("sends nothing when the compose box is empty", () => {
      stubSendBroadcast();
      visitTeam();
      cy.wait("@getBroadcasts");
      cy.contains("button", "New Broadcast").click();
      // The Send button is disabled until the message has content.
      cy.contains("button", "Send").should("be.disabled");
      cy.assertNoRequest("@sendBroadcast");
    });
  });

  // ── Conversations — GET /v1/hcm/communication/* ───────────────────────────

  describe("GET /v1/hcm/communication — conversations and messages", { tags: [Tags.HOMEADMIN] }, () => {
    it("requests the conversations list when the popup mounts", () => {
      visitTeam();
      openCommsPopup();
      cy.wait("@getConversations", { timeout: 10000 }).then(({ request }) => {
        expect(request.method).to.eq("GET");
        expect(request.url).to.include(
          "/v1/hcm/communication/conversations"
        );
        expect(request.headers["authorization"]).to.match(/^Bearer .+/);
      });
    });

    it("fetches a conversation's messages when a member is opened", () => {
      const conversations = [
        {
          conversation_id: CONVO_ID,
          sender_user_id: TEST_USER_ID,
          receiver_user_id: MEMBER_ID,
        },
      ];
      visitTeam("HomeAdmin", { conversations });
      openCommsPopup();
      cy.wait("@getConversations", { timeout: 10000 });
      // The member name's h3 is the covering element — click it directly and
      // let the event bubble to the row handler.
      cy.contains("h3", "Morris Olsen", { timeout: 10000 })
        .should("be.visible")
        .click();
      cy.wait("@getMessages", { timeout: 10000 }).then(({ request }) => {
        expect(request.method).to.eq("GET");
        expect(request.url).to.include(
          `/v1/hcm/communication/conversation/${CONVO_ID}/messages`
        );
      });
      cy.contains("Shift covered, thanks!").should("be.visible");
    });
  });
});
