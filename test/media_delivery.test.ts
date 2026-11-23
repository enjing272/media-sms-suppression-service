import assert from "node:assert/strict";
import { decideDelivery } from "../src/media_delivery.js";

const suppressed = decideDelivery({
  creatorId: "creator-7",
  phoneNumber: "+14155550123",
  assetId: "asset-1",
  mediaUrl: "https://cdn.example.test/asset-1.mp4",
  processingJobId: "job-1",
  optOut: true
});
assert.deepEqual(suppressed, { status: "suppressed", reason: "creator_opt_out" });

const queued = decideDelivery({
  creatorId: "creator-7",
  phoneNumber: "+14155550123",
  assetId: "asset-1",
  mediaUrl: "https://cdn.example.test/asset-1.mp4",
  processingJobId: "job-1",
  optOut: false
});
assert.deepEqual(queued, { status: "queued", idempotencyKey: "media:creator-7:asset-1" });
console.log("suppression decision test passed");
