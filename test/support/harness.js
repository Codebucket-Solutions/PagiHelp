const assert = require("assert/strict");

const tests = [];

const clone = (value) => JSON.parse(JSON.stringify(value));

const runQuietly = (fn) => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = originalLog;
  }
};

const captureLogs = (fn) => {
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => {
    logs.push(args);
  };
  try {
    return { result: fn(), logs };
  } finally {
    console.log = originalLog;
  }
};

const expectThrowString = (fn, expected) => {
  let thrown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown, expected);
};

const expectThrowMessage = (fn, expected) => {
  let thrown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown instanceof Error, true);
  assert.equal(thrown.message, expected);
};

const test = (name, fn) => {
  tests.push({ name, fn });
};

const run = () => {
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      fn();
      process.stdout.write(`PASS ${name}\n`);
    } catch (error) {
      failed += 1;
      process.stdout.write(`FAIL ${name}\n`);
      process.stderr.write(`${error.stack || error}\n`);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
};

module.exports = {
  assert,
  captureLogs,
  clone,
  expectThrowMessage,
  expectThrowString,
  run,
  runQuietly,
  test,
};
