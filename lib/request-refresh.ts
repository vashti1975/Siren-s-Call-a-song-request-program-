// Share slow polls and discard responses from before an owner action or unmount.
export function createRequestRefresh() {
  let active: { controller: AbortController; promise: Promise<void> } | null = null;
  let revision = 0;
  return {
    run<T>(load: (signal: AbortSignal) => Promise<T>, accept: (data: T) => void, reject: (error: unknown) => void): Promise<void> {
      if (active) return active.promise;
      const controller = new AbortController();
      const current = ++revision;
      const promise = Promise.resolve().then(() => load(controller.signal)).then(data => {
        if (current === revision) accept(data);
      }).catch(error => {
        if (current === revision && !controller.signal.aborted) reject(error);
      }).finally(() => {
        if (active?.controller === controller) active = null;
      });
      active = { controller, promise };
      return promise;
    },
    invalidate() {
      revision++;
      active?.controller.abort();
      active = null;
    },
  };
}
