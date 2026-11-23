import { z } from "zod";
import { sendMediaSms } from "./infrai_sms.js";

export const deliveryRequest = z.object({
  creatorId: z.string().min(1),
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/),
  assetId: z.string().min(1),
  mediaUrl: z.string().url(),
  processingJobId: z.string().min(1),
  optOut: z.boolean().default(false)
});

export type DeliveryRequest = z.infer<typeof deliveryRequest>;
export type Decision = { status: "suppressed"; reason: string } | { status: "queued"; idempotencyKey: string };

export function decideDelivery(input: unknown): Decision {
  const request = deliveryRequest.parse(input);
  if (request.optOut) return { status: "suppressed", reason: "creator_opt_out" };
  return { status: "queued", idempotencyKey: `media:${request.creatorId}:${request.assetId}` };
}

export async function deliverCreatorMedia(input: unknown): Promise<Decision | { status: "sent"; result: unknown }> {
  const request = deliveryRequest.parse(input);
  const decision = decideDelivery(request);
  if (decision.status === "suppressed") return decision;
  if (process.env.SEND_MEDIA_SMS !== "1") return decision;
  const result = await sendMediaSms({ to: request.phoneNumber, body: `Media ${request.assetId}: ${request.mediaUrl}` }, decision.idempotencyKey);
  return { status: "sent", result };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const phoneNumber = process.env.DEMO_PHONE_NUMBER;
  if (!phoneNumber) throw new Error("DEMO_PHONE_NUMBER is required");
  const request = {
    creatorId: "creator-42",
    phoneNumber,
    assetId: "asset-202",
    mediaUrl: "https://cdn.example.test/asset-202.mp4",
    processingJobId: "job-202",
    optOut: false
  };
  console.log(await deliverCreatorMedia(request));
}
