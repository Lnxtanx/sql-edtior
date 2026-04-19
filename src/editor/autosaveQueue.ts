export class AutosaveQueue {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  schedule(fileId: string, delayMs: number, callback: () => void): void {
    this.cancel(fileId);
    const timer = window.setTimeout(() => {
      this.timers.delete(fileId);
      callback();
    }, delayMs);
    this.timers.set(fileId, timer);
  }

  cancel(fileId: string): void {
    const existing = this.timers.get(fileId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(fileId);
    }
  }

  flush(fileId: string, callback: () => void): void {
    this.cancel(fileId);
    callback();
  }

  clear(): void {
    for (const fileId of this.timers.keys()) {
      this.cancel(fileId);
    }
  }
}
