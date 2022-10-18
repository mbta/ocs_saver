import fs from "fs/promises";
import os from "os";
import path from "path";
import readline from "readline";
import stream from "stream";
import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
  paginateListObjectsV2,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { AWSLambda as Sentry } from "@sentry/serverless";
import { ScheduledHandler } from "aws-lambda";
import { create as struct } from "superstruct";
import { create as createTar } from "tar";
import { localFromISO } from "./datetime";
import { exception } from "./errors";
import { Environment } from "./packager/structs";
import { OCSEvent } from "./processor/structs";

Sentry.init();

export const handler: ScheduledHandler = Sentry.wrapHandler(
  async ({ detail, time }) => {
    // Copy `process.env` to avoid `optional` properties becoming the string
    // "undefined" instead of real `undefined`; this may have to do with its
    // automatic string conversion behavior
    const env = struct({ ...process.env }, Environment);
    const client = makeS3Client(env);
    const {
      S3_BUCKET: bucket,
      S3_PREFIX_OUTPUT: outputPrefix,
      S3_PREFIX_SOURCE: sourcePrefix,
    } = env;

    const serviceDay = localFromISO(time).minus({ days: 1 }).toISODate();
    const outputLabel = serviceDay.replace(/-/g, "");
    const outputKey = path.posix.join(outputPrefix, `${outputLabel}.tar.gz`);
    const overwrite = detail?.overwrite ?? false;
    const recover = detail?.recover ?? false;

    if (
      !(overwrite || recover) &&
      (await objectExists(client, bucket, outputKey))
    )
      throw exception("OutputKeyExists", outputKey);

    const recoveryPrefix = recover
      ? path.posix.join("failed", outputPrefix, "processing-failed")
      : "";

    const archiveRoot = await concatAllObjects(
      client,
      bucket,
      sourcePrefix,
      outputPrefix,
      serviceDay,
      recoveryPrefix,
      // Mimic the directory structure of the old OCS.LogUploader from RTR
      path.join("root", "persistent-state", `${outputLabel}.txt`)
    );

    const upload = new Upload({
      client,
      params: {
        Body: createTarStream(archiveRoot, ["."]),
        Bucket: bucket,
        ContentType: "application/gzip",
        Key: outputKey,
      },
    });

    await upload.done();
  }
);

/**
 * Downloads and concatenates every S3 object with a given prefix (ordered by
 * the UTF-8 codepoints of their names[1]) into a single file, which is written
 * to a temporary directory. The return value is the full path of the temporary
 * directory.
 *
 * The filename can contain directories, which are created if they don't exist.
 * If the file already exists, it will be overwritten.
 *
 * A newline is appended after each object, including the last one.
 *
 * [1]: https://docs.aws.amazon.com/AmazonS3/latest/userguide/ListingKeysUsingAPIs.html
 */
const concatAllObjects = async (
  client: S3Client,
  bucket: string,
  sourcePrefix: string,
  outputPrefix: string,
  serviceDay: string,
  recoveryPrefix: string,
  filename: string
) => {
  const prefix = path.posix.join(sourcePrefix, serviceDay);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "temp-"));
  const outputPath = path.join(tempDir, filename);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const outputFile = await fs.open(outputPath, "w");

  if (recoveryPrefix) {
    for await (const {
      $metadata: metadata,
      Contents: objects,
    } of paginateListObjectsV2(
      { client },
      { Bucket: bucket, Prefix: recoveryPrefix }
    )) {
      if (objects === undefined)
        throw exception("BadS3Response", JSON.stringify(metadata));

      for (const { Key: key } of objects) {
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const { $metadata: metadata, Body: data } = await client.send(command);

        if (data === undefined)
          throw exception("BadS3Response", JSON.stringify(metadata));

        if (
          key &&
          key.startsWith(`ocs-saver-${outputPrefix}-1-${serviceDay}`)
        ) {
          const command = new GetObjectCommand({ Bucket: bucket, Key: key });
          const { $metadata: metadata, Body: data } = await client.send(
            command
          );

          if (data === undefined)
            throw exception("BadS3Response", JSON.stringify(metadata));

          const recoveredFile = await fs.open(path.join(tempDir, key), "w");

          const lines = readline.createInterface({
            input: data,
          });

          for await (const line of lines) {
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
            const timestampedRaw = `${datetime.toFormat(
              "MM/dd/yy,HH:mm:ss"
            )},${raw}`;

            await fs.appendFile(recoveredFile, timestampedRaw);
            await fs.appendFile(recoveredFile, "\n");
          }
          await recoveredFile.close();

          const recoveredKey = path.posix.join(sourcePrefix, key);

          const upload = new Upload({
            client,
            params: {
              Body: recoveredFile,
              Bucket: bucket,
              ContentType: "application/gzip",
              Key: recoveredKey,
            },
          });

          await upload.done();
        }
      }
    }
  }

  for await (const {
    $metadata: metadata,
    Contents: objects,
  } of paginateListObjectsV2({ client }, { Bucket: bucket, Prefix: prefix })) {
    if (objects === undefined)
      throw exception("BadS3Response", JSON.stringify(metadata));

    for (const { Key: key } of objects) {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const { $metadata: metadata, Body: data } = await client.send(command);

      if (data === undefined)
        throw exception("BadS3Response", JSON.stringify(metadata));

      await fs.appendFile(outputFile, data);
      await fs.appendFile(outputFile, "\n");
    }
  }

  await outputFile.close();
  return tempDir;
};

/**
 * Creates a `tar.create` stream for use with `Upload`, which normally doesn't
 * work due to a known issue[1] with lib-storage. To work around this, the tar
 * stream is piped into a PassThrough stream.
 *
 * [1]: https://github.com/aws/aws-sdk-js-v3/issues/2522
 */
const createTarStream = (cwd: string, paths: string[]) => {
  const tarStream = createTar({ cwd, gzip: true, strict: true }, paths);
  const passThrough = new stream.PassThrough();
  // prettier-ignore
  stream.pipeline(tarStream, passThrough, (err) => { if (err) throw err });
  return passThrough;
};

/**
 * Creates an `S3Client` using the configured values in the `Environment`.
 */
const makeS3Client = (env: Environment) => {
  const {
    AWS_ACCESS_KEY_ID: accessKeyId,
    AWS_SECRET_ACCESS_KEY: secretAccessKey,
    AWS_SESSION_TOKEN: sessionToken,
    AWS_REGION: region,
    S3_ENDPOINT: endpoint,
  } = env;

  const credentials =
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey, sessionToken }
      : undefined;

  // Use `forcePathStyle` to allow using S3rver on `localhost` in tests
  return new S3Client({ credentials, endpoint, forcePathStyle: true, region });
};

/**
 * Returns whether there is an object with the given key in the given bucket.
 */
const objectExists = async (client: S3Client, bucket: string, key: string) => {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (error instanceof NotFound) return false;
    throw error;
  }
};
