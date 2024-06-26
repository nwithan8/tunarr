import { Channel } from '../src/dao/entities/Channel.js';

interface CustomMatchers<R = unknown> {
  toMatchChannel: (channel: Channel) => R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
