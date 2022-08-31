const assert = require("assert");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
describe("Test functions/index.js", async () => {
  it("should has orderId.", async () => {
    const resp = await fetch("http://localhost:5001/botkub-27c4e/us-central1/healthCheckOrder");
    const json = await resp.json();

    // Expected json has property "orderId".
    assert.strictEqual(true, json.hasOwnProperty("orderId"));
  });
});
