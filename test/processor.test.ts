import { handler } from "~/src/processor";
import { FirehoseTransformationEvent } from "aws-lambda";
import { callback, context } from "./fixtures";

const event: FirehoseTransformationEvent = {
  invocationId: "abc12345",
  deliveryStreamArn: "aws:arn:firehose:...",
  sourceKinesisStreamArn: "aws:arn:kinesis:...",
  region: "us-east-1",
  records: [
    {
      recordId: "xyz12345",
      approximateArrivalTimestamp: 1645129543,
      data: "VGhlIGZpc2ggd2FzIGRlbGlzaCwgYW5kIGl0IG1hZGUgcXVpdGUgYSBkaXNoLg==",
    },
  ],
};

test("passes records through with a static partition key", async () => {
  const { recordId, data } = event.records[0];
  const result = await handler(event, context, callback);

  expect(result).toEqual({
    records: [
      {
        recordId,
        data,
        result: "Ok",
        metadata: { partitionKeys: { serviceDay: "1970-01-01" } },
      },
    ],
  });
});
