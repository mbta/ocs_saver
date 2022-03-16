import { DateTime } from "luxon";
import { exception } from "./errors";

const TZ = "America/New_York";

export const localFromISO = (iso: string) => {
  const datetime = DateTime.fromISO(iso).setZone(TZ);
  if (!datetime.isValid) throw exception("InvalidDatetime", iso);
  return datetime;
};
