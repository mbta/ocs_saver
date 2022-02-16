import hello from "../src/packager";

describe("hello", () => {
  test("says hello", () => {
    const greeting = hello("world");
    expect(greeting).toEqual("Hello world!");
  });
});
