import { expect, test } from "bun:test";
import { startPollingLoop } from "./polling-loop";

test("polling loop prevents overlapping runs and waits for in-flight work on stop", async () => {
  let runs = 0;
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const loop = startPollingLoop(async () => {
    runs += 1;
    await blocked;
  }, 60_000, () => undefined);

  await Promise.resolve();
  loop.trigger();
  expect(runs).toBe(1);

  let stopped = false;
  const stopping = loop.stop().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  expect(stopped).toBe(false);

  release?.();
  await stopping;
  loop.trigger();
  await Promise.resolve();
  expect(runs).toBe(1);
});

test("polling loop reports task failures and remains stoppable", async () => {
  const errors: unknown[] = [];
  const loop = startPollingLoop(
    async () => {
      throw new Error("expected polling failure");
    },
    60_000,
    (error) => errors.push(error),
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  await loop.stop();
  expect(errors).toHaveLength(1);
  expect(errors[0]).toBeInstanceOf(Error);
});
