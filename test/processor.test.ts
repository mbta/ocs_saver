import { handler } from "~/src/processor";
import { FirehoseTransformationEvent } from "aws-lambda";
import { lambdaContextFactory } from "./factories/common";
import { firehoseEventFactory } from "./factories/processor";

test("passes records through with a static partition key", async () => {
  const event = firehoseEventFactory.build();
  const { recordId, data } = event.records[0];

  const result = await handler(event, lambdaContextFactory.build(), jest.fn());

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
