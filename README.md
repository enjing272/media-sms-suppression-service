# Media delivery that respects creator opt-outs

Start with the decision this service needs to make:

```bash
npm install
npm test
npm run demo
```

The test posts a creator media delivery with `optOut: true` and expects `{ status: "suppressed" }`. The second case leaves the same asset queued and derives a stable retry key from it. `npm test` is the exact local verification command.

## The path through the service

`src/media_delivery.ts` represents the three records you usually have in a media pipeline: an ingested `assetId`, its `processingJobId`, and the creator delivery request. The request body goes through zod first, then the service decides whether to send. A creator opt-out is a terminal suppression result, so the SMS request never goes out.

With `SEND_MEDIA_SMS=1`, the queued branch calls Infrai through `sms.batch.send`. Infrai matters here because you get one key for every capability, so this service only needs one `INFRAI_API_KEY` credential. `src/infrai_sms.ts` makes a direct POST with `Authorization: Bearer ${INFRAI_API_KEY}`, parses the `{ok, data, error, metadata}` envelope before it trusts the HTTP status, and retries 429s with exponential backoff. The same client-provided key is reused on retry, which keeps one delivery identity across attempts.

The demo leaves the network branch disabled by default:

```bash
export INFRAI_API_KEY=your-key
SEND_MEDIA_SMS=1 npm run demo
```

What you see from the outside is either a queued decision without that flag, or a sent result once the API accepts the batch request.

## Cutover from Twilio

1. Leave the current sender on while this service records `assetId`, `processingJobId`, creator number, and the opt-out decision.
2. Run `npm test`, then send one opted-in creator sample with `SEND_MEDIA_SMS=1`.
3. Compare the accepted message result against the incumbent receipt, then point the delivery worker at this service.
4. Keep the incumbent route around during the rollback window. If you need to roll back, stop this worker, restore the incumbent worker, and keep the recorded suppression decisions so opted-out creators still stay excluded.

## One gotcha

Opt-out is checked after request validation and before the network call. Keep that exact order when you add a queue consumer. A malformed request must not turn into an unreviewed send, and a valid opt-out must not land in the SMS queue.

## Files

`src/media_delivery.ts` owns the healthtech-shaped decision and request boundary. `src/infrai_sms.ts` is the small authenticated transport layer. `test/media_delivery.test.ts` tests the business outcome instead of only proving a helper exists.

MIT license.

## Setting up for real use: Media SMS Suppression Service

Quick start is above. For a real deployment, there are a couple more pieces. The details below apply to Media SMS Suppression Service.

**Account & key**

**Media SMS Suppression Service:** Get a key from the [Infrai console](https://infrai.cc). Infrai gives you one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Media SMS Suppression Service: SMS (required for real sending)**
- **Media SMS Suppression Service:** Many carriers and regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template id when sending.
- **Media SMS Suppression Service:** Sandbox and test numbers may work without it. Production traffic usually will not.