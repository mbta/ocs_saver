import {
  GetObjectCommand,
  GetObjectCommandOutput,
  S3Client,
} from "@aws-sdk/client-s3";
import { exception } from "./errors";
import { localFromISO } from "./datetime";
import { OCSEvent } from "./processor/structs";
import { mask as struct } from "superstruct";

export const safeSend = async (
  client: S3Client,
  bucket: string,
  key?: string
): Promise<GetObjectCommandOutput> => {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await client.send(command);
  const { $metadata: metadata, Body: data } = response;

  if (data === undefined)
    throw exception("BadS3Response", JSON.stringify(metadata));

  return response;
};

export const recoverLine = (line: string): string => {
  if (line.trim() === "") return "";

  const { rawData } = JSON.parse(line);
  const events = wrapList(
    JSON.parse(Buffer.from(rawData, "base64").toString())
  );
  const { time } = struct(events[0], OCSEvent);
  const datetime = localFromISO(time);
  const formattedTime = datetime.toFormat("MM/dd/yy,HH:mm:ss");
  const timestampedRaw = events
    .map((eventRaw) => {
      const {data: { raw }} = struct(eventRaw, OCSEvent); // prettier-ignore
      return `${formattedTime},${raw}`;
    })
    .join("\n");
  // Mimic the timestamp prepended by the old OCS.LogUploader from RTR
  return `${timestampedRaw}\n`;
};

export function wrapList<T>(item_or_items: T | Array<T>): Array<T> {
  if (Array.isArray(item_or_items)) {
    return item_or_items;
  } else if (item_or_items === null || item_or_items === undefined) {
    return [];
  } else {
    return [item_or_items];
  }
}
