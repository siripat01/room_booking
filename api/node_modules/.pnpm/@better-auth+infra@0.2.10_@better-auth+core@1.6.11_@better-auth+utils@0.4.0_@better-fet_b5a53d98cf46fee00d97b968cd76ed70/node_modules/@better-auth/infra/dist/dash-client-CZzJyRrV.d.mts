//#region src/dash-client.d.ts
interface DashAuditLog {
  eventType: string;
  eventData: Record<string, unknown>;
  eventKey: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  ageInMinutes?: number;
  location?: {
    ipAddress?: string | null;
    city?: string | null;
    country?: string | null;
    countryCode?: string | null;
  };
}
interface DashAuditLogsResponse {
  events: DashAuditLog[];
  total: number;
  limit: number;
  offset: number;
}
type SessionLike = {
  user?: {
    id?: string | null;
  };
};
type UserLike = {
  id?: string | null;
};
interface DashGetAuditLogsInput {
  limit?: number;
  offset?: number;
  organizationId?: string;
  identifier?: string;
  eventType?: string;
  userId?: string;
  user?: UserLike | null;
  session?: SessionLike | null;
}
interface DashGetAllAuditLogsInput {
  limit?: number;
  offset?: number;
  organizationId?: string;
  userId?: string;
  eventType?: string;
  identifier?: string;
  session?: SessionLike | null;
}
interface DashClientOptions {
  resolveUserId?: (input: {
    userId?: string;
    user?: UserLike | null;
    session?: SessionLike | null;
  }) => string | undefined;
}
declare const dashClient: (options?: DashClientOptions) => {
  id: "dash";
  getActions: ($fetch: import("@better-fetch/fetch").BetterFetch) => {
    dash: {
      getAuditLogs: (input?: DashGetAuditLogsInput) => Promise<{
        data: null;
        error: {
          message?: string | undefined;
          status: number;
          statusText: string;
        };
      } | {
        data: DashAuditLogsResponse;
        error: null;
      }>;
      getAllAuditLogs: (input?: DashGetAllAuditLogsInput) => Promise<{
        data: null;
        error: {
          message?: string | undefined;
          status: number;
          statusText: string;
        };
      } | {
        data: DashAuditLogsResponse;
        error: null;
      }>;
    };
  };
  pathMethods: {
    "/events/audit-logs": "GET";
    "/events/all-audit-logs": "GET";
  };
};
//#endregion
export { DashGetAuditLogsInput as a, DashGetAllAuditLogsInput as i, DashAuditLogsResponse as n, dashClient as o, DashClientOptions as r, DashAuditLog as t };