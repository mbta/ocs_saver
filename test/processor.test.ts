import { handler } from "~/src/processor";
import { OCSEvent } from "~/src/processor/structs";
import {
  FirehoseTransformationEvent,
  FirehoseTransformationEventRecord,
} from "aws-lambda";
import { lambdaContextFactory } from "./factories/common";
import {
  firehoseEventFactory,
  kinesisRecordFactory,
  ocsEventFactory,
} from "./factories/processor";

const handle = async (event: FirehoseTransformationEvent) =>
  await handler(event, lambdaContextFactory.build(), jest.fn());

const buildFirehoseEvent = (records: FirehoseTransformationEventRecord[]) =>
  firehoseEventFactory.build({ records });

const buildKinesisRecord = (id: string, ocsEventAttrs: Partial<OCSEvent>) =>
  kinesisRecordFactory.build(
    { recordId: id },
    { transient: { encodeEvent: ocsEventFactory.build(ocsEventAttrs) } }
  );

test("transforms records to raw OCS messages", async () => {
  const messages = ["101,DIAG,00:00:01,test1", "102,DIAG,00:00:02,test2"];
  const encoded = messages.map((msg) => Buffer.from(msg).toString("base64"));
  const event = buildFirehoseEvent([
    buildKinesisRecord("rec1", { data: { raw: messages[0] } }),
    buildKinesisRecord("rec2", { data: { raw: messages[1] } }),
  ]);

  expect(await handle(event)).toMatchObject({
    records: [
      { data: encoded[0], recordId: "rec1", result: "Ok" },
      { data: encoded[1], recordId: "rec2", result: "Ok" },
    ],
  });
});

test("generates partition keys based on the service day", async () => {
  const timesWithDays = [
    { id: "11:59pm", time: "2022-03-01T04:59:00Z", day: "2022-02-28" },
    { id: "12:00am", time: "2022-03-01T05:00:00Z", day: "2022-02-28" },
    { id: "1:59am", time: "2022-03-01T06:59:00Z", day: "2022-02-28" },
    { id: "2:00am", time: "2022-03-01T07:00:00Z", day: "2022-03-01" },
    { id: "7:00am", time: "2022-03-01T12:00:00Z", day: "2022-03-01" },
    { id: "7:00pm", time: "2022-03-02T00:00:00Z", day: "2022-03-01" },
    // Test both occurrences of a time in the "Fall Back" period of DST
    { id: "1:30am-4", time: "2022-11-06T05:30:00Z", day: "2022-11-05" },
    { id: "1:30am-5", time: "2022-11-06T06:30:00Z", day: "2022-11-05" },
  ];

  const event = buildFirehoseEvent(
    timesWithDays.map(({ id, time }) => buildKinesisRecord(id, { time }))
  );
  const expectedRecords = timesWithDays.map(({ id, day }) => ({
    recordId: id,
    metadata: { partitionKeys: { serviceDay: day } },
  }));

  expect(await handle(event)).toMatchObject({ records: expectedRecords });
});

test("handles records with invalid data", async () => {
  const event = firehoseEventFactory.build({
    records: [
      kinesisRecordFactory.build({ recordId: "invalid-base64", data: "*" }),
      kinesisRecordFactory.build(
        { recordId: "invalid-json" },
        { transient: { encodeData: "{" } }
      ),
      kinesisRecordFactory.build(
        { recordId: "invalid-event" },
        { transient: { encodeData: '{"some": "value"}' } }
      ),
      buildKinesisRecord("invalid-time", { time: "nope" }),
      buildKinesisRecord("valid", {}),
    ],
  });

  expect(await handle(event)).toMatchObject({
    records: [
      { recordId: "invalid-base64", result: "ProcessingFailed" },
      { recordId: "invalid-json", result: "ProcessingFailed" },
      { recordId: "invalid-event", result: "ProcessingFailed" },
      { recordId: "invalid-time", result: "ProcessingFailed" },
      { recordId: "valid", result: "Ok" },
    ],
  });
});
