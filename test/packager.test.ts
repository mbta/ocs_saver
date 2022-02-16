import { handler } from "../src/packager";
import { ScheduledEvent } from "aws-lambda";
import { callback, context } from "./fixtures";

const event: ScheduledEvent = {
  version: "0",
  account: "1234567890",
  region: "us-east-1",
  detail: {},
  "detail-type": "Scheduled Event",
  source: "aws.events",
  time: "2019-03-01T01:23:45Z",
  id: "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
  resources: ["arn:aws:events:..."],
};

test("does nothing", async () => {
  const result = await handler(event, context, callback);
  expect(result).toBeUndefined();
});
