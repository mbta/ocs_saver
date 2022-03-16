/**
 * Convenience function for constructing errors where the `name` property has a
 * given value. This enables easier identification and grouping in e.g. Sentry.
 */
export const exception = (name: string, message: string) => {
  const error = new Error(message);
  error.name = name;
  // Omit this function from the stack trace
  Error.captureStackTrace(error, exception);
  return error;
};
