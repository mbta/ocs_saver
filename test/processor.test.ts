import hello from "../src/processor";

describe("hello", () => {
  test("says hello", () => {
    const greeting = hello("world");
    expect(greeting).toEqual("Hello world!");
  });
});
