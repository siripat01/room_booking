import { a as DashGetAuditLogsInput, i as DashGetAllAuditLogsInput, n as DashAuditLogsResponse, o as dashClient, r as DashClientOptions, t as DashAuditLog } from "./dash-client-CZzJyRrV.mjs";
import { BetterAuthClientPlugin } from "better-auth";

//#region src/sentinel/native/client.d.ts
interface SentinelNativeClientOptions {
  identifyUrl?: string;
  /**
   * Timeout for KV identify and related HTTP requests (milliseconds).
   * @default 1000
   */
  kvTimeout?: number;
  autoSolveChallenge?: boolean;
  onChallengeReceived?: (reason: string) => void;
  onChallengeSolved?: (solveTimeMs: number) => void;
  onChallengeFailed?: (error: Error) => void;
  storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
}
declare const sentinelNativeClient: (options?: SentinelNativeClientOptions) => BetterAuthClientPlugin;
//#endregion
export { type DashAuditLog, type DashAuditLogsResponse, type DashClientOptions, type DashGetAllAuditLogsInput, type DashGetAuditLogsInput, type SentinelNativeClientOptions, dashClient, sentinelNativeClient };