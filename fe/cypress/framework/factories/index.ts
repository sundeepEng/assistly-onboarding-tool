/**
 * Test-data factories — one builder per API entity, named `build<Entity>`.
 *
 * Builders return the exact response shape the app's services layer consumes
 * and accept an overrides bag so a spec only says what makes its case
 * different. Keep them in sync with the API contracts; a field renamed in the
 * app is a field renamed here.
 *
 * Static canned responses that never vary belong in cypress/fixtures instead.
 */

export * from "./token.factory";
export * from "./home.factory";
export * from "./user.factory";
export * from "./module.factories";
