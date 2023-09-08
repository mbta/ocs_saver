import { handler } from "~/src/processor";
import { OCSEvent } from "~/src/processor/structs";
import {
  FirehoseTransformationEvent,
  FirehoseTransformationEventRecord,
  FirehoseTransformationResult,
  FirehoseTransformationResultRecord,
} from "aws-lambda";
import { lambdaContextFactory } from "./factories/common";
import {
  firehoseEventFactory,
  kinesisRecordFactory,
  ocsEventFactory,
} from "./factories/processor";

const handle = (event: FirehoseTransformationEvent) =>
  handler(event, lambdaContextFactory.build(), jest.fn());

const buildFirehoseEvent = (records: FirehoseTransformationEventRecord[]) =>
  firehoseEventFactory.build({ records });

const buildKinesisRecord = (id: string, ocsEventAttrs: any) =>
  kinesisRecordFactory.build(
    { recordId: id },
    { transient: { encodeEvent: ocsEventFactory.build(ocsEventAttrs) } }
  );

const buildKinesisBatchRecord = (
  id: string,
  ocsEventsAttrs: Array<Partial<OCSEvent>>
) =>
  kinesisRecordFactory.build(
    { recordId: id },
    {
      transient: {
        encodeData: JSON.stringify(
          ocsEventsAttrs.map((attrs) => ocsEventFactory.build(attrs))
        ),
      },
    }
  );

// prettier-ignore
const decodeRecordData = (record: FirehoseTransformationResultRecord) =>
  ({ ...record, data: Buffer.from(record.data, "base64").toString() });

test("transforms records to timestamped raw OCS messages", async () => {
  const event = buildFirehoseEvent([
    buildKinesisRecord("rec1", {
      time: "2022-03-01T05:00:02Z",
      data: { raw: "101,DIAG,00:00:01,test1" },
    }),
    buildKinesisRecord("rec2", {
      time: "2022-03-01T05:00:03Z",
      data: { raw: "102,DIAG,00:00:02,test2" },
    }),
  ]);

  const { records } = (await handle(event)) as FirehoseTransformationResult;

  expect(records.map(decodeRecordData)).toMatchObject([
    {
      data: "03/01/22,00:00:02,101,DIAG,00:00:01,test1",
      recordId: "rec1",
      result: "Ok",
    },
    {
      data: "03/01/22,00:00:03,102,DIAG,00:00:02,test2",
      recordId: "rec2",
      result: "Ok",
    },
  ]);
});

test("transforms records to timestamped raw OCS messages - with arbitrary field", async () => {
  const event = buildFirehoseEvent([
    buildKinesisRecord("rec1", {
      time: "2022-03-01T05:00:02Z",
      data: { raw: "101,DIAG,00:00:01,test1" },
      sourceip: "127.0.0.1"
    }),
    buildKinesisRecord("rec2", {
      time: "2022-03-01T05:00:03Z",
      data: { raw: "102,DIAG,00:00:02,test2" },
      sourceip: "127.0.0.1"
    }),
  ]);

  const { records } = (await handle(event)) as FirehoseTransformationResult;

  expect(records.map(decodeRecordData)).toMatchObject([
    {
      data: "03/01/22,00:00:02,101,DIAG,00:00:01,test1",
      recordId: "rec1",
      result: "Ok",
    },
    {
      data: "03/01/22,00:00:03,102,DIAG,00:00:02,test2",
      recordId: "rec2",
      result: "Ok",
    },
  ]);
});

test("transforms batch records to timestamped raw OCS messages", async () => {
  const event = buildFirehoseEvent([
    buildKinesisBatchRecord("rec1", [
      {
        time: "2022-03-01T05:00:02Z",
        data: { raw: "101,DIAG,00:00:01,test1" },
      },
      {
        // NB: only the first time is used, so this is ignored.
        time: "2022-03-01T05:00:03Z",
        data: { raw: "102,DIAG,00:00:02,test2" },
      },
    ]),
  ]);

  const { records } = (await handle(event)) as FirehoseTransformationResult;
  expect(records.map(decodeRecordData)).toMatchObject([
    {
      data: `03/01/22,00:00:02,101,DIAG,00:00:01,test1
03/01/22,00:00:02,102,DIAG,00:00:02,test2`,
      metadata: { partitionKeys: { serviceDay: "2022-02-28" } },
      recordId: "rec1",
      result: "Ok",
    },
  ]);
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
