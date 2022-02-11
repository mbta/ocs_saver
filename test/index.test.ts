import hello from "../src/index";

describe("hello", () => {
  test("says hello", () => {
    const greeting = hello("world");
    expect(greeting).toEqual("Hello world!");
  });
});
