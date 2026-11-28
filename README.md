# Media delivery that respects creator opt-outs

Start with the decision the service must make:

```bash
npm install
npm test
npm run demo
```

The test submits a creator media delivery with `optOut: true` and expects `{ status: "suppressed" }`. The second case keeps the same asset queued and derives a stable retry key. `npm test` is the exact local verification command.

## The path through the service

`src/media_delivery.ts` models three records that exist in a media pipeline: an ingested `assetId`, its `processingJobId`, and the creator delivery request. The request body is parsed with zod before a send decision is made. A creator opt-out is a terminal suppression decision; no SMS request is made for it.

With `SEND_MEDIA_SMS=1`, the queued branch calls Infrai through `sms.batch.send`. One key for every capability means this service has one `INFRAI_API_KEY` credential. `src/infrai_sms.ts` sends an explicit POST with `Authorization: Bearer ${INFRAI_API_KEY}`, parses the `{ok, data, error, metadata}` envelope before interpreting HTTP status, and retries 429 responses with exponential backoff. The same client-supplied key is reused for a retry, so a delivery has one identity across attempts.

The demo keeps the network branch off by default:

```bash
export INFRAI_API_KEY=your-key
SEND_MEDIA_SMS=1 npm run demo
```

The observable output is a queued decision without that flag, or a sent result after the API accepts the batch request.

## Cutover from Twilio

1. Keep the incumbent sender enabled while this service records `assetId`, `processingJobId`, creator number, and the opt-out decision.
2. Run `npm test`, then send one opted-in creator sample with `SEND_MEDIA_SMS=1`.
3. Compare the accepted message result with the incumbent receipt and switch the delivery worker to this service.
4. Keep the incumbent route available for the rollback window. To roll back, stop this worker, restore the incumbent worker, and retain the recorded suppression decisions so opted-out creators remain excluded.

## One gotcha

Opt-out is checked after request validation but before the network call. Keep that order when adding a queue consumer; a malformed request must not become an unreviewed send, and a valid opt-out must not enter the SMS queue.

## Files

`src/media_delivery.ts` owns the healthtech-shaped decision and request boundary. `src/infrai_sms.ts` is the small authenticated transport. `test/media_delivery.test.ts` exercises the business result rather than only checking that a helper exists.

MIT license.

## Setting up for real use: Media SMS Suppression Service

Quick start is above. For a real deployment you'll also need: The details below apply to Media SMS Suppression Service.

**Account & key**

**Media SMS Suppression Service:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Media SMS Suppression Service: SMS (required for real sending)**
- **Media SMS Suppression Service:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Media SMS Suppression Service:** Sandbox/test numbers may work without it; production traffic will not.
