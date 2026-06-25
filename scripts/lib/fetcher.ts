/**
 * Polite HTTP fetcher: descriptive User-Agent, per-host rate limiting,
 * retry with backoff, and optional robots.txt respect.
 */

import { parseRobots, isAllowed, type RobotsRules } from "../../src/domain/library/robots.js";

const DEFAULT_UA =
  "dos-usb-aggregator/1.0 (+https://github.com/webbertakken/dos-usb; respectful metadata aggregation)";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface FetcherOptions {
  userAgent?: string;
  minIntervalMs?: number;
  retries?: number;
  respectRobots?: boolean;
}

export class PoliteFetcher {
  private readonly userAgent: string;
  private readonly minIntervalMs: number;
  private readonly retries: number;
  private readonly respectRobots: boolean;
  private readonly lastRequestAt = new Map<string, number>();
  private readonly robotsCache = new Map<string, RobotsRules>();

  constructor(options: FetcherOptions = {}) {
    this.userAgent = options.userAgent ?? DEFAULT_UA;
    this.minIntervalMs = options.minIntervalMs ?? 500;
    this.retries = options.retries ?? 4;
    this.respectRobots = options.respectRobots ?? false;
  }

  private async throttle(host: string): Promise<void> {
    const last = this.lastRequestAt.get(host) ?? 0;
    const wait = this.minIntervalMs - (Date.now() - last);
    if (wait > 0) {
      await sleep(wait);
    }
    this.lastRequestAt.set(host, Date.now());
  }

  private async ensureAllowed(url: URL): Promise<void> {
    if (!this.respectRobots) return;
    let rules = this.robotsCache.get(url.host);
    if (!rules) {
      try {
        const res = await fetch(`${url.origin}/robots.txt`, {
          headers: { "User-Agent": this.userAgent },
        });
        rules = parseRobots(res.ok ? await res.text() : "", this.userAgent);
      } catch {
        rules = { disallow: [] };
      }
      this.robotsCache.set(url.host, rules);
    }
    if (!isAllowed(rules, url.pathname)) {
      throw new Error(`Blocked by robots.txt: ${url.href}`);
    }
  }

  private async request(url: string): Promise<Response> {
    const parsed = new URL(url);
    await this.ensureAllowed(parsed);
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      await this.throttle(parsed.host);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(url, {
          headers: { "User-Agent": this.userAgent },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`  fetch ${attempt}/${this.retries} failed ${url}: ${message}`);
        if (attempt < this.retries) {
          await sleep(this.minIntervalMs * attempt * 2);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
  }

  async json<T = unknown>(url: string): Promise<T> {
    return (await this.request(url)).json() as Promise<T>;
  }

  async text(url: string): Promise<string> {
    return (await this.request(url)).text();
  }
}
