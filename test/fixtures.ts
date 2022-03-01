import { Callback, Context } from "aws-lambda";

/**
 * Shared fixture data for tests.
 */

export const callback: Callback = () => undefined;

export const context: Context = {
  functionName: "test-func",
  functionVersion: "0",
  invokedFunctionArn: "arn:aws:lambda:...",
  memoryLimitInMB: "128",
  awsRequestId: "abc12345",
  logGroupName: "test-group",
  logStreamName: "test-stream",
  getRemainingTimeInMillis: () => 2000,
  callbackWaitsForEmptyEventLoop: true,
  // Deprecated, but still required by the type definitions
  done: () => undefined,
  fail: () => undefined,
  succeed: () => undefined,
};
