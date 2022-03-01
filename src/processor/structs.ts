import { Infer, literal, object, string } from "superstruct";

export const OCSEvent = object({
  data: object({ raw: string() }),
  id: string(),
  partitionkey: string(),
  source: string(),
  specversion: literal("1.0"),
  time: string(),
  type: literal("com.mbta.ocs.raw_message"),
});

export type OCSEvent = Infer<typeof OCSEvent>;
