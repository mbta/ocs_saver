import { Factory } from "fishery";
import {
  FirehoseTransformationEvent,
  FirehoseTransformationEventRecord,
} from "aws-lambda";
import { OCSEvent } from "src/processor/structs";

export const firehoseEventFactory = Factory.define<FirehoseTransformationEvent>(
  ({ sequence }) => ({
    invocationId: `invocation-id-${sequence}`,
    deliveryStreamArn: `aws:arn:firehose:${sequence}`,
    sourceKinesisStreamArn: `aws:arn:kinesis:${sequence}`,
    region: "us-east-1",
    records: kinesisRecordFactory.buildList(1),
  })
);

export const kinesisRecordFactory = Factory.define<
  FirehoseTransformationEventRecord,
  { encodeData: string; encodeEvent: OCSEvent }
>(({ sequence, transientParams: { encodeData, encodeEvent } }) => {
  encodeEvent ??= ocsEventFactory.build();
  encodeData ??= JSON.stringify(encodeEvent);

  return {
    recordId: `record-id-${sequence}`,
    approximateArrivalTimestamp: 1645129000 + sequence,
    data: Buffer.from(encodeData).toString("base64"),
  };
});

export const ocsEventFactory = Factory.define<OCSEvent>(({ sequence }) => ({
  data: { raw: "4994,TSCH,02:00:06,R,RLD,W" },
  id: `ocs-event-${sequence}`,
  partitionkey: "1bQ0GxT4mk",
  source: "opstech3.mbta.com/trike",
  specversion: "1.0",
  time: new Date().toISOString(),
  type: "com.mbta.ocs.raw_message",
}));
