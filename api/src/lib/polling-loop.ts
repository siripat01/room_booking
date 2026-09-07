export type PollingLoopController = {
  trigger: () => void;
  stop: () => Promise<void>;
};

export function startPollingLoop(
  task: () => Promise<void>,
  intervalMs: number,
  onError: (error: unknown) => void,
): PollingLoopController {
  let stopped = false;
  let activeRun: Promise<void> | undefined;

  const trigger = () => {
    if (stopped || activeRun) return;
    const run = task()
      .catch(onError)
      .finally(() => {
        if (activeRun === run) activeRun = undefined;
      });
    activeRun = run;
  };

  trigger();
  const timer = setInterval(trigger, intervalMs);
  timer.unref?.();

  return {
    trigger,
    async stop() {
      stopped = true;
      clearInterval(timer);
      await activeRun;
    },
  };
}

export function startAdaptivePollingLoop(
  task: () => Promise<boolean>,
  activeIntervalMs: number,
  idleIntervalMs: number,
  onError: (error: unknown) => void,
): PollingLoopController {
  let stopped = false;
  let activeRun: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const trigger = () => {
    if (stopped || activeRun) return;
    const run = task()
      .then((hasWork) => {
        if (!stopped) {
          timer = setTimeout(trigger, hasWork ? activeIntervalMs : idleIntervalMs);
          timer.unref?.();
        }
      })
      .catch(onError)
      .finally(() => {
        if (activeRun === run) activeRun = undefined;
      });
    activeRun = run;
  };

  trigger();
  return {
    trigger,
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await activeRun;
    },
  };
}
