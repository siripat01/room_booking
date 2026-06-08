import { EMAIL_TEMPLATES, EmailConfig, EmailTemplateId, EmailTemplateVariables, SendBulkEmailsOptions, SendBulkEmailsResult, SendEmailOptions, SendEmailResult, createEmailSender, sendBulkEmails, sendEmail } from "./email.mjs";
import { Account, AuthContext, BetterAuthPlugin, GenericEndpointContext, Session, User } from "better-auth";
import { createFetch } from "@better-fetch/fetch";
import * as zod from "zod";
import z$1 from "zod";
import * as better_call0 from "better-call";
import { APIError, Endpoint, EndpointOptions } from "better-call";
import { DBFieldAttribute } from "better-auth/db";
import * as zod_v4_core0 from "zod/v4/core";
import { Invitation, Member, Organization, Team, TeamMember } from "better-auth/plugins";
export type * from "better-call";

//#region src/identification.d.ts
interface IPLocation {
  lat: number;
  lng: number;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: {
    code: string;
    name: string;
  } | null;
  timezone: string | null;
}
interface Identification {
  visitorId: string;
  requestId: string;
  timestamp: number;
  url: string;
  ip: string | null;
  location: IPLocation | null;
  browser: {
    name: string | null;
    version: string | null;
    os: string | null;
    osVersion: string | null;
    device: string | null;
    userAgent: string | null;
  };
  confidence: number;
  incognito: boolean;
  bot: "notDetected" | "detected" | "unknown";
}
//#endregion
//#region src/sentinel/security.d.ts
type SecurityAction = "log" | "block" | "challenge";
interface ThresholdConfig {
  challenge?: number;
  block?: number;
}
interface SecurityOptions {
  unknownDeviceNotification?: boolean;
  credentialStuffing?: {
    enabled: boolean;
    thresholds?: ThresholdConfig;
    windowSeconds?: number;
    cooldownSeconds?: number;
  };
  impossibleTravel?: {
    enabled: boolean;
    maxSpeedKmh?: number;
    action?: SecurityAction;
  };
  geoBlocking?: {
    allowList?: string[];
    denyList?: string[];
    action?: "block" | "challenge";
  };
  botBlocking?: boolean | {
    action: SecurityAction;
  };
  suspiciousIpBlocking?: boolean | {
    action: SecurityAction;
  };
  velocity?: {
    enabled: boolean;
    thresholds?: ThresholdConfig;
    maxSignupsPerVisitor?: number;
    maxPasswordResetsPerIp?: number;
    maxSignInsPerIp?: number;
    windowSeconds?: number;
    action?: SecurityAction;
  };
  freeTrialAbuse?: {
    enabled: boolean;
    thresholds?: ThresholdConfig;
    maxAccountsPerVisitor?: number;
    action?: SecurityAction;
  };
  compromisedPassword?: {
    enabled: boolean;
    action?: SecurityAction;
    minBreachCount?: number;
  };
  emailValidation?: {
    enabled?: boolean;
    strictness?: "low" | "medium" | "high";
    action?: SecurityAction;
    domainAllowlist?: string[];
  };
  emailNormalization?: {
    enabled?: boolean;
  };
  staleUsers?: {
    enabled: boolean;
    staleDays?: number;
    action?: SecurityAction;
    notifyUser?: boolean;
    notifyAdmin?: boolean;
    adminEmail?: string;
  };
  challengeDifficulty?: number;
}
interface SecurityVerdict {
  action: "allow" | "challenge" | "block";
  challenge?: string;
  reason?: string;
  details?: Record<string, unknown>;
}
interface CredentialStuffingResult {
  blocked: boolean;
  challenged?: boolean;
  challenge?: string;
  reason?: string;
  details?: Record<string, unknown>;
}
interface ImpossibleTravelResult {
  isImpossible: boolean;
  action?: "allow" | "challenge" | "block";
  challenged?: boolean;
  challenge?: string;
  distance?: number;
  timeElapsedHours?: number;
  speedRequired?: number;
  from?: {
    city: string | null;
    country: string | null;
  } | null;
  to?: {
    city: string | null;
    country: string | null;
  } | null;
}
interface CompromisedPasswordResult {
  compromised: boolean;
  breachCount?: number;
  action?: SecurityAction;
}
interface StaleUserResult {
  isStale: boolean;
  daysSinceLastActive?: number;
  staleDays?: number;
  lastActiveAt?: string | null;
  action?: SecurityAction;
  notifyUser?: boolean;
  notifyAdmin?: boolean;
}
interface SecurityEvent {
  type: SecurityEventType;
  timestamp: number;
  userId: string | null;
  visitorId: string | null;
  ip: string | null;
  country: string | null;
  details: Record<string, unknown>;
  action: "logged" | "blocked" | "challenged";
}
type SecurityEventType = "unknown_device" | "credential_stuffing" | "impossible_travel" | "geo_blocked" | "bot_blocked" | "suspicious_ip_detected" | "velocity_exceeded" | "free_trial_abuse" | "compromised_password" | "stale_account_reactivation";
//#endregion
//#region src/sentinel/sentinel.d.ts
declare const sentinel: (options?: SentinelOptions) => {
  id: "sentinel";
  init(ctx: import("better-auth").AuthContext): {
    options: {
      emailValidation: {
        enabled?: boolean;
        strictness?: "low" | "medium" | "high";
        action?: SecurityAction;
        domainAllowlist?: string[];
      } | undefined;
      emailNormalization: {
        enabled?: boolean;
      } | undefined;
      databaseHooks: {
        user: {
          create: {
            before(user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & Record<string, unknown>, ctx: import("better-auth").GenericEndpointContext | null): Promise<{
              data: {
                email: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
              };
            } | undefined>;
            after(user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & Record<string, unknown>, ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
          update: {
            before(user: Partial<{
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            }> & Record<string, unknown>, ctx: import("better-auth").GenericEndpointContext | null): Promise<{
              data: {
                email: string;
                id?: string | undefined;
                createdAt?: Date | undefined;
                updatedAt?: Date | undefined;
                emailVerified?: boolean | undefined;
                name?: string | undefined;
                image?: string | null | undefined;
              };
            } | undefined>;
          };
        };
        session: {
          create: {
            before(session: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              userId: string;
              expiresAt: Date;
              token: string;
              ipAddress?: string | null | undefined;
              userAgent?: string | null | undefined;
            } & Record<string, unknown>, ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
            after(session: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              userId: string;
              expiresAt: Date;
              token: string;
              ipAddress?: string | null | undefined;
              userAgent?: string | null | undefined;
            } & Record<string, unknown>, ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
        };
      };
    };
  };
  hooks: {
    before: ({
      matcher: (context: import("better-auth").HookEndpointContext) => boolean;
      handler: (inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        context: {
          method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
          path: string;
          body: any;
          query: Record<string, any> | undefined;
          params: Record<string, any> & string;
          request: Request | undefined;
          headers: Headers | undefined;
          setHeader: ((key: string, value: string) => void) & ((key: string, value: string) => void);
          setStatus: (status: import("better-call").Status) => void;
          getHeader: ((key: string) => string | null) & ((key: string) => string | null);
          getCookie: (key: string, prefix?: import("better-call").CookiePrefixOptions) => string | null;
          getSignedCookie: (key: string, secret: string, prefix?: import("better-call").CookiePrefixOptions) => Promise<string | null | false>;
          setCookie: (key: string, value: string, options?: import("better-call").CookieOptions) => string;
          setSignedCookie: (key: string, value: string, secret: string, options?: import("better-call").CookieOptions) => Promise<string>;
          json: (<R extends Record<string, any> | null>(json: R, routerResponse?: {
            status?: number;
            headers?: Record<string, string>;
            response?: Response;
            body?: Record<string, string>;
          } | Response) => Promise<R>) & (<R extends Record<string, any> | null>(json: R, routerResponse?: {
            status?: number;
            headers?: Record<string, string>;
            response?: Response;
          } | Response) => Promise<R>);
          context: {
            [x: string]: any;
          } & {
            returned?: unknown | undefined;
            responseHeaders?: Headers | undefined;
            getPlugin: <ID extends import("better-auth").BetterAuthPluginRegistryIdentifier | import("better-auth").LiteralString, PluginOptions extends never>(pluginId: ID) => (ID extends keyof import("better-auth").BetterAuthPluginRegistry<unknown, unknown> ? import("better-auth").BetterAuthPluginRegistry<import("better-auth").BetterAuthOptions, PluginOptions>[ID] extends {
              creator: infer C;
            } ? C extends ((...args: any[]) => infer R) ? R : never : never : BetterAuthPlugin) | null;
            hasPlugin: <ID extends import("better-auth").BetterAuthPluginRegistryIdentifier | import("better-auth").LiteralString>(pluginId: ID) => ID extends never ? true : boolean;
            appName: string;
            baseURL: string;
            version: string;
            options: import("better-auth").BetterAuthOptions;
            trustedOrigins: string[];
            trustedProviders: string[];
            isTrustedOrigin: (url: string, settings?: {
              allowRelativePaths: boolean;
            }) => boolean;
            oauthConfig: {
              skipStateCookieCheck?: boolean | undefined;
              storeStateStrategy: "database" | "cookie";
            };
            newSession: {
              session: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
              } & Record<string, any>;
              user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
              } & Record<string, any>;
            } | null;
            session: {
              session: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
              } & Record<string, any>;
              user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
              } & Record<string, any>;
            } | null;
            setNewSession: (session: {
              session: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
              } & Record<string, any>;
              user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
              } & Record<string, any>;
            } | null) => void;
            socialProviders: import("better-auth").OAuthProvider[];
            authCookies: import("better-auth").BetterAuthCookies;
            logger: ReturnType<(options?: import("better-auth").Logger | undefined) => import("better-auth").InternalLogger>;
            rateLimit: {
              enabled: boolean;
              window: number;
              max: number;
              storage: "memory" | "database" | "secondary-storage";
            } & Omit<import("better-auth").BetterAuthRateLimitOptions, "enabled" | "window" | "max" | "storage">;
            adapter: import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>;
            internalAdapter: import("better-auth").InternalAdapter<import("better-auth").BetterAuthOptions>;
            createAuthCookie: (cookieName: string, overrideAttributes?: Partial<import("better-call").CookieOptions> | undefined) => import("better-auth").BetterAuthCookie;
            secret: string;
            secretConfig: string | import("better-auth").SecretConfig;
            sessionConfig: {
              updateAge: number;
              expiresIn: number;
              freshAge: number;
              cookieRefreshCache: false | {
                enabled: true;
                updateAge: number;
              };
            };
            generateId: (options: {
              model: import("better-auth").ModelNames;
              size?: number | undefined;
            }) => string | false;
            secondaryStorage: import("better-auth").SecondaryStorage | undefined;
            password: {
              hash: (password: string) => Promise<string>;
              verify: (data: {
                password: string;
                hash: string;
              }) => Promise<boolean>;
              config: {
                minPasswordLength: number;
                maxPasswordLength: number;
              };
              checkPassword: (userId: string, ctx: import("better-auth").GenericEndpointContext<import("better-auth").BetterAuthOptions>) => Promise<boolean>;
            };
            tables: import("better-auth").BetterAuthDBSchema;
            runMigrations: () => Promise<void>;
            publishTelemetry: (event: {
              type: string;
              anonymousId?: string | undefined;
              payload: Record<string, any>;
            }) => Promise<void>;
            skipOriginCheck: boolean | string[];
            skipCSRFCheck: boolean;
            runInBackground: (promise: Promise<unknown>) => void;
            runInBackgroundOrAwait: (promise: Promise<unknown> | void) => import("better-auth").Awaitable<unknown>;
          };
          redirect: (url: string) => import("better-call").APIError;
          error: (status: ("OK" | "CREATED" | "ACCEPTED" | "NO_CONTENT" | "MULTIPLE_CHOICES" | "MOVED_PERMANENTLY" | "FOUND" | "SEE_OTHER" | "NOT_MODIFIED" | "TEMPORARY_REDIRECT" | "BAD_REQUEST" | "UNAUTHORIZED" | "PAYMENT_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "NOT_ACCEPTABLE" | "PROXY_AUTHENTICATION_REQUIRED" | "REQUEST_TIMEOUT" | "CONFLICT" | "GONE" | "LENGTH_REQUIRED" | "PRECONDITION_FAILED" | "PAYLOAD_TOO_LARGE" | "URI_TOO_LONG" | "UNSUPPORTED_MEDIA_TYPE" | "RANGE_NOT_SATISFIABLE" | "EXPECTATION_FAILED" | "I'M_A_TEAPOT" | "MISDIRECTED_REQUEST" | "UNPROCESSABLE_ENTITY" | "LOCKED" | "FAILED_DEPENDENCY" | "TOO_EARLY" | "UPGRADE_REQUIRED" | "PRECONDITION_REQUIRED" | "TOO_MANY_REQUESTS" | "REQUEST_HEADER_FIELDS_TOO_LARGE" | "UNAVAILABLE_FOR_LEGAL_REASONS" | "INTERNAL_SERVER_ERROR" | "NOT_IMPLEMENTED" | "BAD_GATEWAY" | "SERVICE_UNAVAILABLE" | "GATEWAY_TIMEOUT" | "HTTP_VERSION_NOT_SUPPORTED" | "VARIANT_ALSO_NEGOTIATES" | "INSUFFICIENT_STORAGE" | "LOOP_DETECTED" | "NOT_EXTENDED" | "NETWORK_AUTHENTICATION_REQUIRED") | import("better-call").Status, body?: {
            message?: string;
            code?: string;
          } & Record<string, any>, headers?: HeadersInit) => import("better-call").APIError;
        };
      } | undefined>;
    } | {
      matcher: (context: import("better-auth").HookEndpointContext) => boolean;
      handler: (inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<void>;
    })[];
    after: {
      matcher: (ctx: import("better-auth").HookEndpointContext) => boolean;
      handler: (inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<void>;
    }[];
  };
};
//#endregion
//#region src/types.d.ts
/**
 * Shared connection options used by infra plugins.
 */
interface InfraPluginConnectionOptions {
  /**
   * The URL of the Better Auth Dash API
   * @default "https://dash.better-auth.com"
   */
  apiUrl?: string;
  /**
   * The URL of the KV storage service
   * @default "https://kv.better-auth.com"
   */
  kvUrl?: string;
  /**
   * Your Better Auth Dash API key
   * @default process.env.BETTER_AUTH_API_KEY
   */
  apiKey?: string;
  /**
   * Timeout for Dash API HTTP requests (milliseconds).
   * @default 3000
   */
  apiTimeout?: number;
  /**
   * Timeout for KV HTTP requests (milliseconds).
   * @default 1000
   */
  kvTimeout?: number;
}
/**
 * Configuration options for the dash plugin.
 */
interface DashOptions extends InfraPluginConnectionOptions {
  /**
   * User activity tracking configuration
   */
  activityTracking?: {
    /**
     * Whether to enable user activity tracking
     *
     * This requires a database schema change to the user table.
     * @default false
     */
    enabled?: boolean;
    /**
     * Interval in milliseconds to update lastActiveAt for active users
     * Set to 0 to disable interval-based tracking
     * @default 300000 (5 minutes)
     */
    updateInterval?: number;
  };
}
/**
 * Configuration options for the sentinel plugin.
 */
interface SentinelOptions extends InfraPluginConnectionOptions {
  /**
   * Security features configuration
   */
  security?: SecurityOptions;
}
/**
 * Internal connection options with required fields resolved.
 */
interface InfraPluginConnectionOptionsInternal extends InfraPluginConnectionOptions {
  apiUrl: string;
  kvUrl: string;
  apiKey: string;
  apiTimeout: number;
  kvTimeout: number;
}
/**
 * Internal options with required fields resolved
 */
interface DashOptionsInternal extends Omit<DashOptions, keyof InfraPluginConnectionOptions>, InfraPluginConnectionOptionsInternal {
  /**
   * Shared Dash HTTP client from {@link createAPI}; injected by {@link dash} when wiring endpoints.
   *
   * @internal
   */
  $api: ReturnType<typeof import("@better-fetch/fetch").createFetch>;
}
/**
 * Resolved dash options from {@link resolveDashOptions} / plugin-stored config; excludes injected `$api`.
 */
type DashOptionsResolved = Omit<DashOptionsInternal, "$api">;
/**
 * Internal sentinel options with required fields resolved.
 */
interface SentinelOptionsInternal extends Omit<SentinelOptions, keyof InfraPluginConnectionOptions>, InfraPluginConnectionOptionsInternal {}
/**
 * Location/geo data used across events, audit logs, and request context.
 */
interface LocationData {
  ipAddress?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
}
/** @deprecated Use LocationData instead */
type LocationDataContext = LocationData;
type InfraEndpointContext = (GenericEndpointContext & {
  context: {
    identification?: Identification | null | undefined;
    visitorId: string | null;
    requestId: string | null;
    location: LocationData | undefined;
  };
}) | undefined;
//#endregion
//#region src/pow.d.ts
/**
 * Proof of Work Challenge System - Client Side
 *
 * Client-side PoW solver and encoding utilities.
 * Server-side challenge generation and verification moved to Infra API.
 */
interface PoWChallenge {
  /** Random nonce for this challenge */
  nonce: string;
  /** Number of leading zero bits required */
  difficulty: number;
  /** Timestamp when challenge was created */
  timestamp: number;
  /** Challenge expiry time in seconds */
  ttl: number;
}
interface PoWSolution {
  /** The nonce from the challenge */
  nonce: string;
  /** The counter value that produces valid hash */
  counter: number;
}
/** Default difficulty in bits (18 = ~500ms solve time) */
declare const DEFAULT_DIFFICULTY = 18;
/** Challenge TTL in seconds */
declare const CHALLENGE_TTL = 60;
/**
 * Solve a PoW challenge (browser-compatible)
 * This function is designed to run in a browser environment
 */
declare function solvePoWChallenge(challenge: PoWChallenge): Promise<PoWSolution>;
/**
 * Decode a base64-encoded challenge string (browser-compatible)
 */
declare function decodePoWChallenge(encoded: string): PoWChallenge | null;
/**
 * Encode a solution string (browser-compatible)
 */
declare function encodePoWSolution(solution: PoWSolution): string;
/**
 * Verify a PoW solution locally (for testing purposes)
 */
declare function verifyPoWSolution(nonce: string, counter: number, difficulty: number): Promise<boolean>;
//#endregion
//#region src/sms.d.ts
/**
 * SMS sending module for @better-auth/infra
 *
 * This module provides SMS sending functionality for OTP verification codes
 * with template support similar to emails.
 */
/**
 * SMS template definitions with their required variables
 */
declare const SMS_TEMPLATES: {
  readonly "phone-verification": {
    readonly variables: {
      code: string;
      appName?: string;
      expirationMinutes?: string;
    };
  };
  readonly "two-factor": {
    readonly variables: {
      code: string;
      appName?: string;
      expirationMinutes?: string;
    };
  };
  readonly "sign-in-otp": {
    readonly variables: {
      code: string;
      appName?: string;
      expirationMinutes?: string;
    };
  };
};
type SMSTemplateId = keyof typeof SMS_TEMPLATES;
type SMSTemplateVariables<T extends SMSTemplateId> = (typeof SMS_TEMPLATES)[T]["variables"];
interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
interface SMSConfig {
  apiKey?: string;
  apiUrl?: string;
  /**
   * Timeout for Dash SMS API HTTP requests (milliseconds).
   * @default 3000
   */
  apiTimeout?: number;
}
/**
 * Options for sending SMS
 */
interface SendSMSOptions {
  /**
   * Phone number to send to (E.164 format, e.g., +1234567890)
   */
  to: string;
  /**
   * The OTP code to send
   */
  code: string;
  /**
   * The SMS template to use (optional - defaults to generic verification message)
   */
  template?: SMSTemplateId;
}
/**
 * Create an SMS sender instance
 */
declare function createSMSSender(config?: SMSConfig): {
  send: (options: SendSMSOptions) => Promise<SendSMSResult>;
};
/**
 * Send an SMS with OTP code via Better Auth Infra.
 *
 * @example
 * ```ts
 * import { sendSMS } from "@better-auth/infra";
 *
 * // For phone verification
 * await sendSMS({
 *   to: "+1234567890",
 *   code: "123456",
 *   template: "phone-verification",
 * });
 *
 * // For two-factor authentication
 * await sendSMS({
 *   to: "+1234567890",
 *   code: "123456",
 *   template: "two-factor",
 * });
 *
 * // Default (no template specified - uses generic message)
 * await sendSMS({
 *   to: "+1234567890",
 *   code: "123456",
 * });
 * ```
 */
declare function sendSMS(options: SendSMSOptions, config?: SMSConfig): Promise<SendSMSResult>;
//#endregion
//#region src/routes/auth/types.d.ts
type DBField = {
  name: string;
  type?: DBFieldAttribute["type"];
  required?: DBFieldAttribute["required"];
  input?: DBFieldAttribute["input"];
  unique?: DBFieldAttribute["unique"];
  hasDefaultValue?: boolean;
  references?: DBFieldAttribute["references"];
  returned?: DBFieldAttribute["returned"];
  bigInt?: DBFieldAttribute["bigint"];
};
interface DashConfigResponse {
  version: string | null;
  socialProviders: string[];
  emailAndPassword: unknown;
  plugins: Array<{
    id: string;
    schema: unknown;
    version?: unknown;
    options: unknown;
  }>;
  organization: {
    sendInvitationEmailEnabled: boolean;
    additionalFields: DBField[];
  };
  user: {
    fields: DBField[];
    additionalFields: DBField[];
    deleteUserEnabled: boolean;
    modelName?: string;
  };
  baseURL: unknown;
  basePath: string;
  emailVerification: {
    sendVerificationEmailEnabled: boolean;
  };
  insights: Record<string, unknown>;
}
interface DashValidateResponse {
  valid: boolean;
}
//#endregion
//#region src/routes/common-types.d.ts
/**
 * Shared JSON body shapes used by multiple `/dash/*` handlers.
 *
 * Naming:
 * - `Dash<Domain>…Response` — full HTTP response body
 * - `Dash<Domain>…Item` — array element or nested row
 * - `Dash<Domain>…Summary` — minimal embedded shape where applicable
 */
interface DashSuccessResponse {
  success: boolean;
}
/** Endpoints that may omit `success` in the body */
interface DashMaybeSuccessResponse {
  success?: boolean;
}
/** Single `id` field (e.g. add-member, create-team) */
interface DashIdRow {
  id: string;
}
//#endregion
//#region ../../node_modules/.bun/@better-auth+scim@1.6.11+89e630460ed02574/node_modules/@better-auth/scim/dist/index.d.mts
//#region src/types.d.ts
interface SCIMProvider {
  id: string;
  providerId: string;
  scimToken: string;
  organizationId?: string;
  userId?: string;
}
type SCIMOptions = {
  /**
   * SCIM provider ownership configuration. When enabled, each provider
   * connection is linked to the user who generated its token.
   */
  providerOwnership?: {
    enabled: boolean;
  };
  /**
   * Minimum organization role(s) required for SCIM management operations
   * (generate-token, list/get/delete provider connections).
   *
   * Defaults to `["admin", organization.creatorRole ?? "owner"]`.
   */
  requiredRole?: string[];
  /**
   * Default list of SCIM providers for testing.
   * These will take precedence over the database when present.
   */
  defaultSCIM?: Omit<SCIMProvider, "id">[];
  /**
   * A callback that runs before a new SCIM token is generated.
   * Runs after the built-in role check, so it can add additional
   * restrictions but cannot bypass the role requirement.
   */
  beforeSCIMTokenGenerated?: (payload: {
    user: User;
    member: Member | null;
    scimToken: string;
  }) => Promise<void>;
  /**
   * A callback that runs after a new SCIM token is generated.
   */
  afterSCIMTokenGenerated?: (payload: {
    user: User;
    member: Member | null;
    scimToken: string;
    scimProvider: SCIMProvider;
  }) => Promise<void>;
  /**
   * How to store the SCIM token in the database.
   *
   * @default "plain"
   */
  storeSCIMToken?: ("hashed" | "plain" | "encrypted" | {
    hash: (scimToken: string) => Promise<string>;
  } | {
    encrypt: (scimToken: string) => Promise<string>;
    decrypt: (scimToken: string) => Promise<string>;
  }) | undefined;
}; //#endregion
//#region src/index.d.ts
declare module "@better-auth/core" {
  interface BetterAuthPluginRegistry<AuthOptions, Options> {
    scim: {
      creator: typeof scim;
    };
  }
}
declare const scim: (options?: SCIMOptions) => {
  id: "scim";
  version: string;
  endpoints: {
    generateSCIMToken: better_call0.StrictEndpoint<"/scim/generate-token", {
      method: "POST";
      body: zod.ZodObject<{
        providerId: zod.ZodString;
        organizationId: zod.ZodOptional<zod.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          summary: string;
          description: string;
          responses: {
            "201": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      scimToken: {
                        description: string;
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
      use: ((inputContext: better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
    }, {
      scimToken: string;
    }>;
    listSCIMProviderConnections: better_call0.StrictEndpoint<"/scim/list-provider-connections", {
      method: "GET";
      use: ((inputContext: better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      providers: {
                        type: string;
                        items: {
                          type: string;
                          properties: {
                            id: {
                              type: string;
                            };
                            providerId: {
                              type: string;
                            };
                            organizationId: {
                              type: string;
                              nullable: boolean;
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    }, {
      providers: {
        id: string;
        providerId: string;
        organizationId: string | null;
      }[];
    }>;
    getSCIMProviderConnection: better_call0.StrictEndpoint<"/scim/get-provider-connection", {
      method: "GET";
      use: ((inputContext: better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      query: zod.ZodObject<{
        providerId: zod.ZodString;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      id: {
                        type: string;
                      };
                      providerId: {
                        type: string;
                      };
                      organizationId: {
                        type: string;
                        nullable: boolean;
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
            };
            "403": {
              description: string;
            };
          };
        };
      };
    }, {
      id: string;
      providerId: string;
      organizationId: string | null;
    }>;
    deleteSCIMProviderConnection: better_call0.StrictEndpoint<"/scim/delete-provider-connection", {
      method: "POST";
      use: ((inputContext: better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      body: zod.ZodObject<{
        providerId: zod.ZodString;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
            };
            "403": {
              description: string;
            };
          };
        };
      };
    }, {
      success: boolean;
    }>;
    getSCIMUser: better_call0.StrictEndpoint<"/scim/v2/Users/:userId", {
      method: "GET";
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly id: {
                        readonly type: "string";
                      };
                      readonly meta: {
                        readonly type: "object";
                        readonly properties: {
                          readonly resourceType: {
                            readonly type: "string";
                          };
                          readonly created: {
                            readonly type: "string";
                            readonly format: "date-time";
                          };
                          readonly lastModified: {
                            readonly type: "string";
                            readonly format: "date-time";
                          };
                          readonly location: {
                            readonly type: "string";
                          };
                        };
                      };
                      readonly userName: {
                        readonly type: "string";
                      };
                      readonly name: {
                        readonly type: "object";
                        readonly properties: {
                          readonly formatted: {
                            readonly type: "string";
                          };
                          readonly givenName: {
                            readonly type: "string";
                          };
                          readonly familyName: {
                            readonly type: "string";
                          };
                        };
                      };
                      readonly displayName: {
                        readonly type: "string";
                      };
                      readonly active: {
                        readonly type: "boolean";
                      };
                      readonly emails: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "object";
                          readonly properties: {
                            readonly value: {
                              readonly type: "string";
                            };
                            readonly primary: {
                              readonly type: "boolean";
                            };
                          };
                        };
                      };
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
        scope: "server";
      };
      use: ((inputContext: better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>) => Promise<{
        authSCIMToken: string;
        scimProvider: Omit<SCIMProvider, "id">;
      }>)[];
    }, {
      id: string;
      externalId: string | undefined;
      meta: {
        resourceType: string;
        created: Date;
        lastModified: Date;
        location: string;
      };
      userName: string;
      name: {
        formatted: string;
      };
      displayName: string;
      active: boolean;
      emails: {
        primary: boolean;
        value: string;
      }[];
      schemas: string[];
    }>;
    createSCIMUser: better_call0.StrictEndpoint<"/scim/v2/Users", {
      method: "POST";
      body: zod.ZodObject<{
        userName: zod.ZodString;
        externalId: zod.ZodOptional<zod.ZodString>;
        name: zod.ZodOptional<zod.ZodObject<{
          formatted: zod.ZodOptional<zod.ZodString>;
          givenName: zod.ZodOptional<zod.ZodString>;
          familyName: zod.ZodOptional<zod.ZodString>;
        }, zod_v4_core0.$strip>>;
        emails: zod.ZodOptional<zod.ZodArray<zod.ZodObject<{
          value: zod.ZodEmail;
          primary: zod.ZodOptional<zod.ZodBoolean>;
        }, zod_v4_core0.$strip>>>;
      }, zod_v4_core0.$strip>;
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "201": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly id: {
                        readonly type: "string";
                      };
                      readonly meta: {
                        readonly type: "object";
                        readonly properties: {
                          readonly resourceType: {
                            readonly type: "string";
                          };
                          readonly created: {
                            readonly type: "string";
                            readonly format: "date-time";
                          };
                          readonly lastModified: {
                            readonly type: "string";
                            readonly format: "date-time";
                          };
                          readonly location: {
                            readonly type: "string";
                          };
                        };
                      };
                      readonly userName: {
                        readonly type: "string";
                      };
                      readonly name: {
                        readonly type: "object";
                        readonly properties: {
                          readonly formatted: {
                            readonly type: "string";
                          };
                          readonly givenName: {
                            readonly type: "string";
                          };
                          readonly familyName: {
                            readonly type: "string";
                          };
                        };
                      };
                      readonly displayName: {
                        readonly type: "string";
                      };
                      readonly active: {
                        readonly type: "boolean";
                      };
                      readonly emails: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "object";
                          readonly properties: {
                            readonly value: {
                              readonly type: "string";
                            };
                            readonly primary: {
                              readonly type: "boolean";
                            };
                          };
                        };
                      };
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
        scope: "server";
      };
      use: ((inputContext: better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>) => Promise<{
        authSCIMToken: string;
        scimProvider: Omit<SCIMProvider, "id">;
      }>)[];
    }, {
      id: string;
      externalId: string | undefined;
      meta: {
        resourceType: string;
        created: Date;
        lastModified: Date;
        location: string;
      };
      userName: string;
      name: {
        formatted: string;
      };
      displayName: string;
      active: boolean;
      emails: {
        primary: boolean;
        value: string;
      }[];
      schemas: string[];
    }>;
    patchSCIMUser: better_call0.StrictEndpoint<"/scim/v2/Users/:userId", {
      method: "PATCH";
      body: zod.ZodObject<{
        schemas: zod.ZodArray<zod.ZodString>;
        Operations: zod.ZodArray<zod.ZodObject<{
          op: zod.ZodPipe<zod.ZodDefault<zod.ZodString>, zod.ZodEnum<{
            replace: "replace";
            add: "add";
            remove: "remove";
          }>>;
          path: zod.ZodOptional<zod.ZodString>;
          value: zod.ZodAny;
        }, zod_v4_core0.$strip>>;
      }, zod_v4_core0.$strip>;
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "204": {
              description: string;
            };
          };
        };
        scope: "server";
      };
      use: ((inputContext: better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>) => Promise<{
        authSCIMToken: string;
        scimProvider: Omit<SCIMProvider, "id">;
      }>)[];
    }, void>;
    deleteSCIMUser: better_call0.StrictEndpoint<"/scim/v2/Users/:userId", {
      method: "DELETE";
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "204": {
              description: string;
            };
          };
        };
        scope: "server";
      };
      use: ((inputContext: better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>) => Promise<{
        authSCIMToken: string;
        scimProvider: Omit<SCIMProvider, "id">;
      }>)[];
    }, void>;
    updateSCIMUser: better_call0.StrictEndpoint<"/scim/v2/Users/:userId", {
      method: "PUT";
      body: zod.ZodObject<{
        userName: zod.ZodString;
        externalId: zod.ZodOptional<zod.ZodString>;
        name: zod.ZodOptional<zod.ZodObject<{
          formatted: zod.ZodOptional<zod.ZodString>;
          givenName: zod.ZodOptional<zod.ZodString>;
          familyName: zod.ZodOptional<zod.ZodString>;
        }, zod_v4_core0.$strip>>;
        emails: zod.ZodOptional<zod.ZodArray<zod.ZodObject<{
          value: zod.ZodEmail;
          primary: zod.ZodOptional<zod.ZodBoolean>;
        }, zod_v4_core0.$strip>>>;
      }, zod_v4_core0.$strip>;
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly id: {
                        readonly type: "string";
                      };
                      readonly meta: {
                        readonly type: "object";
                        readonly properties: {
                          readonly resourceType: {
                            readonly type: "string";
                          };
                          readonly created: {
                            readonly type: "string";
                            readonly format: "date-time";
                          };
                          readonly lastModified: {
                            readonly type: "string";
                            readonly format: "date-time";
                          };
                          readonly location: {
                            readonly type: "string";
                          };
                        };
                      };
                      readonly userName: {
                        readonly type: "string";
                      };
                      readonly name: {
                        readonly type: "object";
                        readonly properties: {
                          readonly formatted: {
                            readonly type: "string";
                          };
                          readonly givenName: {
                            readonly type: "string";
                          };
                          readonly familyName: {
                            readonly type: "string";
                          };
                        };
                      };
                      readonly displayName: {
                        readonly type: "string";
                      };
                      readonly active: {
                        readonly type: "boolean";
                      };
                      readonly emails: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "object";
                          readonly properties: {
                            readonly value: {
                              readonly type: "string";
                            };
                            readonly primary: {
                              readonly type: "boolean";
                            };
                          };
                        };
                      };
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
        scope: "server";
      };
      use: ((inputContext: better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>) => Promise<{
        authSCIMToken: string;
        scimProvider: Omit<SCIMProvider, "id">;
      }>)[];
    }, {
      id: string;
      externalId: string | undefined;
      meta: {
        resourceType: string;
        created: Date;
        lastModified: Date;
        location: string;
      };
      userName: string;
      name: {
        formatted: string;
      };
      displayName: string;
      active: boolean;
      emails: {
        primary: boolean;
        value: string;
      }[];
      schemas: string[];
    }>;
    listSCIMUsers: better_call0.StrictEndpoint<"/scim/v2/Users", {
      method: "GET";
      query: zod.ZodOptional<zod.ZodObject<{
        filter: zod.ZodOptional<zod.ZodString>;
      }, zod_v4_core0.$strip>>;
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      totalResults: {
                        type: string;
                      };
                      itemsPerPage: {
                        type: string;
                      };
                      startIndex: {
                        type: string;
                      };
                      Resources: {
                        type: string;
                        items: {
                          readonly type: "object";
                          readonly properties: {
                            readonly id: {
                              readonly type: "string";
                            };
                            readonly meta: {
                              readonly type: "object";
                              readonly properties: {
                                readonly resourceType: {
                                  readonly type: "string";
                                };
                                readonly created: {
                                  readonly type: "string";
                                  readonly format: "date-time";
                                };
                                readonly lastModified: {
                                  readonly type: "string";
                                  readonly format: "date-time";
                                };
                                readonly location: {
                                  readonly type: "string";
                                };
                              };
                            };
                            readonly userName: {
                              readonly type: "string";
                            };
                            readonly name: {
                              readonly type: "object";
                              readonly properties: {
                                readonly formatted: {
                                  readonly type: "string";
                                };
                                readonly givenName: {
                                  readonly type: "string";
                                };
                                readonly familyName: {
                                  readonly type: "string";
                                };
                              };
                            };
                            readonly displayName: {
                              readonly type: "string";
                            };
                            readonly active: {
                              readonly type: "boolean";
                            };
                            readonly emails: {
                              readonly type: "array";
                              readonly items: {
                                readonly type: "object";
                                readonly properties: {
                                  readonly value: {
                                    readonly type: "string";
                                  };
                                  readonly primary: {
                                    readonly type: "boolean";
                                  };
                                };
                              };
                            };
                            readonly schemas: {
                              readonly type: "array";
                              readonly items: {
                                readonly type: "string";
                              };
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
        scope: "server";
      };
      use: ((inputContext: better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>) => Promise<{
        authSCIMToken: string;
        scimProvider: Omit<SCIMProvider, "id">;
      }>)[];
    }, {
      readonly schemas: readonly ["urn:ietf:params:scim:api:messages:2.0:ListResponse"];
      readonly totalResults: 0;
      readonly startIndex: 1;
      readonly itemsPerPage: 0;
      readonly Resources: readonly [];
    } | {
      schemas: string[];
      totalResults: number;
      startIndex: number;
      itemsPerPage: number;
      Resources: {
        id: string;
        externalId: string | undefined;
        meta: {
          resourceType: string;
          created: Date;
          lastModified: Date;
          location: string;
        };
        userName: string;
        name: {
          formatted: string;
        };
        displayName: string;
        active: boolean;
        emails: {
          primary: boolean;
          value: string;
        }[];
        schemas: string[];
      }[];
    }>;
    getSCIMServiceProviderConfig: better_call0.StrictEndpoint<"/scim/v2/ServiceProviderConfig", {
      method: "GET";
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly patch: {
                        type: string;
                        properties: {
                          supported: {
                            type: string;
                          };
                        };
                      };
                      readonly bulk: {
                        type: string;
                        properties: {
                          supported: {
                            type: string;
                          };
                        };
                      };
                      readonly filter: {
                        type: string;
                        properties: {
                          supported: {
                            type: string;
                          };
                        };
                      };
                      readonly changePassword: {
                        type: string;
                        properties: {
                          supported: {
                            type: string;
                          };
                        };
                      };
                      readonly sort: {
                        type: string;
                        properties: {
                          supported: {
                            type: string;
                          };
                        };
                      };
                      readonly etag: {
                        type: string;
                        properties: {
                          supported: {
                            type: string;
                          };
                        };
                      };
                      readonly authenticationSchemes: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "object";
                          readonly properties: {
                            readonly name: {
                              readonly type: "string";
                            };
                            readonly description: {
                              readonly type: "string";
                            };
                            readonly specUri: {
                              readonly type: "string";
                            };
                            readonly type: {
                              readonly type: "string";
                            };
                            readonly primary: {
                              readonly type: "boolean";
                            };
                          };
                        };
                      };
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly meta: {
                        readonly type: "object";
                        readonly properties: {
                          readonly resourceType: {
                            readonly type: "string";
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
        scope: "server";
      };
    }, {
      patch: {
        supported: boolean;
      };
      bulk: {
        supported: boolean;
      };
      filter: {
        supported: boolean;
      };
      changePassword: {
        supported: boolean;
      };
      sort: {
        supported: boolean;
      };
      etag: {
        supported: boolean;
      };
      authenticationSchemes: {
        name: string;
        description: string;
        specUri: string;
        type: string;
        primary: boolean;
      }[];
      schemas: string[];
      meta: {
        resourceType: string;
      };
    }>;
    getSCIMSchemas: better_call0.StrictEndpoint<"/scim/v2/Schemas", {
      method: "GET";
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "array";
                    items: {
                      readonly type: "object";
                      readonly properties: {
                        readonly id: {
                          readonly type: "string";
                        };
                        readonly schemas: {
                          readonly type: "array";
                          readonly items: {
                            readonly type: "string";
                          };
                        };
                        readonly name: {
                          readonly type: "string";
                        };
                        readonly description: {
                          readonly type: "string";
                        };
                        readonly attributes: {
                          readonly type: "array";
                          readonly items: {
                            readonly properties: {
                              readonly subAttributes: {
                                readonly type: "array";
                                readonly items: {
                                  readonly type: "object";
                                  readonly properties: {
                                    readonly name: {
                                      readonly type: "string";
                                    };
                                    readonly type: {
                                      readonly type: "string";
                                    };
                                    readonly multiValued: {
                                      readonly type: "boolean";
                                    };
                                    readonly description: {
                                      readonly type: "string";
                                    };
                                    readonly required: {
                                      readonly type: "boolean";
                                    };
                                    readonly caseExact: {
                                      readonly type: "boolean";
                                    };
                                    readonly mutability: {
                                      readonly type: "string";
                                    };
                                    readonly returned: {
                                      readonly type: "string";
                                    };
                                    readonly uniqueness: {
                                      readonly type: "string";
                                    };
                                  };
                                };
                              };
                              readonly name: {
                                readonly type: "string";
                              };
                              readonly type: {
                                readonly type: "string";
                              };
                              readonly multiValued: {
                                readonly type: "boolean";
                              };
                              readonly description: {
                                readonly type: "string";
                              };
                              readonly required: {
                                readonly type: "boolean";
                              };
                              readonly caseExact: {
                                readonly type: "boolean";
                              };
                              readonly mutability: {
                                readonly type: "string";
                              };
                              readonly returned: {
                                readonly type: "string";
                              };
                              readonly uniqueness: {
                                readonly type: "string";
                              };
                            };
                            readonly type: "object";
                          };
                        };
                        readonly meta: {
                          readonly type: "object";
                          readonly properties: {
                            readonly resourceType: {
                              readonly type: "string";
                            };
                            readonly location: {
                              readonly type: "string";
                            };
                          };
                          readonly required: readonly ["resourceType", "location"];
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
        scope: "server";
      };
    }, {
      totalResults: number;
      itemsPerPage: number;
      startIndex: number;
      schemas: string[];
      Resources: {
        meta: {
          location: string;
          resourceType: string;
        };
        id: string;
        schemas: string[];
        name: string;
        description: string;
        attributes: ({
          name: string;
          type: string;
          multiValued: boolean;
          description: string;
          required: boolean;
          caseExact: boolean;
          mutability: string;
          returned: string;
          uniqueness: string;
          subAttributes?: undefined;
        } | {
          name: string;
          type: string;
          multiValued: boolean;
          description: string;
          required: boolean;
          mutability: string;
          returned: string;
          caseExact?: undefined;
          uniqueness?: undefined;
          subAttributes?: undefined;
        } | {
          name: string;
          type: string;
          multiValued: boolean;
          description: string;
          required: boolean;
          subAttributes: {
            name: string;
            type: string;
            multiValued: boolean;
            description: string;
            required: boolean;
            caseExact: boolean;
            mutability: string;
            returned: string;
            uniqueness: string;
          }[];
          caseExact?: undefined;
          mutability?: undefined;
          returned?: undefined;
          uniqueness?: undefined;
        } | {
          name: string;
          type: string;
          multiValued: boolean;
          description: string;
          required: boolean;
          subAttributes: ({
            name: string;
            type: string;
            multiValued: boolean;
            description: string;
            required: boolean;
            caseExact: boolean;
            mutability: string;
            returned: string;
            uniqueness: string;
          } | {
            name: string;
            type: string;
            multiValued: boolean;
            description: string;
            required: boolean;
            mutability: string;
            returned: string;
            caseExact?: undefined;
            uniqueness?: undefined;
          })[];
          mutability: string;
          returned: string;
          uniqueness: string;
          caseExact?: undefined;
        })[];
      }[];
    }>;
    getSCIMSchema: better_call0.StrictEndpoint<"/scim/v2/Schemas/:schemaId", {
      method: "GET";
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly id: {
                        readonly type: "string";
                      };
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly name: {
                        readonly type: "string";
                      };
                      readonly description: {
                        readonly type: "string";
                      };
                      readonly attributes: {
                        readonly type: "array";
                        readonly items: {
                          readonly properties: {
                            readonly subAttributes: {
                              readonly type: "array";
                              readonly items: {
                                readonly type: "object";
                                readonly properties: {
                                  readonly name: {
                                    readonly type: "string";
                                  };
                                  readonly type: {
                                    readonly type: "string";
                                  };
                                  readonly multiValued: {
                                    readonly type: "boolean";
                                  };
                                  readonly description: {
                                    readonly type: "string";
                                  };
                                  readonly required: {
                                    readonly type: "boolean";
                                  };
                                  readonly caseExact: {
                                    readonly type: "boolean";
                                  };
                                  readonly mutability: {
                                    readonly type: "string";
                                  };
                                  readonly returned: {
                                    readonly type: "string";
                                  };
                                  readonly uniqueness: {
                                    readonly type: "string";
                                  };
                                };
                              };
                            };
                            readonly name: {
                              readonly type: "string";
                            };
                            readonly type: {
                              readonly type: "string";
                            };
                            readonly multiValued: {
                              readonly type: "boolean";
                            };
                            readonly description: {
                              readonly type: "string";
                            };
                            readonly required: {
                              readonly type: "boolean";
                            };
                            readonly caseExact: {
                              readonly type: "boolean";
                            };
                            readonly mutability: {
                              readonly type: "string";
                            };
                            readonly returned: {
                              readonly type: "string";
                            };
                            readonly uniqueness: {
                              readonly type: "string";
                            };
                          };
                          readonly type: "object";
                        };
                      };
                      readonly meta: {
                        readonly type: "object";
                        readonly properties: {
                          readonly resourceType: {
                            readonly type: "string";
                          };
                          readonly location: {
                            readonly type: "string";
                          };
                        };
                        readonly required: readonly ["resourceType", "location"];
                      };
                    };
                  };
                };
              };
            };
          };
        };
        scope: "server";
      };
    }, {
      meta: {
        location: string;
        resourceType: string;
      };
      id: string;
      schemas: string[];
      name: string;
      description: string;
      attributes: ({
        name: string;
        type: string;
        multiValued: boolean;
        description: string;
        required: boolean;
        caseExact: boolean;
        mutability: string;
        returned: string;
        uniqueness: string;
        subAttributes?: undefined;
      } | {
        name: string;
        type: string;
        multiValued: boolean;
        description: string;
        required: boolean;
        mutability: string;
        returned: string;
        caseExact?: undefined;
        uniqueness?: undefined;
        subAttributes?: undefined;
      } | {
        name: string;
        type: string;
        multiValued: boolean;
        description: string;
        required: boolean;
        subAttributes: {
          name: string;
          type: string;
          multiValued: boolean;
          description: string;
          required: boolean;
          caseExact: boolean;
          mutability: string;
          returned: string;
          uniqueness: string;
        }[];
        caseExact?: undefined;
        mutability?: undefined;
        returned?: undefined;
        uniqueness?: undefined;
      } | {
        name: string;
        type: string;
        multiValued: boolean;
        description: string;
        required: boolean;
        subAttributes: ({
          name: string;
          type: string;
          multiValued: boolean;
          description: string;
          required: boolean;
          caseExact: boolean;
          mutability: string;
          returned: string;
          uniqueness: string;
        } | {
          name: string;
          type: string;
          multiValued: boolean;
          description: string;
          required: boolean;
          mutability: string;
          returned: string;
          caseExact?: undefined;
          uniqueness?: undefined;
        })[];
        mutability: string;
        returned: string;
        uniqueness: string;
        caseExact?: undefined;
      })[];
    }>;
    getSCIMResourceTypes: better_call0.StrictEndpoint<"/scim/v2/ResourceTypes", {
      method: "GET";
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      totalResults: {
                        type: string;
                      };
                      itemsPerPage: {
                        type: string;
                      };
                      startIndex: {
                        type: string;
                      };
                      Resources: {
                        type: string;
                        items: {
                          readonly type: "object";
                          readonly properties: {
                            readonly schemas: {
                              readonly type: "array";
                              readonly items: {
                                readonly type: "string";
                              };
                            };
                            readonly id: {
                              readonly type: "string";
                            };
                            readonly name: {
                              readonly type: "string";
                            };
                            readonly endpoint: {
                              readonly type: "string";
                            };
                            readonly description: {
                              readonly type: "string";
                            };
                            readonly schema: {
                              readonly type: "string";
                            };
                            readonly meta: {
                              readonly type: "object";
                              readonly properties: {
                                readonly resourceType: {
                                  readonly type: "string";
                                };
                                readonly location: {
                                  readonly type: "string";
                                };
                              };
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
        scope: "server";
      };
    }, {
      totalResults: number;
      itemsPerPage: number;
      startIndex: number;
      schemas: string[];
      Resources: {
        meta: {
          location: string;
          resourceType: string;
        };
        schemas: string[];
        id: string;
        name: string;
        endpoint: string;
        description: string;
        schema: string;
      }[];
    }>;
    getSCIMResourceType: better_call0.StrictEndpoint<"/scim/v2/ResourceTypes/:resourceTypeId", {
      method: "GET";
      metadata: {
        allowedMediaTypes: string[];
        openapi: {
          summary: string;
          description: string;
          responses: {
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "401": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "403": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "404": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "429": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "500": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly status: {
                        readonly type: "string";
                      };
                      readonly detail: {
                        readonly type: "string";
                      };
                      readonly scimType: {
                        readonly type: "string";
                      };
                    };
                  };
                };
              };
            };
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    readonly type: "object";
                    readonly properties: {
                      readonly schemas: {
                        readonly type: "array";
                        readonly items: {
                          readonly type: "string";
                        };
                      };
                      readonly id: {
                        readonly type: "string";
                      };
                      readonly name: {
                        readonly type: "string";
                      };
                      readonly endpoint: {
                        readonly type: "string";
                      };
                      readonly description: {
                        readonly type: "string";
                      };
                      readonly schema: {
                        readonly type: "string";
                      };
                      readonly meta: {
                        readonly type: "object";
                        readonly properties: {
                          readonly resourceType: {
                            readonly type: "string";
                          };
                          readonly location: {
                            readonly type: "string";
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
        scope: "server";
      };
    }, {
      meta: {
        location: string;
        resourceType: string;
      };
      schemas: string[];
      id: string;
      name: string;
      endpoint: string;
      description: string;
      schema: string;
    }>;
  };
  schema: {
    scimProvider: {
      fields: {
        userId?: {
          type: "string";
          required: false;
        } | undefined;
        providerId: {
          type: "string";
          required: true;
          unique: true;
        };
        scimToken: {
          type: "string";
          required: true;
          unique: true;
        };
        organizationId: {
          type: "string";
          required: false;
        };
      };
    };
  };
  options: SCIMOptions | undefined;
}; //#endregion
//#endregion
//#region src/routes/directory-sync/types.d.ts
type SCIMPlugin = ReturnType<typeof scim>;
interface DirectorySyncConnection {
  organizationId: string;
  providerId: string;
  scimEndpoint: string;
}
interface DashDirectoryCreateResponse {
  organizationId: string;
  providerId: string;
  scimEndpoint: string;
  scimToken: string;
}
interface DashDirectoryItem {
  id?: string;
  providerId: string;
  organizationId: string;
  scimEndpoint: string;
}
interface DashDirectoryDeleteResponse {
  success: boolean;
}
interface DashDirectoryRegenerateTokenResponse {
  success: boolean;
  scimToken: string;
  scimEndpoint: string;
}
//#endregion
//#region src/events/constants.d.ts
declare const EVENT_TYPES: {
  readonly USER_CREATED: "user_created";
  readonly USER_SIGNED_IN: "user_signed_in";
  readonly USER_SIGNED_OUT: "user_signed_out";
  readonly USER_SIGN_IN_FAILED: "user_sign_in_failed";
  readonly PASSWORD_RESET_REQUESTED: "password_reset_requested";
  readonly PASSWORD_RESET_COMPLETED: "password_reset_completed";
  readonly PASSWORD_CHANGED: "password_changed";
  readonly EMAIL_VERIFICATION_SENT: "email_verification_sent";
  readonly EMAIL_VERIFIED: "email_verified";
  readonly EMAIL_CHANGED: "email_changed";
  readonly PROFILE_UPDATED: "profile_updated";
  readonly PROFILE_IMAGE_UPDATED: "profile_image_updated";
  readonly SESSION_CREATED: "session_created";
  readonly SESSION_REVOKED: "session_revoked";
  readonly ALL_SESSIONS_REVOKED: "all_sessions_revoked";
  readonly TWO_FACTOR_ENABLED: "two_factor_enabled";
  readonly TWO_FACTOR_DISABLED: "two_factor_disabled";
  readonly TWO_FACTOR_VERIFIED: "two_factor_verified";
  readonly ACCOUNT_LINKED: "account_linked";
  readonly ACCOUNT_UNLINKED: "account_unlinked";
  readonly USER_BANNED: "user_banned";
  readonly USER_UNBANNED: "user_unbanned";
  readonly USER_DELETED: "user_deleted";
  readonly USER_IMPERSONATED: "user_impersonated";
  readonly USER_IMPERSONATED_STOPPED: "user_impersonated_stopped";
};
declare const ORGANIZATION_EVENT_TYPES: {
  readonly ORGANIZATION_CREATED: "organization_created";
  readonly ORGANIZATION_UPDATED: "organization_updated";
  readonly ORGANIZATION_MEMBER_ADDED: "organization_member_added";
  readonly ORGANIZATION_MEMBER_REMOVED: "organization_member_removed";
  readonly ORGANIZATION_MEMBER_ROLE_UPDATED: "organization_member_role_updated";
  readonly ORGANIZATION_MEMBER_INVITED: "organization_member_invited";
  readonly ORGANIZATION_MEMBER_INVITE_CANCELED: "organization_member_invite_canceled";
  readonly ORGANIZATION_MEMBER_INVITE_ACCEPTED: "organization_member_invite_accepted";
  readonly ORGANIZATION_MEMBER_INVITE_REJECTED: "organization_member_invite_rejected";
  readonly ORGANIZATION_TEAM_CREATED: "organization_team_created";
  readonly ORGANIZATION_TEAM_UPDATED: "organization_team_updated";
  readonly ORGANIZATION_TEAM_DELETED: "organization_team_deleted";
  readonly ORGANIZATION_TEAM_MEMBER_ADDED: "organization_team_member_added";
  readonly ORGANIZATION_TEAM_MEMBER_REMOVED: "organization_team_member_removed";
};
/** All audit event type string constants (user + organization). */
declare const USER_EVENT_TYPES: {
  readonly ORGANIZATION_CREATED: "organization_created";
  readonly ORGANIZATION_UPDATED: "organization_updated";
  readonly ORGANIZATION_MEMBER_ADDED: "organization_member_added";
  readonly ORGANIZATION_MEMBER_REMOVED: "organization_member_removed";
  readonly ORGANIZATION_MEMBER_ROLE_UPDATED: "organization_member_role_updated";
  readonly ORGANIZATION_MEMBER_INVITED: "organization_member_invited";
  readonly ORGANIZATION_MEMBER_INVITE_CANCELED: "organization_member_invite_canceled";
  readonly ORGANIZATION_MEMBER_INVITE_ACCEPTED: "organization_member_invite_accepted";
  readonly ORGANIZATION_MEMBER_INVITE_REJECTED: "organization_member_invite_rejected";
  readonly ORGANIZATION_TEAM_CREATED: "organization_team_created";
  readonly ORGANIZATION_TEAM_UPDATED: "organization_team_updated";
  readonly ORGANIZATION_TEAM_DELETED: "organization_team_deleted";
  readonly ORGANIZATION_TEAM_MEMBER_ADDED: "organization_team_member_added";
  readonly ORGANIZATION_TEAM_MEMBER_REMOVED: "organization_team_member_removed";
  readonly USER_CREATED: "user_created";
  readonly USER_SIGNED_IN: "user_signed_in";
  readonly USER_SIGNED_OUT: "user_signed_out";
  readonly USER_SIGN_IN_FAILED: "user_sign_in_failed";
  readonly PASSWORD_RESET_REQUESTED: "password_reset_requested";
  readonly PASSWORD_RESET_COMPLETED: "password_reset_completed";
  readonly PASSWORD_CHANGED: "password_changed";
  readonly EMAIL_VERIFICATION_SENT: "email_verification_sent";
  readonly EMAIL_VERIFIED: "email_verified";
  readonly EMAIL_CHANGED: "email_changed";
  readonly PROFILE_UPDATED: "profile_updated";
  readonly PROFILE_IMAGE_UPDATED: "profile_image_updated";
  readonly SESSION_CREATED: "session_created";
  readonly SESSION_REVOKED: "session_revoked";
  readonly ALL_SESSIONS_REVOKED: "all_sessions_revoked";
  readonly TWO_FACTOR_ENABLED: "two_factor_enabled";
  readonly TWO_FACTOR_DISABLED: "two_factor_disabled";
  readonly TWO_FACTOR_VERIFIED: "two_factor_verified";
  readonly ACCOUNT_LINKED: "account_linked";
  readonly ACCOUNT_UNLINKED: "account_unlinked";
  readonly USER_BANNED: "user_banned";
  readonly USER_UNBANNED: "user_unbanned";
  readonly USER_DELETED: "user_deleted";
  readonly USER_IMPERSONATED: "user_impersonated";
  readonly USER_IMPERSONATED_STOPPED: "user_impersonated_stopped";
};
//#endregion
//#region src/routes/events/types.d.ts
/**
 * A single audit log event for the user
 */
interface UserEvent {
  /** The type of event (e.g., "user_signed_in", "password_changed") */
  eventType: UserEventType | string;
  /** Additional data about the event */
  eventData: Record<string, unknown>;
  /** Unique key for the event (typically the user ID) */
  eventKey: string;
  /** Project/organization ID */
  projectId: string;
  /** When the event occurred */
  createdAt: Date;
  /** When the event was last updated */
  updatedAt: Date;
  /** How old the event is in minutes (if available) */
  ageInMinutes?: number;
  /** Location information for the event */
  location?: EventLocation;
}
/**
 * Response from the user events endpoint
 */
interface UserEventsResponse {
  /** Array of audit log events */
  events: UserEvent[];
  /** Total number of events matching the query */
  total: number;
  /** Number of events returned in this response */
  limit: number;
  /** Number of events skipped */
  offset: number;
}
/**
 * Response fromthe user event types endpoint
 */
interface EventTypesResponse {
  user: typeof EVENT_TYPES;
  organization: typeof ORGANIZATION_EVENT_TYPES;
  all: typeof USER_EVENT_TYPES;
}
//#endregion
//#region src/routes/events/index.d.ts
type UserEventType = (typeof USER_EVENT_TYPES)[keyof typeof USER_EVENT_TYPES];
/** Location information associated with an event */
type EventLocation = LocationData;
//#endregion
//#region src/routes/execute-adapter/types.d.ts
interface DashExecuteAdapterCountResponse {
  count: number;
}
interface DashExecuteAdapterFindManyResponse<T = Record<string, unknown>> {
  result: T[];
}
interface DashExecuteAdapterFindOneResponse<T = Record<string, unknown>> {
  result: T | null;
}
interface DashExecuteAdapterMutationResponse<T = Record<string, unknown>> {
  result: T;
}
type DashExecuteAdapterResponse = DashExecuteAdapterFindOneResponse<unknown> | DashExecuteAdapterFindManyResponse<unknown> | DashExecuteAdapterMutationResponse<unknown> | DashExecuteAdapterCountResponse;
//#endregion
//#region src/routes/invitations/types.d.ts
interface DashCompleteInvitationResponse {
  success?: boolean;
  redirectUrl?: string;
  message?: string;
  error?: string;
  user?: unknown;
}
//#endregion
//#region src/routes/organizations/types.d.ts
type DashOrganizationUpdateResponse = Organization;
/** Mirrors joined `user` row fields exposed on dash org APIs. Omitted when the user has no email (e.g. phone-only). */
type DashOrganizationMemberUser = {
  id: string;
  name: string;
  email?: string;
  image: string | null;
};
type DashOrganizationDetailResponse = Organization & {
  memberCount: number;
  members?: DashOrganizationMemberUser[];
};
interface DashOrganizationListResponse {
  organizations: DashOrganizationDetailResponse[];
  total: number;
  offset: number;
  limit: number;
}
type DashOrganizationMember = Member & {
  user?: DashOrganizationMemberUser | null;
};
type DashOrganizationMemberListItem = Member & {
  user: DashOrganizationMemberUser;
  invitedBy?: DashOrganizationMemberUser | null;
};
type DashOrganizationMemberListResponse = DashOrganizationMemberListItem[];
interface DashCreateOrganizationBody {
  name: string;
  slug: string;
  logo?: string;
  defaultTeamName?: string;
}
interface DashCreateOrganizationResponse extends Organization {
  members: DashOrganizationMember[];
}
type DashOrganizationInvitationItem = Invitation & {
  user: DashOrganizationMemberUser | null;
};
type DashOrganizationInvitationListResponse = DashOrganizationInvitationItem[];
type DashInviteMemberResponse = Invitation;
interface DashOrganizationOptionsResponse {
  teamsEnabled: boolean;
}
type DashExportOrganizationsResponse = string;
type DashOrganizationAddMemberResponse = Member;
type DashOrganizationUpdateMemberRoleResponse = Pick<Member, "id" | "role" | "userId">;
interface DashCheckUserByEmailResponse {
  exists: boolean;
  user: DashOrganizationMemberUser | null;
  isAlreadyMember: boolean;
}
type DashOrganizationInvitationStatusItem = Pick<Invitation, "id" | "status">;
interface DashOrganizationDeleteManyResponse {
  success: boolean;
  deletedOrgIds: string[];
  skippedOrgIds: string[];
}
type DashTeam = Pick<Team, "id" | "name">;
type DashOrganizationTeamItem = Team & {
  memberCount: number;
};
type DashOrganizationTeamListResponse = DashOrganizationTeamItem[];
type DashCreateTeamResponse = Team;
type DashUpdateTeamResponse = DashCreateTeamResponse;
type DashTeamMember = TeamMember;
type DashAddTeamMemberResponse = DashTeamMember;
type DashTeamMemberListResponse = Array<TeamMember & {
  user: DashOrganizationMemberUser | null;
}>;
//#endregion
//#region src/routes/sessions/types.d.ts
interface DashSessionRevokeManyResponse {
  success: boolean;
  revokedCount: number;
}
//#endregion
//#region src/routes/sso/types.d.ts
/** Minimal provider fields returned on create/update and nested in responses. */
interface DashSsoProviderSummary {
  id: string;
  providerId: string;
  domain: string;
}
/** Full provider row from list and related endpoints. */
interface DashSsoProviderItem extends DashSsoProviderSummary {
  organizationId: string;
  issuer?: string;
  userId?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  oidcConfig?: unknown;
  samlConfig?: unknown;
  domainVerified?: boolean;
  domainVerificationToken?: string | null;
}
interface DashSsoCreateProviderResponse {
  success: boolean;
  provider: DashSsoProviderSummary;
  domainVerification?: {
    txtRecordName: string;
    verificationToken: string | null;
  };
}
interface DashSsoDeleteResponse {
  success: boolean;
  message?: string;
}
interface DashSsoUpdateProviderResponse {
  success: boolean;
  provider: DashSsoProviderSummary;
}
interface DashSsoVerificationTokenResponse {
  success: boolean;
  providerId: string;
  domain: string;
  verificationToken: string;
  txtRecordName: string;
  existingToken?: boolean;
}
interface DashSsoMarkDomainVerifiedResponse {
  success: boolean;
  domainVerified: boolean;
  message: string;
}
interface DashSsoVerifyDomainResponse {
  verified: boolean;
  message?: string;
}
//#endregion
//#region src/routes/two-factor/types.d.ts
interface DashTwoFactorEnableResponse {
  success: boolean;
  totpURI: string;
  secret: string;
  backupCodes: string[];
}
interface DashTwoFactorTotpViewResponse {
  totpURI: string;
  secret: string;
}
interface DashTwoFactorBackupCodesResponse {
  backupCodes: string[];
}
//#endregion
//#region src/routes/users/types.d.ts
type DashUser = User & {
  banned?: boolean;
  banReason?: string | null;
  banExpires?: number | null;
};
interface DashUserListResponse {
  users: DashUser[];
  total: number;
  offset: number;
  limit: number;
  onlineUsers: number;
  activityTrackingEnabled: boolean;
}
type DashUserDetailsResponse = DashUser & {
  account?: Account[];
  session?: Session[];
  lastActiveAt?: string | Date | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
};
type DashUserOrganization = Pick<Organization, "id" | "name" | "slug" | "logo" | "createdAt"> & {
  role: string;
  teams: Team[];
};
interface DashUserOrganizationsResponse {
  organizations: DashUserOrganization[];
}
type DashCreateUserResponse = DashUser;
type DashUpdateUserResponse = DashUser;
/** One period of sign-up stats; null when the underlying query failed. */
interface DashUserStatsSignUpPeriod {
  signUps: number | null;
  /** Omitted when current or previous-period query failed (avoids misleading deltas). */
  percentage: number | null;
}
/** One period of active-user stats; null when the underlying query failed. */
interface DashUserStatsActivePeriod {
  active: number | null;
  percentage: number | null;
}
interface DashUserStatsResponse {
  daily: DashUserStatsSignUpPeriod;
  weekly: DashUserStatsSignUpPeriod;
  monthly: DashUserStatsSignUpPeriod;
  total: number | null;
  activeUsers: {
    daily: DashUserStatsActivePeriod;
    weekly: DashUserStatsActivePeriod;
    monthly: DashUserStatsActivePeriod;
  };
  /** Set when any stat query failed; some fields may be null. */
  degraded?: boolean;
}
interface DashUserGraphPoint {
  date: string | Date;
  label: string;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
}
interface DashUserGraphDataResponse {
  period: string;
  data: DashUserGraphPoint[];
}
interface DashUserRetention {
  n: number;
  label: string;
  cohortStart: string;
  cohortEnd: string;
  activeStart: string;
  activeEnd: string;
  cohortSize: number;
  retained: number;
  retentionRate: number;
}
interface DashUserRetentionDataResponse {
  period: string;
  data: DashUserRetention[];
}
interface DashBanManyResponse {
  success: boolean;
  bannedUserIds: string[];
  skippedUserIds: string[];
}
interface DashDeleteManyUsersResponse {
  success: boolean;
  deletedUserIds: string[];
  skippedUserIds: string[];
}
interface DashSendManyVerificationEmailsResponse {
  success: boolean;
  sentEmailUserIds: string[];
  skippedEmailUserIds: string[];
}
interface DashCheckUserExistsResponse {
  exists: boolean;
  userId: string | null;
}
//#endregion
//#region src/validation/email.d.ts
/**
 * Normalize an email address for comparison/deduplication
 * - Lowercase the entire email
 * - Remove dots from Gmail-like providers (they ignore dots)
 * - Remove plus addressing (user+tag@domain → user@domain)
 * - Normalize googlemail.com to gmail.com
 *
 * @param email - Raw email to normalize
 * @param context - Auth context
 */
declare function normalizeEmail(email: string, context: AuthContext): string;
//#endregion
//#region src/index.d.ts
declare const dash: <O extends DashOptions>(options?: O) => {
  id: "dash";
  options: DashOptionsResolved;
  version: string;
  init(ctx: import("better-auth").AuthContext): {
    options: {
      databaseHooks: {
        user: {
          create: {
            after(user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & Record<string, unknown>, _ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
          update: {
            after(user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & Record<string, unknown>, _ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
          delete: {
            after(user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & Record<string, unknown>, _ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
        };
        session: {
          create: {
            before(session: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              userId: string;
              expiresAt: Date;
              token: string;
              ipAddress?: string | null | undefined;
              userAgent?: string | null | undefined;
            } & Record<string, unknown>, _ctx: import("better-auth").GenericEndpointContext | null): Promise<{
              data: {
                loginMethod: string | null;
              };
            } | undefined>;
            after(session: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              userId: string;
              expiresAt: Date;
              token: string;
              ipAddress?: string | null | undefined;
              userAgent?: string | null | undefined;
            } & Record<string, unknown>, _ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
          delete: {
            after(session: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              userId: string;
              expiresAt: Date;
              token: string;
              ipAddress?: string | null | undefined;
              userAgent?: string | null | undefined;
            } & Record<string, unknown>, _ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
        };
        account: {
          create: {
            after(account: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              providerId: string;
              accountId: string;
              userId: string;
              accessToken?: string | null | undefined;
              refreshToken?: string | null | undefined;
              idToken?: string | null | undefined;
              accessTokenExpiresAt?: Date | null | undefined;
              refreshTokenExpiresAt?: Date | null | undefined;
              scope?: string | null | undefined;
              password?: string | null | undefined;
            }, _ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
          update: {
            after(account: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              providerId: string;
              accountId: string;
              userId: string;
              accessToken?: string | null | undefined;
              refreshToken?: string | null | undefined;
              idToken?: string | null | undefined;
              accessTokenExpiresAt?: Date | null | undefined;
              refreshTokenExpiresAt?: Date | null | undefined;
              scope?: string | null | undefined;
              password?: string | null | undefined;
            } & Record<string, unknown>, _ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
          delete: {
            after(account: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              providerId: string;
              accountId: string;
              userId: string;
              accessToken?: string | null | undefined;
              refreshToken?: string | null | undefined;
              idToken?: string | null | undefined;
              accessTokenExpiresAt?: Date | null | undefined;
              refreshTokenExpiresAt?: Date | null | undefined;
              scope?: string | null | undefined;
              password?: string | null | undefined;
            } & Record<string, unknown>, _ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
        };
        verification: {
          create: {
            after(verification: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              value: string;
              expiresAt: Date;
              identifier: string;
            } & Record<string, unknown>, _ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
          delete: {
            after(verification: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              value: string;
              expiresAt: Date;
              identifier: string;
            } & Record<string, unknown>, ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
          };
        };
      };
      session: {
        storeSessionInDatabase: boolean;
      };
    };
  };
  hooks: {
    before: {
      matcher: (ctx: import("better-auth").HookEndpointContext) => boolean;
      handler: (inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<void>;
    }[];
    after: {
      matcher: (ctx: import("better-auth").HookEndpointContext) => boolean;
      handler: (inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<void>;
    }[];
  };
  endpoints: {
    getDashConfig: import("better-call").StrictEndpoint<"/dash/config", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
    }, DashConfigResponse>;
    getDashValidate: import("better-call").StrictEndpoint<"/dash/validate", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: import("jose").JWTPayload;
      }>)[];
    }, DashValidateResponse>;
    getDashUsers: import("better-call").StrictEndpoint<"/dash/list-users", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
      query: import("zod").ZodOptional<import("zod").ZodObject<{
        limit: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        offset: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        sortBy: import("zod").ZodOptional<import("zod").ZodString>;
        sortOrder: import("zod").ZodOptional<import("zod").ZodEnum<{
          asc: "asc";
          desc: "desc";
        }>>;
        where: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<import("better-auth").Where[], string>>>;
        countWhere: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<import("better-auth").Where[], string>>>;
      }, import("zod/v4/core").$strip>>;
    }, DashUserListResponse>;
    exportDashUsers: import("better-call").StrictEndpoint<"/dash/export-users", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
      query: import("zod").ZodOptional<import("zod").ZodObject<{
        limit: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        offset: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        sortBy: import("zod").ZodOptional<import("zod").ZodString>;
        sortOrder: import("zod").ZodOptional<import("zod").ZodEnum<{
          asc: "asc";
          desc: "desc";
        }>>;
        where: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<import("better-auth").Where[], string>>>;
        countWhere: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<import("better-auth").Where[], string>>>;
      }, import("zod/v4/core").$strip>>;
    }, Response>;
    createDashUser: import("better-call").StrictEndpoint<"/dash/create-user", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId?: string | undefined;
          organizationRole?: string | undefined;
        };
      }>)[];
      body: import("zod").ZodObject<{
        name: import("zod").ZodString;
        email: import("zod").ZodEmail;
        image: import("zod").ZodOptional<import("zod").ZodString>;
        password: import("zod").ZodOptional<import("zod").ZodString>;
        generatePassword: import("zod").ZodOptional<import("zod").ZodBoolean>;
        emailVerified: import("zod").ZodOptional<import("zod").ZodBoolean>;
        sendVerificationEmail: import("zod").ZodOptional<import("zod").ZodBoolean>;
        sendOrganizationInvite: import("zod").ZodOptional<import("zod").ZodBoolean>;
        organizationRole: import("zod").ZodOptional<import("zod").ZodString>;
        organizationId: import("zod").ZodOptional<import("zod").ZodString>;
      }, import("zod/v4/core").$loose>;
    }, {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      emailVerified: boolean;
      name: string;
      image?: string | null | undefined;
    } & {
      banned?: boolean;
      banReason?: string | null;
      banExpires?: number | null;
    }>;
    deleteDashUser: import("better-call").StrictEndpoint<"/dash/delete-user", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
    }, void>;
    deleteManyDashUsers: import("better-call").StrictEndpoint<"/dash/delete-many-users", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userIds: string[];
        };
      }>)[];
    }, DashDeleteManyUsersResponse>;
    listDashOrganizations: import("better-call").StrictEndpoint<"/dash/list-organizations", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
      query: import("zod").ZodOptional<import("zod").ZodObject<{
        limit: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        offset: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        sortBy: import("zod").ZodOptional<import("zod").ZodEnum<{
          createdAt: "createdAt";
          name: "name";
          slug: "slug";
          members: "members";
        }>>;
        sortOrder: import("zod").ZodOptional<import("zod").ZodEnum<{
          asc: "asc";
          desc: "desc";
        }>>;
        filterMembers: import("zod").ZodOptional<import("zod").ZodEnum<{
          abandoned: "abandoned";
          eq1: "eq1";
          gt1: "gt1";
          gt5: "gt5";
          gt10: "gt10";
        }>>;
        search: import("zod").ZodOptional<import("zod").ZodString>;
        startDate: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodDate, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<Date, string>>]>>;
        endDate: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodDate, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<Date, string>>]>>;
      }, import("zod/v4/core").$strip>>;
    }, DashOrganizationListResponse>;
    exportDashOrganizations: import("better-call").StrictEndpoint<"/dash/export-organizations", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
      query: import("zod").ZodOptional<import("zod").ZodObject<{
        limit: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        offset: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        sortBy: import("zod").ZodOptional<import("zod").ZodString>;
        sortOrder: import("zod").ZodOptional<import("zod").ZodEnum<{
          asc: "asc";
          desc: "desc";
        }>>;
        where: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<import("better-auth").Where[], string>>>;
      }, import("zod/v4/core").$strip>>;
    }, Response>;
    getDashOrganization: import("better-call").StrictEndpoint<"/dash/organization/:id", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
    }, DashOrganizationDetailResponse>;
    listDashOrganizationMembers: import("better-call").StrictEndpoint<"/dash/organization/:id/members", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
    }, DashOrganizationMemberListResponse>;
    listDashOrganizationInvitations: import("better-call").StrictEndpoint<"/dash/organization/:id/invitations", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
    }, DashOrganizationInvitationListResponse>;
    listDashOrganizationTeams: import("better-call").StrictEndpoint<"/dash/organization/:id/teams", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
    }, DashOrganizationTeamListResponse>;
    listDashOrganizationSsoProviders: import("better-call").StrictEndpoint<"/dash/organization/:id/sso-providers", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
    }, DashSsoProviderItem[]>;
    createDashSsoProvider: import("better-call").StrictEndpoint<"/dash/organization/:id/sso-provider/create", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        providerId: import("zod").ZodString;
        domain: import("zod").ZodString;
        protocol: import("zod").ZodEnum<{
          SAML: "SAML";
          OIDC: "OIDC";
        }>;
        userId: import("zod").ZodString;
        samlConfig: import("zod").ZodOptional<import("zod").ZodObject<{
          idpMetadata: import("zod").ZodOptional<import("zod").ZodObject<{
            metadata: import("zod").ZodOptional<import("zod").ZodString>;
            metadataUrl: import("zod").ZodOptional<import("zod").ZodString>;
          }, import("zod/v4/core").$strip>>;
          entryPoint: import("zod").ZodOptional<import("zod").ZodString>;
          cert: import("zod").ZodOptional<import("zod").ZodString>;
          entityId: import("zod").ZodOptional<import("zod").ZodString>;
          mapping: import("zod").ZodOptional<import("zod").ZodObject<{
            id: import("zod").ZodOptional<import("zod").ZodString>;
            email: import("zod").ZodOptional<import("zod").ZodString>;
            emailVerified: import("zod").ZodOptional<import("zod").ZodString>;
            name: import("zod").ZodOptional<import("zod").ZodString>;
            firstName: import("zod").ZodOptional<import("zod").ZodString>;
            lastName: import("zod").ZodOptional<import("zod").ZodString>;
            extraFields: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>>;
          }, import("zod/v4/core").$strip>>;
        }, import("zod/v4/core").$strip>>;
        oidcConfig: import("zod").ZodOptional<import("zod").ZodObject<{
          clientId: import("zod").ZodString;
          clientSecret: import("zod").ZodOptional<import("zod").ZodString>;
          discoveryUrl: import("zod").ZodOptional<import("zod").ZodString>;
          issuer: import("zod").ZodOptional<import("zod").ZodString>;
          mapping: import("zod").ZodOptional<import("zod").ZodObject<{
            id: import("zod").ZodOptional<import("zod").ZodString>;
            email: import("zod").ZodOptional<import("zod").ZodString>;
            emailVerified: import("zod").ZodOptional<import("zod").ZodString>;
            name: import("zod").ZodOptional<import("zod").ZodString>;
            image: import("zod").ZodOptional<import("zod").ZodString>;
            extraFields: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>>;
          }, import("zod/v4/core").$strip>>;
        }, import("zod/v4/core").$strip>>;
      }, import("zod/v4/core").$strip>;
    }, DashSsoCreateProviderResponse>;
    updateDashSsoProvider: import("better-call").StrictEndpoint<"/dash/organization/:id/sso-provider/update", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        providerId: import("zod").ZodString;
        domain: import("zod").ZodString;
        protocol: import("zod").ZodEnum<{
          SAML: "SAML";
          OIDC: "OIDC";
        }>;
        samlConfig: import("zod").ZodOptional<import("zod").ZodObject<{
          idpMetadata: import("zod").ZodOptional<import("zod").ZodObject<{
            metadata: import("zod").ZodOptional<import("zod").ZodString>;
            metadataUrl: import("zod").ZodOptional<import("zod").ZodString>;
          }, import("zod/v4/core").$strip>>;
          entryPoint: import("zod").ZodOptional<import("zod").ZodString>;
          cert: import("zod").ZodOptional<import("zod").ZodString>;
          entityId: import("zod").ZodOptional<import("zod").ZodString>;
          mapping: import("zod").ZodOptional<import("zod").ZodObject<{
            id: import("zod").ZodOptional<import("zod").ZodString>;
            email: import("zod").ZodOptional<import("zod").ZodString>;
            emailVerified: import("zod").ZodOptional<import("zod").ZodString>;
            name: import("zod").ZodOptional<import("zod").ZodString>;
            firstName: import("zod").ZodOptional<import("zod").ZodString>;
            lastName: import("zod").ZodOptional<import("zod").ZodString>;
            extraFields: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>>;
          }, import("zod/v4/core").$strip>>;
        }, import("zod/v4/core").$strip>>;
        oidcConfig: import("zod").ZodOptional<import("zod").ZodObject<{
          clientId: import("zod").ZodString;
          clientSecret: import("zod").ZodOptional<import("zod").ZodString>;
          discoveryUrl: import("zod").ZodOptional<import("zod").ZodString>;
          issuer: import("zod").ZodOptional<import("zod").ZodString>;
          mapping: import("zod").ZodOptional<import("zod").ZodObject<{
            id: import("zod").ZodOptional<import("zod").ZodString>;
            email: import("zod").ZodOptional<import("zod").ZodString>;
            emailVerified: import("zod").ZodOptional<import("zod").ZodString>;
            name: import("zod").ZodOptional<import("zod").ZodString>;
            image: import("zod").ZodOptional<import("zod").ZodString>;
            extraFields: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>>;
          }, import("zod/v4/core").$strip>>;
        }, import("zod/v4/core").$strip>>;
      }, import("zod/v4/core").$strip>;
    }, DashSsoUpdateProviderResponse>;
    requestDashSsoVerificationToken: import("better-call").StrictEndpoint<"/dash/organization/:id/sso-provider/request-verification-token", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        providerId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSsoVerificationTokenResponse>;
    verifyDashSsoProviderDomain: import("better-call").StrictEndpoint<"/dash/organization/:id/sso-provider/verify-domain", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        providerId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSsoVerifyDomainResponse>;
    deleteDashSsoProvider: import("better-call").StrictEndpoint<"/dash/organization/:id/sso-provider/delete", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        providerId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSsoDeleteResponse>;
    markDashSsoProviderDomainVerified: import("better-call").StrictEndpoint<"/dash/organization/:id/sso-provider/mark-domain-verified", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        providerId: import("zod").ZodString;
        verified: import("zod").ZodBoolean;
      }, import("zod/v4/core").$strip>;
    }, DashSsoMarkDomainVerifiedResponse>;
    listDashTeamMembers: import("better-call").StrictEndpoint<"/dash/organization/:orgId/teams/:teamId/members", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
    }, DashTeamMemberListResponse>;
    createDashOrganization: import("better-call").StrictEndpoint<"/dash/organization/create", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
          skipDefaultTeam: boolean;
        };
      }>)[];
      body: import("zod").ZodObject<{
        name: import("zod").ZodString;
        slug: import("zod").ZodString;
        logo: import("zod").ZodOptional<import("zod").ZodString>;
        defaultTeamName: import("zod").ZodOptional<import("zod").ZodString>;
      }, import("zod/v4/core").$catchall<import("zod").ZodUnknown>>;
    }, DashCreateOrganizationResponse>;
    deleteDashOrganization: import("better-call").StrictEndpoint<"/dash/organization/delete", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        organizationId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    deleteManyDashOrganizations: import("better-call").StrictEndpoint<"/dash/organization/delete-many", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationIds: string[];
        };
      }>)[];
    }, DashOrganizationDeleteManyResponse>;
    getDashOrganizationOptions: import("better-call").StrictEndpoint<"/dash/organization/options", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
    }, DashOrganizationOptionsResponse>;
    getDashUser: import("better-call").StrictEndpoint<"/dash/user", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
      query: import("zod").ZodOptional<import("zod").ZodObject<{
        minimal: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodBoolean, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<boolean, string>>]>>;
      }, import("zod/v4/core").$strip>>;
    }, DashUserDetailsResponse>;
    getDashUserOrganizations: import("better-call").StrictEndpoint<"/dash/user-organizations", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
    }, DashUserOrganizationsResponse>;
    updateDashUser: import("better-call").StrictEndpoint<"/dash/update-user", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        name: import("zod").ZodOptional<import("zod").ZodString>;
        email: import("zod").ZodOptional<import("zod").ZodEmail>;
        image: import("zod").ZodOptional<import("zod").ZodString>;
        emailVerified: import("zod").ZodOptional<import("zod").ZodBoolean>;
      }, import("zod/v4/core").$loose>;
    }, {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      emailVerified: boolean;
      name: string;
      image?: string | null | undefined;
    } & {
      banned?: boolean;
      banReason?: string | null;
      banExpires?: number | null;
    }>;
    setDashPassword: import("better-call").StrictEndpoint<"/dash/set-password", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        password: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    unlinkDashAccount: import("better-call").StrictEndpoint<"/dash/unlink-account", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        providerId: import("zod").ZodString;
        accountId: import("zod").ZodOptional<import("zod").ZodString>;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    dashRevokeSession: import("better-call").StrictEndpoint<"/dash/sessions/revoke", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
      metadata: {
        allowedMediaTypes: string[];
      };
    }, DashSuccessResponse>;
    dashRevokeAllSessions: import("better-call").StrictEndpoint<"/dash/sessions/revoke-all", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
      body: import("zod").ZodObject<{
        userId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    dashRevokeManySessions: import("better-call").StrictEndpoint<"/dash/sessions/revoke-many", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userIds: string[];
        };
      }>)[];
    }, DashSessionRevokeManyResponse>;
    dashImpersonateUser: import("better-call").StrictEndpoint<"/dash/impersonate-user", {
      method: "GET";
      query: import("zod").ZodObject<{
        impersonation_token: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
          redirectUrl: string;
          impersonatedBy?: string | undefined;
        };
      }>)[];
    }, never>;
    updateDashOrganization: import("better-call").StrictEndpoint<"/dash/organization/update", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        logo: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodURL, import("zod").ZodLiteral<"">]>>;
        name: import("zod").ZodOptional<import("zod").ZodString>;
        slug: import("zod").ZodOptional<import("zod").ZodString>;
        metadata: import("zod").ZodOptional<import("zod").ZodString>;
      }, import("zod/v4/core").$catchall<import("zod").ZodUnknown>>;
    }, {
      id: string;
      name: string;
      slug: string;
      createdAt: Date;
      logo?: string | null | undefined;
      metadata?: any;
    }>;
    createDashTeam: import("better-call").StrictEndpoint<"/dash/organization/create-team", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        name: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, {
      id: string;
      name: string;
      organizationId: string;
      createdAt: Date;
      updatedAt?: Date | undefined;
    }>;
    updateDashTeam: import("better-call").StrictEndpoint<"/dash/organization/update-team", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        teamId: import("zod").ZodString;
        name: import("zod").ZodOptional<import("zod").ZodString>;
      }, import("zod/v4/core").$strip>;
    }, {
      id: string;
      name: string;
      organizationId: string;
      createdAt: Date;
      updatedAt?: Date | undefined;
    }>;
    deleteDashTeam: import("better-call").StrictEndpoint<"/dash/organization/delete-team", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        teamId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    addDashTeamMember: import("better-call").StrictEndpoint<"/dash/organization/add-team-member", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        teamId: import("zod").ZodString;
        userId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, {
      id: string;
      teamId: string;
      userId: string;
      createdAt: Date;
    }>;
    removeDashTeamMember: import("better-call").StrictEndpoint<"/dash/organization/remove-team-member", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        teamId: import("zod").ZodString;
        userId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    addDashMember: import("better-call").StrictEndpoint<"/dash/organization/add-member", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        userId: import("zod").ZodString;
        role: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, {
      id: string;
      organizationId: string;
      userId: string;
      role: string;
      createdAt: Date;
    }>;
    removeDashMember: import("better-call").StrictEndpoint<"/dash/organization/remove-member", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        memberId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    updateDashMemberRole: import("better-call").StrictEndpoint<"/dash/organization/update-member-role", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        memberId: import("zod").ZodString;
        role: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashOrganizationUpdateMemberRoleResponse>;
    inviteDashMember: import("better-call").StrictEndpoint<"/dash/organization/invite-member", {
      method: "POST";
      body: import("zod").ZodObject<{
        email: import("zod").ZodString;
        role: import("zod").ZodString;
        invitedBy: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
          invitedBy: string;
        };
      }>)[];
    }, {
      id: string;
      organizationId: string;
      email: string;
      role: string;
      status: "pending" | "accepted" | "rejected" | "canceled";
      inviterId: string;
      expiresAt: Date;
      createdAt: Date;
      teamId?: string | null | undefined;
    }>;
    cancelDashInvitation: import("better-call").StrictEndpoint<"/dash/organization/cancel-invitation", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
          invitationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        invitationId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    resendDashInvitation: import("better-call").StrictEndpoint<"/dash/organization/resend-invitation", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
          invitationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        invitationId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    dashCheckUserByEmail: import("better-call").StrictEndpoint<"/dash/organization/check-user-by-email", {
      method: "POST";
      body: import("zod").ZodObject<{
        email: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
    }, DashCheckUserByEmailResponse>;
    dashGetUserStats: import("better-call").StrictEndpoint<"/dash/user-stats", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
    }, DashUserStatsResponse>;
    dashGetUserGraphData: import("better-call").StrictEndpoint<"/dash/user-graph-data", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
      query: import("zod").ZodObject<{
        period: import("zod").ZodDefault<import("zod").ZodEnum<{
          daily: "daily";
          weekly: "weekly";
          monthly: "monthly";
        }>>;
      }, import("zod/v4/core").$strip>;
    }, DashUserGraphDataResponse>;
    dashGetUserRetentionData: import("better-call").StrictEndpoint<"/dash/user-retention-data", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
      query: import("zod").ZodObject<{
        period: import("zod").ZodDefault<import("zod").ZodEnum<{
          daily: "daily";
          weekly: "weekly";
          monthly: "monthly";
        }>>;
      }, import("zod/v4/core").$strip>;
    }, DashUserRetentionDataResponse>;
    dashBanUser: import("better-call").StrictEndpoint<"/dash/ban-user", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        banReason: import("zod").ZodOptional<import("zod").ZodString>;
        banExpires: import("zod").ZodOptional<import("zod").ZodNumber>;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    dashBanManyUsers: import("better-call").StrictEndpoint<"/dash/ban-many-users", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userIds: string[];
        };
      }>)[];
      body: import("zod").ZodObject<{
        banReason: import("zod").ZodOptional<import("zod").ZodString>;
        banExpires: import("zod").ZodOptional<import("zod").ZodNumber>;
      }, import("zod/v4/core").$strip>;
    }, DashBanManyResponse>;
    dashUnbanUser: import("better-call").StrictEndpoint<"/dash/unban-user", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
    }, DashSuccessResponse>;
    dashSendVerificationEmail: import("better-call").StrictEndpoint<"/dash/send-verification-email", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        callbackUrl: import("zod").ZodURL;
      }, import("zod/v4/core").$strip>;
    }, DashSuccessResponse>;
    dashSendManyVerificationEmails: import("better-call").StrictEndpoint<"/dash/send-many-verification-emails", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userIds: string[];
        };
      }>)[];
      body: import("zod").ZodObject<{
        callbackUrl: import("zod").ZodURL;
      }, import("zod/v4/core").$strip>;
    }, DashSendManyVerificationEmailsResponse>;
    dashSendResetPasswordEmail: import("better-call").StrictEndpoint<"/dash/send-reset-password-email", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        callbackUrl: import("zod").ZodURL;
      }, import("zod/v4/core").$strip>;
    }, never>;
    dashEnableTwoFactor: import("better-call").StrictEndpoint<"/dash/enable-two-factor", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
    }, DashTwoFactorEnableResponse>;
    dashViewTwoFactorTotpUri: import("better-call").StrictEndpoint<"/dash/view-two-factor-totp-uri", {
      method: "POST";
      metadata: {
        scope: "http";
      };
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
    }, DashTwoFactorTotpViewResponse>;
    dashViewBackupCodes: import("better-call").StrictEndpoint<"/dash/view-backup-codes", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
    }, DashTwoFactorBackupCodesResponse>;
    dashDisableTwoFactor: import("better-call").StrictEndpoint<"/dash/disable-two-factor", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
    }, DashSuccessResponse>;
    dashGenerateBackupCodes: import("better-call").StrictEndpoint<"/dash/generate-backup-codes", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          userId: string;
        };
      }>)[];
    }, DashTwoFactorBackupCodesResponse>;
    getUserEvents: import("better-call").StrictEndpoint<"/events/list", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      query: import("zod").ZodOptional<import("zod").ZodObject<{
        limit: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        offset: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        eventType: import("zod").ZodOptional<import("zod").ZodString>;
      }, import("zod/v4/core").$strip>>;
    }, UserEventsResponse>;
    getAuditLogs: import("better-call").StrictEndpoint<"/events/audit-logs", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      query: import("zod").ZodOptional<import("zod").ZodObject<{
        limit: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        offset: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        userId: import("zod").ZodOptional<import("zod").ZodString>;
        organizationId: import("zod").ZodOptional<import("zod").ZodString>;
        identifier: import("zod").ZodOptional<import("zod").ZodString>;
        eventType: import("zod").ZodOptional<import("zod").ZodString>;
      }, import("zod/v4/core").$strip>>;
    }, UserEventsResponse>;
    getAllAuditLogs: import("better-call").StrictEndpoint<"/events/all-audit-logs", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      query: import("zod").ZodOptional<import("zod").ZodObject<{
        limit: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        offset: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodNumber, import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<number, string>>]>>;
        userId: import("zod").ZodOptional<import("zod").ZodString>;
        organizationId: import("zod").ZodOptional<import("zod").ZodString>;
        eventType: import("zod").ZodOptional<import("zod").ZodString>;
        identifier: import("zod").ZodOptional<import("zod").ZodString>;
      }, import("zod/v4/core").$strip>>;
    }, UserEventsResponse>;
    getEventTypes: import("better-call").StrictEndpoint<"/events/types", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
    }, EventTypesResponse>;
    dashAcceptInvitation: import("better-call").StrictEndpoint<"/dash/accept-invitation", {
      method: "GET";
      query: import("zod").ZodObject<{
        token: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, {
      status: ("OK" | "CREATED" | "ACCEPTED" | "NO_CONTENT" | "MULTIPLE_CHOICES" | "MOVED_PERMANENTLY" | "FOUND" | "SEE_OTHER" | "NOT_MODIFIED" | "TEMPORARY_REDIRECT" | "BAD_REQUEST" | "UNAUTHORIZED" | "PAYMENT_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "NOT_ACCEPTABLE" | "PROXY_AUTHENTICATION_REQUIRED" | "REQUEST_TIMEOUT" | "CONFLICT" | "GONE" | "LENGTH_REQUIRED" | "PRECONDITION_FAILED" | "PAYLOAD_TOO_LARGE" | "URI_TOO_LONG" | "UNSUPPORTED_MEDIA_TYPE" | "RANGE_NOT_SATISFIABLE" | "EXPECTATION_FAILED" | "I'M_A_TEAPOT" | "MISDIRECTED_REQUEST" | "UNPROCESSABLE_ENTITY" | "LOCKED" | "FAILED_DEPENDENCY" | "TOO_EARLY" | "UPGRADE_REQUIRED" | "PRECONDITION_REQUIRED" | "TOO_MANY_REQUESTS" | "REQUEST_HEADER_FIELDS_TOO_LARGE" | "UNAVAILABLE_FOR_LEGAL_REASONS" | "INTERNAL_SERVER_ERROR" | "NOT_IMPLEMENTED" | "BAD_GATEWAY" | "SERVICE_UNAVAILABLE" | "GATEWAY_TIMEOUT" | "HTTP_VERSION_NOT_SUPPORTED" | "VARIANT_ALSO_NEGOTIATES" | "INSUFFICIENT_STORAGE" | "LOOP_DETECTED" | "NOT_EXTENDED" | "NETWORK_AUTHENTICATION_REQUIRED") | import("better-call").Status;
      body: ({
        message?: string;
        code?: string;
        cause?: unknown;
      } & Record<string, any>) | undefined;
      headers: HeadersInit;
      statusCode: number;
      name: string;
      message: string;
      stack?: string;
      cause?: unknown;
    }>;
    dashCompleteInvitation: import("better-call").StrictEndpoint<"/dash/complete-invitation", {
      method: "POST";
      body: import("zod").ZodObject<{
        token: import("zod").ZodString;
        password: import("zod").ZodOptional<import("zod").ZodString>;
        providerId: import("zod").ZodOptional<import("zod").ZodString>;
        providerAccountId: import("zod").ZodOptional<import("zod").ZodString>;
        accessToken: import("zod").ZodOptional<import("zod").ZodString>;
        refreshToken: import("zod").ZodOptional<import("zod").ZodString>;
      }, import("zod/v4/core").$strip>;
    }, DashCompleteInvitationResponse>;
    dashCheckUserExists: import("better-call").StrictEndpoint<"/dash/check-user-exists", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
      body: import("zod").ZodObject<{
        email: import("zod").ZodEmail;
      }, import("zod/v4/core").$strip>;
    }, DashCheckUserExistsResponse>;
    listDashOrganizationDirectories: import("better-call").StrictEndpoint<"/dash/organization/:id/directories", {
      method: "GET";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
    }, DashDirectoryItem[]>;
    createDashOrganizationDirectory: import("better-call").StrictEndpoint<"/dash/organization/directory/create", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        providerId: import("zod").ZodString;
        ownerUserId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashDirectoryCreateResponse>;
    deleteDashOrganizationDirectory: import("better-call").StrictEndpoint<"/dash/organization/directory/delete", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        providerId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashDirectoryDeleteResponse>;
    regenerateDashDirectoryToken: import("better-call").StrictEndpoint<"/dash/organization/directory/regenerate-token", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: {
          organizationId: string;
        };
      }>)[];
      body: import("zod").ZodObject<{
        providerId: import("zod").ZodString;
      }, import("zod/v4/core").$strip>;
    }, DashDirectoryRegenerateTokenResponse>;
    dashExecuteAdapter: import("better-call").StrictEndpoint<"/dash/execute-adapter", {
      method: "POST";
      use: ((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        payload: Record<string, unknown>;
      }>)[];
      body: import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
        action: import("zod").ZodLiteral<"findOne">;
        model: import("zod").ZodString;
        where: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
          field: import("zod").ZodString;
          value: import("zod").ZodUnknown;
          operator: import("zod").ZodOptional<import("zod").ZodEnum<{
            in: "in";
            eq: "eq";
            ne: "ne";
            gt: "gt";
            gte: "gte";
            lt: "lt";
            lte: "lte";
            contains: "contains";
            starts_with: "starts_with";
            ends_with: "ends_with";
          }>>;
          connector: import("zod").ZodOptional<import("zod").ZodEnum<{
            OR: "OR";
            AND: "AND";
          }>>;
        }, import("zod/v4/core").$strip>>>;
        select: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString>>;
        join: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodBoolean>>;
      }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
        action: import("zod").ZodLiteral<"findMany">;
        model: import("zod").ZodString;
        where: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
          field: import("zod").ZodString;
          value: import("zod").ZodUnknown;
          operator: import("zod").ZodOptional<import("zod").ZodEnum<{
            in: "in";
            eq: "eq";
            ne: "ne";
            gt: "gt";
            gte: "gte";
            lt: "lt";
            lte: "lte";
            contains: "contains";
            starts_with: "starts_with";
            ends_with: "ends_with";
          }>>;
          connector: import("zod").ZodOptional<import("zod").ZodEnum<{
            OR: "OR";
            AND: "AND";
          }>>;
        }, import("zod/v4/core").$strip>>>;
        limit: import("zod").ZodOptional<import("zod").ZodNumber>;
        offset: import("zod").ZodOptional<import("zod").ZodNumber>;
        sortBy: import("zod").ZodOptional<import("zod").ZodObject<{
          field: import("zod").ZodString;
          direction: import("zod").ZodEnum<{
            asc: "asc";
            desc: "desc";
          }>;
        }, import("zod/v4/core").$strip>>;
        join: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodBoolean>>;
      }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
        action: import("zod").ZodLiteral<"create">;
        model: import("zod").ZodString;
        data: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>;
      }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
        action: import("zod").ZodLiteral<"update">;
        model: import("zod").ZodString;
        where: import("zod").ZodArray<import("zod").ZodObject<{
          field: import("zod").ZodString;
          value: import("zod").ZodUnknown;
          operator: import("zod").ZodOptional<import("zod").ZodEnum<{
            in: "in";
            eq: "eq";
            ne: "ne";
            gt: "gt";
            gte: "gte";
            lt: "lt";
            lte: "lte";
            contains: "contains";
            starts_with: "starts_with";
            ends_with: "ends_with";
          }>>;
          connector: import("zod").ZodOptional<import("zod").ZodEnum<{
            OR: "OR";
            AND: "AND";
          }>>;
        }, import("zod/v4/core").$strip>>;
        update: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>;
      }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
        action: import("zod").ZodLiteral<"count">;
        model: import("zod").ZodString;
        where: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
          field: import("zod").ZodString;
          value: import("zod").ZodUnknown;
          operator: import("zod").ZodOptional<import("zod").ZodEnum<{
            in: "in";
            eq: "eq";
            ne: "ne";
            gt: "gt";
            gte: "gte";
            lt: "lt";
            lte: "lte";
            contains: "contains";
            starts_with: "starts_with";
            ends_with: "ends_with";
          }>>;
          connector: import("zod").ZodOptional<import("zod").ZodEnum<{
            OR: "OR";
            AND: "AND";
          }>>;
        }, import("zod/v4/core").$strip>>>;
      }, import("zod/v4/core").$strip>], "action">;
    }, DashExecuteAdapterResponse>;
  };
  schema: O extends {
    activityTracking: {
      enabled: true;
    };
  } ? {
    user: {
      fields: {
        lastActiveAt: {
          type: "date";
          required: false;
        };
      };
    };
  } : {};
};
//#endregion
export { type APIError, CHALLENGE_TTL, type CompromisedPasswordResult, type CredentialStuffingResult, type DBField, DEFAULT_DIFFICULTY, type DashAddTeamMemberResponse, type DashBanManyResponse, type DashCheckUserByEmailResponse, type DashCheckUserExistsResponse, type DashCompleteInvitationResponse, type DashConfigResponse, type DashCreateOrganizationBody, type DashCreateOrganizationResponse, type DashCreateTeamResponse, type DashCreateUserResponse, type DashDeleteManyUsersResponse, type DashDirectoryCreateResponse, type DashDirectoryDeleteResponse, type DashDirectoryItem, type DashDirectoryRegenerateTokenResponse, type DashExecuteAdapterCountResponse, type DashExecuteAdapterFindManyResponse, type DashExecuteAdapterFindOneResponse, type DashExecuteAdapterMutationResponse, type DashExecuteAdapterResponse, type DashExportOrganizationsResponse, type DashIdRow, type DashInviteMemberResponse, type DashMaybeSuccessResponse, type DashOptions, type DashOptionsInternal, type DashOptionsResolved, type DashOrganizationAddMemberResponse, type DashOrganizationDeleteManyResponse, type DashOrganizationDetailResponse, type DashOrganizationInvitationItem, type DashOrganizationInvitationListResponse, type DashOrganizationInvitationStatusItem, type DashOrganizationListResponse, type DashOrganizationMember, type DashOrganizationMemberListItem, type DashOrganizationMemberListResponse, type DashOrganizationMemberUser, type DashOrganizationOptionsResponse, type DashOrganizationTeamItem, type DashOrganizationTeamListResponse, type DashOrganizationUpdateMemberRoleResponse, type DashOrganizationUpdateResponse, type DashSendManyVerificationEmailsResponse, type DashSessionRevokeManyResponse, type DashSsoCreateProviderResponse, type DashSsoDeleteResponse, type DashSsoMarkDomainVerifiedResponse, type DashSsoProviderItem, type DashSsoProviderSummary, type DashSsoUpdateProviderResponse, type DashSsoVerificationTokenResponse, type DashSsoVerifyDomainResponse, type DashSuccessResponse, type DashTeam, type DashTeamMember, type DashTeamMemberListResponse, type DashTwoFactorBackupCodesResponse, type DashTwoFactorEnableResponse, type DashTwoFactorTotpViewResponse, type DashUpdateTeamResponse, type DashUpdateUserResponse, type DashUserDetailsResponse, type DashUserGraphDataResponse, type DashUserListResponse, type DashUserOrganizationsResponse, type DashUserRetentionDataResponse, type DashUserStatsActivePeriod, type DashUserStatsResponse, type DashUserStatsSignUpPeriod, type DashValidateResponse, type DirectorySyncConnection, EMAIL_TEMPLATES, type EmailConfig, type EmailTemplateId, type EmailTemplateVariables, type Endpoint, type EndpointOptions, type EventLocation, type EventTypesResponse, type ImpossibleTravelResult, type InfraEndpointContext, type InfraPluginConnectionOptions, type InfraPluginConnectionOptionsInternal, type LocationData, type LocationDataContext, type PoWChallenge, type PoWSolution, type SCIMPlugin, type SMSConfig, type SMSTemplateId, type SMSTemplateVariables, SMS_TEMPLATES, type SecurityEvent, type SecurityEventType, type SecurityOptions, type SecurityVerdict, type SendBulkEmailsOptions, type SendBulkEmailsResult, type SendEmailOptions, type SendEmailResult, type SendSMSOptions, type SendSMSResult, type SentinelOptions, type SentinelOptionsInternal, type StaleUserResult, type ThresholdConfig, USER_EVENT_TYPES, type UserEvent, type UserEventType, type UserEventsResponse, createEmailSender, createSMSSender, dash, decodePoWChallenge, encodePoWSolution, normalizeEmail, sendBulkEmails, sendEmail, sendSMS, sentinel, solvePoWChallenge, verifyPoWSolution };