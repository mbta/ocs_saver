import { Factory } from "fishery";
import { Context } from "aws-lambda";

export const lambdaContextFactory = Factory.define<Context>(({ sequence }) => ({
  functionName: `test-func-${sequence}`,
  functionVersion: "0",
  invokedFunctionArn: `arn:aws:lambda:${sequence}`,
  memoryLimitInMB: "128",
  awsRequestId: `request-id-${sequence}`,
  logGroupName: `test-group-${sequence}`,
  logStreamName: `test-stream-${sequence}`,
  getRemainingTimeInMillis: () => 2000,
  callbackWaitsForEmptyEventLoop: true,
  // Deprecated, but still required by the type definitions
  done: () => undefined,
  fail: () => undefined,
  succeed: () => undefined,
}));
