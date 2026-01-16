const { getCurrentTime } = require('./lib/time-utils');

function getNameArg(args) {
  const nameArg = args.find((arg) => arg.startsWith('--name='));
  if (!nameArg) {
    return 'World';
  }

  const value = nameArg.slice('--name='.length).trim();
  return value || 'World';
}

const name = getNameArg(process.argv.slice(2));
const currentTime = getCurrentTime();
console.log(`Hello ${name}! The current time is ${currentTime}`);
