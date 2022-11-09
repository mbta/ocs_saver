import { localFromISO } from "~/src/datetime";

const hours = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
];
const minutes = ["00", "15", "30", "45"];

test("handles all times on a DST sprint forward date", async () => {
  const isoDate = "2022-03-14";
  for (const hour of hours) {
    for (const minute of minutes) {
      const isoDt = `${isoDate}T${hour}:${minute}:00.000000Z`;
      const result = localFromISO(isoDt);
      expect(result).not.toBeFalsy();
    }
  }
});

test("handles all times on a DST fallback date", async () => {
  const isoDate = "2022-11-06";
  for (const hour of hours) {
    for (const minute of minutes) {
      const isoDt = `${isoDate}T${hour}:${minute}:00.000000Z`;
      const result = localFromISO(isoDt);
      expect(result).not.toBeFalsy();
    }
  }
});
