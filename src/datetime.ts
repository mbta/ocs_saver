import { DateTime } from "luxon";

const TZ = "America/New_York";
class InvalidDatetimeError extends Error {}

export const localFromISO = (iso: string) => {
  const datetime = DateTime.fromISO(iso).setZone(TZ);
  if (!datetime.isValid) throw new InvalidDatetimeError(iso);
  return datetime;
};
