#!/usr/bin/env node

const { getCurrentTime } = require("./lib/time-utils");

const args = process.argv.slice(2);
const nameFlag = args.find((arg) => arg.startsWith("--name="));
const nameIndex = args.indexOf("--name");
const providedName =
  (nameFlag && nameFlag.split("=").slice(1).join("=")) ||
  (nameIndex !== -1 && args[nameIndex + 1]) ||
  "World";

const currentTime = getCurrentTime();
console.log(`Hello ${providedName}! The current time is ${currentTime}`);
