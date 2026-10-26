import { Infer, defaulted, optional, string, type } from "superstruct";

export const Environment = type({
  AWS_ACCESS_KEY_ID: optional(string()),
  AWS_SECRET_ACCESS_KEY: optional(string()),
  AWS_SESSION_TOKEN: optional(string()),
  AWS_REGION: defaulted(string(), "us-east-1"),
  S3_BUCKET: string(),
  S3_ENDPOINT: optional(string()),
  S3_PREFIX_OUTPUT: string(),
  S3_PREFIX_SOURCE: string(),
});

export type Environment = Infer<typeof Environment>;
