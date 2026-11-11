// Stands in for @upstash/ratelimit and @upstash/redis in the after-hours test.
// Every request passes the per-IP limit; the daily counter stays at 1.
export class Ratelimit {
  static slidingWindow() {
    return {};
  }
  constructor(_opts: unknown) {}
  async limit(_ip: string) {
    return { success: true };
  }
}
export class Redis {
  constructor(_opts: unknown) {}
  async incr(_key: string) {
    return 1;
  }
  async expire(_key: string, _s: number) {
    return 1;
  }
}
