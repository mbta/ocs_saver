import { Factory } from "fishery";
import {
  FirehoseTransformationEvent,
  FirehoseTransformationEventRecord,
} from "aws-lambda";

export const firehoseEventFactory = Factory.define<FirehoseTransformationEvent>(
  ({ sequence }) => ({
    invocationId: `invocation-id-${sequence}`,
    deliveryStreamArn: `aws:arn:firehose:${sequence}`,
    sourceKinesisStreamArn: `aws:arn:kinesis:${sequence}`,
    region: "us-east-1",
    records: kinesisRecordFactory.buildList(1),
  })
);

export const kinesisRecordFactory =
  Factory.define<FirehoseTransformationEventRecord>(({ sequence }) => ({
    recordId: `record-id-${sequence}`,
    approximateArrivalTimestamp: 1645129000 + sequence,
    data: "VGhlIGZpc2ggd2FzIGRlbGlzaCwgYW5kIGl0IG1hZGUgcXVpdGUgYSBkaXNoLg==",
  }));
