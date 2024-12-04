import 'dotenv/config';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LISTEN_HOST?: string;
      LISTEN_PORT?: string;
      ITERATION_TIME_STEP?: string;
    }
  }
}

const DEFAULT_LISTEN_HOST = '::';
const DEFAULT_LISTEN_PORT = 8080;
const DEFAULT_ITERATION_TIME_STEP = 100;

export const env = {
  LISTEN_HOST: process.env.LISTEN_HOST || DEFAULT_LISTEN_HOST,
  LISTEN_PORT: Number(process.env.LISTEN_PORT) || DEFAULT_LISTEN_PORT,
  ITERATION_TIME_STEP: Number(process.env.ITERATION_TIME_STEP) || DEFAULT_ITERATION_TIME_STEP,
};

if (!env.LISTEN_PORT || env.LISTEN_PORT > 0xffff || env.LISTEN_PORT < 1) {
  console.warn(`WARN: Env NODE_LISTEN_PORT is invalid. Using fallback value: "${DEFAULT_LISTEN_PORT}".`);
  env.LISTEN_PORT = DEFAULT_LISTEN_PORT;
}
if (!env.LISTEN_HOST) {
  console.warn(`WARN: Env NODE_LISTEN_HOST is invalid. Using fallback value: "${DEFAULT_LISTEN_HOST}".`);
  env.LISTEN_HOST = DEFAULT_LISTEN_HOST;
}

export default env;
