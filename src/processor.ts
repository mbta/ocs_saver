import { AWSLambda as Sentry } from "@sentry/serverless";
import {
  FirehoseTransformationHandler as Handler,
  FirehoseTransformationEventRecord as EventRecord,
  FirehoseTransformationResultRecord as ResultRecord,
} from "aws-lambda";
import { DateTime } from "luxon";
import { create as struct } from "superstruct";
import { localFromISO } from "./datetime";
import { OCSEvent } from "./processor/structs";

Sentry.init();

export const handler: Handler = Sentry.wrapHandler(async ({ records }) => ({
  records: records.map(transformRecord),
}));

const transformRecord = ({ recordId, data }: EventRecord): ResultRecord => {
  try {
    const events = wrapList(JSON.parse(Buffer.from(data, "base64").toString()));
    const {time} = struct(events[0], OCSEvent); // prettier-ignore
    const datetime = localFromISO(time);
    const formattedTime = datetime.toFormat("MM/dd/yy,HH:mm:ss");
    const timestampedRaw = events
      .map((eventRaw) => {
        const {data: { raw }} = struct(eventRaw, OCSEvent); // prettier-ignore
        return `${formattedTime},${raw}`;
      })
      .join("\n");
    return {
      recordId,
      result: "Ok",
      data: Buffer.from(timestampedRaw).toString("base64"),
      metadata: { partitionKeys: { serviceDay: serviceDayKey(datetime) } },
    };
  } catch (error) {
    maybeCaptureError(error);
    return { recordId, result: "ProcessingFailed", data };
  }
};

function wrapList<T>(item_or_items: T | Array<T>): Array<T> {
  if (Array.isArray(item_or_items)) {
    return item_or_items;
  } else if (item_or_items === null || item_or_items === undefined) {
    return [];
  } else {
    return [item_or_items];
  }
}

// Only capture an error once per run; if many records throw errors and we try
// to capture them all, the capturing itself can take a long time and cause the
// Lambda to time out
let errorCaptured = false;
const maybeCaptureError = (error: unknown) => {
  if (!errorCaptured) {
    Sentry.captureException(error);
    errorCaptured = true;
  }
};

const serviceDayKey = (datetime: DateTime): string => {
  if (datetime.hour < 2) {
    return datetime.minus({ days: 1 }).toISODate();
  } else {
    return datetime.toISODate();
  }
};
