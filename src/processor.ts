import {
  FirehoseTransformationHandler as Handler,
  FirehoseTransformationEventRecord as EventRecord,
  FirehoseTransformationResultRecord as ResultRecord,
} from "aws-lambda";
import { DateTime } from "luxon";
import { create } from "superstruct";
import { OCSEvent } from "./processor/structs";

export const handler: Handler = async ({ records }) => ({
  records: records.map(transformRecord),
});

const transformRecord = ({ recordId, data }: EventRecord): ResultRecord => {
  try {
    const event = JSON.parse(Buffer.from(data, "base64").toString());
    const { time, data: { raw } } = create(event, OCSEvent); // prettier-ignore

    return {
      recordId,
      result: "Ok",
      data: Buffer.from(raw).toString("base64"),
      metadata: { partitionKeys: { serviceDay: serviceDay(time) } },
    };
  } catch (error) {
    return { recordId, result: "ProcessingFailed", data };
  }
};

const TZ = "America/New_York";
class InvalidDatetimeError extends Error {}

const serviceDay = (eventTime: string): string => {
  const datetime = DateTime.fromISO(eventTime).setZone(TZ);

  if (datetime.isValid) {
    if (datetime.hour < 2) {
      return datetime.minus({ days: 1 }).toISODate();
    } else {
      return datetime.toISODate();
    }
  } else {
    throw new InvalidDatetimeError(eventTime);
  }
};
