import { recoverLine } from "~/src/util";

test("recovers line from failed attempt log", async () => {
  const line = `{"attemptsMade":4,"arrivalTimestamp":1654710150135,"errorCode":"Lambda.FunctionTimedOut","errorMessage":"The Lambda function invocation timed out. Increase the Timeout setting in the Lambda function.","attemptEndingTimestamp":1654710238263,"rawData":"eyJkYXRhIjp7InJhdyI6IjE2Njc0NCxSR1BTLDEzOjQyOjI5LEcsVTE1LTE0MS02MzEsMzY3NSw0Mi4zNDgxODgzMzMzMzMzLDcxLjE0MDQ5ODMzMzMzMzMsMC4wMCwxOC45NCJ9LCJpZCI6IlpKd3Y3WUF0M21PS3BIaGZyUWZIQ2hHWmFpMD0iLCJwYXJ0aXRpb25rZXkiOiJ7MTAuMTA4LjQ2LjE5ODo4MDgxIC0+IDEwLjE5OC4wLjM0OjQzNDE0fSIsInNvdXJjZSI6Im9wc3RlY2gzLm1idGEuY29tL3RyaWtlIiwic3BlY3ZlcnNpb24iOiIxLjAiLCJ0aW1lIjoiMjAyMi0wNi0wOFQxNzo0MjozMC4wOTIwMDBaIiwidHlwZSI6ImNvbS5tYnRhLm9jcy5yYXdfbWVzc2FnZSJ9","lambdaArn":"arn"}`;

  expect(recoverLine(line)).toEqual(
    `06/08/22,13:42:30,166744,RGPS,13:42:29,G,U15-141-631,3675,42.3481883333333,71.1404983333333,0.00,18.94\n`
  )
});

test("returns an empty string on missing rawData", async () => {
  const lineMissingData = `{"attemptsMade":4,"arrivalTimestamp":1654710150135,"errorCode":"Lambda.FunctionTimedOut","errorMessage":"The Lambda function invocation timed out. Increase the Timeout setting in the Lambda function.","attemptEndingTimestamp":1654710238263,"lambdaArn":"arn"}`;

  expect(() => recoverLine(lineMissingData)).toThrowError();
});

test("returns an empty string on invalid rawData", async () => {
  const lineInvalidData = `{"attemptsMade":4,"arrivalTimestamp":1654710150135,"errorCode":"Lambda.FunctionTimedOut","errorMessage":"The Lambda function invocation timed out. Increase the Timeout setting in the Lambda function.","attemptEndingTimestamp":1654710238263,"rawData":"not base64 data","lambdaArn":"arn"}`;

  expect(() => recoverLine(lineInvalidData)).toThrowError();
});