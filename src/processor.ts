import {
  FirehoseTransformationHandler as Handler,
  FirehoseTransformationEventRecord as EventRecord,
  FirehoseTransformationResultRecord as ResultRecord,
} from "aws-lambda";
import { DateTime } from "luxon";
import { create as struct } from "superstruct";
import { localFromISO } from "./datetime";
import { OCSEvent } from "./processor/structs";

export const handler: Handler = async ({ records }) => ({
  records: records.map(transformRecord),
});

const transformRecord = ({ recordId, data }: EventRecord): ResultRecord => {
  try {
    const event = JSON.parse(Buffer.from(data, "base64").toString());
    const { time, data: { raw } } = struct(event, OCSEvent); // prettier-ignore
    const datetime = localFromISO(time);

    return {
      recordId,
      result: "Ok",
      data: Buffer.from(raw).toString("base64"),
      metadata: { partitionKeys: { serviceDay: serviceDayKey(datetime) } },
    };
  } catch (error) {
    return { recordId, result: "ProcessingFailed", data };
  }
};

const serviceDayKey = (datetime: DateTime): string => {
  if (datetime.hour < 2) {
    return datetime.minus({ days: 1 }).toISODate();
  } else {
    return datetime.toISODate();
  }
};
