import camelCase from "camelcase";

const hello = (name: string) => `Hello ${camelCase(name)}!`;

export default hello;
