import { Future } from 'runner';

export let resolveSleep = () => {
  //Nothing
};

const sleepPromiseFactory = () =>
  new Future<void>((resolve) => {
    resolveSleep = () => {
      resolve();
      sleepPromise = sleepPromiseFactory();
    };
  });

let sleepPromise = sleepPromiseFactory();

export const sleep = () => sleepPromise;
