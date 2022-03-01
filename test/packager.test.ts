import { handler } from "~/src/packager";
import { lambdaContextFactory } from "./factories/common";
import { scheduledEventFactory } from "./factories/packager";

test("does nothing", async () => {
  const result = await handler(
    scheduledEventFactory.build(),
    lambdaContextFactory.build(),
    jest.fn()
  );

  expect(result).toBeUndefined();
});
