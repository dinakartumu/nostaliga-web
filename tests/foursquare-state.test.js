import test from "node:test";
import assert from "node:assert/strict";
import { config, foursquareRequest } from "../api/_shared.js";
import handler from "../api/foursquare/token.js";

test("Foursquare exchanges use the configured callback plus the attempt nonce", async () => {
  config.foursquare = { clientId: "fixture", clientSecret: "fixture", redirectUri: "nostaliga://swarm/callback" };
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_, request) => {
    bodies.push(new URLSearchParams(request.body));
    return { status: 200, json: async () => ({ access_token: "fixture" }) };
  };
  try {
    const state = "c6c2f5a3-9763-487d-b2a9-d6d49f8eb5e0";
    await foursquareRequest("fixture-code", state);
    assert.equal(bodies[0].get("redirect_uri"), `nostaliga://swarm/callback?state=${state}`);
    await foursquareRequest("fixture-code");
    assert.equal(bodies[1].get("redirect_uri"), "nostaliga://swarm/callback");
    let status;
    const response = { setHeader() {}, status(value) { status = value; return this; }, json() {} };
    await handler({ method: "POST", body: { code: "fixture", state: "https://untrusted.invalid/" } }, response);
    assert.equal(status, 400);
    assert.equal(bodies.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});
