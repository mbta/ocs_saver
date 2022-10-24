import { GetObjectCommand, GetObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { exception } from "./errors";
import { localFromISO } from "./datetime";
import { OCSEvent } from "./processor/structs";
import { create as struct } from "superstruct";

export const safeSend = async (client: S3Client, bucket: string, key?: string): Promise<GetObjectCommandOutput> => {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await client.send(command);
  const { $metadata: metadata, Body: data } = response;

  if (data === undefined)
    throw exception("BadS3Response", JSON.stringify(metadata));

  return response;
};

export const recoverLine = (line: string): string => {
  const { rawData } = JSON.parse(line);
  const eventData = JSON.parse(
    Buffer.from(rawData, "base64").toString()
  );
  const {
    time,
    data: { raw },
  } = struct(eventData, OCSEvent);
  const datetime = localFromISO(time);
  // Mimic the timestamp prepended by the old OCS.LogUploader from RTR
  return `${datetime.toFormat("MM/dd/yy,HH:mm:ss")},${raw}\n`;
}
