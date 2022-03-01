import { Factory } from "fishery";
import { ScheduledEvent } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";

export const scheduledEventFactory = Factory.define<ScheduledEvent>(() => ({
  version: "0",
  account: "1234567890",
  region: "us-east-1",
  detail: {},
  "detail-type": "Scheduled Event",
  source: "aws.events",
  time: new Date().toISOString(),
  id: uuidv4(),
  resources: ["arn:aws:events:abc12345"],
}));
