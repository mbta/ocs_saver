import { handler } from "~/src/packager";
import fs from "fs/promises";
import os from "os";
import path from "path";
import stream from "stream";
import util from "util";
import {
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ScheduledEvent } from "aws-lambda";
import getStream from "get-stream";
import { promise as readdirp } from "readdirp";
import S3rver from "s3rver";
import { extract as extractTar } from "tar";
import { lambdaContextFactory } from "./factories/common";
import { scheduledEventFactory } from "./factories/packager";

const originalEnv = process.env;
const env = {
  AWS_ACCESS_KEY_ID: "S3RVER",
  AWS_SECRET_ACCESS_KEY: "S3RVER",
  AWS_REGION: "us-east-1",
  S3_BUCKET: "test-bucket",
  S3_ENDPOINT: "http://localhost:4568",
  S3_PREFIX_OUTPUT: "test-output",
  S3_PREFIX_SOURCE: "test-source",
};
let s3rver: S3rver;
let client: S3Client;

beforeAll(async () => {
  process.env = { ...originalEnv, ...env };

  const s3dir = await makeTempDir("s3rver");
  s3rver = new S3rver({ directory: s3dir, silent: true });

  client = new S3Client({
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    region: env.AWS_REGION,
  });

  await s3rver.run();
});

afterAll(async () => {
  await s3rver.close();
  process.env = originalEnv;
}, 10000);

beforeEach(async () => {
  s3rver.reset();
  await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
});

const handle = (event: ScheduledEvent) =>
  handler(event, lambdaContextFactory.build(), jest.fn());

test("archives all logs for the previous service day", async () => {
  const objects = [
    ["2021-12-31/ocs", "prev day"],
    ["2022-01-01/ocs1", "one\ntwo"],
    ["2022-01-01/ocs2", "three\nfour\nfive"],
    ["2022-01-01/ocs3", "six"],
    ["2022-01-02/ocs", "next day"],
  ];
  for (const [key, data] of objects) await putSourceObject(key, data);

  await handle(scheduledEventFactory.build({ time: "2022-01-02T12:00:00Z" }));

  const [entry] = await extractOutputObject("20220101.tar.gz");
  const data = (await fs.readFile(entry.fullPath)).toString();
  expect(entry.path).toEqual("root/persistent-state/20220101.txt");
  expect(data).toEqual("one\ntwo\nthree\nfour\nfive\nsix\n");
});

test("doesn't write the output object if it already exists", async () => {
  const existingOutput = Buffer.from("existing output\n");
  await putSourceObject("2022-01-01/ocs", "new data");
  await putOutputObject("20220101.tar.gz", existingOutput);

  await expect(
    handle(scheduledEventFactory.build({ time: "2022-01-02T12:00:00Z" }))
  ).rejects.toThrow("20220101.tar.gz");

  const output = await getOutputObject("20220101.tar.gz");
  expect(output).toEqual(existingOutput);
});

test("overwrites the output object if an option is provided", async () => {
  const existingOutput = Buffer.from("existing output\n");
  await putSourceObject("2022-01-01/ocs", "updated output");
  await putOutputObject("20220101.tar.gz", existingOutput);

  await handle(
    scheduledEventFactory.build({
      time: "2022-01-02T12:00:00Z",
      detail: { overwrite: true },
    })
  );

  const [entry] = await extractOutputObject("20220101.tar.gz");
  const data = (await fs.readFile(entry.fullPath)).toString();
  expect(data).toEqual("updated output\n");
});

test("recovers old inputs if output did not succeed for a given date", async () => {
  await putFailedProcessingObject(
    "ocs-saver-test-output-1-2022-01-01/failed",
    `{"attemptsMade":4,"arrivalTimestamp":1654710150135,"errorCode":"Lambda.FunctionTimedOut","errorMessage":"The Lambda function invocation timed out. Increase the Timeout setting in the Lambda function.","attemptEndingTimestamp":1654710238263,"rawData":"eyJkYXRhIjp7InJhdyI6IjE2Njc0NCxSR1BTLDEzOjQyOjI5LEcsVTE1LTE0MS02MzEsMzY3NSw0Mi4zNDgxODgzMzMzMzMzLDcxLjE0MDQ5ODMzMzMzMzMsMC4wMCwxOC45NCJ9LCJpZCI6IlpKd3Y3WUF0M21PS3BIaGZyUWZIQ2hHWmFpMD0iLCJwYXJ0aXRpb25rZXkiOiJ7MTAuMTA4LjQ2LjE5ODo4MDgxIC0+IDEwLjE5OC4wLjM0OjQzNDE0fSIsInNvdXJjZSI6Im9wc3RlY2gzLm1idGEuY29tL3RyaWtlIiwic3BlY3ZlcnNpb24iOiIxLjAiLCJ0aW1lIjoiMjAyMi0wNi0wOFQxNzo0MjozMC4wOTIwMDBaIiwidHlwZSI6ImNvbS5tYnRhLm9jcy5yYXdfbWVzc2FnZSJ9","lambdaArn":"test"}
{"attemptsMade":4,"arrivalTimestamp":1654705063218,"errorCode":"Lambda.FunctionError","errorMessage":"The Lambda function was successfully invoked but it returned an error result.","attemptEndingTimestamp":1654705152242,"rawData":"eyJkYXRhIjp7InJhdyI6IjUzNDAyLFJHUFMsMTI6MTc6NDMsRyxVMTYtMzUwLTcxMywzMDg3LDQyLjI2OTQyNjY2NjY2NjcsNzEuMDc3MDgzMzMzMzMzMywzMS45NCw3MS45OSJ9LCJpZCI6IjlJUndnZWkweHJmY3JkTEZ1TU5pQkx3dFRXWT0iLCJwYXJ0aXRpb25rZXkiOiJ7MTAuMTA4LjQ2LjE5ODo4MDgxIC0+IDEwLjE5OC4wLjM0OjQzNDE0fSIsInNvdXJjZSI6Im9wc3RlY2gzLm1idGEuY29tL3RyaWtlIiwic3BlY3ZlcnNpb24iOiIxLjAiLCJ0aW1lIjoiMjAyMi0wNi0wOFQxNjoxNzo0My4xODMwMDBaIiwidHlwZSI6ImNvbS5tYnRhLm9jcy5yYXdfbWVzc2FnZSJ9","lambdaArn":"test"}
`
  );

  await handle(
    scheduledEventFactory.build({
      time: "2022-01-02T12:00:00Z",
      detail: { recover: true },
    })
  );

  const [entry] = await extractOutputObject("20220101.tar.gz");
  const data = (await fs.readFile(entry.fullPath)).toString();
  expect(data).toEqual(
    `06/08/22,13:42:30,166744,RGPS,13:42:29,G,U15-141-631,3675,42.3481883333333,71.1404983333333,0.00,18.94
06/08/22,12:17:43,53402,RGPS,12:17:43,G,U16-350-713,3087,42.2694266666667,71.0770833333333,31.94,71.99

`
  );
});

const extractOutputObject = async (key: string) => {
  const buffer = await getOutputObject(key);
  const tempDir = await makeTempDir("output");

  await pipeline(
    stream.Readable.from(buffer),
    extractTar({ cwd: tempDir, strict: true })
  );

  return readdirp(tempDir);
};

const getOutputObject = async (key: string) => {
  const { Body: body } = await client.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: path.posix.join(env.S3_PREFIX_OUTPUT, key),
    })
  );

  return getStream.buffer(body);
};

const makeTempDir = (prefix: string) =>
  fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));

const pipeline = util.promisify(stream.pipeline);

const putObject = (key: string, data: Buffer) =>
  client.send(
    new PutObjectCommand({ Body: data, Bucket: env.S3_BUCKET, Key: key })
  );

const putOutputObject = (key: string, data: Buffer) =>
  putObject(path.posix.join(env.S3_PREFIX_OUTPUT, key), data);

const putSourceObject = (key: string, data: string) =>
  putObject(path.posix.join(env.S3_PREFIX_SOURCE, key), Buffer.from(data));

const putFailedProcessingObject = (key: string, data: string) =>
  putObject(
    path.posix.join("failed", env.S3_PREFIX_OUTPUT, "processing-failed", key),
    Buffer.from(data)
  );
