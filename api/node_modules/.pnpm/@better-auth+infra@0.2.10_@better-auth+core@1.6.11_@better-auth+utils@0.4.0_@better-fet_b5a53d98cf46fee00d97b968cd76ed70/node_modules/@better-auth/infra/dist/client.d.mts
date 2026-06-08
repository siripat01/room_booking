import { a as DashGetAuditLogsInput, i as DashGetAllAuditLogsInput, n as DashAuditLogsResponse, o as dashClient, r as DashClientOptions, t as DashAuditLog } from "./dash-client-CZzJyRrV.mjs";

//#region src/sentinel/client.d.ts
interface SentinelClientOptions {
  /**
   * The URL of the identification service
   * @default "https://kv.better-auth.com"
   */
  identifyUrl?: string;
  /**
   * Timeout for KV identify and related HTTP requests (milliseconds).
   * @default 1000
   */
  kvTimeout?: number;
  /**
   * Whether to automatically solve PoW challenges (default: true)
   */
  autoSolveChallenge?: boolean;
  /**
   * Callback when a PoW challenge is received
   */
  onChallengeReceived?: (reason: string) => void;
  /**
   * Callback when a PoW challenge is solved
   */
  onChallengeSolved?: (solveTimeMs: number) => void;
  /**
   * Callback when a PoW challenge fails to solve
   */
  onChallengeFailed?: (error: Error) => void;
}
declare const sentinelClient: (options?: SentinelClientOptions) => {
  id: "sentinel";
  fetchPlugins: ({
    id: string;
    name: string;
    hooks: {
      onRequest<T extends Record<string, any>>(context: import("@better-fetch/fetch").RequestContext<T>): Promise<import("@better-fetch/fetch").RequestContext<T>>;
      onResponse?: undefined;
    };
  } | {
    id: string;
    name: string;
    hooks: {
      onResponse(context: import("@better-fetch/fetch").ResponseContext): Promise<import("@better-fetch/fetch").ResponseContext>;
      onRequest<T extends Record<string, any>>(context: import("@better-fetch/fetch").RequestContext<T>): Promise<import("@better-fetch/fetch").RequestContext<T>>;
    };
  })[];
};
//#endregion
export { type DashAuditLog, type DashAuditLogsResponse, type DashClientOptions, type DashGetAllAuditLogsInput, type DashGetAuditLogsInput, type SentinelClientOptions, dashClient, sentinelClient };