import { n as INFRA_API_URL, r as INFRA_KV_URL } from "./constants-CvriWQVc.mjs";
import { n as createKV, t as createAPI } from "./fetch-DiAhoiKA.mjs";
import { EMAIL_TEMPLATES, createEmailSender, sendBulkEmails, sendEmail } from "./email.mjs";
import { APIError, generateId, getAuthTables, logger, parseState } from "better-auth";
import { env } from "@better-auth/core/env";
import { APIError as APIError$1, createAuthEndpoint, createAuthMiddleware, requestPasswordReset, sendVerificationEmailFn, sessionMiddleware } from "better-auth/api";
import { getCurrentAuthContext } from "@better-auth/core/context";
import { createFetch } from "@better-fetch/fetch";
import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";
import { createLocalJWKSet, jwtVerify } from "jose";
import z$1, { z } from "zod";
import { setSessionCookie } from "better-auth/cookies";
//#region src/options.ts
function resolveConnectionOptions(options) {
	return {
		apiUrl: options?.apiUrl || INFRA_API_URL,
		kvUrl: options?.kvUrl || INFRA_KV_URL,
		apiKey: options?.apiKey || env.BETTER_AUTH_API_KEY || "",
		apiTimeout: options?.apiTimeout ?? 3e3,
		kvTimeout: options?.kvTimeout ?? 1e3
	};
}
function resolveDashOptions(options) {
	const activityUpdateInterval = options?.activityTracking?.updateInterval ?? 3e5;
	return {
		...resolveConnectionOptions(options),
		...options,
		activityTracking: {
			...options?.activityTracking,
			updateInterval: activityUpdateInterval
		}
	};
}
function resolveSentinelOptions(options) {
	return {
		...resolveConnectionOptions(options),
		...options
	};
}
//#endregion
//#region src/events/constants.ts
const EVENT_TYPES = {
	USER_CREATED: "user_created",
	USER_SIGNED_IN: "user_signed_in",
	USER_SIGNED_OUT: "user_signed_out",
	USER_SIGN_IN_FAILED: "user_sign_in_failed",
	PASSWORD_RESET_REQUESTED: "password_reset_requested",
	PASSWORD_RESET_COMPLETED: "password_reset_completed",
	PASSWORD_CHANGED: "password_changed",
	EMAIL_VERIFICATION_SENT: "email_verification_sent",
	EMAIL_VERIFIED: "email_verified",
	EMAIL_CHANGED: "email_changed",
	PROFILE_UPDATED: "profile_updated",
	PROFILE_IMAGE_UPDATED: "profile_image_updated",
	SESSION_CREATED: "session_created",
	SESSION_REVOKED: "session_revoked",
	ALL_SESSIONS_REVOKED: "all_sessions_revoked",
	TWO_FACTOR_ENABLED: "two_factor_enabled",
	TWO_FACTOR_DISABLED: "two_factor_disabled",
	TWO_FACTOR_VERIFIED: "two_factor_verified",
	ACCOUNT_LINKED: "account_linked",
	ACCOUNT_UNLINKED: "account_unlinked",
	USER_BANNED: "user_banned",
	USER_UNBANNED: "user_unbanned",
	USER_DELETED: "user_deleted",
	USER_IMPERSONATED: "user_impersonated",
	USER_IMPERSONATED_STOPPED: "user_impersonated_stopped"
};
const routes = {
	SEND_VERIFICATION_EMAIL: "/send-verification-email",
	SIGN_IN: "/sign-in",
	SIGN_IN_EMAIL: "/sign-in/email",
	SIGN_IN_USERNAME: "/sign-in/username",
	SIGN_IN_EMAIL_OTP: "/sign-in/email-otp",
	SIGN_IN_SOCIAL: "/sign-in/social",
	SIGN_IN_ANONYMOUS: "/sign-in/anonymous",
	SIGN_IN_SOCIAL_CALLBACK: "/callback/:id",
	SIGN_IN_OAUTH_CALLBACK: "/oauth2/callback/:id",
	SIGN_OUT: "/sign-out",
	SIGN_UP: "/sign-up",
	SIGN_UP_EMAIL: "/sign-up/email",
	UPDATE_USER: "/update-user",
	CHANGE_EMAIL: "/change-email",
	VERIFY_EMAIL: "/verify-email",
	CHANGE_PASSWORD: "/change-password",
	SET_PASSWORD: "/set-password",
	RESET_PASSWORD: "/reset-password",
	REQUEST_PASSWORD_RESET: "/request-password-reset",
	REVOKE_ALL_SESSIONS: "/revoke-sessions",
	FORGET_PASSWORD: "/forget-password",
	SIGN_IN_PASSKEY: "/sign-in/passkey",
	PASSKEY_ADD: "/passkey/add-passkey",
	SIGN_IN_MAGIC_LINK: "/sign-in/magic-link",
	MAGIC_LINK_VERIFY: "/magic-link/verify",
	SIGN_IN_SSO: "/sign-in/sso",
	TWO_FACTOR_VERIFY_TOTP: "/two-factor/verify-totp",
	TWO_FACTOR_VERIFY_BACKUP: "/two-factor/verify-backup-code",
	TWO_FACTOR_VERIFY_OTP: "/two-factor/verify-otp",
	EMAIL_OTP_SEND: "/email-otp/send-verification-otp",
	PHONE_SEND_OTP: "/phone-number/send-otp",
	PHONE_VERIFY_OTP: "/phone-number/verify-phone-number",
	DEVICE_TOKEN: "/device/token",
	SIWE_VERIFY: "/siwe/verify",
	ORG_CREATE: "/organization/create",
	ORG_INVITE_MEMBER: "/organization/invite-member",
	API_KEY_CREATE: "/api-key/create",
	LINK_SOCIAL: "/link-social",
	DASH_ROUTE: "/dash",
	DASH_UPDATE_USER: "/dash/update-user",
	DASH_REVOKE_SESSIONS_ALL: "/dash/sessions/revoke-all",
	DASH_BAN_USER: "/dash/ban-user",
	DASH_UNBAN_USER: "/dash/unban-user",
	ADMIN_ROUTE: "/admin",
	ADMIN_REVOKE_USER_SESSIONS: "/admin/revoke-user-sessions",
	ADMIN_SET_PASSWORD: "/admin/set-user-password",
	ADMIN_BAN_USER: "/admin/ban-user",
	ADMIN_UNBAN_USER: "/admin/unban-user",
	ADMIN_IMPERSONATE_USER: "/admin/impersonate-user"
};
const ORGANIZATION_EVENT_TYPES = {
	ORGANIZATION_CREATED: "organization_created",
	ORGANIZATION_UPDATED: "organization_updated",
	ORGANIZATION_MEMBER_ADDED: "organization_member_added",
	ORGANIZATION_MEMBER_REMOVED: "organization_member_removed",
	ORGANIZATION_MEMBER_ROLE_UPDATED: "organization_member_role_updated",
	ORGANIZATION_MEMBER_INVITED: "organization_member_invited",
	ORGANIZATION_MEMBER_INVITE_CANCELED: "organization_member_invite_canceled",
	ORGANIZATION_MEMBER_INVITE_ACCEPTED: "organization_member_invite_accepted",
	ORGANIZATION_MEMBER_INVITE_REJECTED: "organization_member_invite_rejected",
	ORGANIZATION_TEAM_CREATED: "organization_team_created",
	ORGANIZATION_TEAM_UPDATED: "organization_team_updated",
	ORGANIZATION_TEAM_DELETED: "organization_team_deleted",
	ORGANIZATION_TEAM_MEMBER_ADDED: "organization_team_member_added",
	ORGANIZATION_TEAM_MEMBER_REMOVED: "organization_team_member_removed"
};
/** All audit event type string constants (user + organization). */
const USER_EVENT_TYPES = {
	...EVENT_TYPES,
	...ORGANIZATION_EVENT_TYPES
};
//#endregion
//#region src/events/core/adapter.ts
const getUserByEmail = async (email, ctx) => {
	let user = null;
	try {
		user = await ctx.context.adapter.findOne({
			model: "user",
			select: [
				"id",
				"name",
				"email"
			],
			where: [{
				field: "email",
				value: email
			}]
		});
	} catch (error) {
		logger.debug("[Dash] Failed to fetch user info:", error);
	}
	return user;
};
async function getUserById(userId, ctx) {
	let user = null;
	try {
		user = await ctx.context.adapter.findOne({
			model: "user",
			select: [
				"id",
				"name",
				"email"
			],
			where: [{
				field: "id",
				value: userId
			}]
		});
	} catch (error) {
		logger.debug("[Dash] Failed to fetch user info:", error);
	}
	return user;
}
const getUserByIdToken = async (providerId, idToken, ctx) => {
	const provider = ctx.context.socialProviders.find((p) => p.id === providerId);
	let user = null;
	if (provider) try {
		user = await provider.getUserInfo(idToken);
	} catch (error) {
		logger.debug("[Dash] Failed to fetch user info:", error);
	}
	return user;
};
const getUserByAuthorizationCode = async (providerId, ctx) => {
	let userInfo = null;
	const provider = ctx.context.socialProviders.find((p) => p.id === providerId);
	if (provider) try {
		const codeVerifier = (await parseState(ctx)).codeVerifier;
		const { code, device_id } = ctx.query ?? {};
		const tokens = await provider.validateAuthorizationCode({
			code,
			codeVerifier,
			deviceId: device_id,
			redirectURI: `${ctx.context.baseURL}/callback/${provider.id}`
		});
		userInfo = await provider.getUserInfo({ ...tokens }).then((res) => res?.user);
	} catch (error) {
		logger.debug("[Dash] Failed to fetch user info:", error);
	}
	return userInfo;
};
//#endregion
//#region src/events/core/events-account.ts
const initAccountEvents = (tracker) => {
	const { trackEvent } = tracker;
	const trackAccountLinking = (account, trigger, ctx, location) => {
		const track = async () => {
			const user = await getUserById(account.userId, ctx);
			trackEvent({
				eventKey: account.userId,
				eventType: EVENT_TYPES.ACCOUNT_LINKED,
				eventDisplayName: `Linked ${account.providerId} account`,
				eventData: {
					userId: account.userId,
					userEmail: user?.email ?? "unknown",
					userName: user?.name ?? "unknown",
					accountId: account.id,
					providerId: account.providerId,
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackAccountUnlink = (account, trigger, ctx, location) => {
		const track = async () => {
			const user = await getUserById(account.userId, ctx);
			trackEvent({
				eventKey: account.userId,
				eventType: EVENT_TYPES.ACCOUNT_UNLINKED,
				eventDisplayName: `Unlinked ${account.providerId} account`,
				eventData: {
					userId: account.userId,
					userEmail: user?.email ?? "unknown",
					userName: user?.name ?? "unknown",
					accountId: account.id,
					providerId: account.providerId,
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackAccountPasswordChange = (account, trigger, ctx, location) => {
		const track = async () => {
			const user = await getUserById(account.userId, ctx);
			trackEvent({
				eventKey: account.userId,
				eventType: EVENT_TYPES.PASSWORD_CHANGED,
				eventDisplayName: "Password changed",
				eventData: {
					userId: account.userId,
					userEmail: user?.email ?? "unknown",
					userName: user?.name ?? "unknown",
					accountId: account.id,
					providerId: account.providerId,
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	return {
		trackAccountLinking,
		trackAccountUnlink,
		trackAccountPasswordChange
	};
};
//#endregion
//#region src/routes/try-decode.ts
function tryDecode(value) {
	const trimmed = value.trim();
	try {
		return decodeURIComponent(trimmed);
	} catch {
		return trimmed;
	}
}
//#endregion
//#region src/routes-matcher.ts
const stripQuery = (value) => value.split("?")[0] || value;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const routeToRegex = (route) => {
	const pattern = escapeRegex(stripQuery(route)).replace(/\/:([^/]+)/g, "/[^/]+");
	return new RegExp(`${pattern}(?:$|[/?])`);
};
const matchesAnyRoute = (path, routes) => {
	const cleanPath = stripQuery(path);
	return routes.some((route) => routeToRegex(route).test(cleanPath));
};
//#endregion
//#region src/events/login-methods.ts
const OAUTH_CALLBACK_PATHS = [routes.SIGN_IN_SOCIAL_CALLBACK, routes.SIGN_IN_OAUTH_CALLBACK];
const PATH_TO_METHOD = [
	[routes.SIGN_IN_EMAIL, "email"],
	[routes.SIGN_UP_EMAIL, "email"],
	[routes.SIGN_IN_USERNAME, "username"],
	[routes.SIGN_IN_EMAIL_OTP, "email-otp"],
	[routes.SIGN_IN_SOCIAL, "social"],
	[routes.SIGN_IN_ANONYMOUS, "anonymous"],
	[routes.SIGN_IN_PASSKEY, "passkey"],
	[routes.SIGN_IN_MAGIC_LINK, "magic-link"],
	[routes.MAGIC_LINK_VERIFY, "magic-link"],
	[routes.SIGN_IN_SSO, "sso"],
	[routes.PHONE_VERIFY_OTP, "phone"],
	[routes.TWO_FACTOR_VERIFY_TOTP, "totp"],
	[routes.TWO_FACTOR_VERIFY_OTP, "two-factor-otp"],
	[routes.TWO_FACTOR_VERIFY_BACKUP, "backup-code"],
	[routes.ADMIN_IMPERSONATE_USER, "impersonation"],
	[routes.DEVICE_TOKEN, "device-code"],
	[routes.SIWE_VERIFY, "siwe"]
];
const getLoginMethod = (ctx) => {
	if (matchesAnyRoute(ctx.path, OAUTH_CALLBACK_PATHS)) {
		const id = ctx.params?.id;
		if (typeof id === "string" && id && !id.startsWith(":")) return id;
		return null;
	}
	for (const [path, method] of PATH_TO_METHOD) if (matchesAnyRoute(ctx.path, [path])) return method;
	return null;
};
//#endregion
//#region src/events/core/events-session.ts
const initSessionEvents = (tracker) => {
	const { trackEvent } = tracker;
	const trackUserSignedIn = (session, trigger, ctx, location) => {
		const track = async () => {
			const loginMethod = session.loginMethod ?? "unknown";
			const user = await getUserById(session.userId, ctx);
			trackEvent({
				eventKey: session.userId,
				eventType: EVENT_TYPES.USER_SIGNED_IN,
				eventDisplayName: `Signed in via ${loginMethod}`,
				eventData: {
					userId: session.userId,
					userName: user?.name ?? "unknown",
					userEmail: user?.email ?? "unknown",
					sessionId: session.id,
					loginMethod,
					userAgent: session.userAgent,
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackUserSignedOut = (session, trigger, ctx, location) => {
		const track = async () => {
			const loginMethod = session.loginMethod ?? "unknown";
			const user = await getUserById(session.userId, ctx);
			trackEvent({
				eventKey: session.userId,
				eventType: EVENT_TYPES.USER_SIGNED_OUT,
				eventDisplayName: "User signed out",
				eventData: {
					userId: session.userId,
					userName: user?.name ?? "unknown",
					userEmail: user?.email ?? "unknown",
					sessionId: session.id,
					loginMethod,
					userAgent: session.userAgent,
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackSessionRevoked = (session, trigger, ctx, location) => {
		const track = async () => {
			const loginMethod = session.loginMethod ?? "unknown";
			const user = await getUserById(session.userId, ctx);
			trackEvent({
				eventKey: session.userId,
				eventType: EVENT_TYPES.SESSION_REVOKED,
				eventDisplayName: "Session revoked",
				eventData: {
					userId: session.userId,
					userName: user?.name ?? "unknown",
					userEmail: user?.email ?? "unknown",
					sessionId: session.id,
					loginMethod,
					userAgent: session.userAgent,
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackSessionRevokedAll = (session, trigger, ctx, _location) => {
		const track = async () => {
			const user = await getUserById(session.userId, ctx);
			trackEvent({
				eventKey: session.userId,
				eventType: EVENT_TYPES.ALL_SESSIONS_REVOKED,
				eventDisplayName: "All sessions revoked",
				eventData: {
					userId: session.userId,
					userName: user?.name ?? "unknown",
					userEmail: user?.email ?? "unknown",
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				}
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackUserImpersonated = (session, trigger, ctx, location) => {
		const track = async () => {
			const loginMethod = session.loginMethod ?? "unknown";
			const user = await getUserById(session.userId, ctx);
			const impersonator = session.impersonatedBy ? await getUserById(session.impersonatedBy, ctx) : null;
			trackEvent({
				eventKey: session.userId,
				eventType: EVENT_TYPES.USER_IMPERSONATED,
				eventDisplayName: "User impersonated",
				eventData: {
					userId: session.userId,
					userName: user?.name ?? "unknown",
					userEmail: user?.email ?? "unknown",
					sessionId: session.id,
					loginMethod,
					userAgent: session.userAgent,
					impersonatedBy: impersonator?.name ?? impersonator?.email ?? session.impersonatedBy,
					impersonatedById: session.impersonatedBy,
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackUserImpersonationStop = (session, trigger, ctx, location) => {
		const track = async () => {
			const loginMethod = session.loginMethod ?? "unknown";
			const user = await getUserById(session.userId, ctx);
			const impersonator = session.impersonatedBy ? await getUserById(session.impersonatedBy, ctx) : null;
			trackEvent({
				eventKey: session.userId,
				eventType: EVENT_TYPES.USER_IMPERSONATED_STOPPED,
				eventDisplayName: "User impersonation stopped",
				eventData: {
					userId: session.userId,
					userName: user?.name ?? "unknown",
					userEmail: user?.email ?? "unknown",
					sessionId: session.id,
					loginMethod,
					userAgent: session.userAgent,
					impersonatedBy: impersonator?.name ?? impersonator?.email ?? session.impersonatedBy,
					impersonatedById: session.impersonatedBy,
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackSessionCreated = (session, trigger, ctx, location) => {
		const track = async () => {
			const loginMethod = session.loginMethod ?? "unknown";
			const user = await getUserById(session.userId, ctx);
			trackEvent({
				eventKey: session.userId,
				eventType: EVENT_TYPES.SESSION_CREATED,
				eventDisplayName: "Session created",
				eventData: {
					userId: session.userId,
					userName: user?.name ?? "unknown",
					userEmail: user?.email ?? "unknown",
					sessionId: session.id,
					loginMethod,
					userAgent: session.userAgent,
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackEmailVerificationSent = (session, user, trigger, _ctx) => {
		trackEvent({
			eventKey: session.userId,
			eventType: EVENT_TYPES.EMAIL_VERIFICATION_SENT,
			eventDisplayName: "Verification email sent",
			eventData: {
				userId: session.userId,
				userName: user.name,
				userEmail: user.email ?? "unknown",
				sessionId: session.id,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackEmailSignInAttempt = (ctx, trigger) => {
		const track = async () => {
			const user = await getUserByEmail(ctx.body.email, ctx);
			trackEvent({
				eventKey: user?.id ?? "unknown",
				eventType: EVENT_TYPES.USER_SIGN_IN_FAILED,
				eventDisplayName: "User sign-in attempt failed",
				eventData: {
					userId: user?.id ?? "unknown",
					nameName: user?.name ?? "unknown",
					userEmail: ctx.body.email,
					loginMethod: getLoginMethod(ctx),
					triggeredBy: user?.id ?? trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				}
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackSocialSignInAttempt = (ctx, trigger) => {
		const track = async () => {
			const user = await getUserByIdToken(ctx.body.provider, ctx.body.idToken, ctx);
			trackEvent({
				eventKey: user?.user.id.toString() ?? "unknown",
				eventType: EVENT_TYPES.USER_SIGN_IN_FAILED,
				eventDisplayName: "User sign-in attempt failed",
				eventData: {
					userId: user?.user.id.toString() ?? "unknown",
					userName: user?.user.name ?? "unknown",
					userEmail: user?.user.email ?? "unknown",
					loginMethod: getLoginMethod(ctx),
					triggeredBy: user?.user.id ?? trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				}
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackSocialSignInRedirectionAttempt = (ctx, trigger) => {
		const track = async () => {
			const user = await getUserByAuthorizationCode(tryDecode(ctx.params?.id), ctx);
			trackEvent({
				eventKey: user?.id.toString() ?? "unknown",
				eventType: EVENT_TYPES.USER_SIGN_IN_FAILED,
				eventDisplayName: "User sign-in attempt failed",
				eventData: {
					userId: user?.id.toString() ?? "unknown",
					userName: user?.name ?? "unknown",
					userEmail: user?.id ?? "unknown",
					loginMethod: getLoginMethod(ctx),
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				}
			});
		};
		ctx.context.runInBackground(track());
	};
	return {
		trackUserSignedIn,
		trackUserSignedOut,
		trackSessionCreated,
		trackSessionRevoked,
		trackSessionRevokedAll,
		trackUserImpersonated,
		trackUserImpersonationStop,
		trackEmailVerificationSent,
		trackEmailSignInAttempt,
		trackSocialSignInAttempt,
		trackSocialSignInRedirectionAttempt
	};
};
//#endregion
//#region src/events/core/events-user.ts
const initUserEvents = (tracker) => {
	const { trackEvent } = tracker;
	const trackUserSignedUp = (user, trigger, location) => {
		trackEvent({
			eventKey: user.id,
			eventType: EVENT_TYPES.USER_CREATED,
			eventDisplayName: `${user.name || user.email || "unknown"} signed up`,
			eventData: {
				userId: user.id,
				userEmail: user.email ?? "unknown",
				userName: user.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			},
			ipAddress: location?.ipAddress,
			city: location?.city,
			country: location?.country,
			countryCode: location?.countryCode
		});
	};
	const trackUserDeleted = (user, trigger, location) => {
		trackEvent({
			eventKey: user.id,
			eventType: EVENT_TYPES.USER_DELETED,
			eventDisplayName: "User deleted",
			eventData: {
				userId: user.id,
				userEmail: user.email ?? "unknown",
				userName: user.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			},
			ipAddress: location?.ipAddress,
			city: location?.city,
			country: location?.country,
			countryCode: location?.countryCode
		});
	};
	const trackUserProfileUpdated = (user, trigger, ctx, location) => {
		trackEvent({
			eventKey: user.id,
			eventType: EVENT_TYPES.PROFILE_UPDATED,
			eventDisplayName: "Profile updated",
			eventData: {
				userId: user.id,
				userEmail: user.email ?? "unknown",
				userName: user.name,
				updatedFields: Object.keys(ctx?.body || {}),
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			},
			ipAddress: location?.ipAddress,
			city: location?.city,
			country: location?.country,
			countryCode: location?.countryCode
		});
	};
	const trackUserProfileImageUpdated = (user, trigger, location) => {
		trackEvent({
			eventKey: user.id,
			eventType: EVENT_TYPES.PROFILE_IMAGE_UPDATED,
			eventDisplayName: "Profile image updated",
			eventData: {
				userId: user.id,
				userEmail: user.email ?? "unknown",
				userName: user.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			},
			ipAddress: location?.ipAddress,
			city: location?.city,
			country: location?.country,
			countryCode: location?.countryCode
		});
	};
	const trackUserBanned = (user, trigger, location) => {
		const reasonSuffix = user.banReason ? `: ${user.banReason}` : "";
		const expiresSuffix = user.banExpires ? ` (until ${user.banExpires.toISOString()})` : "";
		trackEvent({
			eventKey: user.id,
			eventType: EVENT_TYPES.USER_BANNED,
			eventDisplayName: `User banned${reasonSuffix}${expiresSuffix}`,
			eventData: {
				userId: user.id,
				userEmail: user.email ?? "unknown",
				userName: user.name,
				banned: user.banned,
				banReason: user.banReason,
				banExpires: user.banExpires,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			},
			ipAddress: location?.ipAddress,
			city: location?.city,
			country: location?.country,
			countryCode: location?.countryCode
		});
	};
	const trackUserUnBanned = (user, trigger, location) => {
		trackEvent({
			eventKey: user.id,
			eventType: EVENT_TYPES.USER_UNBANNED,
			eventDisplayName: "User unbanned",
			eventData: {
				userId: user.id,
				userEmail: user.email ?? "unknown",
				userName: user.name,
				banned: user.banned,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			},
			ipAddress: location?.ipAddress,
			city: location?.city,
			country: location?.country,
			countryCode: location?.countryCode
		});
	};
	const trackUserEmailVerified = (user, trigger, location) => {
		trackEvent({
			eventKey: user.id,
			eventType: EVENT_TYPES.EMAIL_VERIFIED,
			eventDisplayName: "Email verified",
			eventData: {
				userId: user.id,
				userEmail: user.email ?? "unknown",
				userName: user.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			},
			ipAddress: location?.ipAddress,
			city: location?.city,
			country: location?.country,
			countryCode: location?.countryCode
		});
	};
	return {
		trackUserSignedUp,
		trackUserDeleted,
		trackUserProfileUpdated,
		trackUserProfileImageUpdated,
		trackUserBanned,
		trackUserUnBanned,
		trackUserEmailVerified
	};
};
//#endregion
//#region src/events/core/events-verification.ts
const initVerificationEvents = (tracker) => {
	const { trackEvent } = tracker;
	const trackPasswordResetRequest = (verification, trigger, ctx, location) => {
		const track = async () => {
			const user = await getUserById(verification.value, ctx);
			trackEvent({
				eventKey: verification.value,
				eventType: EVENT_TYPES.PASSWORD_RESET_REQUESTED,
				eventDisplayName: "Password reset requested",
				eventData: {
					userId: verification.value,
					userName: user?.name ?? "unknown",
					userEmail: user?.email ?? "unknown",
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	const trackPasswordResetRequestCompletion = (verification, trigger, ctx, location) => {
		const track = async () => {
			const user = await getUserById(verification.value, ctx);
			trackEvent({
				eventKey: verification.value,
				eventType: EVENT_TYPES.PASSWORD_RESET_COMPLETED,
				eventDisplayName: "Password reset completed",
				eventData: {
					userId: verification.value,
					userName: user?.name ?? "unknown",
					userEmail: user?.email ?? "unknown",
					triggeredBy: trigger.triggeredBy,
					triggerContext: trigger.triggerContext
				},
				ipAddress: location?.ipAddress,
				city: location?.city,
				country: location?.country,
				countryCode: location?.countryCode
			});
		};
		ctx.context.runInBackground(track());
	};
	return {
		trackPasswordResetRequest,
		trackPasswordResetRequestCompletion
	};
};
//#endregion
//#region src/events/triggers.ts
const getTriggerInfo = (ctx, userId, session) => {
	const sessionUserId = session?.userId ?? ctx.context.session?.session.userId ?? userId;
	return {
		triggeredBy: sessionUserId,
		triggerContext: sessionUserId === userId ? "user" : matchesAnyRoute(ctx.path, [routes.ADMIN_ROUTE]) ? "admin" : matchesAnyRoute(ctx.path, [routes.DASH_ROUTE]) ? "dashboard" : sessionUserId === "unknown" ? "user" : "unknown"
	};
};
/**
* Get trigger info for organization hooks
* Since organization hooks don't have direct access to the auth context,
* we use the user parameter when available
*/
const getOrganizationTriggerInfo = (user) => {
	return {
		triggeredBy: user?.id ?? "unknown",
		triggerContext: "organization"
	};
};
//#endregion
//#region src/events/index.ts
const initTrackEvents = ($api) => {
	const trackEvent = (data) => {
		const track = async () => {
			try {
				await $api("/events/track", {
					method: "POST",
					body: {
						eventType: data.eventType,
						eventData: data.eventData,
						eventKey: data.eventKey,
						eventDisplayName: data.eventDisplayName || data.eventType,
						ipAddress: data.ipAddress ?? void 0,
						city: data.city ?? void 0,
						country: data.country ?? void 0,
						countryCode: data.countryCode ?? void 0
					}
				});
			} catch (e) {
				logger.debug("[Dash] Failed to track event:", e);
			}
		};
		const onSuccess = (ctx) => {
			ctx.context.runInBackground(track());
		};
		const onError = () => {
			track();
		};
		getCurrentAuthContext().then(onSuccess, onError);
	};
	return { tracker: { trackEvent } };
};
//#endregion
//#region src/identification.ts
/**
* Identification Service
*
* Fetches identification data from the durable-kv service
* when a request includes an X-Request-Id header.
*/
const IDENTIFICATION_COOKIE_NAME = "__infra-rid";
const identificationCache = /* @__PURE__ */ new Map();
const CACHE_TTL_MS = 6e4;
const CACHE_MAX_SIZE = 1e3;
let lastCleanup = Date.now();
function cleanupCache() {
	const now = Date.now();
	for (const [key, value] of identificationCache.entries()) if (now - value.timestamp > CACHE_TTL_MS) identificationCache.delete(key);
	lastCleanup = now;
}
function maybeCleanup() {
	if (Date.now() - lastCleanup > CACHE_TTL_MS || identificationCache.size > CACHE_MAX_SIZE) cleanupCache();
}
/**
* Fetch identification data from durable-kv by requestId
*/
async function getIdentification(requestId, $kv) {
	maybeCleanup();
	const cached = identificationCache.get(requestId);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;
	const maxRetries = 3;
	const retryDelays = [
		50,
		100,
		200
	];
	for (let attempt = 0; attempt <= maxRetries; attempt++) try {
		const { data, error } = await $kv(`/identify/${requestId}`, { method: "GET" });
		if (data && !error) {
			identificationCache.set(requestId, {
				data,
				timestamp: Date.now()
			});
			return data;
		}
		const status = error?.status;
		if (status === 404 && attempt < maxRetries) {
			await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
			continue;
		}
		if (status !== 404) identificationCache.set(requestId, {
			data: null,
			timestamp: Date.now()
		});
		return null;
	} catch (error) {
		if (attempt === maxRetries) {
			logger.error("[Dash] Failed to fetch identification:", error);
			return null;
		}
		await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt] || 50));
	}
	return null;
}
/**
* Extract identification headers from a request
*/
function extractIdentificationHeaders(request) {
	if (!request) return {
		visitorId: null,
		requestId: null
	};
	return {
		visitorId: request.headers.get("X-Visitor-Id"),
		requestId: request.headers.get("X-Request-Id")
	};
}
/**
* Early middleware that loads identification data.
*
* @param $kv — KV client from {@link createKV} for the same plugin options (one instance per plugin).
*/
function createIdentificationMiddleware($kv) {
	return createAuthMiddleware(async (ctx) => {
		const { visitorId, requestId: headerRequestId } = extractIdentificationHeaders(ctx.request);
		const requestId = headerRequestId ?? ctx.getCookie("__infra-rid") ?? null;
		ctx.context.visitorId = visitorId;
		ctx.context.requestId = requestId;
		if (requestId) {
			if (ctx.context.identification === void 0) ctx.context.identification = await getIdentification(requestId, $kv) ?? null;
		} else ctx.context.identification = null;
		const ipConfig = ctx.context.options?.advanced?.ipAddress;
		if (ipConfig?.disableIpTracking === true) {
			ctx.context.location = void 0;
			return;
		}
		const identification = ctx.context.identification;
		if (requestId && identification) {
			const loc = getLocation(identification);
			ctx.context.location = {
				ipAddress: identification.ip || void 0,
				city: loc?.city || void 0,
				country: loc?.country?.name || void 0,
				countryCode: loc?.country?.code || void 0
			};
			return;
		}
		const ipAddress = getClientIpFromRequest(ctx.request, ipConfig?.ipAddressHeaders || null);
		if (ipAddress) {
			const countryCode = getCountryCodeFromRequest(ctx.request);
			ctx.context.location = {
				ipAddress,
				countryCode
			};
			return;
		}
		ctx.context.location = void 0;
	});
}
/**
* Get the visitor's location
*/
function getLocation(identification) {
	if (!identification) return null;
	return identification.location;
}
function getClientIpFromRequest(request, ipAddressHeaders) {
	if (!request) return void 0;
	const headers = ipAddressHeaders?.length ? ipAddressHeaders : [
		"cf-connecting-ip",
		"x-forwarded-for",
		"x-real-ip",
		"x-vercel-forwarded-for"
	];
	for (const headerName of headers) {
		const value = request.headers.get(headerName);
		if (!value) continue;
		const ip = value.split(",")[0]?.trim();
		if (ip) return ip;
	}
}
function getCountryCodeFromRequest(request) {
	if (!request) return void 0;
	const cc = request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country");
	return cc ? cc.toUpperCase() : void 0;
}
//#endregion
//#region src/sentinel/evaluation.ts
/** Lazily attach the buffer to the request context. */
function getEvaluation(ctx) {
	if (!ctx.context.sentinelEvaluation) ctx.context.sentinelEvaluation = {
		checks: /* @__PURE__ */ new Set(),
		outcome: "passed",
		emitted: false
	};
	return ctx.context.sentinelEvaluation;
}
function recordCheck(ctx, name) {
	getEvaluation(ctx).checks.add(name);
}
/** Call immediately before throwing so the buffer reflects the final outcome. */
function setOutcome(ctx, outcome, triggeredBy, details) {
	const ev = getEvaluation(ctx);
	ev.outcome = outcome;
	ev.triggeredBy = triggeredBy;
	if (details) ev.details = details;
}
/**
* Emit one `security_check` event for the request. Idempotent per request and
* skipped when no checks ran (unprotected route, or short-circuit before any
* sentinel hook). `evaluatedChecks` carries the per-type breakdown — all under
* the same Stripe meter, so the array is for support inspection only.
*/
function emitEvaluation(ctx, trackEvent, options = {}) {
	const ev = ctx.context.sentinelEvaluation;
	if (!ev || ev.emitted || ev.checks.size === 0) return;
	ev.emitted = true;
	const identification = ctx.context.identification ?? null;
	const visitorId = ctx.context.visitorId ?? null;
	const path = ctx.path ?? "";
	trackEvent({
		eventKey: visitorId || identification?.ip || "unknown",
		eventType: "security_check",
		eventDisplayName: ev.outcome === "blocked" ? "Security: blocked" : ev.outcome === "challenged" ? "Security: challenged" : "Security: passed",
		eventData: {
			outcome: ev.outcome,
			evaluatedChecks: [...ev.checks].sort(),
			triggeredBy: ev.triggeredBy,
			identifier: options.identifier,
			path,
			userAgent: options.userAgent,
			details: ev.details
		},
		ipAddress: identification?.ip || void 0,
		city: identification?.location?.city || void 0,
		country: identification?.location?.country?.name || void 0,
		countryCode: identification?.location?.country?.code || void 0
	});
}
//#endregion
//#region src/sentinel/security.ts
async function hashForFingerprint(input) {
	const data = new TextEncoder().encode(input);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha1Hash(input) {
	const data = new TextEncoder().encode(input);
	const hashBuffer = await crypto.subtle.digest("SHA-1", data);
	return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
/**
* Whether Sentinel should normalize emails for deduplication/sign-in consistency.
* If `emailNormalization` is set, it wins; otherwise legacy behavior uses `emailValidation.enabled`.
*/
function isEmailNormalizationEnabled(security) {
	const explicit = security?.emailNormalization;
	if (explicit !== void 0) return explicit.enabled !== false;
	return security?.emailValidation?.enabled !== false;
}
/**
* @param $api — Dash client from `createAPI(opts, { throw: true })`.
*/
function createSecurityClient(conn, $api, options, onSecurityEvent) {
	const emailSender = createEmailSender({
		apiUrl: conn.apiUrl || INFRA_API_URL,
		apiKey: conn.apiKey
	});
	function logEvent(event) {
		const fullEvent = {
			...event,
			timestamp: Date.now()
		};
		if (onSecurityEvent) onSecurityEvent(fullEvent);
	}
	return {
		async checkSecurity(request) {
			try {
				const data = await $api("/security/check", {
					method: "POST",
					body: {
						...request,
						config: options
					}
				});
				if (data.action !== "allow") logEvent({
					type: this.mapReasonToEventType(data.reason),
					userId: null,
					visitorId: request.visitorId,
					ip: request.ip,
					country: null,
					details: data.details || { reason: data.reason },
					action: data.action === "block" ? "blocked" : "challenged"
				});
				return data;
			} catch (error) {
				logger.error("[Dash] Security check failed:", error);
				return { action: "allow" };
			}
		},
		mapReasonToEventType(reason) {
			switch (reason) {
				case "geo_blocked": return "geo_blocked";
				case "bot_detected": return "bot_blocked";
				case "suspicious_ip_detected": return "suspicious_ip_detected";
				case "rate_limited": return "velocity_exceeded";
				case "credential_stuffing_cooldown": return "credential_stuffing";
				default: return "credential_stuffing";
			}
		},
		async trackFailedAttempt(identifier, visitorId, password, ip) {
			try {
				const data = await $api("/security/track-failed-login", {
					method: "POST",
					body: {
						identifier,
						visitorId,
						passwordHash: await hashForFingerprint(password),
						ip,
						config: options
					}
				});
				if (data.blocked || data.challenged) logEvent({
					type: "credential_stuffing",
					userId: null,
					visitorId,
					ip,
					country: null,
					details: data.details || { reason: data.reason },
					action: data.blocked ? "blocked" : "challenged"
				});
				return data;
			} catch (error) {
				logger.error("[Dash] Track failed attempt error:", error);
				return { blocked: false };
			}
		},
		async clearFailedAttempts(identifier) {
			try {
				await $api("/security/clear-failed-attempts", {
					method: "POST",
					body: { identifier }
				});
			} catch (error) {
				logger.error("[Dash] Clear failed attempts error:", error);
			}
		},
		async isBlocked(visitorId) {
			try {
				return (await $api(`/security/is-blocked?visitorId=${encodeURIComponent(visitorId)}`, { method: "GET" })).blocked ?? false;
			} catch (error) {
				logger.warn("[Dash] Security is-blocked check failed:", error);
				return false;
			}
		},
		async verifyPoWSolution(visitorId, solution) {
			try {
				return await $api("/security/pow/verify", {
					method: "POST",
					body: {
						visitorId,
						solution
					}
				});
			} catch (error) {
				logger.warn("[Dash] PoW verify failed:", error);
				return {
					valid: false,
					reason: "error"
				};
			}
		},
		async generateChallenge(visitorId) {
			try {
				return (await $api("/security/pow/generate", {
					method: "POST",
					body: {
						visitorId,
						difficulty: options.challengeDifficulty
					}
				})).challenge || "";
			} catch (error) {
				logger.warn("[Dash] PoW generate challenge failed:", error);
				return "";
			}
		},
		async checkImpossibleTravel(userId, currentLocation, visitorId, ip = null) {
			if (!options.impossibleTravel?.enabled || !currentLocation) return null;
			try {
				const data = await $api("/security/impossible-travel", {
					method: "POST",
					body: {
						userId,
						visitorId,
						location: currentLocation,
						ip,
						config: options
					}
				});
				if (data.isImpossible) {
					const actionTaken = data.action === "block" ? "blocked" : data.action === "challenge" ? "challenged" : "logged";
					logEvent({
						type: "impossible_travel",
						userId,
						visitorId: visitorId || null,
						ip: null,
						country: currentLocation.country?.code || null,
						details: {
							from: data.from,
							to: data.to,
							distance: data.distance,
							speedRequired: data.speedRequired,
							action: data.action
						},
						action: actionTaken
					});
				}
				return data;
			} catch (error) {
				logger.warn("[Dash] Impossible travel check failed:", error);
				return null;
			}
		},
		/**
		* Store user's last known location for impossible travel detection
		*/
		async storeLastLocation(userId, location, ip = null) {
			if (!options.impossibleTravel?.enabled || !location) return;
			try {
				await $api("/security/store-last-login", {
					method: "POST",
					body: {
						userId,
						location,
						ip
					}
				});
			} catch (error) {
				logger.error("[Dash] Store last location error:", error);
			}
		},
		/**
		* Check if a visitor has exceeded the free trial signup limit.
		*/
		async checkFreeTrialAbuse(visitorId) {
			if (!options.freeTrialAbuse?.enabled) return {
				isAbuse: false,
				accountCount: 0,
				maxAccounts: 0,
				action: "log"
			};
			try {
				const data = await $api("/security/free-trial-abuse/check", {
					method: "POST",
					body: {
						visitorId,
						config: options
					}
				});
				if (data.isAbuse) logEvent({
					type: "free_trial_abuse",
					userId: null,
					visitorId,
					ip: null,
					country: null,
					details: {
						accountCount: data.accountCount,
						maxAccounts: data.maxAccounts
					},
					action: data.action === "block" ? "blocked" : "logged"
				});
				return data;
			} catch (error) {
				logger.warn("[Dash] Free trial abuse check failed:", error);
				return {
					isAbuse: false,
					accountCount: 0,
					maxAccounts: 0,
					action: "log"
				};
			}
		},
		/**
		* Track a new signup for free trial abuse detection.
		* Stores the userId for auditing purposes.
		*/
		async trackFreeTrialSignup(visitorId, userId) {
			if (!options.freeTrialAbuse?.enabled) return;
			try {
				await $api("/security/free-trial-abuse/track", {
					method: "POST",
					body: {
						visitorId,
						userId
					}
				});
			} catch (error) {
				logger.error("[Dash] Track free trial signup error:", error);
			}
		},
		async checkCompromisedPassword(password) {
			try {
				const hash = await sha1Hash(password);
				const prefix = hash.substring(0, 5);
				const suffix = hash.substring(5);
				const data = await $api("/security/breached-passwords", {
					method: "POST",
					body: {
						passwordPrefix: prefix,
						config: options
					}
				});
				if (!data.enabled) return { compromised: false };
				const breachCount = (data.suffixes || {})[suffix] || 0;
				const minBreachCount = data.minBreachCount ?? 1;
				const action = data.action || "block";
				const compromised = breachCount >= minBreachCount;
				if (compromised) logEvent({
					type: "compromised_password",
					userId: null,
					visitorId: null,
					ip: null,
					country: null,
					details: { breachCount },
					action: action === "block" ? "blocked" : action === "challenge" ? "challenged" : "logged"
				});
				return {
					compromised,
					breachCount: breachCount > 0 ? breachCount : void 0,
					action: compromised ? action : void 0
				};
			} catch (error) {
				logger.error("[Dash] Compromised password check error:", error);
				return { compromised: false };
			}
		},
		/**
		* Check if a user account is stale (inactive for a configured period)
		* This helps detect potential account takeover when dormant accounts become active
		*/
		async checkStaleUser(userId, lastActiveAt) {
			if (!options.staleUsers?.enabled) return { isStale: false };
			try {
				const data = await $api("/security/stale-user", {
					method: "POST",
					body: {
						userId,
						lastActiveAt: lastActiveAt instanceof Date ? lastActiveAt.toISOString() : lastActiveAt,
						config: options
					}
				});
				if (data.isStale) logEvent({
					type: "stale_account_reactivation",
					userId,
					visitorId: null,
					ip: null,
					country: null,
					details: {
						daysSinceLastActive: data.daysSinceLastActive,
						staleDays: data.staleDays,
						lastActiveAt: data.lastActiveAt,
						notifyUser: data.notifyUser,
						notifyAdmin: data.notifyAdmin
					},
					action: data.action === "block" ? "blocked" : data.action === "challenge" ? "challenged" : "logged"
				});
				return data;
			} catch (error) {
				logger.error("[Dash] Stale user check error:", error);
				return { isStale: false };
			}
		},
		/**
		* Send stale account reactivation notification to the user
		*/
		async notifyStaleAccountUser(userEmail, userName, daysSinceLastActive, identification, appName) {
			const loginTime = (/* @__PURE__ */ new Date()).toLocaleString("en-US", {
				dateStyle: "long",
				timeStyle: "short",
				timeZone: "UTC"
			}) + " UTC";
			const location = identification?.location;
			const loginLocation = location?.city && location?.country?.name ? `${location.city}, ${location.country.code}` : location?.country?.name || "Unknown";
			const browser = identification?.browser;
			const loginDevice = browser?.name && browser?.os ? `${browser.name} on ${browser.os}` : "Unknown device";
			const result = await emailSender.send({
				template: "stale-account-user",
				to: userEmail,
				variables: {
					userEmail,
					userName: userName || "User",
					appName: appName || "Your App",
					daysSinceLastActive: String(daysSinceLastActive),
					loginTime,
					loginLocation,
					loginDevice,
					loginIp: identification?.ip || "Unknown"
				}
			});
			if (result.success) logger.info(`[Dash] Stale account notification sent to user: ${userEmail}`);
			else logger.error(`[Dash] Failed to send stale account user notification: ${result.error}`);
		},
		/**
		* Send stale account reactivation notification to the admin
		*/
		async notifyStaleAccountAdmin(adminEmail, userId, userEmail, userName, daysSinceLastActive, identification, appName) {
			const loginTime = (/* @__PURE__ */ new Date()).toLocaleString("en-US", {
				dateStyle: "long",
				timeStyle: "short",
				timeZone: "UTC"
			}) + " UTC";
			const location = identification?.location;
			const loginLocation = location?.city && location?.country?.name ? `${location.city}, ${location.country.code}` : location?.country?.name || "Unknown";
			const browser = identification?.browser;
			const loginDevice = browser?.name && browser?.os ? `${browser.name} on ${browser.os}` : "Unknown device";
			const result = await emailSender.send({
				template: "stale-account-admin",
				to: adminEmail,
				variables: {
					userEmail,
					userName: userName || "User",
					userId,
					appName: appName || "Your App",
					daysSinceLastActive: String(daysSinceLastActive),
					loginTime,
					loginLocation,
					loginDevice,
					loginIp: identification?.ip || "Unknown",
					adminEmail
				}
			});
			if (result.success) logger.info(`[Dash] Stale account admin notification sent to: ${adminEmail}`);
			else logger.error(`[Dash] Failed to send stale account admin notification: ${result.error}`);
		},
		async checkUnknownDevice(_userId, _visitorId) {
			return false;
		},
		async notifyUnknownDevice(userId, email, identification) {
			logEvent({
				type: "unknown_device",
				userId,
				visitorId: identification?.visitorId || null,
				ip: identification?.ip || null,
				country: identification?.location?.country?.code || null,
				details: {
					email,
					device: identification?.browser.device,
					os: identification?.browser.os,
					browser: identification?.browser.name,
					city: identification?.location?.city,
					country: identification?.location?.country?.name
				},
				action: "logged"
			});
		}
	};
}
//#endregion
//#region src/validation/matchers.ts
const all = new Set([
	"/sign-up/email",
	"/email-otp/verify-email",
	"/sign-in/email-otp",
	"/sign-in/magic-link",
	"/sign-in/email",
	"/forget-password/email-otp",
	"/email-otp/reset-password",
	"/email-otp/create-verification-otp",
	"/email-otp/get-verification-otp",
	"/email-otp/send-verification-otp",
	"/forget-password",
	"/request-password-reset",
	"/send-verification-email",
	"/change-email",
	"/organization/invite-member",
	"/dash/organization/invite-member",
	"/dash/create-user",
	"/dash/update-user"
]);
/**
* Path is one of `[
*   '/sign-up/email',
*   '/email-otp/verify-email',
*   '/sign-in/email-otp',
*   '/sign-in/magic-link',
*   '/sign-in/email',
*   '/forget-password/email-otp',
*   '/email-otp/reset-password',
*   '/email-otp/create-verification-otp',
*   '/email-otp/get-verification-otp',
*   '/email-otp/send-verification-otp',
*   '/forget-password',
*   '/request-password-reset',
*   '/send-verification-email',
*   '/change-email',
*   '/organization/invite-member',
*   '/dash/organization/invite-member',
*   '/dash/create-user',
*   '/dash/update-user'
* ]`.
* @param context Request context
* @param context.path Request path
* @returns boolean
*/
const allEmail = ({ path }) => !!path && all.has(path);
//#endregion
//#region src/validation/email.ts
/**
* Gmail-like providers that ignore dots in the local part
*/
const GMAIL_LIKE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
/**
* Providers known to support plus addressing
*/
const PLUS_ADDRESSING_DOMAINS = new Set([
	"gmail.com",
	"googlemail.com",
	"outlook.com",
	"hotmail.com",
	"live.com",
	"yahoo.com",
	"icloud.com",
	"me.com",
	"mac.com",
	"protonmail.com",
	"proton.me",
	"fastmail.com",
	"zoho.com"
]);
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
function normalizeEmail(email, context) {
	if (!email || typeof email !== "string") return email;
	const mergedOpts = context.options;
	if (!isEmailNormalizationEnabled(mergedOpts)) return email;
	const trimmed = email.trim().toLowerCase();
	const atIndex = trimmed.lastIndexOf("@");
	if (atIndex === -1) return trimmed;
	let localPart = trimmed.slice(0, atIndex);
	let domain = trimmed.slice(atIndex + 1);
	if (domain === "googlemail.com") domain = "gmail.com";
	if (PLUS_ADDRESSING_DOMAINS.has(domain)) {
		const plusIndex = localPart.indexOf("+");
		if (plusIndex !== -1) localPart = localPart.slice(0, plusIndex);
	}
	if (GMAIL_LIKE_DOMAINS.has(domain)) localPart = localPart.replace(/\./g, "");
	return `${localPart}@${domain}`;
}
function hasRemoteEmailClients(options) {
	return options.$api !== void 0 && options.$kv !== void 0;
}
function createEmailValidator(options) {
	const { $api, $kv, emailValidationOptions = {} } = options;
	/**
	* Fetch and resolve email validity policy from API with caching
	* Sends client config to API which merges with user's dashboard settings
	*/
	async function fetchPolicy() {
		try {
			const { data } = await $api("/security/resolve-policy", {
				method: "POST",
				body: {
					policyId: "email_validity",
					config: { emailValidation: {
						enabled: emailValidationOptions.enabled,
						strictness: emailValidationOptions.strictness,
						action: emailValidationOptions.action,
						domainAllowlist: emailValidationOptions.domainAllowlist
					} }
				}
			});
			if (data?.policy) return data.policy;
		} catch (error) {
			logger.warn("[Dash] Failed to fetch email policy, using defaults:", error);
		}
		return null;
	}
	return { 
	/**
	* Validate an email address
	* Returns validation result - caller should use getPolicy() to determine action
	*/
async validate(email, checkMx = true) {
		const trimmed = email.trim();
		const policy = await fetchPolicy();
		if (!policy?.enabled) return {
			valid: true,
			disposable: false,
			confidence: "high",
			policy
		};
		try {
			const { data } = await $kv("/email/validate", {
				method: "POST",
				body: {
					email: trimmed,
					checkMx,
					strictness: policy.strictness
				}
			});
			return {
				...data || {
					valid: false,
					reason: "invalid_format"
				},
				policy
			};
		} catch (error) {
			logger.warn("[Dash] Email validation API error, falling back to allow:", error);
			return {
				valid: true,
				policy
			};
		}
	} };
}
/**
* Basic local email format validation (fallback)
*/
function isValidEmailFormatLocal(email) {
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
	if (email.length > 254) return false;
	const [localPart, domain] = email.split("@");
	if (!localPart || !domain) return false;
	if (localPart.length > 64) return false;
	if (domain.length > 253) return false;
	return true;
}
const getEmail = (ctx) => {
	if (ctx.path === "/change-email") return {
		email: ctx.body?.newEmail,
		container: "body",
		field: "newEmail"
	};
	const body = ctx.body;
	const query = ctx.query;
	return {
		email: body?.email ?? query?.email,
		container: body ? "body" : "query",
		field: "email"
	};
};
/**
* Create email normalization hook (shared between all configurations)
*/
function createEmailNormalizationHook() {
	return {
		matcher: allEmail,
		handler: createAuthMiddleware(async (ctx) => {
			const { email, container, field } = getEmail(ctx);
			if (typeof email !== "string") return;
			const normalized = normalizeEmail(email, ctx.context);
			if (normalized === email) return;
			const data = container === "query" ? {
				...ctx.query,
				[field]: normalized
			} : {
				...ctx.body,
				[field]: normalized
			};
			return { context: {
				...ctx,
				[container]: data
			} };
		})
	};
}
/**
* Records `email_validity` on every email-bearing request. On block, emits the
* `security_check` event inline before throwing — the after-hook won't run on throw.
*/
function createEmailValidationHook(validator, trackEvent) {
	return {
		matcher: allEmail,
		handler: createAuthMiddleware(async (ctx) => {
			const { email } = getEmail(ctx);
			if (typeof email !== "string") return;
			const trimmed = email.trim();
			recordCheck(ctx, "email_validity");
			if (!isValidEmailFormatLocal(trimmed)) {
				if (trackEvent) {
					setOutcome(ctx, "blocked", "email_validity", {
						reason: "invalid_format",
						email: trimmed
					});
					emitEvaluation(ctx, trackEvent, { identifier: trimmed });
				}
				throw new APIError$1("BAD_REQUEST", { message: "Invalid email" });
			}
			if (validator) {
				const result = await validator.validate(trimmed);
				const policy = result.policy;
				if (!policy?.enabled) return;
				if (policy.domainAllowlist?.length) {
					const domain = trimmed.toLowerCase().split("@")[1];
					if (domain && policy.domainAllowlist.includes(domain)) return;
				}
				const action = policy.action;
				if (!result.valid) {
					if (action === "allow") return;
					const message = result.reason === "no_mx_records" ? "This email domain cannot receive emails" : result.disposable || result.reason === "blocklist" ? "Disposable email addresses are not allowed" : result.reason === "known_invalid_email" || result.reason === "known_invalid_host" || result.reason === "reserved_tld" || result.reason === "provider_local_too_short" ? "This email address appears to be invalid" : "Invalid email";
					if (trackEvent) {
						setOutcome(ctx, "blocked", "email_validity", {
							reason: result.reason,
							confidence: result.confidence,
							email: trimmed
						});
						emitEvaluation(ctx, trackEvent, { identifier: trimmed });
					}
					throw new APIError$1("BAD_REQUEST", { message });
				}
			}
		})
	};
}
/**
* Create email validation hooks with optional API-backed validation.
*
* @param options - {@link EmailHooksOptions}
*
* @example
* // Local validation only
* createEmailHooks()
*
* @example
* // API-backed validation
* createEmailHooks({ $api, $kv })
*/
function createEmailHooks(options = {}) {
	const { emailValidationOptions, emailNormalizationOptions, trackEvent } = options;
	const emailConfig = {
		enabled: true,
		strictness: "medium",
		action: "block",
		...emailValidationOptions
	};
	return { before: [...isEmailNormalizationEnabled({
		emailValidation: emailValidationOptions,
		emailNormalization: emailNormalizationOptions
	}) ? [createEmailNormalizationHook()] : [], ...emailConfig.enabled ? [createEmailValidationHook(hasRemoteEmailClients(options) ? createEmailValidator({
		$api: options.$api,
		$kv: options.$kv,
		emailValidationOptions: emailConfig
	}) : void 0, trackEvent)] : []] };
}
//#endregion
//#region src/validation/phone.ts
/**
* Common fake/test phone numbers that should be blocked
* These are numbers commonly used in testing, movies, documentation, etc.
*/
const INVALID_PHONE_NUMBERS = new Set([
	"+15550000000",
	"+15550001111",
	"+15550001234",
	"+15551234567",
	"+15555555555",
	"+15551111111",
	"+15550000001",
	"+15550123456",
	"+12125551234",
	"+13105551234",
	"+14155551234",
	"+12025551234",
	"+10000000000",
	"+11111111111",
	"+12222222222",
	"+13333333333",
	"+14444444444",
	"+15555555555",
	"+16666666666",
	"+17777777777",
	"+18888888888",
	"+19999999999",
	"+11234567890",
	"+10123456789",
	"+19876543210",
	"+441632960000",
	"+447700900000",
	"+447700900001",
	"+447700900123",
	"+447700900999",
	"+442079460000",
	"+442079460123",
	"+441134960000",
	"+0000000000",
	"+1000000000",
	"+123456789",
	"+1234567890",
	"+12345678901",
	"+0123456789",
	"+9876543210",
	"+11111111111",
	"+99999999999",
	"+491234567890",
	"+491111111111",
	"+33123456789",
	"+33111111111",
	"+61123456789",
	"+61111111111",
	"+81123456789",
	"+81111111111",
	"+19001234567",
	"+19761234567",
	"+1911",
	"+1411",
	"+1611",
	"+44999",
	"+44112"
]);
/**
* Patterns that indicate fake/test phone numbers
*/
const INVALID_PHONE_PATTERNS = [
	/^\+\d(\d)\1{6,}$/,
	/^\+\d*1234567890/,
	/^\+\d*0123456789/,
	/^\+\d*9876543210/,
	/^\+\d*0987654321/,
	/^\+\d*(12){4,}/,
	/^\+\d*(21){4,}/,
	/^\+\d*(00){4,}/,
	/^\+1\d{3}555\d{4}$/,
	/^\+\d{1,3}\d{1,5}$/,
	/^\+\d+0{7,}$/,
	/^\+\d*147258369/,
	/^\+\d*258369147/,
	/^\+\d*369258147/,
	/^\+\d*789456123/,
	/^\+\d*123456789/,
	/^\+\d*1234512345/,
	/^\+\d*1111122222/,
	/^\+\d*1212121212/,
	/^\+\d*1010101010/
];
/**
* Invalid area codes / prefixes that indicate test numbers
* Key: country code, Value: set of invalid prefixes
*/
const INVALID_PREFIXES_BY_COUNTRY = {
	US: new Set([
		"555",
		"000",
		"111",
		"911",
		"411",
		"611"
	]),
	CA: new Set([
		"555",
		"000",
		"911"
	]),
	GB: new Set([
		"7700900",
		"1632960",
		"1134960"
	]),
	AU: new Set([
		"0491570",
		"0491571",
		"0491572"
	])
};
/**
* Check if a phone number is a commonly used fake/test number
* @param phone - The phone number to check (E.164 format preferred)
* @param defaultCountry - Default country code if not included in phone string
* @returns true if the phone appears to be fake/test, false if it seems legitimate
*/
const isFakePhoneNumber = (phone, defaultCountry) => {
	const parsed = parsePhoneNumberFromString(phone, defaultCountry);
	if (!parsed) return true;
	const e164 = parsed.number;
	const nationalNumber = parsed.nationalNumber;
	const country = parsed.country;
	if (INVALID_PHONE_NUMBERS.has(e164)) return true;
	for (const pattern of INVALID_PHONE_PATTERNS) if (pattern.test(e164)) return true;
	if (country && INVALID_PREFIXES_BY_COUNTRY[country]) {
		const prefixes = INVALID_PREFIXES_BY_COUNTRY[country];
		for (const prefix of prefixes) if (nationalNumber.startsWith(prefix)) return true;
	}
	if (/^(\d)\1+$/.test(nationalNumber)) return true;
	const digits = nationalNumber.split("").map(Number);
	let isSequential = digits.length >= 6;
	for (let i = 1; i < digits.length && isSequential; i++) {
		const current = digits[i];
		const previous = digits[i - 1];
		if (current === void 0 || previous === void 0 || current !== previous + 1 && current !== previous - 1) isSequential = false;
	}
	if (isSequential) return true;
	return false;
};
/**
* Validate a phone number format
* @param phone - The phone number to validate
* @param defaultCountry - Default country code if not included in phone string
* @returns true if the phone number is valid
*/
const isValidPhone = (phone, defaultCountry) => {
	return isValidPhoneNumber(phone, defaultCountry);
};
/**
* Comprehensive phone number validation
* @param phone - The phone number to validate
* @param options - Validation options
* @returns true if valid, false otherwise
*/
const validatePhone = (phone, options = {}) => {
	const { mobileOnly = false, allowedCountries, blockedCountries, blockFakeNumbers = true, blockPremiumRate = true, blockTollFree = false, blockVoip = false, defaultCountry } = options;
	if (!isValidPhone(phone, defaultCountry)) return false;
	const parsed = parsePhoneNumberFromString(phone, defaultCountry);
	if (!parsed) return false;
	if (blockFakeNumbers && isFakePhoneNumber(phone, defaultCountry)) return false;
	const country = parsed.country;
	if (country) {
		if (allowedCountries && !allowedCountries.includes(country)) return false;
		if (blockedCountries?.includes(country)) return false;
	}
	const phoneType = parsed.getType();
	if (mobileOnly) {
		if (phoneType !== "MOBILE" && phoneType !== "FIXED_LINE_OR_MOBILE") return false;
	}
	if (blockPremiumRate && phoneType === "PREMIUM_RATE") return false;
	if (blockTollFree && phoneType === "TOLL_FREE") return false;
	if (blockVoip && phoneType === "VOIP") return false;
	return true;
};
const allPhonePaths = new Set([
	"/phone-number/send-otp",
	"/phone-number/verify",
	"/sign-in/phone-number",
	"/phone-number/request-password-reset",
	"/phone-number/reset-password"
]);
const getPhoneNumber = (ctx) => ctx.body?.phoneNumber ?? ctx.query?.phoneNumber;
/**
* Better Auth plugin for phone number validation
* Validates phone numbers on all phone-related endpoints
*/
const phoneValidationHooks = { before: [{
	matcher: (context) => !!context.path && allPhonePaths.has(context.path),
	handler: createAuthMiddleware(async (ctx) => {
		const phoneNumber = getPhoneNumber(ctx);
		if (typeof phoneNumber !== "string") return;
		if (!validatePhone(phoneNumber)) throw new APIError$1("BAD_REQUEST", { message: "Invalid phone number" });
	})
}] };
//#endregion
//#region src/sentinel/security-hooks.ts
const ERROR_MESSAGES = {
	geo_blocked: "Access from your location is not allowed.",
	bot_detected: "Automated access is not allowed.",
	suspicious_ip_detected: "Anonymous connections (VPN, proxy, Tor) are not allowed.",
	rate_limited: "Too many attempts. Please try again later.",
	compromised_password: "This password has been found in data breaches. Please choose a different password.",
	impossible_travel: "Login blocked due to suspicious location change."
};
/**
* Throw a challenge error with appropriate headers
*/
function throwChallengeError(challenge, reason, message = "Please complete a security check to continue.") {
	const error = new APIError("LOCKED", {
		message,
		code: "POW_CHALLENGE_REQUIRED"
	});
	error.headers = {
		"X-PoW-Challenge": challenge,
		"X-PoW-Reason": reason
	};
	throw error;
}
/** Emits the `security_check` event inline before throwing — the after-hook won't run on throw. */
async function handleSecurityVerdict(verdict, hookCtx, checkCtx, trackEvent, securityService) {
	if (verdict.action === "allow") return;
	const reason = verdict.reason || "unknown";
	if (verdict.action === "challenge" && checkCtx.visitorId) {
		const challenge = verdict.challenge || await securityService.generateChallenge(checkCtx.visitorId);
		if (!challenge?.trim()) {
			logger.warn("[Sentinel] Could not generate PoW challenge (service may be unavailable). Falling back to allow.");
			return;
		}
		setOutcome(hookCtx, "challenged", "server_security_check", {
			reason,
			...verdict.details
		});
		emitEvaluation(hookCtx, trackEvent, {
			identifier: checkCtx.identifier,
			userAgent: checkCtx.userAgent
		});
		throwChallengeError(challenge, reason);
	}
	if (verdict.action === "block") {
		setOutcome(hookCtx, "blocked", "server_security_check", {
			reason,
			...verdict.details
		});
		emitEvaluation(hookCtx, trackEvent, {
			identifier: checkCtx.identifier,
			userAgent: checkCtx.userAgent
		});
		throw new APIError("FORBIDDEN", { message: ERROR_MESSAGES[reason] || "Access denied." });
	}
}
/**
* Single API call from the plugin; server runs all configured rules and returns
* one verdict — counts as one billable check.
*/
async function runSecurityChecks(hookCtx, checkCtx, securityService, trackEvent, powVerified) {
	if (powVerified) return;
	recordCheck(hookCtx, "server_security_check");
	await handleSecurityVerdict(await securityService.checkSecurity({
		visitorId: checkCtx.visitorId,
		requestId: checkCtx.identification?.requestId || null,
		ip: checkCtx.identification?.ip || null,
		path: checkCtx.path,
		identifier: checkCtx.identifier
	}), hookCtx, checkCtx, trackEvent, securityService);
}
//#endregion
//#region src/sentinel/sentinel.ts
const sentinel = (options) => {
	const opts = resolveSentinelOptions(options);
	const $api = createAPI(opts);
	const $apiThrowing = createAPI(opts, { throw: true });
	const $kv = createKV(opts);
	const { tracker } = initTrackEvents($api);
	const { trackEvent } = tracker;
	if (!opts.apiKey) logger.warn("[Sentinel] Missing BETTER_AUTH_API_KEY. Security checks may fall back to allow mode when the Infra API rejects requests.");
	const securityService = createSecurityClient(opts, $apiThrowing, opts.security || {}, (event) => {
		trackEvent({
			eventKey: event.visitorId || event.userId || "unknown",
			eventType: "security_signal",
			eventDisplayName: `Security signal: ${event.type.replace(/_/g, " ")}`,
			eventData: {
				type: event.type,
				userId: event.userId || void 0,
				visitorId: event.visitorId || void 0,
				action: event.action,
				...event.details
			},
			ipAddress: event.ip || void 0,
			country: event.country || void 0
		});
	});
	const emailHooks = createEmailHooks({
		emailValidationOptions: opts.security?.emailValidation,
		emailNormalizationOptions: opts.security?.emailNormalization,
		trackEvent,
		...opts.apiKey ? {
			$api,
			$kv
		} : {}
	});
	return {
		id: "sentinel",
		init(ctx) {
			const activityTrackingEnabled = (ctx.getPlugin("dash")?.options)?.activityTracking?.enabled === true;
			return { options: {
				emailValidation: opts.security?.emailValidation,
				emailNormalization: opts.security?.emailNormalization,
				databaseHooks: {
					user: {
						create: {
							async before(user, ctx) {
								if (!ctx) return;
								const visitorId = ctx.context.visitorId;
								if (visitorId && opts.security?.freeTrialAbuse?.enabled) {
									recordCheck(ctx, "free_trial_abuse");
									const abuseCheck = await securityService.checkFreeTrialAbuse(visitorId);
									if (abuseCheck.isAbuse && abuseCheck.action === "block") {
										setOutcome(ctx, "blocked", "free_trial_abuse", {
											accountCount: abuseCheck.accountCount,
											maxAccounts: abuseCheck.maxAccounts
										});
										emitEvaluation(ctx, trackEvent);
										throw new APIError("FORBIDDEN", { message: "Account creation is not allowed from this device." });
									}
								}
								if (user.email && typeof user.email === "string" && isEmailNormalizationEnabled(opts.security)) return { data: {
									...user,
									email: normalizeEmail(user.email, ctx.context)
								} };
							},
							async after(user, ctx) {
								if (!ctx) return;
								const visitorId = ctx.context.visitorId;
								if (visitorId && opts.security?.freeTrialAbuse?.enabled) await ctx.context.runInBackgroundOrAwait(securityService.trackFreeTrialSignup(visitorId, user.id));
							}
						},
						update: { async before(user, ctx) {
							if (!ctx) return;
							if (user.email && typeof user.email === "string" && isEmailNormalizationEnabled(opts.security)) return { data: {
								...user,
								email: normalizeEmail(user.email, ctx.context)
							} };
						} }
					},
					session: { create: {
						async before(session, ctx) {
							if (!ctx) return;
							const visitorId = ctx.context.visitorId;
							const identification = ctx.context.identification;
							if (session.userId && identification?.location && visitorId) {
								recordCheck(ctx, "impossible_travel");
								const travelCheck = await securityService.checkImpossibleTravel(session.userId, identification.location, visitorId, identification.ip);
								if (travelCheck?.isImpossible) {
									if (travelCheck.action === "block") {
										setOutcome(ctx, "blocked", "impossible_travel", {
											from: travelCheck.from,
											to: travelCheck.to,
											distance: travelCheck.distance,
											speedRequired: travelCheck.speedRequired
										});
										emitEvaluation(ctx, trackEvent);
										throw new APIError("FORBIDDEN", { message: "Login blocked due to suspicious location change." });
									}
									if (travelCheck.action === "challenge" && travelCheck.challenge) {
										setOutcome(ctx, "challenged", "impossible_travel", {
											from: travelCheck.from,
											to: travelCheck.to,
											distance: travelCheck.distance,
											speedRequired: travelCheck.speedRequired
										});
										emitEvaluation(ctx, trackEvent);
										throwChallengeError(travelCheck.challenge, "impossible_travel", "Unusual login location detected. Please complete a security check.");
									}
								}
							}
						},
						async after(session, ctx) {
							if (!ctx || !session.userId) return;
							const visitorId = ctx.context.visitorId;
							const identification = ctx.context.identification;
							let user = null;
							const userSelect = [
								"email",
								"name",
								...activityTrackingEnabled ? ["lastActiveAt"] : []
							];
							try {
								user = await ctx.context.adapter.findOne({
									model: "user",
									select: [...userSelect],
									where: [{
										field: "id",
										value: session.userId
									}]
								});
							} catch (error) {
								logger.warn("[Sentinel] Failed to fetch user for security checks:", error);
							}
							if (visitorId) {
								if (await securityService.checkUnknownDevice(session.userId, visitorId) && user?.email) await ctx.context.runInBackgroundOrAwait(securityService.notifyUnknownDevice(session.userId, user.email, identification));
							}
							if (opts.security?.staleUsers?.enabled && user) {
								recordCheck(ctx, "stale_users");
								const lastActiveAtForStale = activityTrackingEnabled ? user.lastActiveAt ?? null : null;
								const staleCheck = await securityService.checkStaleUser(session.userId, lastActiveAtForStale);
								if (staleCheck.isStale) {
									const staleOpts = opts.security.staleUsers;
									const notificationPromises = [];
									if (staleCheck.notifyUser && user.email) notificationPromises.push(securityService.notifyStaleAccountUser(user.email, user.name || null, staleCheck.daysSinceLastActive || 0, identification));
									if (staleCheck.notifyAdmin && staleOpts.adminEmail) notificationPromises.push(securityService.notifyStaleAccountAdmin(staleOpts.adminEmail, session.userId, user.email || "unknown", user.name || null, staleCheck.daysSinceLastActive || 0, identification));
									if (notificationPromises.length > 0) Promise.all(notificationPromises).catch((error) => {
										logger.error("[Sentinel] Failed to send stale account notifications:", error);
									});
									if (staleCheck.action === "block") {
										setOutcome(ctx, "blocked", "stale_users", {
											userId: session.userId,
											daysSinceLastActive: staleCheck.daysSinceLastActive,
											staleDays: staleCheck.staleDays,
											lastActiveAt: staleCheck.lastActiveAt,
											notifyUser: staleCheck.notifyUser,
											notifyAdmin: staleCheck.notifyAdmin
										});
										emitEvaluation(ctx, trackEvent);
										throw new APIError("FORBIDDEN", {
											message: "This account has been inactive for an extended period. Please contact support to reactivate.",
											code: "STALE_ACCOUNT"
										});
									}
								}
							}
							if (opts.security?.impossibleTravel?.enabled && identification?.location) await ctx.context.runInBackgroundOrAwait(securityService.storeLastLocation(session.userId, identification.location, identification.ip));
						}
					} }
				}
			} };
		},
		hooks: {
			before: [
				{
					matcher: (ctx) => ctx.request?.method !== "GET",
					handler: createIdentificationMiddleware($kv)
				},
				{
					matcher: (ctx) => ctx.request?.method !== "GET",
					handler: createAuthMiddleware(async (ctx) => {
						const visitorId = ctx.context.visitorId;
						const powSolution = ctx.headers?.get?.("X-PoW-Solution");
						if (visitorId && powSolution) {
							if ((await securityService.verifyPoWSolution(visitorId, powSolution)).valid) ctx.context.powVerified = true;
						}
					})
				},
				...emailHooks.before,
				...phoneValidationHooks.before,
				{
					matcher: (ctx) => ctx.request?.method !== "GET",
					handler: createAuthMiddleware(async (ctx) => {
						const visitorId = ctx.context.visitorId;
						const identification = ctx.context.identification;
						const isSignIn = matchesAnyRoute(ctx.path, [
							routes.SIGN_IN_EMAIL,
							routes.SIGN_IN_USERNAME,
							routes.SIGN_IN_EMAIL_OTP,
							routes.SIGN_IN_SOCIAL,
							routes.SIGN_IN_PASSKEY,
							routes.SIGN_IN_MAGIC_LINK,
							routes.SIGN_IN_SSO,
							routes.SIGN_IN_ANONYMOUS
						]);
						const isSignUp = matchesAnyRoute(ctx.path, [routes.SIGN_UP_EMAIL]);
						const isPasswordReset = matchesAnyRoute(ctx.path, [routes.FORGET_PASSWORD, routes.REQUEST_PASSWORD_RESET]);
						const isTwoFactor = matchesAnyRoute(ctx.path, [
							routes.TWO_FACTOR_VERIFY_TOTP,
							routes.TWO_FACTOR_VERIFY_BACKUP,
							routes.TWO_FACTOR_VERIFY_OTP
						]);
						const isOtpSend = matchesAnyRoute(ctx.path, [routes.EMAIL_OTP_SEND, routes.PHONE_SEND_OTP]);
						const isMagicLinkVerify = matchesAnyRoute(ctx.path, [routes.MAGIC_LINK_VERIFY]);
						const isOrgCreate = matchesAnyRoute(ctx.path, [routes.ORG_CREATE]);
						const isSensitiveAction = matchesAnyRoute(ctx.path, [
							routes.CHANGE_EMAIL,
							routes.CHANGE_PASSWORD,
							routes.SET_PASSWORD,
							routes.LINK_SOCIAL,
							routes.PASSKEY_ADD
						]);
						if (!(isSignIn || isSignUp || isPasswordReset || isTwoFactor || isOtpSend || isMagicLinkVerify || isOrgCreate || isSensitiveAction)) return;
						const requestBody = ctx.body;
						const identifier = requestBody?.email || requestBody?.phone || requestBody?.username || void 0;
						const powVerified = ctx.context.powVerified === true;
						if (visitorId && powVerified) recordCheck(ctx, "pow_challenge");
						if (visitorId) {
							recordCheck(ctx, "credential_stuffing");
							if (await securityService.isBlocked(visitorId)) {
								setOutcome(ctx, "blocked", "credential_stuffing", {
									reason: "cooldown_active",
									visitorId,
									confidence: 1
								});
								emitEvaluation(ctx, trackEvent, {
									identifier,
									userAgent: ctx.headers?.get?.("user-agent") || ""
								});
								throw new APIError(403, { message: "Too many failed attempts. Please try again later." });
							}
						}
						await runSecurityChecks(ctx, {
							path: ctx.path,
							identifier,
							visitorId,
							identification,
							userAgent: ctx.headers?.get?.("user-agent") || ""
						}, securityService, trackEvent, powVerified);
						if (matchesAnyRoute(ctx.path, [
							routes.SIGN_UP_EMAIL,
							routes.CHANGE_PASSWORD,
							routes.SET_PASSWORD,
							routes.RESET_PASSWORD
						])) {
							const body = ctx.body;
							const passwordToCheck = body?.newPassword || body?.password;
							if (passwordToCheck) {
								recordCheck(ctx, "compromised_password");
								const compromisedResult = await securityService.checkCompromisedPassword(passwordToCheck);
								if (compromisedResult.compromised && compromisedResult.action) {
									if (compromisedResult.action === "block") {
										setOutcome(ctx, "blocked", "compromised_password", { breachCount: compromisedResult.breachCount });
										emitEvaluation(ctx, trackEvent, {
											identifier,
											userAgent: ctx.headers?.get?.("user-agent") || ""
										});
										throw new APIError("BAD_REQUEST", {
											message: "This password has been found in data breaches. Please choose a different password.",
											code: "COMPROMISED_PASSWORD"
										});
									}
								}
							}
						}
					})
				}
			],
			after: [{
				matcher: (ctx) => ctx.request?.method !== "GET",
				handler: createAuthMiddleware(async (ctx) => {
					const visitorId = ctx.context.visitorId;
					const identification = ctx.context.identification;
					const body = ctx.body;
					emitEvaluation(ctx, trackEvent, {
						identifier: body?.email,
						userAgent: ctx.headers?.get?.("user-agent") || ""
					});
					if (matchesAnyRoute(ctx.path, [routes.SIGN_IN_EMAIL, routes.SIGN_IN_EMAIL_OTP]) && ctx.context.returned instanceof Error && body?.email && body?.password && visitorId) {
						const { email, password } = body;
						const ip = identification?.ip || null;
						await ctx.context.runInBackgroundOrAwait(securityService.trackFailedAttempt(email, visitorId, password, ip));
					}
					if (matchesAnyRoute(ctx.path, [routes.SIGN_IN_EMAIL, routes.SIGN_IN_EMAIL_OTP]) && !(ctx.context.returned instanceof Error) && body?.email) {
						const email = body.email;
						await ctx.context.runInBackgroundOrAwait(securityService.clearFailedAttempts(email));
					}
				})
			}]
		}
	};
};
//#endregion
//#region src/events/organization/events-invitation.ts
const initInvitationEvents = (tracker) => {
	const { trackEvent } = tracker;
	const trackOrganizationMemberInvited = (organization, invitation, inviter, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_MEMBER_INVITED,
			eventDisplayName: "User invited to organization",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				inviteeId: invitation.id,
				inviteeEmail: invitation.email,
				inviteeRole: invitation.role,
				inviteeTeamId: invitation.teamId,
				inviterId: inviter.id,
				inviterName: inviter.name,
				inviterEmail: inviter.email ?? "unknown",
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackOrganizationMemberInviteAccepted = (organization, invitation, member, acceptedBy, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_MEMBER_INVITE_ACCEPTED,
			eventDisplayName: "User accepted invite organization invite",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				inviteeId: invitation.id,
				inviteeEmail: invitation.email,
				inviteeRole: invitation.role,
				inviteeTeamId: invitation.teamId,
				acceptedById: acceptedBy.id,
				acceptedByEmail: acceptedBy.email ?? "unknown",
				acceptedByName: acceptedBy.name,
				memberId: member.id,
				memberRole: member.role,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackOrganizationMemberInviteRejected = (organization, invitation, rejectedBy, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_MEMBER_INVITE_REJECTED,
			eventDisplayName: "User rejected organization invite",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				inviteeId: invitation.id,
				inviteeEmail: invitation.email,
				inviteeRole: invitation.role,
				inviteeTeamId: invitation.teamId,
				rejectedById: rejectedBy.id,
				rejectedByEmail: rejectedBy.email ?? "unknown",
				rejectedByName: rejectedBy.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackOrganizationMemberInviteCanceled = (organization, invitation, cancelledBy, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_MEMBER_INVITE_CANCELED,
			eventDisplayName: "Organization invite cancelled",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				inviteeId: invitation.id,
				inviteeEmail: invitation.email,
				inviteeRole: invitation.role,
				inviteeTeamId: invitation.teamId,
				cancelledById: cancelledBy.id,
				cancelledByName: cancelledBy.name,
				cancelledByEmail: cancelledBy.email ?? "unknown",
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	return {
		trackOrganizationMemberInvited,
		trackOrganizationMemberInviteAccepted,
		trackOrganizationMemberInviteCanceled,
		trackOrganizationMemberInviteRejected
	};
};
//#endregion
//#region src/events/organization/events-member.ts
const initMemberEvents = (tracker) => {
	const { trackEvent } = tracker;
	const trackOrganizationMemberAdded = (organization, member, user, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_MEMBER_ADDED,
			eventDisplayName: "Member added to organization",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				userId: member.userId,
				memberName: user.name,
				role: member.role,
				memberId: member.id,
				memberEmail: user.email ?? "unknown",
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackOrganizationMemberRemoved = (organization, member, user, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_MEMBER_REMOVED,
			eventDisplayName: "Member removed from organization",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				userId: member.userId,
				memberName: user.name,
				role: member.role,
				memberId: member.id,
				memberEmail: user.email ?? "unknown",
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackOrganizationMemberRoleUpdated = (organization, member, user, previousRole, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_MEMBER_ROLE_UPDATED,
			eventDisplayName: "Organization member role updated",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				userId: member.userId,
				memberName: user.name,
				newRole: member.role,
				oldRole: previousRole,
				memberId: member.id,
				memberEmail: user.email ?? "unknown",
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	return {
		trackOrganizationMemberAdded,
		trackOrganizationMemberRemoved,
		trackOrganizationMemberRoleUpdated
	};
};
//#endregion
//#region src/events/organization/events-organization.ts
const initOrganizationEvents = (tracker) => {
	const { trackEvent } = tracker;
	const trackOrganizationCreated = (organization, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_CREATED,
			eventDisplayName: "Organization Created",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackOrganizationUpdated = (organization, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_UPDATED,
			eventDisplayName: "Organization Updated",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	return {
		trackOrganizationCreated,
		trackOrganizationUpdated
	};
};
//#endregion
//#region src/events/organization/events-team.ts
const initTeamEvents = (tracker) => {
	const { trackEvent } = tracker;
	const trackOrganizationTeamCreated = (organization, team, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_TEAM_CREATED,
			eventDisplayName: "Organization team created",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				teamId: team.id,
				teamName: team.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackOrganizationTeamUpdated = (organization, team, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_TEAM_UPDATED,
			eventDisplayName: "Organization team updated",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				teamId: team.id,
				teamName: team.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackOrganizationTeamDeleted = (organization, team, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_TEAM_DELETED,
			eventDisplayName: "Organization team deleted",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				teamId: team.id,
				teamName: team.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackOrganizationTeamMemberAdded = (organization, team, user, teamMember, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_TEAM_MEMBER_ADDED,
			eventDisplayName: "User added to organization team",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				teamId: teamMember.teamId,
				teamName: team.name,
				userid: teamMember.userId,
				memberName: user.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	const trackOrganizationTeamMemberRemoved = (organization, team, user, teamMember, trigger) => {
		trackEvent({
			eventKey: organization.id,
			eventType: ORGANIZATION_EVENT_TYPES.ORGANIZATION_TEAM_MEMBER_REMOVED,
			eventDisplayName: "User removed from organization team",
			eventData: {
				organizationId: organization.id,
				organizationSlug: organization.slug,
				organizationName: organization.name,
				teamId: teamMember.teamId,
				teamName: team.name,
				userid: teamMember.userId,
				memberName: user.name,
				triggeredBy: trigger.triggeredBy,
				triggerContext: trigger.triggerContext
			}
		});
	};
	return {
		trackOrganizationTeamCreated,
		trackOrganizationTeamUpdated,
		trackOrganizationTeamDeleted,
		trackOrganizationTeamMemberAdded,
		trackOrganizationTeamMemberRemoved
	};
};
//#endregion
//#region src/jwt.ts
/**
* Hash the given value
* Note: Must match @infra/utils/crypto hash()
* @param value - The value to hash
*/
async function hash(value) {
	const data = new TextEncoder().encode(value);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = new Uint8Array(hashBuffer);
	return Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/**
* Skip JTI check for JWTs issued within this many seconds.
* This is safe because replay attacks require time for interception.
* A freshly issued token is almost certainly legitimate.
*/
const JTI_CHECK_GRACE_PERIOD_SECONDS = 30;
const JWKS_CACHE_TTL_MS = 900 * 1e3;
const jwksCache = /* @__PURE__ */ new Map();
const inflightRequests = /* @__PURE__ */ new Map();
async function fetchJWKS(ctx, cacheKey, $api) {
	const { data, error } = await $api("/api/auth/jwks");
	if (error || !data) {
		ctx.context.logger.warn("[Dash] Failed to fetch JWKS", error);
		throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
	}
	jwksCache.set(cacheKey, {
		data,
		expiresAt: Date.now() + JWKS_CACHE_TTL_MS
	});
	return createLocalJWKSet(data);
}
async function prefetchJWKS(ctx, cacheKey, $api) {
	const fetchPromise = fetchJWKS(ctx, cacheKey, $api);
	inflightRequests.set(cacheKey, fetchPromise);
	fetchPromise.finally(() => inflightRequests.delete(cacheKey));
	return fetchPromise;
}
async function getJWKs(ctx, cacheKey, $api) {
	const cached = jwksCache.get(cacheKey);
	if (cached && Date.now() < cached.expiresAt) return createLocalJWKSet(cached.data);
	if (cached) {
		if (!inflightRequests.has(cacheKey)) prefetchJWKS(ctx, cacheKey, $api);
		return createLocalJWKSet(cached.data);
	}
	return inflightRequests.get(cacheKey) ?? prefetchJWKS(ctx, cacheKey, $api);
}
/**
* Check if JWT is recently issued and can skip JTI verification.
* JWTs issued within the grace period are trusted without JTI check
* since replay attacks need time for interception and replay.
*/
function isRecentlyIssued(payload) {
	if (!payload.iat) return false;
	const issuedAt = payload.iat * 1e3;
	return Date.now() - issuedAt < JTI_CHECK_GRACE_PERIOD_SECONDS * 1e3;
}
const jwtMiddleware = (options, schema, getJWT) => {
	const { $api } = options;
	const cacheKey = options.apiUrl;
	return createAuthMiddleware(async (ctx) => {
		const jwsFromHeader = getJWT ? await getJWT(ctx) : ctx.headers?.get("Authorization")?.split(" ")[1];
		if (!jwsFromHeader) {
			ctx.context.logger.warn("[Dash] JWT is missing from header");
			throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
		}
		const { payload } = await jwtVerify(jwsFromHeader, await getJWKs(ctx, cacheKey, $api), { maxTokenAge: "5m" }).catch((e) => {
			ctx.context.logger.warn("[Dash] JWT verification failed:", e);
			throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
		});
		const apiKeyHash = payload.apiKeyHash;
		if (typeof apiKeyHash !== "string" || !options.apiKey) {
			ctx.context.logger.warn("[Dash] API key hash is missing or invalid", {
				apiKeyHash,
				apiKey: options.apiKey ? "present" : "missing"
			});
			throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
		}
		const expectedHash = await hash(options.apiKey);
		if (apiKeyHash !== expectedHash) {
			ctx.context.logger.warn("[Dash] API key hash is invalid", apiKeyHash, expectedHash);
			throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
		}
		if (!isRecentlyIssued(payload)) {
			const { error, data } = await $api("/api/auth/check-jti", {
				method: "POST",
				body: {
					jti: payload.jti,
					expiresAt: payload.exp
				}
			});
			if (error || !data?.valid) {
				ctx.context.logger.warn("[Dash] JTI check failed with error", error, data?.valid);
				throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
			}
		}
		if (schema) {
			const parsed = schema.safeParse(payload);
			if (!parsed.success) {
				ctx.context.logger.warn("[Dash] JWT payload is invalid", parsed.error);
				throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
			}
			return { payload: parsed.data };
		}
		return { payload };
	});
};
/**
* Lightweight JWT middleware for /dash/validate. Verifies JWT signature and
* apiKeyHash only—no JTI check. Used during onboarding when the org doesn't
* exist yet.
*/
const jwtValidateMiddleware = (options) => {
	const { $api } = options;
	const cacheKey = options.apiUrl;
	return createAuthMiddleware(async (ctx) => {
		const jwsFromHeader = ctx.headers?.get("Authorization")?.split(" ")[1];
		if (!jwsFromHeader) {
			ctx.context.logger.warn("[Dash] JWT is missing from header");
			throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
		}
		const { payload } = await jwtVerify(jwsFromHeader, await getJWKs(ctx, cacheKey, $api), { maxTokenAge: "5m" }).catch((e) => {
			ctx.context.logger.error("[Dash] JWT verification failed:", e);
			throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
		});
		const apiKeyHash = payload.apiKeyHash;
		if (typeof apiKeyHash !== "string" || !options.apiKey) {
			ctx.context.logger.warn("[Dash] API key hash is missing or invalid", {
				apiKeyHash: typeof apiKeyHash,
				apiKey: options.apiKey ? "present" : "missing"
			});
			throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
		}
		if (apiKeyHash !== await hash(options.apiKey)) {
			ctx.context.logger.warn("[Dash] API key hash mismatch");
			throw ctx.error("UNAUTHORIZED", { message: "Invalid API key" });
		}
		return { payload };
	});
};
//#endregion
//#region src/version.ts
const PLUGIN_VERSION = "0.2.10";
//#endregion
//#region src/routes/auth/config.ts
const PLUGIN_OPTIONS_EXCLUDE_KEYS = { stripe: new Set(["stripeClient"]) };
const EXACT_SENSITIVE_STRING_KEYS_LOWER = new Set([...new Set([
	"accessToken",
	"apiKey",
	"apiSecret",
	"authorization",
	"authToken",
	"bearerToken",
	"clientSecret",
	"consumerSecret",
	"encPrivateKey",
	"encPrivateKeyPass",
	"encryptionKey",
	"encryptionSecret",
	"idToken",
	"password",
	"privateKey",
	"privateKeyPass",
	"refreshToken",
	"secret",
	"secretKey",
	"signingSecret",
	"stripeWebhookSecret",
	"webhookSecret"
])].map((k) => k.toLowerCase()));
/**
* Case-insensitive suffixes for unknown plugin options
* Matching is more permissive to account for unknown plugin options
*/
const SENSITIVE_KEY_SUFFIXES_LOWER = [
	"secret",
	"password",
	"passphrase",
	"privatekey",
	"keypass",
	"apikey",
	"token",
	"signingkey",
	"credentials",
	"authheader"
];
const REDACTED_SIMPLE_STRING = "[REDACTED]";
function snakeCaseToCamelCase(key) {
	return key.replace(/_([a-zA-Z])/g, (_, ch) => ch.toUpperCase());
}
function keyVariantsForMatching(key) {
	const trimmed = key.replace(/^[\s._-]+/, "");
	if (!trimmed) return [key];
	const out = new Set([key, trimmed]);
	if (trimmed.includes("_")) out.add(snakeCaseToCamelCase(trimmed));
	return [...out];
}
function shouldRedactSensitiveStringKey(key) {
	const variants = keyVariantsForMatching(key);
	const compactLower = key.replace(/[\s._-]/g, "").toLowerCase();
	const forms = new Set([compactLower]);
	for (const raw of variants) {
		forms.add(raw);
		forms.add(raw.toLowerCase());
	}
	for (const form of forms) {
		const fl = form.toLowerCase();
		if (EXACT_SENSITIVE_STRING_KEYS_LOWER.has(fl)) return true;
		for (const suffix of SENSITIVE_KEY_SUFFIXES_LOWER) if (fl.endsWith(suffix)) return true;
	}
	return false;
}
function isPlainSerializable(value) {
	if (value === null || typeof value !== "object") return true;
	if (Array.isArray(value)) return true;
	if (value instanceof Date) return true;
	const constructor = Object.getPrototypeOf(value)?.constructor;
	if (constructor && constructor.name !== "Object" && constructor.name !== "Array") return false;
	return true;
}
/**
* Sanitize any plain JSON-like subtree from Better Auth options
*/
function sanitizeConfig(value, visiting, excludeKeys) {
	if (value === null || value === void 0) return value;
	if (typeof value === "function") return void 0;
	if (typeof value !== "object") return value;
	const obj = value;
	if (visiting.has(obj)) return void 0;
	visiting.add(obj);
	try {
		if (Array.isArray(value)) return value.map((item) => sanitizeConfig(item, visiting, excludeKeys)).filter((item) => item !== void 0);
		const result = {};
		for (const [key, val] of Object.entries(value)) {
			if (excludeKeys?.has(key)) continue;
			if (typeof val === "function") continue;
			if (typeof val === "string" && shouldRedactSensitiveStringKey(key)) {
				result[key] = REDACTED_SIMPLE_STRING;
				continue;
			}
			if (val !== null && typeof val === "object" && !isPlainSerializable(val)) continue;
			const sanitized = sanitizeConfig(val, visiting, excludeKeys);
			if (sanitized !== void 0) result[key] = sanitized;
		}
		return result;
	} finally {
		visiting.delete(obj);
	}
}
function sanitizePluginOptions(pluginId, options) {
	return sanitizeConfig(options, /* @__PURE__ */ new WeakSet(), PLUGIN_OPTIONS_EXCLUDE_KEYS[pluginId]);
}
function estimateEntropy(str) {
	const unique = new Set(str).size;
	if (unique === 0) return 0;
	return Math.log2(Math.pow(unique, str.length));
}
const getConfig = (options) => {
	return createAuthEndpoint("/dash/config", {
		method: "GET",
		use: [jwtMiddleware(options)]
	}, async (ctx) => {
		const advancedOptions = ctx.context.options.advanced;
		const organizationPlugin = ctx.context.getPlugin("organization");
		return {
			version: ctx.context.version || null,
			socialProviders: Object.keys(ctx.context.options.socialProviders || {}),
			emailAndPassword: sanitizeConfig(ctx.context.options.emailAndPassword, /* @__PURE__ */ new WeakSet(), void 0),
			plugins: ctx.context.options.plugins?.map((plugin) => {
				const base = {
					id: plugin.id,
					schema: plugin.schema,
					version: plugin.version,
					options: sanitizePluginOptions(plugin.id, plugin.options)
				};
				if (plugin.id === "dash" && !plugin.version) return {
					...base,
					version: PLUGIN_VERSION
				};
				return base;
			}) ?? [],
			organization: {
				sendInvitationEmailEnabled: !!organizationPlugin?.options?.sendInvitationEmail,
				additionalFields: (() => {
					const orgAdditionalFields = organizationPlugin?.options?.schema?.organization?.additionalFields || {};
					return Object.keys(orgAdditionalFields).map((field) => {
						const fieldType = orgAdditionalFields[field];
						return {
							name: field,
							type: fieldType?.type,
							required: fieldType?.required,
							input: fieldType?.input,
							unique: fieldType?.unique,
							hasDefaultValue: !!fieldType?.defaultValue,
							references: fieldType?.references,
							returned: fieldType?.returned,
							bigInt: fieldType?.bigint
						};
					});
				})()
			},
			user: {
				fields: Object.keys(ctx.context.options.user?.fields || {}).map((field) => {
					const fieldType = (ctx.context.options.user?.fields)?.[field];
					return {
						name: field,
						type: fieldType?.type,
						required: fieldType?.required,
						input: fieldType?.input,
						unique: fieldType?.unique,
						hasDefaultValue: !!fieldType?.defaultValue,
						references: fieldType?.references,
						returned: fieldType?.returned,
						bigInt: fieldType?.bigint
					};
				}),
				additionalFields: Object.keys(ctx.context.options.user?.additionalFields || {}).map((field) => {
					const fieldType = (ctx.context.options.user?.additionalFields)?.[field];
					return {
						name: field,
						type: fieldType?.type,
						required: fieldType?.required,
						input: fieldType?.input,
						unique: fieldType?.unique,
						hasDefaultValue: !!fieldType?.defaultValue,
						references: fieldType?.references,
						returned: fieldType?.returned,
						bigInt: fieldType?.bigint
					};
				}),
				deleteUserEnabled: !!ctx.context.options.user?.deleteUser?.enabled,
				modelName: ctx.context.options.user?.modelName
			},
			baseURL: ctx.context.options.baseURL,
			basePath: ctx.context.options.basePath || "/api/auth",
			emailVerification: { sendVerificationEmailEnabled: !!ctx.context.options.emailVerification?.sendVerificationEmail },
			insights: {
				hasDatabase: !!ctx.context.options.database,
				cookies: advancedOptions?.cookies ? Object.entries(advancedOptions.cookies).map(([key, value]) => ({
					key,
					name: value?.name,
					sameSite: value?.attributes?.sameSite
				})) : null,
				hasIpAddressHeaders: !!(advancedOptions?.ipAddress?.ipAddressHeaders && advancedOptions.ipAddress.ipAddressHeaders.length > 0),
				ipAddressHeaders: advancedOptions?.ipAddress?.ipAddressHeaders || null,
				disableIpTracking: advancedOptions?.ipAddress?.disableIpTracking || false,
				disableCSRFCheck: ctx.context.options.advanced?.disableCSRFCheck || false,
				disableOriginCheck: ctx.context.options.advanced?.disableOriginCheck || false,
				allowDifferentEmails: ctx.context.options.account?.accountLinking?.enabled && ctx.context.options.account?.accountLinking?.allowDifferentEmails || false,
				skipStateCookieCheck: ctx.context.options.account?.skipStateCookieCheck || false,
				storeStateCookieStrategy: ctx.context.options.account?.storeStateStrategy || null,
				cookieCache: {
					enabled: ctx.context.options.session?.cookieCache?.enabled || false,
					strategy: ctx.context.options.session?.cookieCache?.enabled && ctx.context.options.session?.cookieCache?.strategy || null,
					refreshCache: ctx.context.options.session?.cookieCache?.enabled && typeof ctx.context.options.session?.cookieCache?.refreshCache !== "undefined" ? ctx.context.options.session.cookieCache.refreshCache !== false : null
				},
				sessionFreshAge: ctx.context.options.session?.freshAge || null,
				disableVerificationCleanup: ctx.context.options.verification?.disableCleanup || false,
				minPasswordLength: ctx.context.options.emailAndPassword?.enabled && ctx.context.options.emailAndPassword?.minPasswordLength || null,
				maxPasswordLength: ctx.context.options.emailAndPassword?.enabled && ctx.context.options.emailAndPassword?.maxPasswordLength || null,
				hasRateLimitDisabled: ctx.context.options.rateLimit?.enabled === false,
				rateLimitStorage: ctx.context.options.rateLimit?.enabled !== false && !ctx.context.options.rateLimit?.customStorage && ctx.context.options.rateLimit?.storage || null,
				storeSessionInDatabase: ctx.context.options.session?.storeSessionInDatabase === true,
				preserveSessionInDatabase: ctx.context.options.session?.preserveSessionInDatabase === true,
				secretEntropy: ctx.context.secret === "better-auth-secret-12345678901234567890" || ctx.context.secret.length < 32 ? 0 : estimateEntropy(ctx.context.secret),
				useSecureCookies: typeof ctx.context.options.advanced?.useSecureCookies !== "undefined" ? ctx.context.options.advanced.useSecureCookies : null,
				crossSubDomainCookiesEnabled: ctx.context.options.advanced?.crossSubDomainCookies?.enabled || false,
				crossSubDomainCookiesDomain: ctx.context.options.advanced?.crossSubDomainCookies?.domain,
				defaultCookieAttributes: ctx.context.options.advanced?.defaultCookieAttributes ? {
					sameSite: ctx.context.options.advanced?.defaultCookieAttributes?.sameSite || null,
					httpOnly: typeof ctx.context.options.advanced?.defaultCookieAttributes?.httpOnly !== "undefined" ? ctx.context.options.advanced?.defaultCookieAttributes?.httpOnly : null,
					prefix: ctx.context.options.advanced?.defaultCookieAttributes?.prefix || null,
					partitioned: typeof ctx.context.options.advanced?.defaultCookieAttributes?.partitioned !== "undefined" ? ctx.context.options.advanced?.defaultCookieAttributes?.partitioned : null,
					secure: typeof ctx.context.options.advanced?.defaultCookieAttributes?.secure !== "undefined" ? ctx.context.options.advanced?.defaultCookieAttributes?.secure : null
				} : null,
				appName: ctx.context.options.appName || null,
				hasJoinsEnabled: ctx.context.options.experimental?.joins === true
			}
		};
	});
};
//#endregion
//#region src/routes/auth/validate.ts
/**
* Lightweight endpoint to verify API key ownership during onboarding
*/
const getValidate = (options) => {
	return createAuthEndpoint("/dash/validate", {
		method: "GET",
		use: [jwtValidateMiddleware(options)]
	}, async () => {
		return { valid: true };
	});
};
//#endregion
//#region src/routes/organization-guards.ts
/** Returns true if organization plugin is enabled. */
function isOrganizationEnabled(ctx) {
	return !!ctx.context.getPlugin("organization");
}
/** Returns the organization plugin, throws if not enabled. Use for write endpoints. */
function requireOrganizationPlugin(ctx) {
	const plugin = ctx.context.getPlugin("organization");
	if (!plugin) throw ctx.error("BAD_REQUEST", { message: "Organization plugin not enabled" });
	return plugin;
}
/** Returns true if organization plugin and teams feature are enabled. */
function isTeamsEnabled(ctx) {
	return !!ctx.context.getPlugin("organization")?.options?.teams?.enabled;
}
/**
* Validates that the organization plugin is enabled and teams feature is enabled.
*
* @returns The organization options for use in team logic (maximumTeams, hooks, etc.)
*/
function requireTeamsEnabled(ctx) {
	const orgOptions = requireOrganizationPlugin(ctx).options || {};
	if (!orgOptions?.teams?.enabled) throw ctx.error("BAD_REQUEST", { message: "Teams are not enabled" });
	return orgOptions;
}
//#endregion
//#region src/routes/directory-sync/session.ts
async function buildSyntheticSession(ctx, ownerUserId) {
	const owner = await ctx.context.internalAdapter.findUserById(ownerUserId);
	if (!owner) throw ctx.error("BAD_REQUEST", { message: "Owner identity not found" });
	return {
		...ctx.context,
		session: {
			user: owner,
			session: { userId: ownerUserId }
		}
	};
}
//#endregion
//#region src/routes/directory-sync/index.ts
async function getScimProviderOwner(ctx, organizationId, providerId) {
	const where = [{
		field: "organizationId",
		value: organizationId
	}];
	if (providerId) where.push({
		field: "providerId",
		value: providerId
	});
	return (await ctx.context.adapter.findOne({
		model: "scimProvider",
		where,
		select: ["userId"]
	}))?.userId ?? null;
}
function getScimEndpoint(baseUrl) {
	return `${baseUrl}/scim/v2`;
}
function getSCIMPlugin(ctx) {
	return ctx.context.getPlugin("scim");
}
const DIRECTORY_SYNC_DUPLICATE_MESSAGE = "A directory sync connection with this provider ID already exists. Remove the existing connection or choose a different provider ID.";
function isDuplicateDirectorySyncError(e) {
	if (e instanceof APIError$1) return e.status === "CONFLICT" || /duplicate|already exists|unique constraint/i.test(e.message ?? "");
	if (e instanceof Error) return /unique constraint|duplicate key|already exists|P2002/i.test(e.message);
	return false;
}
const listOrganizationDirectories = (options) => {
	return createAuthEndpoint("/dash/organization/:id/directories", {
		method: "GET",
		use: [jwtMiddleware(options)]
	}, async (ctx) => {
		if (!isOrganizationEnabled(ctx)) {
			ctx.context.logger.warn("[Dash] Organization plugin not enabled, returning empty directories list");
			return [];
		}
		const organizationId = tryDecode(ctx.params.id);
		const scimPlugin = getSCIMPlugin(ctx);
		if (!scimPlugin?.endpoints.listSCIMProviderConnections || !scimPlugin?.options?.providerOwnership?.enabled) {
			ctx.context.logger.warn("[Dash] SCIM plugin not available or provider ownership disabled, returning empty directories list", { organizationId });
			return [];
		}
		const ownerUserId = await getScimProviderOwner(ctx, organizationId);
		if (!ownerUserId) {
			ctx.context.logger.warn("[Dash] No SCIM provider owner found for organization, returning empty directories list", { organizationId });
			return [];
		}
		try {
			const { providers } = await scimPlugin.endpoints.listSCIMProviderConnections({
				context: await buildSyntheticSession(ctx, ownerUserId),
				headers: ctx.request?.headers ?? new Headers()
			});
			return providers.filter((p) => p.organizationId === organizationId).map((provider) => ({
				organizationId: provider.organizationId,
				providerId: provider.providerId,
				scimEndpoint: getScimEndpoint(ctx.context.baseURL)
			}));
		} catch (error) {
			ctx.context.logger.warn("[Dash] Failed to list SCIM provider connections:", error);
			return [];
		}
	});
};
const createOrganizationDirectory = (options) => {
	return createAuthEndpoint("/dash/organization/directory/create", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({
			providerId: z$1.string().min(1, "Provider ID is required"),
			ownerUserId: z$1.string().min(1, "Owner user ID is required")
		})
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		const { organizationId } = ctx.context.payload;
		const scimPlugin = getSCIMPlugin(ctx);
		if (!scimPlugin?.endpoints.generateSCIMToken || !scimPlugin?.options?.providerOwnership?.enabled) throw ctx.error("BAD_REQUEST", { message: "SCIM plugin is not enabled or does not support this feature" });
		const { providerId, ownerUserId } = ctx.body;
		let scimToken;
		try {
			scimToken = (await scimPlugin.endpoints.generateSCIMToken({
				body: {
					providerId,
					organizationId
				},
				context: await buildSyntheticSession(ctx, ownerUserId),
				headers: ctx.request?.headers ?? new Headers()
			})).scimToken;
		} catch (e) {
			if (isDuplicateDirectorySyncError(e)) throw ctx.error("BAD_REQUEST", { message: DIRECTORY_SYNC_DUPLICATE_MESSAGE });
			ctx.context.logger.error("[Dash] Failed to create directory sync provider (organizationId=%s, providerId=%s)", organizationId, providerId, e);
			if (e instanceof APIError$1) throw e;
			throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to create directory sync provider" });
		}
		if (!scimToken) throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to create directory sync provider" });
		return {
			organizationId,
			providerId,
			scimEndpoint: getScimEndpoint(ctx.context.baseURL),
			scimToken
		};
	});
};
const deleteOrganizationDirectory = (options) => {
	return createAuthEndpoint("/dash/organization/directory/delete", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({ providerId: z$1.string().min(1, "Provider ID is required") })
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		const scimPlugin = getSCIMPlugin(ctx);
		if (!scimPlugin?.endpoints.deleteSCIMProviderConnection || !scimPlugin?.options?.providerOwnership?.enabled) throw ctx.error("BAD_REQUEST", { message: "SCIM plugin is not enabled or does not support this feature" });
		const { organizationId } = ctx.context.payload;
		const { providerId } = ctx.body;
		const ownerUserId = await getScimProviderOwner(ctx, organizationId, providerId);
		if (!ownerUserId) throw ctx.error("NOT_FOUND", { message: "Directory sync connection not found or missing owner" });
		await scimPlugin.endpoints.deleteSCIMProviderConnection({
			body: { providerId },
			context: await buildSyntheticSession(ctx, ownerUserId),
			headers: ctx.request?.headers ?? new Headers()
		});
		return { success: true };
	});
};
const regenerateDirectoryToken = (options) => {
	return createAuthEndpoint("/dash/organization/directory/regenerate-token", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({ providerId: z$1.string().min(1, "Provider ID is required") })
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		const scimPlugin = getSCIMPlugin(ctx);
		if (!scimPlugin?.endpoints.generateSCIMToken || !scimPlugin?.options?.providerOwnership?.enabled) throw ctx.error("BAD_REQUEST", { message: "SCIM plugin is not enabled or does not support this feature" });
		const { organizationId } = ctx.context.payload;
		const { providerId } = ctx.body;
		const ownerUserId = await getScimProviderOwner(ctx, organizationId, providerId);
		if (!ownerUserId) throw ctx.error("NOT_FOUND", { message: "Directory sync connection not found or missing owner" });
		const { scimToken } = await scimPlugin.endpoints.generateSCIMToken({
			body: {
				providerId,
				organizationId
			},
			context: await buildSyntheticSession(ctx, ownerUserId),
			headers: ctx.request?.headers ?? new Headers()
		});
		if (!scimToken) throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to regenerate directory sync token" });
		return {
			success: true,
			scimToken,
			scimEndpoint: getScimEndpoint(ctx.context.baseURL)
		};
	});
};
//#endregion
//#region src/routes/events/index.ts
function transformEvent(raw) {
	const location = raw.ipAddress || raw.city || raw.country || raw.countryCode ? {
		ipAddress: raw.ipAddress,
		city: raw.city,
		country: raw.country,
		countryCode: raw.countryCode
	} : void 0;
	return {
		eventType: raw.eventType,
		eventData: raw.eventData,
		eventKey: raw.eventKey,
		projectId: raw.projectId,
		createdAt: new Date(raw.createdAt),
		updatedAt: new Date(raw.updatedAt),
		ageInMinutes: raw.ageInMinutes,
		location
	};
}
/**
* Get the current user's audit log events.
*
* This endpoint is designed for end-users to view their own activity history,
* such as sign-ins, password changes, and other account events.
*
* @example
* ```ts
* // Using the Better Auth client
* const { data, error } = await authClient.events.list({
*   query: { limit: 20, offset: 0 }
* });
*
* if (data) {
*   for (const event of data.events) {
*     console.log(`${event.eventType} at ${event.createdAt}`);
*   }
* }
* ```
*/
const getUserEvents = (options) => {
	const { $api } = options;
	return createAuthEndpoint("/events/list", {
		method: "GET",
		use: [sessionMiddleware],
		query: z$1.object({
			/** Maximum number of events to return (default: 50, max: 100) */
			limit: z$1.number().or(z$1.string().transform(Number)).optional(),
			/** Number of events to skip for pagination (default: 0) */
			offset: z$1.number().or(z$1.string().transform(Number)).optional(),
			/** Filter by event type (e.g., "user_signed_in") */
			eventType: z$1.string().optional()
		}).optional()
	}, async (ctx) => {
		const session = ctx.context.session;
		if (!session?.user?.id) throw ctx.error("UNAUTHORIZED", { message: "You must be signed in to view your events" });
		if (!options.apiKey) throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Events API is not configured" });
		const requestedLimit = ctx.query?.limit ?? 50;
		const limit = Math.min(Math.max(1, requestedLimit), 100);
		const offset = Math.max(0, ctx.query?.offset ?? 0);
		const { data, error } = await $api("/events/user", {
			method: "GET",
			query: {
				userId: session.user.id,
				limit: limit.toString(),
				offset: offset.toString()
			}
		});
		if (error || !data) {
			ctx.context.logger.error("[Dash] Failed to fetch events:", error);
			throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to fetch events" });
		}
		let events = data.events.map(transformEvent);
		if (ctx.query?.eventType) events = events.filter((event) => event.eventType === ctx.query?.eventType);
		return {
			events,
			total: data.total,
			limit: data.limit,
			offset: data.offset
		};
	});
};
/**
* Get the list of available event types.
*
* This endpoint returns all the event types that can appear in the audit log,
* useful for building filters or documentation.
*/
const getEventTypes = (options) => {
	return createAuthEndpoint("/events/types", {
		method: "GET",
		use: [sessionMiddleware]
	}, async (ctx) => {
		if (!options.apiKey) throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Events API is not configured" });
		return {
			user: EVENT_TYPES,
			organization: ORGANIZATION_EVENT_TYPES,
			all: USER_EVENT_TYPES
		};
	});
};
/**
* Get audit logs for the current user (by session) or by organization.
*
* Behavior:
* - Without `organizationId`: queries user-scoped events for the resolved user.
* - With `organizationId`: queries organization events and optionally scopes
*   results to the resolved user/identifier.
*/
const getAuditLogs = (options) => {
	const { $api } = options;
	return createAuthEndpoint("/events/audit-logs", {
		method: "GET",
		use: [sessionMiddleware],
		query: z$1.object({
			limit: z$1.number().or(z$1.string().transform(Number)).optional(),
			offset: z$1.number().or(z$1.string().transform(Number)).optional(),
			userId: z$1.string().optional(),
			organizationId: z$1.string().optional(),
			identifier: z$1.string().optional(),
			eventType: z$1.string().optional()
		}).optional()
	}, async (ctx) => {
		const session = ctx.context.session;
		if (!session?.user?.id) throw ctx.error("UNAUTHORIZED", { message: "You must be signed in to view audit logs" });
		if (!options.apiKey) throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Events API is not configured" });
		const requestedLimit = ctx.query?.limit ?? 50;
		const limit = Math.min(Math.max(1, requestedLimit), 100);
		const offset = Math.max(0, ctx.query?.offset ?? 0);
		const resolvedUserId = ctx.query?.userId || session.user.id;
		const organizationId = ctx.query?.organizationId;
		if (ctx.query?.userId && ctx.query.userId !== session.user.id) throw ctx.error("FORBIDDEN", { message: "Not allowed to access another user's audit logs" });
		let rawEvents = [];
		let total = 0;
		let responseLimit = limit;
		let responseOffset = offset;
		if (organizationId) {
			const sessionData = session;
			const sessionOrganizations = sessionData.organizations;
			if (!(sessionData.session?.activeOrganizationId === organizationId) && (!Array.isArray(sessionOrganizations) || !sessionOrganizations.some((org) => {
				return org.id === organizationId;
			}))) throw ctx.error("FORBIDDEN", { message: "Not allowed to access this organization" });
			const { data, error } = await $api("/events/organization", {
				method: "GET",
				query: {
					organizationId,
					limit: limit.toString(),
					offset: offset.toString()
				}
			});
			if (error || !data) {
				ctx.context.logger.error("[Dash] Failed to fetch organization audit logs:", error);
				throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to fetch organization audit logs" });
			}
			rawEvents = data.events;
			total = data.total;
			responseLimit = data.limit;
			responseOffset = data.offset;
		} else {
			const { data, error } = await $api("/events/user", {
				method: "GET",
				query: {
					userId: resolvedUserId,
					limit: limit.toString(),
					offset: offset.toString()
				}
			});
			if (error || !data) {
				ctx.context.logger.error("[Dash] Failed to fetch user audit logs:", error);
				throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to fetch user audit logs" });
			}
			rawEvents = data.events;
			total = data.total;
			responseLimit = data.limit;
			responseOffset = data.offset;
		}
		let filteredEvents = rawEvents;
		if (organizationId) filteredEvents = filteredEvents.filter((event) => {
			const eventData = event.eventData || {};
			const eventUserId = typeof eventData.userId === "string" ? eventData.userId : void 0;
			const eventIdentifier = typeof eventData.identifier === "string" ? eventData.identifier : void 0;
			const matchesUser = !resolvedUserId || eventUserId === resolvedUserId || event.eventKey === resolvedUserId;
			const matchesIdentifier = !ctx.query?.identifier || eventIdentifier === ctx.query.identifier;
			return matchesUser && matchesIdentifier;
		});
		if (ctx.query?.eventType) filteredEvents = filteredEvents.filter((event) => event.eventType === ctx.query?.eventType);
		const responseTotal = organizationId || ctx.query?.eventType ? filteredEvents.length : total;
		return {
			events: filteredEvents.map(transformEvent),
			total: responseTotal,
			limit: responseLimit,
			offset: responseOffset
		};
	});
};
const OWNER_ADMIN_ROLES = new Set(["owner", "admin"]);
function isOwnerOrAdminRole(role) {
	return role !== void 0 && OWNER_ADMIN_ROLES.has(role);
}
/**
* Get all audit logs the current user has access to
* Queries can be restricted to a single organization, a single user, or all organizations the user has access to
* @param options
* @returns
*/
const getAllAuditLogs = (options) => {
	const { $api } = options;
	const getUserOrganizationRole = async (adapter, orgId, userId) => {
		return (await adapter.findOne({
			model: "member",
			where: [{
				field: "organizationId",
				value: orgId
			}, {
				field: "userId",
				value: userId
			}],
			select: ["role"]
		}))?.role;
	};
	const listElevatedOrganizationIds = async (adapter, userId) => {
		const memberships = await adapter.findMany({
			model: "member",
			where: [{
				field: "userId",
				value: userId
			}],
			select: ["organizationId", "role"]
		});
		const ids = /* @__PURE__ */ new Set();
		for (const m of memberships) if (isOwnerOrAdminRole(m.role)) ids.add(m.organizationId);
		return [...ids];
	};
	return createAuthEndpoint("/events/all-audit-logs", {
		method: "GET",
		use: [sessionMiddleware],
		query: z$1.object({
			limit: z$1.number().or(z$1.string().transform(Number)).optional(),
			offset: z$1.number().or(z$1.string().transform(Number)).optional(),
			userId: z$1.string().optional(),
			organizationId: z$1.string().optional(),
			/** Filter by event type (e.g. `organization_member_added`) */
			eventType: z$1.string().optional(),
			/** Match `eventData.identifier` (organization-scoped actor identity) */
			identifier: z$1.string().optional()
		}).refine((q) => {
			const u = q.userId?.trim();
			const o = q.organizationId?.trim();
			return !(u && o);
		}, { message: "Provide at most one of userId and organizationId." }).optional()
	}, async (ctx) => {
		const session = ctx.context.session;
		if (!session?.user?.id) throw ctx.error("UNAUTHORIZED", { message: "You must be signed in to view activity logs" });
		if (!options.apiKey) throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Events API is not configured" });
		const query = ctx.query ?? {};
		const adapter = ctx.context.adapter;
		const sessionUserId = session.user.id;
		const limit = Math.min(Math.max(1, query.limit ?? 50), 100);
		const offset = Math.max(0, query.offset ?? 0);
		const organizationId = query.organizationId?.trim();
		const userId = query.userId?.trim();
		const forbidAccess = () => {
			return ctx.error("FORBIDDEN", { message: "Only organization owners and admins can view activity logs." });
		};
		const elevatedOrgIds = await listElevatedOrganizationIds(adapter, sessionUserId);
		if (organizationId) {
			if (!isOwnerOrAdminRole(await getUserOrganizationRole(adapter, organizationId, sessionUserId))) throw forbidAccess();
		} else if (userId) {
			if (elevatedOrgIds.length === 0) throw forbidAccess();
		} else if (elevatedOrgIds.length === 0) throw forbidAccess();
		const apiQuery = {
			limit: limit.toString(),
			offset: offset.toString()
		};
		if (organizationId) apiQuery.organizationIds = organizationId;
		else if (userId) {
			apiQuery.userId = userId;
			apiQuery.organizationIds = elevatedOrgIds.join(",");
		} else apiQuery.organizationIds = elevatedOrgIds.join(",");
		const eventTypeFilter = query.eventType?.trim();
		const identifierFilter = query.identifier?.trim();
		if (eventTypeFilter) apiQuery.eventType = eventTypeFilter;
		if (identifierFilter) apiQuery.identifier = identifierFilter;
		const { data, error } = await $api("/events/activity", {
			method: "GET",
			query: apiQuery
		});
		if (error || !data) {
			ctx.context.logger.error("[Dash] Failed to fetch activity logs:", error);
			throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to fetch activity logs" });
		}
		return {
			events: data.events.map(transformEvent),
			total: data.total,
			limit: data.limit,
			offset: data.offset
		};
	});
};
//#endregion
//#region src/routes/execute-adapter/index.ts
const whereClause = z.object({
	field: z.string(),
	value: z.unknown(),
	operator: z.enum([
		"eq",
		"ne",
		"gt",
		"gte",
		"lt",
		"lte",
		"in",
		"contains",
		"starts_with",
		"ends_with"
	]).optional(),
	connector: z.enum(["AND", "OR"]).optional()
});
const sortBySchema = z.object({
	field: z.string(),
	direction: z.enum(["asc", "desc"])
});
const actionSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("findOne"),
		model: z.string(),
		where: z.array(whereClause).optional(),
		select: z.array(z.string()).optional(),
		join: z.record(z.string(), z.boolean()).optional()
	}),
	z.object({
		action: z.literal("findMany"),
		model: z.string(),
		where: z.array(whereClause).optional(),
		limit: z.number().optional(),
		offset: z.number().optional(),
		sortBy: sortBySchema.optional(),
		join: z.record(z.string(), z.boolean()).optional()
	}),
	z.object({
		action: z.literal("create"),
		model: z.string(),
		data: z.record(z.string(), z.unknown())
	}),
	z.object({
		action: z.literal("update"),
		model: z.string(),
		where: z.array(whereClause),
		update: z.record(z.string(), z.unknown())
	}),
	z.object({
		action: z.literal("count"),
		model: z.string(),
		where: z.array(whereClause).optional()
	})
]);
const executeAdapter = (options) => {
	return createAuthEndpoint("/dash/execute-adapter", {
		method: "POST",
		use: [jwtMiddleware(options)],
		body: actionSchema
	}, async (ctx) => {
		const adapter = ctx.context.adapter;
		const body = ctx.body;
		switch (body.action) {
			case "findOne": return { result: await adapter.findOne({
				model: body.model,
				where: body.where,
				select: body.select,
				join: body.join
			}) };
			case "findMany": return { result: await adapter.findMany({
				model: body.model,
				where: body.where,
				limit: body.limit,
				offset: body.offset,
				sortBy: body.sortBy,
				join: body.join
			}) };
			case "create": return { result: await adapter.create({
				model: body.model,
				data: body.data
			}) };
			case "update": return { result: await adapter.update({
				model: body.model,
				where: body.where,
				update: body.update
			}) };
			case "count": return { count: await adapter.count({
				model: body.model,
				where: body.where
			}) };
		}
	});
};
//#endregion
//#region src/routes/invitations/index.ts
/**
* Accept invitation endpoint
* This is called when a user clicks the invitation link.
* It creates the user in the auth database and sets up a session.
*/
const acceptInvitation = (options) => {
	const { $api } = options;
	return createAuthEndpoint("/dash/accept-invitation", {
		method: "GET",
		query: z$1.object({ token: z$1.string() })
	}, async (ctx) => {
		const { token } = ctx.query;
		const { data: invitation, error } = await $api("/api/internal/invitations/verify", {
			method: "POST",
			body: { token }
		});
		if (error || !invitation) {
			ctx.context.logger.warn("[Dash] Failed to verify invitation", error);
			throw new APIError("BAD_REQUEST", { message: "Invalid or expired invitation." });
		}
		if (invitation.status !== "pending") throw new APIError("BAD_REQUEST", { message: `This invitation has already been ${invitation.status}.` });
		if (invitation.expiresAt) {
			if (new Date(invitation.expiresAt) < /* @__PURE__ */ new Date()) {
				const { error: markError } = await $api("/api/internal/invitations/mark-expired", {
					method: "POST",
					body: { token }
				});
				if (markError) ctx.context.logger.warn("[Dash] Failed to mark invitation as expired", markError);
				throw new APIError("BAD_REQUEST", { message: "This invitation has expired." });
			}
		}
		const invitationEmail = normalizeEmail(invitation.email, ctx.context);
		const existingUser = await ctx.context.internalAdapter.findUserByEmail(invitationEmail).then((user) => user?.user);
		if (existingUser) {
			const { error: markError } = await $api("/api/internal/invitations/mark-accepted", {
				method: "POST",
				body: {
					token,
					userId: existingUser.id
				}
			});
			if (markError) ctx.context.logger.warn("[Dash] Failed to mark invitation as accepted (existing user)", markError);
			await setSessionCookie(ctx, {
				session: await ctx.context.internalAdapter.createSession(existingUser.id),
				user: existingUser
			});
			const redirectUrl = invitation.redirectUrl || ctx.context.options.baseURL || "/";
			return ctx.redirect(redirectUrl.toString());
		}
		if (invitation.authMode === "auth") {
			const platformUrl = options.apiUrl || INFRA_API_URL;
			const acceptPageUrl = new URL("/invite/accept", platformUrl);
			acceptPageUrl.searchParams.set("token", token);
			const callbackUrl = `${ctx.context.options.baseURL}${ctx.context.options.basePath || "/api/auth"}/dash/complete-invitation`;
			acceptPageUrl.searchParams.set("callback", callbackUrl);
			return ctx.redirect(acceptPageUrl.toString());
		}
		const user = await ctx.context.internalAdapter.createUser({
			email: invitationEmail,
			name: invitation.name || invitation.email.split("@")[0] || "",
			emailVerified: true,
			createdAt: /* @__PURE__ */ new Date(),
			updatedAt: /* @__PURE__ */ new Date()
		});
		const { error: markError } = await $api("/api/internal/invitations/mark-accepted", {
			method: "POST",
			body: {
				token,
				userId: user.id
			}
		});
		if (markError) ctx.context.logger.warn("[Dash] Failed to mark invitation as accepted", markError);
		await setSessionCookie(ctx, {
			session: await ctx.context.internalAdapter.createSession(user.id),
			user
		});
		const redirectUrl = invitation.redirectUrl || ctx.context.options.baseURL || "/";
		return ctx.redirect(redirectUrl.toString());
	});
};
/**
* Complete invitation endpoint
* Called by the platform after user completes authentication (password/social)
* This creates the user in the auth database and sets up a session
*/
const completeInvitation = (options) => {
	const { $api } = options;
	return createAuthEndpoint("/dash/complete-invitation", {
		method: "POST",
		body: z$1.object({
			token: z$1.string(),
			password: z$1.string().optional(),
			providerId: z$1.string().optional(),
			providerAccountId: z$1.string().optional(),
			accessToken: z$1.string().optional(),
			refreshToken: z$1.string().optional()
		})
	}, async (ctx) => {
		const { token, password, providerId, providerAccountId, accessToken, refreshToken } = ctx.body;
		const fallbackRedirect = typeof ctx.context.options.baseURL === "string" ? ctx.context.options.baseURL : "/";
		const { data: invitation, error } = await $api("/api/internal/invitations/verify", {
			method: "POST",
			body: { token }
		});
		if (error || !invitation) {
			ctx.context.logger.warn("[Dash] Failed to verify invitation", error);
			throw new APIError("BAD_REQUEST", { message: "Invalid or expired invitation." });
		}
		if (invitation.status !== "pending") throw new APIError("BAD_REQUEST", { message: `This invitation has already been ${invitation.status}.` });
		if (!ctx.context) throw new APIError("BAD_REQUEST", { message: "Context is required" });
		const invitationEmail = normalizeEmail(invitation.email, ctx.context);
		const existingUser = await ctx.context.internalAdapter.findUserByEmail(invitationEmail).then((user) => user?.user);
		if (existingUser) {
			const { error: markError } = await $api("/api/internal/invitations/mark-accepted", {
				method: "POST",
				body: {
					token,
					userId: existingUser.id
				}
			});
			if (markError) ctx.context.logger.warn("[Dash] Failed to mark invitation as accepted", markError);
			await setSessionCookie(ctx, {
				session: await ctx.context.internalAdapter.createSession(existingUser.id),
				user: existingUser
			});
			return {
				success: true,
				redirectUrl: invitation.redirectUrl ?? fallbackRedirect
			};
		}
		const user = await ctx.context.internalAdapter.createUser({
			email: invitationEmail,
			name: invitation.name || invitation.email.split("@")[0] || "",
			emailVerified: true,
			createdAt: /* @__PURE__ */ new Date(),
			updatedAt: /* @__PURE__ */ new Date()
		});
		if (password) await ctx.context.internalAdapter.createAccount({
			userId: user.id,
			providerId: "credential",
			accountId: user.id,
			password: await ctx.context.password.hash(password)
		});
		else if (providerId && providerAccountId) await ctx.context.internalAdapter.createAccount({
			userId: user.id,
			providerId,
			accountId: providerAccountId,
			accessToken,
			refreshToken
		});
		const { error: markError } = await $api("/api/internal/invitations/mark-accepted", {
			method: "POST",
			body: {
				token,
				userId: user.id
			}
		});
		if (markError) ctx.context.logger.warn("[Dash] Failed to mark invitation as accepted", markError);
		await setSessionCookie(ctx, {
			session: await ctx.context.internalAdapter.createSession(user.id),
			user
		});
		return {
			success: true,
			redirectUrl: invitation.redirectUrl ?? fallbackRedirect
		};
	});
};
/**
* Check if a user exists by email
* Used by the platform to verify before sending invitation
* This is different from /dash/organization/check-user-by-email which also checks membership
*/
const checkUserExists = (options) => {
	return createAuthEndpoint("/dash/check-user-exists", {
		method: "POST",
		use: [jwtMiddleware(options)],
		body: z$1.object({ email: z$1.email() })
	}, async (ctx) => {
		const { email } = ctx.body;
		const normalizedEmail = normalizeEmail(email, ctx.context);
		const existingUser = await ctx.context.internalAdapter.findUserByEmail(normalizedEmail).then((user) => user?.user);
		return {
			exists: !!existingUser,
			userId: existingUser?.id || null
		};
	});
};
//#endregion
//#region src/routes/organizations/roles.ts
const DEFAULT_ORG_MEMBER_ROLES = [
	"member",
	"admin",
	"owner"
];
function getOrganizationRoleKeys(orgOptions) {
	const roles = orgOptions?.roles;
	if (roles && typeof roles === "object" && Object.keys(roles).length > 0) return Object.keys(roles);
	return [...DEFAULT_ORG_MEMBER_ROLES];
}
const organizationMemberRoleInputSchema = z$1.string().trim().min(1, "Role is required").max(64, "Role is too long").regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, "Role must start with a letter and contain only letters, numbers, hyphens, and underscores");
function validateOrganizationMemberRole(ctx, role, orgOptions) {
	const allowedRoles = getOrganizationRoleKeys(orgOptions);
	if (!allowedRoles.includes(role)) throw ctx.error("BAD_REQUEST", { message: `Invalid role. Allowed roles: ${allowedRoles.join(", ")}` });
}
//#endregion
//#region src/routes/organizations/invitations.ts
const listOrganizationInvitations = (options) => {
	return createAuthEndpoint("/dash/organization/:id/invitations", {
		method: "GET",
		use: [jwtMiddleware(options)]
	}, async (ctx) => {
		if (!isOrganizationEnabled(ctx)) {
			ctx.context.logger.warn("[Dash] Organization plugin not enabled, returning empty invitations list");
			return [];
		}
		const organizationId = tryDecode(ctx.params.id);
		const invitations = await ctx.context.adapter.findMany({
			model: "invitation",
			where: [{
				field: "organizationId",
				value: organizationId
			}]
		});
		const emails = [...new Set(invitations.map((i) => normalizeEmail(i.email, ctx.context)))];
		const users = emails.length ? await ctx.context.adapter.findMany({
			model: "user",
			where: [{
				field: "email",
				value: emails,
				operator: "in"
			}]
		}) : [];
		const userByEmail = new Map(users.filter((u) => u.email != null).map((u) => [normalizeEmail(u.email, ctx.context), u]));
		return invitations.map((invitation) => {
			const invitationEmail = normalizeEmail(invitation.email, ctx.context);
			const user = userByEmail.get(invitationEmail);
			return {
				...invitation,
				user: user ? {
					id: user.id,
					name: user.name,
					email: user.email ?? void 0,
					image: user.image || null
				} : null
			};
		});
	});
};
const inviteMember = (options) => {
	return createAuthEndpoint("/dash/organization/invite-member", {
		method: "POST",
		body: z$1.object({
			email: z$1.string(),
			role: organizationMemberRoleInputSchema,
			invitedBy: z$1.string()
		}),
		use: [jwtMiddleware(options, z$1.object({
			organizationId: z$1.string(),
			invitedBy: z$1.string()
		}))]
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const organizationPlugin = requireOrganizationPlugin(ctx);
		validateOrganizationMemberRole(ctx, ctx.body.role, organizationPlugin.options);
		if (!organizationPlugin.options?.sendInvitationEmail) throw ctx.error("BAD_REQUEST", { message: "Invitation email is not enabled" });
		const invitedBy = await ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: ctx.context.payload.invitedBy
			}]
		});
		if (!invitedBy) throw ctx.error("BAD_REQUEST", { message: "Invited by user not found" });
		const invitationEmail = normalizeEmail(ctx.body.email, ctx.context);
		return await organizationPlugin.endpoints.createInvitation({
			headers: ctx.request?.headers ?? new Headers(),
			body: {
				email: invitationEmail,
				role: ctx.body.role,
				organizationId
			},
			context: {
				...ctx.context,
				session: {
					user: invitedBy,
					session: { userId: ctx.context.payload.invitedBy }
				},
				orgOptions: organizationPlugin.options || {}
			}
		});
	});
};
const checkUserByEmail = (options) => {
	return createAuthEndpoint("/dash/organization/check-user-by-email", {
		method: "POST",
		body: z$1.object({ email: z$1.string() }),
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))]
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		const { organizationId } = ctx.context.payload;
		const email = normalizeEmail(ctx.body.email, ctx.context);
		const user = await ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "email",
				value: email
			}]
		});
		if (!user) return {
			exists: false,
			user: null,
			isAlreadyMember: false
		};
		const existingMember = await ctx.context.adapter.findOne({
			model: "member",
			where: [{
				field: "userId",
				value: user.id
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		return {
			exists: true,
			user: {
				id: user.id,
				name: user.name,
				email: user.email ?? void 0,
				image: user.image ?? null
			},
			isAlreadyMember: !!existingMember
		};
	});
};
const cancelInvitation = (options) => {
	return createAuthEndpoint("/dash/organization/cancel-invitation", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({
			organizationId: z$1.string(),
			invitationId: z$1.string()
		}))],
		body: z$1.object({ invitationId: z$1.string() })
	}, async (ctx) => {
		const orgOptions = requireOrganizationPlugin(ctx).options || {};
		const { invitationId, organizationId } = ctx.context.payload;
		const invitation = await ctx.context.adapter.findOne({
			model: "invitation",
			where: [{
				field: "id",
				value: invitationId
			}]
		});
		if (!invitation) throw ctx.error("NOT_FOUND", { message: "Invitation not found" });
		const [user, organization] = await Promise.all([ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: invitation.inviterId
			}]
		}), ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		})]);
		if (!user) throw ctx.error("NOT_FOUND", { message: "Inviter user not found" });
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		if (orgOptions?.organizationHooks?.beforeCancelInvitation) await orgOptions.organizationHooks.beforeCancelInvitation({
			invitation,
			organization,
			cancelledBy: user
		});
		await ctx.context.adapter.update({
			model: "invitation",
			where: [{
				field: "id",
				value: invitationId
			}],
			update: { status: "canceled" }
		});
		if (orgOptions?.organizationHooks?.afterCancelInvitation) await orgOptions.organizationHooks.afterCancelInvitation({
			invitation: {
				...invitation,
				status: "canceled"
			},
			organization,
			cancelledBy: user
		});
		return { success: true };
	});
};
const resendInvitation = (options) => {
	return createAuthEndpoint("/dash/organization/resend-invitation", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({
			organizationId: z$1.string(),
			invitationId: z$1.string()
		}))],
		body: z$1.object({ invitationId: z$1.string() })
	}, async (ctx) => {
		const organizationPlugin = requireOrganizationPlugin(ctx);
		const { invitationId, organizationId } = ctx.context.payload;
		const invitation = await ctx.context.adapter.findOne({
			model: "invitation",
			where: [{
				field: "id",
				value: invitationId
			}]
		});
		if (!invitation) throw ctx.error("NOT_FOUND", { message: "Invitation not found" });
		if (invitation.status !== "pending") throw ctx.error("BAD_REQUEST", { message: "Only pending invitations can be resent" });
		const invitedByUser = await ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: invitation.inviterId
			}]
		});
		if (!invitedByUser) throw ctx.error("BAD_REQUEST", { message: "Inviter user not found" });
		if (!organizationPlugin.endpoints?.createInvitation) throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Organization plugin endpoints not available" });
		const invitationEmail = normalizeEmail(invitation.email, ctx.context);
		await organizationPlugin.endpoints.createInvitation({
			headers: ctx.request?.headers ?? new Headers(),
			body: {
				email: invitationEmail,
				role: invitation.role,
				organizationId,
				resend: true
			},
			context: {
				...ctx.context,
				session: {
					user: invitedByUser,
					session: { userId: invitation.inviterId }
				},
				orgOptions: organizationPlugin.options || {}
			}
		});
		return { success: true };
	});
};
//#endregion
//#region src/routes/organizations/members.ts
const listOrganizationMembers = (options) => {
	return createAuthEndpoint("/dash/organization/:id/members", {
		method: "GET",
		use: [jwtMiddleware(options)]
	}, async (ctx) => {
		if (!isOrganizationEnabled(ctx)) {
			ctx.context.logger.warn("[Dash] Organization plugin not enabled, returning empty members list");
			return [];
		}
		const organizationId = tryDecode(ctx.params.id);
		const members = await ctx.context.adapter.findMany({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId
			}],
			join: { user: true }
		});
		const invitations = await ctx.context.adapter.findMany({
			model: "invitation",
			where: [{
				field: "organizationId",
				value: organizationId
			}, {
				field: "status",
				value: "accepted"
			}],
			join: { user: true }
		});
		const inviterById = /* @__PURE__ */ new Map();
		for (const inv of invitations) {
			const inviter = Array.isArray(inv.user) ? inv.user[0] : inv.user;
			if (inviter && inv.inviterId) inviterById.set(inv.inviterId, inviter);
		}
		const invitationByEmail = new Map(invitations.map((i) => [i.email.toLowerCase(), i]));
		const result = [];
		for (const m of members) {
			const joinedUser = Array.isArray(m.user) ? m.user[0] : m.user;
			if (!joinedUser) continue;
			const invitation = joinedUser.email ? invitationByEmail.get(joinedUser.email.toLowerCase()) : void 0;
			const inviter = invitation ? inviterById.get(invitation.inviterId) : void 0;
			const user = {
				id: joinedUser.id,
				email: joinedUser.email ?? void 0,
				name: joinedUser.name,
				image: joinedUser.image ?? null
			};
			const invitedBy = inviter ? {
				id: inviter.id,
				name: inviter.name,
				email: inviter.email ?? void 0,
				image: inviter.image ?? null
			} : null;
			result.push({
				...m,
				user,
				invitedBy
			});
		}
		return result;
	});
};
const addMember = (options) => {
	return createAuthEndpoint("/dash/organization/add-member", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({
			userId: z$1.string(),
			role: organizationMemberRoleInputSchema
		})
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const orgOptions = requireOrganizationPlugin(ctx).options || {};
		validateOrganizationMemberRole(ctx, ctx.body.role, orgOptions);
		const organization = await ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		});
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		const user = await ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: ctx.body.userId
			}]
		});
		if (!user) throw ctx.error("NOT_FOUND", { message: "User not found" });
		let memberData = {
			organizationId,
			userId: ctx.body.userId,
			role: ctx.body.role,
			createdAt: /* @__PURE__ */ new Date()
		};
		if (orgOptions?.organizationHooks?.beforeAddMember) {
			const response = await orgOptions.organizationHooks.beforeAddMember({
				member: memberData,
				user,
				organization
			});
			if (response && typeof response === "object" && "data" in response) memberData = {
				...memberData,
				...response.data
			};
		}
		const member = await ctx.context.adapter.create({
			model: "member",
			data: memberData
		});
		if (orgOptions?.organizationHooks?.afterAddMember) await orgOptions.organizationHooks.afterAddMember({
			member,
			user,
			organization
		});
		return member;
	});
};
const removeMember = (options) => {
	return createAuthEndpoint("/dash/organization/remove-member", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({ memberId: z$1.string() })
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const orgOptions = requireOrganizationPlugin(ctx).options || {};
		const member = await ctx.context.adapter.findOne({
			model: "member",
			where: [{
				field: "id",
				value: ctx.body.memberId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!member) throw ctx.error("NOT_FOUND", { message: "Member not found" });
		const [user, organization] = await Promise.all([ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: member.userId
			}]
		}), ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		})]);
		if (!user) throw ctx.error("NOT_FOUND", { message: "User not found" });
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		if (orgOptions?.organizationHooks?.beforeRemoveMember) await orgOptions.organizationHooks.beforeRemoveMember({
			member,
			user,
			organization
		});
		if (orgOptions?.teams?.enabled) {
			const teamsInOrg = await ctx.context.adapter.findMany({
				model: "team",
				where: [{
					field: "organizationId",
					value: organizationId
				}]
			});
			if (teamsInOrg.length > 0) {
				const teamIds = teamsInOrg.map((t) => t.id);
				await ctx.context.adapter.deleteMany({
					model: "teamMember",
					where: [{
						field: "userId",
						value: member.userId
					}, {
						field: "teamId",
						value: teamIds,
						operator: "in"
					}]
				});
			}
		}
		await ctx.context.adapter.delete({
			model: "member",
			where: [{
				field: "id",
				value: ctx.body.memberId
			}]
		});
		if (orgOptions?.organizationHooks?.afterRemoveMember) await orgOptions.organizationHooks.afterRemoveMember({
			member,
			user,
			organization
		});
		return { success: true };
	});
};
const updateMemberRole = (options) => {
	return createAuthEndpoint("/dash/organization/update-member-role", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({
			memberId: z$1.string(),
			role: organizationMemberRoleInputSchema
		})
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const orgOptions = requireOrganizationPlugin(ctx).options || {};
		validateOrganizationMemberRole(ctx, ctx.body.role, orgOptions);
		const existingMember = await ctx.context.adapter.findOne({
			model: "member",
			where: [{
				field: "id",
				value: ctx.body.memberId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!existingMember) throw ctx.error("NOT_FOUND", { message: "Member not found" });
		const [user, organization] = await Promise.all([ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: existingMember.userId
			}]
		}), ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		})]);
		if (!user) throw ctx.error("NOT_FOUND", { message: "User not found" });
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		const previousRole = existingMember.role;
		let newRole = ctx.body.role;
		if (orgOptions?.organizationHooks?.beforeUpdateMemberRole) {
			const response = await orgOptions.organizationHooks.beforeUpdateMemberRole({
				member: existingMember,
				user,
				organization,
				newRole
			});
			if (response && typeof response === "object" && "data" in response) newRole = response.data.role || newRole;
		}
		const member = await ctx.context.adapter.update({
			model: "member",
			where: [{
				field: "id",
				value: ctx.body.memberId
			}],
			update: { role: newRole }
		});
		if (!member) throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to update member role" });
		if (orgOptions?.organizationHooks?.afterUpdateMemberRole) await orgOptions.organizationHooks.afterUpdateMemberRole({
			member,
			user,
			organization,
			previousRole
		});
		return member;
	});
};
//#endregion
//#region src/export-factory.ts
const exportFactory = (input, options) => async (ctx) => {
	const batchSize = options?.batchSize || 1e4;
	const staleMs = options?.staleMs || 300 * 1e3;
	const enabledFields = options?.enabledFields || [];
	const userLimit = input.limit;
	const userOffset = input.offset || 0;
	const abortController = new AbortController();
	let page = 0;
	let totalExported = 0;
	let staleTimeout;
	const resetTimeout = () => {
		clearTimeout(staleTimeout);
		staleTimeout = setTimeout(() => {
			abortController.abort();
		}, staleMs);
	};
	const stream = new ReadableStream({ async start(controller) {
		const start = performance.now();
		resetTimeout();
		try {
			while (true) {
				let effectiveBatchSize = batchSize;
				if (userLimit !== void 0) {
					const remaining = userLimit - totalExported;
					if (remaining <= 0) break;
					effectiveBatchSize = Math.min(batchSize, remaining);
				}
				const batch = await ctx.context.adapter.findMany({
					...input,
					limit: effectiveBatchSize,
					offset: userOffset + page * batchSize
				});
				resetTimeout();
				if (batch.length === 0) {
					if (page === 0) throw new APIError("FAILED_DEPENDENCY", { message: "Nothing found to export" });
					break;
				}
				let processedBatch = batch;
				if (enabledFields.length > 0) processedBatch = batch.map((item) => Object.fromEntries(enabledFields.map((key) => [key, item?.[key] ?? null])));
				const chunk = processedBatch.map((u) => options?.processRow ? options.processRow(u) : u).filter((v) => v !== void 0).map((u) => JSON.stringify(u)).join("\n") + "\n";
				controller.enqueue(new TextEncoder().encode(chunk));
				totalExported += batch.length;
				page++;
				if (userLimit !== void 0 && totalExported >= userLimit) break;
				resetTimeout();
			}
		} catch (err) {
			if (!abortController.signal.aborted) ctx.context.logger.error("[Dash] Export stream failed:", err);
		} finally {
			clearTimeout(staleTimeout);
			controller.close();
			const end = performance.now();
			ctx.context.logger.info(`[Dash] Export streamed ${totalExported} records in ${Math.round((end - start) / 1e3)}s` + (abortController.signal.aborted ? " (stale timeout)" : ""));
		}
	} });
	return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
};
//#endregion
//#region src/helper.ts
/**
* Returns true when sessions live exclusively in secondary storage
* (i.e. the user has configured secondaryStorage but has NOT enabled
* storeSessionInDatabase). In this case DB queries against the session
* model will return empty results and we must go through the
* internalAdapter instead.
*/
function isSessionInSecondaryStorageOnly(context) {
	return !!context.options.secondaryStorage && !context.options.session?.storeSessionInDatabase;
}
/**
* Checks whether a plugin is registered by its ID.
* Prefers the native `hasPlugin` when available, otherwise
* falls back to scanning `options.plugins`.
*/
function hasPlugin(context, pluginId) {
	if (typeof context.hasPlugin === "function") return context.hasPlugin(pluginId);
	return context.options.plugins?.some((p) => p.id === pluginId) ?? false;
}
function* chunkArray(arr, options) {
	const batchSize = options?.batchSize || 200;
	for (let i = 0; i < arr.length; i += batchSize) yield arr.slice(i, i + batchSize);
}
async function withConcurrency(items, fn, options) {
	const concurrency = options?.concurrency || 5;
	const results = [];
	const executing = [];
	const run = async () => {
		const batchResults = await Promise.all(executing);
		results.push(...batchResults);
		executing.length = 0;
	};
	for (const item of items) {
		executing.push(fn(item));
		if (executing.length >= concurrency) await run();
	}
	if (executing.length > 0) await run();
	return results;
}
//#endregion
//#region src/routes/organizations/schemas.ts
const DENIED_ORG_WRITE_KEYS = new Set([
	"id",
	"createdAt",
	"updatedAt"
]);
const CREATE_NON_PERSISTED_KEYS = new Set(["defaultTeamName"]);
const CREATE_REQUEST_ONLY_KEYS = new Set(["userId", "skipDefaultTeam"]);
const CORE_CREATE_KEYS = [
	"name",
	"slug",
	"logo"
];
const CORE_UPDATE_KEYS = [
	"name",
	"slug",
	"logo",
	"metadata"
];
function getOrganizationAdditionalFields(orgOptions) {
	return orgOptions?.schema?.organization?.additionalFields ?? {};
}
function getWritableOrganizationAdditionalFieldNames(orgOptions) {
	const additional = getOrganizationAdditionalFields(orgOptions);
	return Object.entries(additional).filter(([, field]) => {
		return field.input !== false;
	}).map(([name]) => name);
}
function getWritableOrganizationFieldNames(orgOptions, mode) {
	const keys = new Set(mode === "create" ? CORE_CREATE_KEYS : CORE_UPDATE_KEYS);
	for (const name of getWritableOrganizationAdditionalFieldNames(orgOptions)) keys.add(name);
	return keys;
}
/**
* Returns only organization fields that may be persisted on create/update.
* Strips unknown keys, denied keys, and create-only request fields.
*/
function pickWritableOrganizationFields(body, orgOptions, mode) {
	const allowed = getWritableOrganizationFieldNames(orgOptions, mode);
	const skip = new Set([
		...DENIED_ORG_WRITE_KEYS,
		...mode === "create" ? CREATE_NON_PERSISTED_KEYS : [],
		...mode === "create" ? CREATE_REQUEST_ONLY_KEYS : []
	]);
	const result = {};
	for (const [key, value] of Object.entries(body)) {
		if (skip.has(key) || !allowed.has(key) || value === void 0) continue;
		result[key] = value;
	}
	return result;
}
const BaseCreateOrgCoreBodySchema = z$1.object({
	name: z$1.string(),
	slug: z$1.string(),
	logo: z$1.string().optional(),
	defaultTeamName: z$1.string().optional()
});
const BaseUpdateOrgCoreBodySchema = z$1.object({
	logo: z$1.union([z$1.url(), z$1.literal("")]).optional(),
	name: z$1.string().optional(),
	slug: z$1.string().optional(),
	metadata: z$1.string().optional()
});
const CreateOrganizationBodySchema = BaseCreateOrgCoreBodySchema.catchall(z$1.unknown());
const UpdateOrganizationBodySchema = BaseUpdateOrgCoreBodySchema.catchall(z$1.unknown());
function createSchemaForDBField(field) {
	switch (field.type) {
		case "number": return field.required ? z$1.coerce.number() : z$1.coerce.number().optional();
		case "boolean": return field.required ? z$1.coerce.boolean() : z$1.coerce.boolean().optional();
		case "date": return field.required ? z$1.union([z$1.string().min(1), z$1.coerce.date()]) : z$1.union([z$1.string(), z$1.coerce.date()]).optional();
		default: return field.required ? z$1.string().min(1) : z$1.string().optional();
	}
}
/**
* Validates required core + configured additional fields on create.
* Call after pickWritableOrgFields if you need required additional field checks.
*/
function validateWritableCreateOrganizationFields(data, options) {
	const shape = {
		name: z$1.string().min(1),
		slug: z$1.string().min(1),
		logo: z$1.string().optional()
	};
	const additional = getOrganizationAdditionalFields(options);
	for (const [name, field] of Object.entries(additional)) {
		if (field.input === false) continue;
		shape[name] = createSchemaForDBField(field);
	}
	const result = z$1.object(shape).strict().safeParse(data);
	if (!result.success) throw result.error;
}
/**
* Ensures at least one field is present on update and validates additional field types.
*/
function validateWritableOrganizationUpdateFields(data, orgOptions) {
	if (Object.keys(data).length === 0) throw new z$1.ZodError([{
		code: "custom",
		message: "No valid fields to update",
		path: []
	}]);
	const shape = {
		name: z$1.string().min(1).optional(),
		slug: z$1.string().min(1).optional(),
		logo: z$1.union([z$1.url(), z$1.literal("")]).optional(),
		metadata: z$1.string().optional()
	};
	const additional = getOrganizationAdditionalFields(orgOptions);
	for (const [name, field] of Object.entries(additional)) {
		if (field.input === false) continue;
		shape[name] = createSchemaForDBField(field);
	}
	const result = z$1.object(shape).partial().strict().safeParse(data);
	if (!result.success) throw result.error;
}
//#endregion
//#region src/routes/organizations/organization.ts
const listOrganizations = (options) => {
	return createAuthEndpoint("/dash/list-organizations", {
		method: "GET",
		use: [jwtMiddleware(options)],
		query: z$1.object({
			limit: z$1.number().or(z$1.string().transform(Number)).optional(),
			offset: z$1.number().or(z$1.string().transform(Number)).optional(),
			sortBy: z$1.enum([
				"createdAt",
				"name",
				"slug",
				"members"
			]).optional(),
			sortOrder: z$1.enum(["asc", "desc"]).optional(),
			filterMembers: z$1.enum([
				"abandoned",
				"eq1",
				"gt1",
				"gt5",
				"gt10"
			]).optional(),
			search: z$1.string().optional(),
			startDate: z$1.date().or(z$1.string().transform((val) => new Date(val))).optional(),
			endDate: z$1.date().or(z$1.string().transform((val) => new Date(val))).optional()
		}).optional()
	}, async (ctx) => {
		const { limit = 10, offset = 0, sortBy = "createdAt", sortOrder = "desc", search, filterMembers } = ctx.query || {};
		if (!isOrganizationEnabled(ctx)) {
			ctx.context.logger.warn("[Dash] Organization plugin not enabled, returning empty organizations list");
			return {
				organizations: [],
				total: 0,
				offset,
				limit
			};
		}
		const where = [];
		if (search && search.trim().length > 0) {
			const searchTerm = search.trim();
			where.push({
				field: "name",
				value: searchTerm,
				operator: "starts_with",
				mode: "insensitive",
				connector: "OR"
			}, {
				field: "slug",
				value: searchTerm,
				operator: "starts_with",
				mode: "insensitive",
				connector: "OR"
			});
		}
		if (ctx.query?.startDate) where.push({
			field: "createdAt",
			value: ctx.query.startDate,
			operator: "gte"
		});
		if (ctx.query?.endDate) where.push({
			field: "createdAt",
			value: ctx.query.endDate,
			operator: "lte"
		});
		const needsInMemoryProcessing = sortBy === "members" || !!filterMembers;
		const dbSortBy = sortBy === "members" ? "createdAt" : sortBy;
		const fetchLimit = needsInMemoryProcessing ? 2500 : limit;
		const fetchOffset = needsInMemoryProcessing ? 0 : offset;
		const [organizations, initialTotal] = await Promise.all([ctx.context.adapter.findMany({
			model: "organization",
			where,
			limit: fetchLimit,
			offset: fetchOffset,
			sortBy: {
				field: dbSortBy,
				direction: sortOrder
			},
			join: { member: { limit: 5 } }
		}), needsInMemoryProcessing ? Promise.resolve(0) : ctx.context.adapter.count({
			model: "organization",
			where
		})]);
		const orgIds = organizations.map((o) => o.id);
		const memberCounts = await withConcurrency(orgIds, (orgId) => ctx.context.adapter.count({
			model: "member",
			where: [{
				field: "organizationId",
				value: orgId
			}]
		}), { concurrency: 10 });
		const memberCountByOrg = new Map(orgIds.map((orgId, i) => [orgId, memberCounts[i]]));
		let withCounts = organizations.map((organization) => {
			const memberCount = memberCountByOrg.get(organization.id) ?? 0;
			return {
				...organization,
				memberCount
			};
		});
		if (filterMembers) {
			const predicate = {
				abandoned: (c) => c === 0,
				eq1: (c) => c === 1,
				gt1: (c) => c > 1,
				gt5: (c) => c > 5,
				gt10: (c) => c > 10
			}[filterMembers];
			if (predicate) withCounts = withCounts.filter((o) => predicate(o.memberCount));
		}
		if (sortBy === "members") {
			const dir = sortOrder === "asc" ? 1 : -1;
			withCounts.sort((a, b) => (a.memberCount - b.memberCount) * dir);
		}
		const total = needsInMemoryProcessing ? withCounts.length : initialTotal;
		if (needsInMemoryProcessing) withCounts = withCounts.slice(offset, offset + limit);
		const allUserIds = /* @__PURE__ */ new Set();
		for (const organization of withCounts) for (const member of organization.member) allUserIds.add(member.userId);
		const users = allUserIds.size > 0 ? await ctx.context.adapter.findMany({
			model: "user",
			where: [{
				field: "id",
				value: Array.from(allUserIds),
				operator: "in"
			}],
			limit: allUserIds.size
		}) : [];
		const userMap = new Map(users.map((u) => [u.id, u]));
		return {
			organizations: withCounts.map((organization) => {
				const members = organization.member.map((m) => userMap.get(m.userId)).filter((u) => u !== void 0).map((u) => ({
					id: u.id,
					name: u.name,
					email: u.email ?? void 0,
					image: u.image ?? null
				}));
				const { member: _members, ...org } = organization;
				return {
					...org,
					members
				};
			}),
			total,
			offset,
			limit
		};
	});
};
function parseWhereClause$1(val) {
	if (!val) return [];
	const parsed = JSON.parse(val);
	if (!Array.isArray(parsed)) return [];
	return parsed;
}
const exportOrganizationsQuerySchema = z$1.object({
	limit: z$1.number().or(z$1.string().transform(Number)).optional(),
	offset: z$1.number().or(z$1.string().transform(Number)).optional(),
	sortBy: z$1.string().optional(),
	sortOrder: z$1.enum(["asc", "desc"]).optional(),
	where: z$1.string().transform(parseWhereClause$1).optional()
}).optional();
const exportOrganizations = (options) => {
	return createAuthEndpoint("/dash/export-organizations", {
		method: "GET",
		use: [jwtMiddleware(options)],
		query: exportOrganizationsQuerySchema
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		const sortBy = ctx.query?.sortBy || "createdAt";
		const sortOrder = ctx.query?.sortOrder || "desc";
		return exportFactory({
			model: "organization",
			limit: ctx.query?.limit,
			offset: ctx.query?.offset ?? 0,
			sortBy: {
				field: sortBy,
				direction: sortOrder
			},
			where: ctx.query?.where
		})(ctx);
	});
};
const getOrganizationOptions = (options) => {
	return createAuthEndpoint("/dash/organization/options", {
		method: "GET",
		use: [jwtMiddleware(options)]
	}, async (ctx) => {
		const organizationPlugin = ctx.context.getPlugin("organization");
		if (!organizationPlugin) return { teamsEnabled: false };
		return { teamsEnabled: Boolean(organizationPlugin.options?.teams?.enabled && organizationPlugin.options.teams.defaultTeam?.enabled !== false) };
	});
};
const getOrganization = (options) => {
	return createAuthEndpoint("/dash/organization/:id", {
		method: "GET",
		use: [jwtMiddleware(options)]
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		const decodedOrganizationId = tryDecode(ctx.params.id);
		const organization = (await ctx.context.adapter.findMany({
			model: "organization",
			where: [{
				field: "id",
				value: decodedOrganizationId
			}],
			limit: 1
		}))[0];
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		const membersCount = await ctx.context.adapter.count({
			model: "member",
			where: [{
				field: "organizationId",
				value: organization.id
			}]
		});
		return {
			...organization,
			memberCount: membersCount
		};
	});
};
const deleteOrganization = (options) => {
	return createAuthEndpoint("/dash/organization/delete", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({ organizationId: z$1.string() })
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const { organizationId: bodyOrganizationId } = ctx.body;
		const orgOptions = requireOrganizationPlugin(ctx).options || {};
		if (organizationId !== bodyOrganizationId) throw ctx.error("BAD_REQUEST", { message: "Organization ID mismatch" });
		const owners = await ctx.context.adapter.findMany({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId
			}, {
				field: "role",
				value: "owner"
			}],
			sortBy: {
				field: "createdAt",
				direction: "asc"
			},
			limit: 1,
			join: { user: true }
		});
		if (owners.length === 0) throw ctx.error("NOT_FOUND", { message: "Owner user not found" });
		const owner = owners[0];
		const deletedByUser = Array.isArray(owner.user) ? owner.user[0] : owner.user;
		if (!deletedByUser) throw ctx.error("NOT_FOUND", { message: "Owner user not found" });
		const organization = await ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		});
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		if (orgOptions?.organizationHooks?.beforeDeleteOrganization) await orgOptions.organizationHooks.beforeDeleteOrganization({
			organization,
			user: deletedByUser
		});
		await ctx.context.adapter.delete({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		});
		if (orgOptions?.organizationHooks?.afterDeleteOrganization) await orgOptions.organizationHooks.afterDeleteOrganization({
			organization,
			user: deletedByUser
		});
		return { success: true };
	});
};
const deleteManyOrganizations = (options) => {
	return createAuthEndpoint("/dash/organization/delete-many", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationIds: z$1.string().array() }))]
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		const { organizationIds } = ctx.context.payload;
		const deletedOrgIds = /* @__PURE__ */ new Set();
		const skippedOrgIds = /* @__PURE__ */ new Set();
		const start = performance.now();
		await withConcurrency(chunkArray(organizationIds), async (chunk) => {
			const where = [{
				field: "id",
				value: chunk,
				operator: "in"
			}];
			await ctx.context.adapter.deleteMany({
				model: "organization",
				where
			});
			const remainingOrgs = await ctx.context.adapter.findMany({
				model: "organization",
				where
			});
			for (const id of chunk) if (!remainingOrgs.some((u) => u.id === id)) deletedOrgIds.add(id);
			else skippedOrgIds.add(id);
		});
		const end = performance.now();
		console.log(`Time taken to bulk delete ${deletedOrgIds.size} organizations: ${Math.round((end - start) / 1e3)}s`, skippedOrgIds.size > 0 ? `Failed: ${skippedOrgIds.size}` : "");
		return {
			success: deletedOrgIds.size > 0,
			deletedOrgIds: Array.from(deletedOrgIds),
			skippedOrgIds: Array.from(skippedOrgIds)
		};
	});
};
const createOrganization = (options) => {
	return createAuthEndpoint("/dash/organization/create", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({
			userId: z$1.string(),
			skipDefaultTeam: z$1.boolean().optional().default(false)
		}))],
		body: CreateOrganizationBodySchema
	}, async (ctx) => {
		const orgOptions = requireOrganizationPlugin(ctx).options || {};
		const { userId } = ctx.context.payload;
		const defaultTeamName = ctx.body.defaultTeamName;
		const user = await ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: userId
			}]
		});
		if (!user) throw ctx.error("BAD_REQUEST", { message: "User not found" });
		if (await ctx.context.adapter.count({
			model: "organization",
			where: [{
				field: "slug",
				value: ctx.body.slug
			}]
		}) > 0) throw ctx.error("BAD_REQUEST", { message: "Organization already exists" });
		let orgData = pickWritableOrganizationFields(ctx.body, orgOptions, "create");
		try {
			validateWritableCreateOrganizationFields(orgData, orgOptions);
		} catch (error) {
			if (error instanceof z$1.ZodError) throw ctx.error("BAD_REQUEST", { message: error.issues[0]?.message ?? "Invalid organization data" });
			throw error;
		}
		if (orgOptions.organizationCreation?.beforeCreate) {
			const response = await orgOptions.organizationCreation.beforeCreate({
				organization: {
					...orgData,
					createdAt: /* @__PURE__ */ new Date()
				},
				user
			}, ctx.request);
			if (response && typeof response === "object" && "data" in response) orgData = pickWritableOrganizationFields({
				...orgData,
				...response.data
			}, orgOptions, "create");
		}
		if (orgOptions?.organizationHooks?.beforeCreateOrganization) {
			const response = await orgOptions?.organizationHooks.beforeCreateOrganization({
				organization: orgData,
				user
			});
			if (response && typeof response === "object" && "data" in response) orgData = pickWritableOrganizationFields({
				...orgData,
				...response.data
			}, orgOptions, "create");
		}
		const organization = await ctx.context.adapter.create({
			model: "organization",
			data: {
				...orgData,
				createdAt: /* @__PURE__ */ new Date()
			}
		});
		let member;
		let data = {
			userId: user.id,
			organizationId: organization.id,
			role: orgOptions.creatorRole || "owner"
		};
		if (orgOptions?.organizationHooks?.beforeAddMember) {
			const response = await orgOptions?.organizationHooks.beforeAddMember({
				member: {
					userId: user.id,
					organizationId: organization.id,
					role: orgOptions.creatorRole || "owner",
					createdAt: /* @__PURE__ */ new Date(),
					updatedAt: /* @__PURE__ */ new Date()
				},
				user,
				organization
			});
			if (response && typeof response === "object" && "data" in response) data = {
				...data,
				...response.data
			};
		}
		member = await ctx.context.adapter.create({
			model: "member",
			data: {
				userId: data.userId,
				organizationId: data.organizationId,
				role: data.role,
				createdAt: /* @__PURE__ */ new Date()
			}
		});
		if (orgOptions?.organizationHooks?.afterAddMember) await orgOptions.organizationHooks.afterAddMember({
			member,
			user,
			organization
		});
		if (orgOptions?.teams?.enabled && orgOptions.teams.defaultTeam?.enabled !== false && !ctx.context.payload.skipDefaultTeam) {
			let teamData = {
				organizationId: organization.id,
				name: defaultTeamName || `${organization.name}`,
				createdAt: /* @__PURE__ */ new Date()
			};
			if (orgOptions?.organizationHooks?.beforeCreateTeam) {
				const response = await orgOptions?.organizationHooks.beforeCreateTeam({
					team: {
						organizationId: organization.id,
						name: teamData.name
					},
					user,
					organization
				});
				if (response && typeof response === "object" && "data" in response) teamData = {
					...teamData,
					...response.data
				};
			}
			const defaultTeam = await orgOptions.teams.defaultTeam?.customCreateDefaultTeam?.(organization, ctx) || await ctx.context.adapter.create({
				model: "team",
				data: teamData
			});
			if (!await ctx.context.adapter.findOne({
				model: "teamMember",
				where: [{
					field: "teamId",
					value: defaultTeam.id
				}, {
					field: "userId",
					value: user.id
				}]
			})) await ctx.context.adapter.create({
				model: "teamMember",
				data: {
					teamId: defaultTeam.id,
					userId: user.id,
					role: "owner"
				}
			});
			if (orgOptions?.organizationHooks?.afterCreateTeam) await orgOptions.organizationHooks.afterCreateTeam({
				team: defaultTeam,
				user,
				organization
			});
		}
		if (orgOptions.organizationCreation?.afterCreate) await orgOptions.organizationCreation.afterCreate({
			organization,
			user,
			member
		}, ctx.request);
		if (orgOptions?.organizationHooks?.afterCreateOrganization) await orgOptions?.organizationHooks.afterCreateOrganization({
			organization,
			user,
			member
		});
		return {
			...organization,
			members: [member]
		};
	});
};
const updateOrganization = (options) => {
	return createAuthEndpoint("/dash/organization/update", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: UpdateOrganizationBodySchema
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const orgOptions = requireOrganizationPlugin(ctx).options || {};
		if (ctx.body.slug) {
			const orgWithSlug = await ctx.context.adapter.findOne({
				model: "organization",
				where: [{
					field: "slug",
					value: ctx.body.slug
				}],
				select: ["id"]
			});
			if (orgWithSlug && orgWithSlug.id !== organizationId) throw ctx.error("BAD_REQUEST", { message: "Slug already exists" });
		}
		const owners = await ctx.context.adapter.findMany({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId
			}, {
				field: "role",
				value: "owner"
			}],
			sortBy: {
				field: "createdAt",
				direction: "asc"
			},
			limit: 1,
			join: { user: true }
		});
		if (owners.length === 0) throw ctx.error("NOT_FOUND", { message: "Owner user not found" });
		const owner = owners[0];
		const updatedByUser = Array.isArray(owner.user) ? owner.user[0] : owner.user;
		if (!updatedByUser) throw ctx.error("NOT_FOUND", { message: "Owner user not found" });
		let updateData = pickWritableOrganizationFields(ctx.body, orgOptions, "update");
		try {
			validateWritableOrganizationUpdateFields(updateData, orgOptions);
		} catch (error) {
			if (error instanceof z$1.ZodError) throw ctx.error("BAD_REQUEST", { message: error.issues[0]?.message ?? "Invalid organization data" });
			throw error;
		}
		if (typeof updateData.metadata === "string") try {
			updateData.metadata = updateData.metadata === "" ? void 0 : JSON.parse(updateData.metadata);
		} catch (parseError) {
			ctx.context.logger.debug("[Dash] Invalid organization metadata JSON:", parseError);
			throw ctx.error("BAD_REQUEST", { message: "Invalid metadata: must be valid JSON" });
		}
		if (orgOptions?.organizationHooks?.beforeUpdateOrganization) {
			const response = await orgOptions?.organizationHooks.beforeUpdateOrganization({
				organization: updateData,
				user: updatedByUser,
				member: owner
			});
			if (response && typeof response === "object" && "data" in response) updateData = pickWritableOrganizationFields({
				...updateData,
				...response.data
			}, orgOptions, "update");
		}
		const organization = await ctx.context.adapter.update({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}],
			update: {
				...updateData,
				metadata: typeof updateData.metadata === "object" ? JSON.stringify(updateData.metadata) : updateData.metadata
			}
		});
		if (!organization) throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to update organization" });
		if (orgOptions?.organizationHooks?.afterUpdateOrganization) await orgOptions?.organizationHooks.afterUpdateOrganization({
			organization,
			user: updatedByUser,
			member: owner
		});
		return organization;
	});
};
//#endregion
//#region src/routes/organizations/teams.ts
const listOrganizationTeams = (options) => {
	return createAuthEndpoint("/dash/organization/:id/teams", {
		method: "GET",
		use: [jwtMiddleware(options)]
	}, async (ctx) => {
		if (!isTeamsEnabled(ctx)) {
			ctx.context.logger.warn("[Dash] Organization plugin or teams not enabled, returning empty teams list");
			return [];
		}
		const organizationId = tryDecode(ctx.params.id);
		try {
			const teams = await ctx.context.adapter.findMany({
				model: "team",
				where: [{
					field: "organizationId",
					value: organizationId
				}]
			});
			return await Promise.all(teams.map(async (team) => {
				let memberCount = 0;
				try {
					memberCount = await ctx.context.adapter.count({
						model: "teamMember",
						where: [{
							field: "teamId",
							value: team.id
						}]
					});
				} catch (error) {
					ctx.context.logger.warn("[Dash] Failed to count team members:", error);
					memberCount = 0;
				}
				return {
					...team,
					memberCount
				};
			}));
		} catch (error) {
			ctx.context.logger.warn("[Dash] Failed to list organization teams:", error);
			return [];
		}
	});
};
const updateTeam = (options) => {
	return createAuthEndpoint("/dash/organization/update-team", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({
			teamId: z$1.string(),
			name: z$1.string().optional()
		})
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const orgOptions = requireTeamsEnabled(ctx);
		const existingTeam = await ctx.context.adapter.findOne({
			model: "team",
			where: [{
				field: "id",
				value: ctx.body.teamId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!existingTeam) throw ctx.error("NOT_FOUND", { message: "Team not found" });
		const organization = await ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		});
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		const owners = await ctx.context.adapter.findMany({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId
			}, {
				field: "role",
				value: "owner"
			}],
			sortBy: {
				field: "createdAt",
				direction: "asc"
			},
			limit: 1,
			join: { user: true }
		});
		if (owners.length === 0) throw ctx.error("NOT_FOUND", { message: "Owner not found" });
		const owner = owners[0];
		const user = Array.isArray(owner.user) ? owner.user[0] : owner.user;
		if (!user) throw ctx.error("NOT_FOUND", { message: "Owner user not found" });
		let updateData = { updatedAt: /* @__PURE__ */ new Date() };
		if (ctx.body.name) updateData.name = ctx.body.name;
		if (orgOptions?.organizationHooks?.beforeUpdateTeam) {
			const response = await orgOptions.organizationHooks.beforeUpdateTeam({
				team: existingTeam,
				updates: updateData,
				user,
				organization
			});
			if (response && typeof response === "object" && "data" in response) updateData = {
				...updateData,
				...response.data
			};
		}
		const team = await ctx.context.adapter.update({
			model: "team",
			where: [{
				field: "id",
				value: ctx.body.teamId
			}],
			update: updateData
		});
		if (!team) throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to update team" });
		if (orgOptions?.organizationHooks?.afterUpdateTeam) await orgOptions.organizationHooks.afterUpdateTeam({
			team,
			user,
			organization
		});
		return team;
	});
};
const deleteTeam = (options) => {
	return createAuthEndpoint("/dash/organization/delete-team", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({ teamId: z$1.string() })
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const orgOptions = requireTeamsEnabled(ctx);
		const team = await ctx.context.adapter.findOne({
			model: "team",
			where: [{
				field: "id",
				value: ctx.body.teamId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!team) throw ctx.error("NOT_FOUND", { message: "Team not found" });
		const organization = await ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		});
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		if (orgOptions?.teams?.allowRemovingAllTeams === false) {
			if (await ctx.context.adapter.count({
				model: "team",
				where: [{
					field: "organizationId",
					value: organizationId
				}]
			}) <= 1) throw ctx.error("BAD_REQUEST", { message: "Cannot remove the last team in the organization" });
		}
		const owners = await ctx.context.adapter.findMany({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId
			}, {
				field: "role",
				value: "owner"
			}],
			sortBy: {
				field: "createdAt",
				direction: "asc"
			},
			limit: 1,
			join: { user: true }
		});
		if (owners.length === 0) throw ctx.error("NOT_FOUND", { message: "Owner not found" });
		const owner = owners[0];
		const user = Array.isArray(owner.user) ? owner.user[0] : owner.user;
		if (!user) throw ctx.error("NOT_FOUND", { message: "Owner user not found" });
		if (orgOptions?.organizationHooks?.beforeDeleteTeam) await orgOptions.organizationHooks.beforeDeleteTeam({
			team,
			user,
			organization
		});
		await ctx.context.adapter.delete({
			model: "team",
			where: [{
				field: "id",
				value: ctx.body.teamId
			}]
		});
		if (orgOptions?.organizationHooks?.afterDeleteTeam) await orgOptions.organizationHooks.afterDeleteTeam({
			team,
			user,
			organization
		});
		return { success: true };
	});
};
const createTeam = (options) => {
	return createAuthEndpoint("/dash/organization/create-team", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({ name: z$1.string() })
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const orgOptions = requireTeamsEnabled(ctx);
		const organization = await ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		});
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		if (orgOptions?.teams?.maximumTeams) {
			const teamsCount = await ctx.context.adapter.count({
				model: "team",
				where: [{
					field: "organizationId",
					value: organizationId
				}]
			});
			const maxTeams = typeof orgOptions.teams.maximumTeams === "function" ? await orgOptions.teams.maximumTeams({
				organizationId,
				session: null
			}) : orgOptions.teams.maximumTeams;
			if (teamsCount >= maxTeams) throw ctx.error("BAD_REQUEST", { message: `Maximum number of teams (${maxTeams}) reached for this organization` });
		}
		const owners = await ctx.context.adapter.findMany({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId
			}, {
				field: "role",
				value: "owner"
			}],
			sortBy: {
				field: "createdAt",
				direction: "asc"
			},
			limit: 1,
			join: { user: true }
		});
		if (owners.length === 0) throw ctx.error("NOT_FOUND", { message: "Owner not found" });
		const owner = owners[0];
		const user = Array.isArray(owner.user) ? owner.user[0] : owner.user;
		if (!user) throw ctx.error("NOT_FOUND", { message: "Owner user not found" });
		let teamData = {
			name: ctx.body.name,
			organizationId,
			createdAt: /* @__PURE__ */ new Date()
		};
		if (orgOptions?.organizationHooks?.beforeCreateTeam) {
			const response = await orgOptions.organizationHooks.beforeCreateTeam({
				team: teamData,
				user,
				organization
			});
			if (response && typeof response === "object" && "data" in response) teamData = {
				...teamData,
				...response.data
			};
		}
		const team = await ctx.context.adapter.create({
			model: "team",
			data: teamData
		});
		if (orgOptions?.organizationHooks?.afterCreateTeam) await orgOptions.organizationHooks.afterCreateTeam({
			team,
			user,
			organization
		});
		return team;
	});
};
const listTeamMembers = (options) => {
	return createAuthEndpoint("/dash/organization/:orgId/teams/:teamId/members", {
		method: "GET",
		use: [jwtMiddleware(options)]
	}, async (ctx) => {
		if (!isTeamsEnabled(ctx)) {
			ctx.context.logger.warn("[Dash] Organization plugin or teams not enabled, returning empty team members list");
			return [];
		}
		const orgId = tryDecode(ctx.params.orgId);
		const teamId = tryDecode(ctx.params.teamId);
		try {
			if (await ctx.context.adapter.count({
				model: "team",
				where: [{
					field: "id",
					value: teamId
				}, {
					field: "organizationId",
					value: orgId
				}]
			}) === 0) throw ctx.error("NOT_FOUND", { message: "Team not found" });
			return (await ctx.context.adapter.findMany({
				model: "teamMember",
				where: [{
					field: "teamId",
					value: teamId
				}],
				join: { user: true }
			})).map((tm) => {
				const user = Array.isArray(tm.user) ? tm.user[0] : tm.user;
				return {
					...tm,
					user: user ? {
						id: user.id,
						name: user.name,
						email: user.email ?? void 0,
						image: user.image ?? null
					} : null
				};
			});
		} catch (e) {
			ctx.context.logger.warn("[Dash] Failed to list team members:", e);
			return [];
		}
	});
};
const addTeamMember = (options) => {
	return createAuthEndpoint("/dash/organization/add-team-member", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({
			teamId: z$1.string(),
			userId: z$1.string()
		})
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const orgOptions = requireTeamsEnabled(ctx);
		const team = await ctx.context.adapter.findOne({
			model: "team",
			where: [{
				field: "id",
				value: ctx.body.teamId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!team) throw ctx.error("NOT_FOUND", { message: "Team not found" });
		const organization = await ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		});
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		const user = await ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: ctx.body.userId
			}]
		});
		if (!user) throw ctx.error("NOT_FOUND", { message: "User not found" });
		if (!await ctx.context.adapter.findOne({
			model: "member",
			where: [{
				field: "userId",
				value: ctx.body.userId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		})) throw ctx.error("BAD_REQUEST", { message: "User is not a member of this organization" });
		if (await ctx.context.adapter.count({
			model: "teamMember",
			where: [{
				field: "teamId",
				value: ctx.body.teamId
			}, {
				field: "userId",
				value: ctx.body.userId
			}]
		}) > 0) throw ctx.error("BAD_REQUEST", { message: "User is already a member of this team" });
		if (orgOptions?.teams?.maximumMembersPerTeam) {
			const teamMemberCount = await ctx.context.adapter.count({
				model: "teamMember",
				where: [{
					field: "teamId",
					value: ctx.body.teamId
				}]
			});
			const maxMembers = typeof orgOptions.teams.maximumMembersPerTeam === "function" ? await orgOptions.teams.maximumMembersPerTeam({
				teamId: ctx.body.teamId,
				organizationId,
				session: null
			}) : orgOptions.teams.maximumMembersPerTeam;
			if (teamMemberCount >= maxMembers) throw ctx.error("BAD_REQUEST", { message: `Maximum number of team members (${maxMembers}) reached for this team` });
		}
		let teamMemberData = {
			teamId: ctx.body.teamId,
			userId: ctx.body.userId,
			createdAt: /* @__PURE__ */ new Date()
		};
		if (orgOptions?.organizationHooks?.beforeAddTeamMember) {
			const response = await orgOptions.organizationHooks.beforeAddTeamMember({
				teamMember: teamMemberData,
				team,
				user,
				organization
			});
			if (response && typeof response === "object" && "data" in response) teamMemberData = {
				...teamMemberData,
				...response.data
			};
		}
		const teamMember = await ctx.context.adapter.create({
			model: "teamMember",
			data: teamMemberData
		});
		if (orgOptions?.organizationHooks?.afterAddTeamMember) await orgOptions.organizationHooks.afterAddTeamMember({
			teamMember,
			team,
			user,
			organization
		});
		return teamMember;
	});
};
const removeTeamMember = (options) => {
	return createAuthEndpoint("/dash/organization/remove-team-member", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({
			teamId: z$1.string(),
			userId: z$1.string()
		})
	}, async (ctx) => {
		const { organizationId } = ctx.context.payload;
		const orgOptions = requireTeamsEnabled(ctx);
		const team = await ctx.context.adapter.findOne({
			model: "team",
			where: [{
				field: "id",
				value: ctx.body.teamId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!team) throw ctx.error("NOT_FOUND", { message: "Team not found" });
		const organization = await ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "id",
				value: organizationId
			}]
		});
		if (!organization) throw ctx.error("NOT_FOUND", { message: "Organization not found" });
		const user = await ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: ctx.body.userId
			}]
		});
		if (!user) throw ctx.error("NOT_FOUND", { message: "User not found" });
		const teamMember = await ctx.context.adapter.findOne({
			model: "teamMember",
			where: [{
				field: "teamId",
				value: ctx.body.teamId
			}, {
				field: "userId",
				value: ctx.body.userId
			}]
		});
		if (!teamMember) throw ctx.error("NOT_FOUND", { message: "User is not a member of this team" });
		if (orgOptions?.organizationHooks?.beforeRemoveTeamMember) await orgOptions.organizationHooks.beforeRemoveTeamMember({
			teamMember,
			team,
			user,
			organization
		});
		await ctx.context.adapter.delete({
			model: "teamMember",
			where: [{
				field: "teamId",
				value: ctx.body.teamId
			}, {
				field: "userId",
				value: ctx.body.userId
			}]
		});
		if (orgOptions?.organizationHooks?.afterRemoveTeamMember) await orgOptions.organizationHooks.afterRemoveTeamMember({
			teamMember,
			team,
			user,
			organization
		});
		return { success: true };
	});
};
//#endregion
//#region src/routes/sessions/index.ts
const revokeSession = (options) => createAuthEndpoint("/dash/sessions/revoke", {
	method: "POST",
	use: [jwtMiddleware(options)],
	metadata: { allowedMediaTypes: ["application/json", ""] }
}, async (ctx) => {
	const { sessionId, userId } = ctx.context.payload;
	if (!sessionId || !userId) throw ctx.error("FORBIDDEN", { message: "Invalid payload" });
	let sessionToken;
	if (isSessionInSecondaryStorageOnly(ctx.context)) {
		const match = (await ctx.context.internalAdapter.listSessions(userId)).find((s) => s.id === sessionId || s.token === sessionId);
		if (!match) throw ctx.error("NOT_FOUND", { message: "Session not found" });
		sessionToken = match.token;
	} else {
		const session = await ctx.context.adapter.findOne({
			model: "session",
			where: [{
				field: "id",
				value: sessionId
			}, {
				field: "userId",
				value: userId
			}]
		});
		if (!session) throw ctx.error("NOT_FOUND", { message: "Session not found" });
		sessionToken = session.token;
	}
	await ctx.context.internalAdapter.deleteSession(sessionToken);
	return ctx.json({ success: true });
});
const revokeAllSessions = (options) => createAuthEndpoint("/dash/sessions/revoke-all", {
	method: "POST",
	use: [jwtMiddleware(options)],
	body: z$1.object({ userId: z$1.string() })
}, async (ctx) => {
	const { userId } = ctx.body;
	if (!await ctx.context.internalAdapter.findUserById(userId)) throw ctx.error("NOT_FOUND", { message: "User not found" });
	await ctx.context.internalAdapter.deleteSessions(userId);
	return ctx.json({ success: true });
});
const revokeManySessions = (options) => createAuthEndpoint("/dash/sessions/revoke-many", {
	method: "POST",
	use: [jwtMiddleware(options, z$1.object({ userIds: z$1.string().array() }))]
}, async (ctx) => {
	const { userIds } = ctx.context.payload;
	await withConcurrency(chunkArray(userIds, { batchSize: 50 }), async (chunk) => {
		for (const userId of chunk) await ctx.context.internalAdapter.deleteSessions(userId);
	}, { concurrency: 3 });
	return ctx.json({
		success: true,
		revokedCount: userIds.length
	});
});
//#endregion
//#region ../utils/dist/ip.mjs
/**
* SSRF (Server-Side Request Forgery) Protection
*
* IP and URL utilities to validate hostnames and URLs before server-side fetches.
* Blocks requests to private/reserved networks. Covers IPv4 private ranges,
* IPv6 private ranges, and IPv4-mapped IPv6 bypass vectors.
*/
function isPrivateIPv4(a, b) {
	if (a === 10) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 0) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	return false;
}
/**
* Loopback, RFC1918, link-local, CGNAT, ULA, documentation, NAT64 well-known,
* IPv4-mapped private, unspecified, and multicast (RFC 4291 section 2.7).
*/
function ipv6GroupsAreNonPublic(groups) {
	if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true;
	if (groups.every((g) => g === 0)) return true;
	if ((groups[0] & 65472) === 65152) return true;
	if ((groups[0] & 65024) === 64512) return true;
	if ((groups[0] & 65280) === 65280) return true;
	if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 65535) return isPrivateIPv4(groups[6] >> 8 & 255, groups[6] & 255);
	if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 && groups[4] === 65535 && groups[5] === 0) return isPrivateIPv4(groups[6] >> 8 & 255, groups[6] & 255);
	if (groups[0] === 100 && groups[1] === 65435 && groups.slice(2, 6).every((g) => g === 0)) return isPrivateIPv4(groups[6] >> 8 & 255, groups[6] & 255);
	if (groups[0] === 8193 && groups[1] === 3512) return true;
	if (groups[0] === 256 && groups.slice(1, 4).every((g) => g === 0)) return true;
	return false;
}
function parseIPv6(addr) {
	const sides = addr.split("::");
	if (sides.length > 2) return null;
	const parseGroups = (s) => s === "" ? [] : s.split(":").map((g) => parseInt(g, 16));
	const left = parseGroups(sides[0]);
	const right = sides.length === 2 ? parseGroups(sides[1]) : [];
	if (left.some(isNaN) || right.some(isNaN)) return null;
	const missing = 8 - left.length - right.length;
	if (sides.length === 2) {
		if (missing < 0) return null;
		return [
			...left,
			...Array(missing).fill(0),
			...right
		];
	}
	if (left.length !== 8) return null;
	return left;
}
/** Returns true if the hostname resolves to a private/reserved IP or is a local hostname. */
function isPrivateHost(hostname) {
	if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) return true;
	const bare = hostname.replace(/^\[|\]$/g, "");
	const v4parts = bare.split(".").map(Number);
	if (v4parts.length === 4 && v4parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) return isPrivateIPv4(v4parts[0], v4parts[1]);
	const groups = parseIPv6(bare);
	if (groups && groups.length === 8) return ipv6GroupsAreNonPublic(groups);
	return false;
}
//#endregion
//#region ../utils/dist/url.mjs
/**
* URL helpers: normalization, SSRF-safe parsing/validation, and path/query segments.
*/
const HTTP_PROTOCOLS = ["http:", "https:"];
function isAllowedProtocol(protocol, allowedProtocols) {
	return (allowedProtocols?.length ? allowedProtocols : HTTP_PROTOCOLS).includes(protocol);
}
function toAllowedOriginSet(allowedOrigins) {
	const set = /* @__PURE__ */ new Set();
	for (const raw of allowedOrigins) try {
		const parsed = new URL(raw.trim());
		if (isAllowedProtocol(parsed.protocol, HTTP_PROTOCOLS)) set.add(parsed.origin);
	} catch {}
	return set;
}
function isAllowedOrigin(origin, allowedOrigins) {
	if (!allowedOrigins.length) return false;
	return toAllowedOriginSet(allowedOrigins).has(origin);
}
async function resolveHostnameAddresses(hostname) {
	try {
		const dns = await import("node:dns").catch((e) => {
			console.warn("Failed to load node:dns for DNS resolution", e);
			return null;
		});
		if (!dns?.promises?.resolve) return null;
		return await dns.promises.resolve(hostname);
	} catch {
		return null;
	}
}
function validateUrlSync(rawUrl, options = {}) {
	const trimmed = rawUrl.trim();
	let parsed;
	try {
		parsed = new URL(trimmed);
	} catch {
		return {
			ok: false,
			reason: "invalid_url",
			url: trimmed
		};
	}
	if (!isAllowedProtocol(parsed.protocol, options.allowedProtocols)) return {
		ok: false,
		reason: "disallowed_protocol",
		url: trimmed,
		protocol: parsed.protocol
	};
	if (parsed.username !== "" || parsed.password !== "") return {
		ok: false,
		reason: "embedded_credentials",
		url: trimmed
	};
	if (isPrivateHost(parsed.hostname)) return {
		ok: false,
		reason: "private_host",
		url: trimmed
	};
	if (options.allowedOrigins?.length) {
		if (!isAllowedOrigin(parsed.origin, options.allowedOrigins)) return {
			ok: false,
			reason: "disallowed_origin",
			url: trimmed,
			hostname: parsed.hostname,
			origin: parsed.origin
		};
	}
	return {
		ok: true,
		url: parsed
	};
}
/** SSRF checks with DNS resolution when available. */
async function validateUrl(rawUrl, options = {}) {
	const sync = validateUrlSync(rawUrl, options);
	if (!sync.ok) return sync;
	if (options.dns === false) return sync;
	const addresses = await resolveHostnameAddresses(sync.url.hostname);
	if (addresses) {
		for (const addr of addresses) if (isPrivateHost(addr)) return {
			ok: false,
			reason: "private_dns",
			url: sync.url.href,
			hostname: sync.url.hostname,
			address: addr
		};
	}
	return sync;
}
function safeResolveUrl(raw, baseURL) {
	const trim = raw.trim();
	if (!trim) return null;
	if (trim.startsWith("//") || trim.includes("\\")) return null;
	if (/[\u0000-\u001F\u007F]/.test(trim)) return null;
	try {
		if (trim.startsWith("/")) return new URL(trim, baseURL);
		return new URL(trim);
	} catch {
		return null;
	}
}
//#endregion
//#region src/validation/ssrf.ts
/**
* SSRF protection for dash plugin outbound fetches.
*
* Uses @infra/utils at build time; tsdown bundles it into published dist so
* consumers do not install the private workspace package.
*/
const REDIRECT_STATUSES = new Set([
	301,
	302,
	303,
	307,
	308
]);
const MAX_REDIRECTS = 10;
var SsrfBlockedError = class extends Error {
	name = "SsrfBlockedError";
};
function isSsrfBlockedError(error) {
	return error instanceof SsrfBlockedError;
}
/** Validates URL hostname literals and resolved DNS addresses. */
async function parseAndValidateUrl(url) {
	const result = await validateUrl(url);
	return result.ok ? result.url : null;
}
/**
* Fetch with SSRF checks on the initial URL and every redirect target.
*/
async function $outbound(url, options = {}) {
	const { timeout, signal: callerSignal, ...fetchInit } = options;
	let currentUrl = url;
	for (let hop = 0;; hop++) {
		const validated = await parseAndValidateUrl(currentUrl);
		if (!validated) throw new SsrfBlockedError("Invalid or blocked URL");
		const signals = [];
		if (callerSignal) signals.push(callerSignal);
		if (timeout !== void 0 && timeout > 0) signals.push(AbortSignal.timeout(timeout));
		const response = await fetch(validated.href, {
			...fetchInit,
			redirect: "manual",
			signal: signals.length === 0 ? void 0 : signals.length === 1 ? signals[0] : AbortSignal.any(signals)
		});
		if (!REDIRECT_STATUSES.has(response.status)) return response;
		if (hop >= MAX_REDIRECTS) throw new SsrfBlockedError("Too many redirects");
		await response.body?.cancel().catch(() => {});
		const location = response.headers.get("location");
		const next = location ? safeResolveUrl(location, validated.href) : null;
		if (!next) throw new SsrfBlockedError("Invalid redirect location");
		currentUrl = next.href;
	}
}
//#endregion
//#region src/routes/plugin-session.ts
/**
* Builds an in-memory session context for calling plugin endpoints
* from the infra layer via plugin.endpoints.xxx({ context }).
*/
function buildSessionContext(userId, user) {
	const now = /* @__PURE__ */ new Date();
	return { session: {
		user: {
			id: userId,
			...user
		},
		session: {
			id: `infra-${now.getTime()}`,
			userId,
			token: `infra-temp-${now.getTime()}`,
			createdAt: now,
			updatedAt: now,
			expiresAt: new Date(now.getTime() + 6e4),
			synthetic: true
		}
	} };
}
function getSSOPlugin(ctx) {
	return ctx.context.getPlugin("sso");
}
//#endregion
//#region src/routes/sso-validation.ts
/**
* SAML metadata limits and algorithm URIs aligned with @better-auth/sso
* (see packages/sso dist constants). Inlined so consumers (e.g. Metro) never
* statically pull @better-auth/sso for validation-only code paths.
*/
const DEFAULT_MAX_SAML_METADATA_SIZE = 100 * 1024;
const RSA_SHA1 = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";
/** @public */
const DEPRECATED_SIGNATURE_ALGORITHMS = [RSA_SHA1];
/** @public */
const DEPRECATED_DIGEST_ALGORITHMS = [SHA1];
function validateSAMLMetadataSize(metadataXml, maxSize = DEFAULT_MAX_SAML_METADATA_SIZE) {
	if (new TextEncoder().encode(metadataXml).byteLength > maxSize) throw new Error(`IdP metadata exceeds maximum allowed size (${Math.round(maxSize / 1024)}KB)`);
}
/** @public */
function extractAlgorithmsFromSAMLMetadata(metadataXml) {
	const signatureAlgorithms = [];
	const digestAlgorithms = [];
	const sigMethodRegex = /<(?:[\w-]+:)?SignatureMethod\s[^>]*Algorithm\s*=\s*"([^"]+)"/g;
	let match;
	while ((match = sigMethodRegex.exec(metadataXml)) !== null) if (match[1] && !signatureAlgorithms.includes(match[1])) signatureAlgorithms.push(match[1]);
	const signingMethodRegex = /<(?:[\w-]+:)?SigningMethod\s[^>]*Algorithm\s*=\s*"([^"]+)"/g;
	while ((match = signingMethodRegex.exec(metadataXml)) !== null) if (match[1] && !signatureAlgorithms.includes(match[1])) signatureAlgorithms.push(match[1]);
	const digestMethodRegex = /<(?:[\w-]+:)?DigestMethod\s[^>]*Algorithm\s*=\s*"([^"]+)"/g;
	while ((match = digestMethodRegex.exec(metadataXml)) !== null) if (match[1] && !digestAlgorithms.includes(match[1])) digestAlgorithms.push(match[1]);
	return {
		signatureAlgorithms,
		digestAlgorithms
	};
}
function validateSAMLMetadataAlgorithms(metadataXml) {
	const warnings = [];
	const { signatureAlgorithms, digestAlgorithms } = extractAlgorithmsFromSAMLMetadata(metadataXml);
	for (const alg of signatureAlgorithms) if (DEPRECATED_SIGNATURE_ALGORITHMS.includes(alg)) warnings.push(`IdP metadata contains deprecated signature algorithm: ${alg}. Consider requesting SHA-256 or stronger from your IdP.`);
	for (const alg of digestAlgorithms) if (DEPRECATED_DIGEST_ALGORITHMS.includes(alg)) warnings.push(`IdP metadata contains deprecated digest algorithm: ${alg}. Consider requesting SHA-256 or stronger from your IdP.`);
	return warnings;
}
//#endregion
//#region src/routes/sso/index.ts
let ssoRuntimeModule;
function loadSsoRuntime() {
	return ssoRuntimeModule ??= import("@better-auth/sso");
}
function requireOrganizationAccess(ctx) {
	const orgIdFromUrl = tryDecode(ctx.params.id);
	const orgIdFromToken = ctx.context.payload?.organizationId;
	if (!orgIdFromToken || orgIdFromUrl !== orgIdFromToken) throw ctx.error("FORBIDDEN", { message: "You do not have access to this organization" });
}
const samlConfigSchema = z$1.object({
	idpMetadata: z$1.object({
		metadata: z$1.string().optional(),
		metadataUrl: z$1.string().optional()
	}).optional(),
	entryPoint: z$1.string().optional(),
	cert: z$1.string().optional(),
	entityId: z$1.string().optional(),
	mapping: z$1.object({
		id: z$1.string().optional(),
		email: z$1.string().optional(),
		emailVerified: z$1.string().optional(),
		name: z$1.string().optional(),
		firstName: z$1.string().optional(),
		lastName: z$1.string().optional(),
		extraFields: z$1.record(z$1.string(), z$1.any()).optional()
	}).optional()
});
const oidcConfigSchema = z$1.object({
	clientId: z$1.string(),
	clientSecret: z$1.string().optional(),
	discoveryUrl: z$1.string().optional(),
	issuer: z$1.string().optional(),
	mapping: z$1.object({
		id: z$1.string().optional(),
		email: z$1.string().optional(),
		emailVerified: z$1.string().optional(),
		name: z$1.string().optional(),
		image: z$1.string().optional(),
		extraFields: z$1.record(z$1.string(), z$1.any()).optional()
	}).optional()
});
async function resolveSAMLConfig(samlConfig, providerId, baseURL, ctx) {
	let idpMetadataXml = samlConfig.idpMetadata?.metadata;
	if (!idpMetadataXml && samlConfig.idpMetadata?.metadataUrl) {
		const validatedMetadataUrl = await parseAndValidateUrl(samlConfig.idpMetadata.metadataUrl);
		if (!validatedMetadataUrl) throw ctx.error("BAD_REQUEST", { message: "Invalid or blocked IdP metadata URL" });
		try {
			const metadataResponse = await $outbound(validatedMetadataUrl.href, {
				method: "GET",
				headers: { Accept: "application/xml, text/xml" },
				timeout: 15e3
			});
			if (!metadataResponse.ok) throw ctx.error("BAD_REQUEST", { message: `Failed to fetch IdP metadata from URL: ${metadataResponse.status} ${metadataResponse.statusText}` });
			idpMetadataXml = await metadataResponse.text();
		} catch (e) {
			if (isSsrfBlockedError(e)) throw ctx.error("BAD_REQUEST", { message: "Invalid or blocked IdP metadata URL" });
			if (e instanceof APIError$1) throw e;
			ctx.context.logger.error("[Dash] Failed to fetch IdP metadata from URL:", e);
			throw ctx.error("BAD_REQUEST", { message: "Failed to fetch IdP metadata from URL" });
		}
	}
	const metadataAlgorithmWarnings = [];
	if (idpMetadataXml) {
		try {
			validateSAMLMetadataSize(idpMetadataXml);
		} catch (e) {
			ctx.context.logger.debug("[Dash] SAML metadata validation failed:", e);
			throw ctx.error("BAD_REQUEST", { message: e instanceof Error ? e.message : "IdP metadata exceeds maximum allowed size" });
		}
		const warnings = validateSAMLMetadataAlgorithms(idpMetadataXml);
		if (warnings.length > 0) {
			metadataAlgorithmWarnings.push(...warnings);
			ctx.context.logger.warn("[Dash] SAML IdP metadata uses deprecated algorithms:", providerId, warnings);
		}
	}
	const idpMetadata = idpMetadataXml ? { metadata: idpMetadataXml } : {
		...samlConfig.entryPoint ? { singleSignOnService: [{
			Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
			Location: samlConfig.entryPoint
		}] } : {},
		...samlConfig.cert ? { cert: samlConfig.cert } : {}
	};
	const m = samlConfig.mapping;
	return {
		config: {
			issuer: samlConfig.entityId ?? `${baseURL}/sso/saml2/sp/metadata?providerId=${providerId}`,
			callbackUrl: `${baseURL}/sso/saml2/sp/acs/${providerId}`,
			idpMetadata,
			spMetadata: {},
			entryPoint: samlConfig.entryPoint ?? "",
			cert: samlConfig.cert ?? "",
			...m ? { mapping: {
				id: m.id ?? "nameID",
				email: m.email ?? "email",
				name: m.name ?? "name",
				emailVerified: m.emailVerified,
				firstName: m.firstName,
				lastName: m.lastName,
				extraFields: m.extraFields
			} } : {}
		},
		...metadataAlgorithmWarnings.length > 0 ? { warnings: metadataAlgorithmWarnings } : {}
	};
}
async function resolveOIDCConfig(oidcConfig, domain, ctx) {
	let normalizedDomain = domain;
	try {
		if (domain.startsWith("http://") || domain.startsWith("https://")) normalizedDomain = new URL(domain).hostname;
	} catch {
		normalizedDomain = domain;
	}
	const issuerHint = oidcConfig.issuer || `https://${normalizedDomain}`;
	const issuer = issuerHint.startsWith("http") ? issuerHint : `https://${issuerHint}`;
	const sso = await loadSsoRuntime();
	try {
		const hydratedConfig = await sso.discoverOIDCConfig({
			issuer,
			discoveryEndpoint: oidcConfig.discoveryUrl,
			isTrustedOrigin: (url) => {
				try {
					const issuerOrigin = new URL(issuer).origin;
					return new URL(url).origin === issuerOrigin;
				} catch {
					return false;
				}
			}
		});
		const om = oidcConfig.mapping;
		return {
			config: {
				clientId: oidcConfig.clientId,
				clientSecret: oidcConfig.clientSecret,
				issuer: hydratedConfig.issuer,
				discoveryEndpoint: hydratedConfig.discoveryEndpoint,
				authorizationEndpoint: hydratedConfig.authorizationEndpoint,
				tokenEndpoint: hydratedConfig.tokenEndpoint,
				jwksEndpoint: hydratedConfig.jwksEndpoint,
				userInfoEndpoint: hydratedConfig.userInfoEndpoint,
				tokenEndpointAuthentication: hydratedConfig.tokenEndpointAuthentication,
				pkce: true,
				...om ? { mapping: {
					id: om.id ?? "sub",
					email: om.email ?? "email",
					name: om.name ?? "name",
					emailVerified: om.emailVerified,
					image: om.image,
					extraFields: om.extraFields
				} } : {}
			},
			issuer: hydratedConfig.issuer
		};
	} catch (e) {
		if (e instanceof sso.DiscoveryError) {
			ctx.context.logger.error("[Dash] OIDC discovery failed:", e);
			throw ctx.error("BAD_REQUEST", {
				message: `OIDC discovery failed: ${e.message}`,
				code: e.code
			});
		}
		ctx.context.logger.error("[Dash] OIDC discovery failed:", e);
		throw ctx.error("BAD_REQUEST", {
			message: `OIDC discovery failed: Unable to discover configuration from ${issuer}`,
			code: "OIDC_DISCOVERY_FAILED"
		});
	}
}
const listOrganizationSsoProviders = (options) => {
	return createAuthEndpoint("/dash/organization/:id/sso-providers", {
		method: "GET",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))]
	}, async (ctx) => {
		if (!isOrganizationEnabled(ctx)) {
			ctx.context.logger.warn("[Dash] Organization plugin not enabled, returning empty SSO providers list");
			return [];
		}
		requireOrganizationAccess(ctx);
		const organizationId = tryDecode(ctx.params.id);
		if (!ctx.context.getPlugin("sso")) {
			ctx.context.logger.warn("[Dash] SSO plugin not enabled, returning empty SSO providers list");
			return [];
		}
		try {
			return await ctx.context.adapter.findMany({
				model: "ssoProvider",
				where: [{
					field: "organizationId",
					value: organizationId
				}]
			});
		} catch (error) {
			ctx.context.logger.warn("[Dash] Failed to list SSO providers:", error);
			return [];
		}
	});
};
const createSsoProvider = (options) => {
	return createAuthEndpoint("/dash/organization/:id/sso-provider/create", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({
			providerId: z$1.string(),
			domain: z$1.string(),
			protocol: z$1.enum(["SAML", "OIDC"]),
			userId: z$1.string(),
			samlConfig: samlConfigSchema.optional(),
			oidcConfig: oidcConfigSchema.optional()
		})
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		requireOrganizationAccess(ctx);
		const ssoPlugin = getSSOPlugin(ctx);
		if (!ssoPlugin?.endpoints?.registerSSOProvider) throw ctx.error("BAD_REQUEST", { message: "SSO plugin is not enabled or feature is not supported in your plugin version" });
		const organizationId = tryDecode(ctx.params.id);
		const { providerId, domain, protocol, samlConfig, oidcConfig, userId } = ctx.body;
		const registerBody = {
			providerId,
			domain,
			issuer: domain,
			organizationId
		};
		if (protocol === "SAML" && samlConfig) {
			const samlResult = await resolveSAMLConfig(samlConfig, providerId, ctx.context.baseURL, ctx);
			registerBody.issuer = samlResult.config.issuer ?? (samlConfig.entityId || `${ctx.context.baseURL}/sso/saml2/sp/metadata?providerId=${providerId}`);
			registerBody.samlConfig = samlResult.config;
		}
		if (protocol === "OIDC" && oidcConfig) {
			if (!oidcConfig.clientSecret) throw ctx.error("BAD_REQUEST", { message: "Client secret is required when creating an OIDC provider" });
			const result = await resolveOIDCConfig(oidcConfig, domain, ctx);
			registerBody.issuer = result.issuer;
			registerBody.oidcConfig = result.config;
		}
		try {
			const result = await ssoPlugin.endpoints.registerSSOProvider({
				body: registerBody,
				context: {
					...ctx.context,
					...buildSessionContext(userId)
				}
			});
			let verificationToken = null;
			if ("domainVerificationToken" in result && typeof result.domainVerificationToken === "string") verificationToken = result.domainVerificationToken;
			return {
				success: true,
				provider: {
					id: result.providerId,
					providerId: result.providerId || providerId,
					domain: result.domain || domain
				},
				domainVerification: {
					txtRecordName: `better-auth-token-${providerId}`,
					verificationToken
				}
			};
		} catch (e) {
			if (e instanceof APIError$1) throw e;
			ctx.context.logger.error("[Dash] Failed to create SSO provider:", e);
			throw ctx.error("BAD_REQUEST", { message: e instanceof Error ? e.message : "Failed to create SSO provider" });
		}
	});
};
const updateSsoProvider = (options) => {
	return createAuthEndpoint("/dash/organization/:id/sso-provider/update", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({
			providerId: z$1.string(),
			domain: z$1.string(),
			protocol: z$1.enum(["SAML", "OIDC"]),
			samlConfig: samlConfigSchema.optional(),
			oidcConfig: oidcConfigSchema.optional()
		})
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		requireOrganizationAccess(ctx);
		const ssoPlugin = getSSOPlugin(ctx);
		if (!ssoPlugin?.endpoints?.updateSSOProvider) throw ctx.error("BAD_REQUEST", { message: "SSO plugin is not enabled or feature is not supported in your plugin version" });
		const organizationId = tryDecode(ctx.params.id);
		const { providerId, domain, protocol, samlConfig, oidcConfig } = ctx.body;
		const existingProvider = await ctx.context.adapter.findOne({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: providerId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!existingProvider) throw ctx.error("NOT_FOUND", { message: "SSO provider not found" });
		const updateBody = { providerId };
		if (domain && domain !== existingProvider.domain) updateBody.domain = domain;
		if (protocol === "SAML" && samlConfig) {
			const samlResult = await resolveSAMLConfig(samlConfig, providerId, ctx.context.baseURL, ctx);
			updateBody.issuer = samlResult.config.issuer ?? (samlConfig.entityId || `${ctx.context.baseURL}/sso/saml2/sp/metadata?providerId=${providerId}`);
			updateBody.samlConfig = samlResult.config;
		}
		if (protocol === "OIDC" && oidcConfig) {
			let effectiveOidcConfig = oidcConfig;
			if (!oidcConfig.clientSecret) {
				if (!existingProvider.oidcConfig) throw ctx.error("BAD_REQUEST", { message: "Client secret is required when updating an OIDC provider" });
				let existingOidc;
				try {
					existingOidc = JSON.parse(existingProvider.oidcConfig);
				} catch (parseError) {
					ctx.context.logger.debug("[Dash] Failed to parse existing OIDC config:", parseError);
					throw ctx.error("BAD_REQUEST", { message: "Client secret is required. Existing provider configuration is invalid." });
				}
				if (existingOidc.clientSecret) effectiveOidcConfig = {
					...oidcConfig,
					clientSecret: existingOidc.clientSecret
				};
				else throw ctx.error("BAD_REQUEST", { message: "Client secret is required. Existing provider has no client secret stored." });
			}
			const result = await resolveOIDCConfig(effectiveOidcConfig, domain, ctx);
			updateBody.issuer = result.issuer;
			updateBody.oidcConfig = result.config;
		}
		const providerUserId = existingProvider.userId;
		if (!providerUserId) throw ctx.error("BAD_REQUEST", { message: "SSO provider has no associated user. Cannot update via session." });
		try {
			const result = await ssoPlugin.endpoints.updateSSOProvider({
				body: updateBody,
				context: {
					...ctx.context,
					...buildSessionContext(providerUserId)
				}
			});
			return {
				success: true,
				provider: {
					id: existingProvider.id,
					providerId: result.providerId ?? existingProvider.providerId,
					domain: result.domain ?? domain
				}
			};
		} catch (e) {
			if (e instanceof APIError$1) throw e;
			ctx.context.logger.error("[Dash] Failed to update SSO provider:", e);
			throw ctx.error("BAD_REQUEST", { message: e instanceof Error ? e.message : "Failed to update SSO provider" });
		}
	});
};
const requestSsoVerificationToken = (options) => {
	return createAuthEndpoint("/dash/organization/:id/sso-provider/request-verification-token", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({ providerId: z$1.string() })
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		requireOrganizationAccess(ctx);
		const ssoPlugin = getSSOPlugin(ctx);
		if (!ssoPlugin || !ssoPlugin.options?.domainVerification?.enabled) throw ctx.error("BAD_REQUEST", { message: "SSO plugin with domain verification is not enabled or feature is not supported in your plugin version" });
		const endpoints = ssoPlugin.endpoints;
		if (typeof endpoints.requestDomainVerification !== "function") throw ctx.error("BAD_REQUEST", { message: "SSO plugin with domain verification is not enabled or feature is not supported in your plugin version" });
		const organizationId = tryDecode(ctx.params.id);
		const { providerId } = ctx.body;
		const provider = await ctx.context.adapter.findOne({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: providerId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!provider) throw ctx.error("NOT_FOUND", { message: "SSO provider not found" });
		const txtRecordName = `${ssoPlugin.options?.domainVerification?.tokenPrefix || "better-auth-token"}-${provider.providerId}`;
		try {
			const result = await endpoints.requestDomainVerification({
				body: { providerId },
				context: {
					...ctx.context,
					...buildSessionContext(provider.userId)
				}
			});
			return {
				success: true,
				providerId: provider.providerId,
				domain: provider.domain,
				verificationToken: result.domainVerificationToken ?? "",
				txtRecordName
			};
		} catch (e) {
			if (e instanceof APIError$1) throw e;
			ctx.context.logger.error("[Dash] Failed to request verification token:", e);
			throw ctx.error("BAD_REQUEST", { message: e instanceof Error ? e.message : "Failed to request verification token" });
		}
	});
};
const verifySsoProviderDomain = (options) => {
	return createAuthEndpoint("/dash/organization/:id/sso-provider/verify-domain", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({ providerId: z$1.string() })
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		requireOrganizationAccess(ctx);
		const ssoPlugin = getSSOPlugin(ctx);
		if (!ssoPlugin || !ssoPlugin.options?.domainVerification?.enabled) throw ctx.error("BAD_REQUEST", { message: "SSO plugin with domain verification is not enabled or feature is not supported in your plugin version" });
		const dvEndpoints = ssoPlugin.endpoints;
		if (typeof dvEndpoints.verifyDomain !== "function") throw ctx.error("BAD_REQUEST", { message: "SSO plugin with domain verification is not enabled or feature is not supported in your plugin version" });
		const organizationId = tryDecode(ctx.params.id);
		const { providerId } = ctx.body;
		const provider = await ctx.context.adapter.findOne({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: providerId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!provider) throw ctx.error("NOT_FOUND", { message: "SSO provider not found" });
		try {
			await dvEndpoints.verifyDomain({
				body: { providerId },
				context: {
					...ctx.context,
					...buildSessionContext(provider.userId)
				}
			});
			return {
				verified: true,
				message: "Domain ownership verified successfully"
			};
		} catch (e) {
			if (e instanceof APIError$1) {
				if (e.status === "CONFLICT") return {
					verified: true,
					message: "Domain has already been verified"
				};
				if (e.status === "BAD_GATEWAY") return {
					verified: false,
					message: "Unable to verify domain ownership. The TXT record was not found. It may take up to 48 hours for DNS changes to propagate."
				};
				throw e;
			}
			throw ctx.error("BAD_REQUEST", { message: e instanceof Error ? e.message : "Failed to verify domain" });
		}
	});
};
const deleteSsoProvider = (options) => {
	return createAuthEndpoint("/dash/organization/:id/sso-provider/delete", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({ providerId: z$1.string() })
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		requireOrganizationAccess(ctx);
		const ssoPlugin = getSSOPlugin(ctx);
		if (!ssoPlugin?.endpoints?.deleteSSOProvider) throw ctx.error("BAD_REQUEST", { message: "SSO plugin is not enabled or feature is not supported in your plugin version" });
		const organizationId = tryDecode(ctx.params.id);
		const { providerId } = ctx.body;
		const provider = await ctx.context.adapter.findOne({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: providerId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!provider) throw ctx.error("NOT_FOUND", { message: "SSO provider not found" });
		try {
			await ssoPlugin.endpoints.deleteSSOProvider({
				body: { providerId },
				context: {
					...ctx.context,
					...buildSessionContext(provider.userId)
				}
			});
			return {
				success: true,
				message: "SSO provider deleted successfully"
			};
		} catch (e) {
			if (e instanceof APIError$1) throw e;
			ctx.context.logger.error("[Dash] Failed to delete SSO provider:", e);
			throw ctx.error("BAD_REQUEST", { message: e instanceof Error ? e.message : "Failed to delete SSO provider" });
		}
	});
};
const markSsoProviderDomainVerified = (options) => {
	return createAuthEndpoint("/dash/organization/:id/sso-provider/mark-domain-verified", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ organizationId: z$1.string() }))],
		body: z$1.object({
			providerId: z$1.string(),
			verified: z$1.boolean()
		})
	}, async (ctx) => {
		requireOrganizationPlugin(ctx);
		requireOrganizationAccess(ctx);
		if (!getSSOPlugin(ctx)?.options?.domainVerification?.enabled) throw ctx.error("BAD_REQUEST", { message: "SSO plugin with domain verification is not enabled or feature is not supported in your plugin version" });
		const organizationId = tryDecode(ctx.params.id);
		const { providerId, verified } = ctx.body;
		const provider = await ctx.context.adapter.findOne({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: providerId
			}, {
				field: "organizationId",
				value: organizationId
			}]
		});
		if (!provider) throw ctx.error("NOT_FOUND", { message: "SSO provider not found" });
		await ctx.context.adapter.update({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: provider.providerId
			}],
			update: { domainVerified: verified }
		});
		return {
			success: true,
			domainVerified: verified,
			message: verified ? "Domain marked as verified" : "Domain verification unmarked"
		};
	});
};
//#endregion
//#region src/routes/two-factor/index.ts
const enableTwoFactor = (options) => createAuthEndpoint("/dash/enable-two-factor", {
	method: "POST",
	use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))]
}, async (ctx) => {
	const { userId } = ctx.context.payload;
	const twoFactorPlugin = ctx.context.getPlugin("two-factor");
	if (!twoFactorPlugin) throw new APIError("BAD_REQUEST", { message: "Two-factor authentication plugin is not enabled" });
	if (await ctx.context.adapter.findOne({
		model: "twoFactor",
		where: [{
			field: "userId",
			value: userId
		}]
	})) throw new APIError("BAD_REQUEST", { message: "Two-factor authentication is already enabled for this user" });
	const { generateRandomString, symmetricEncrypt } = await import("better-auth/crypto");
	const secret = generateRandomString(32, "A-Z");
	const backupCodeAmount = 10;
	const backupCodeLength = 10;
	const backupCodes = [];
	for (let i = 0; i < backupCodeAmount; i++) backupCodes.push(generateId(backupCodeLength).toUpperCase());
	const encryptedSecret = await symmetricEncrypt({
		key: ctx.context.secret,
		data: secret
	});
	const encryptedBackupCodes = await symmetricEncrypt({
		key: ctx.context.secret,
		data: JSON.stringify(backupCodes)
	});
	await ctx.context.adapter.create({
		model: "twoFactor",
		data: {
			id: generateId(32),
			userId,
			secret: encryptedSecret,
			backupCodes: encryptedBackupCodes
		}
	});
	await ctx.context.internalAdapter.updateUser(userId, {
		twoFactorEnabled: true,
		updatedAt: /* @__PURE__ */ new Date()
	});
	const user = await ctx.context.internalAdapter.findUserById(userId);
	const issuer = twoFactorPlugin.options?.issuer || ctx.context.appName || "BetterAuth";
	return {
		success: true,
		totpURI: `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user?.email || userId)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`,
		secret,
		backupCodes
	};
});
const viewTwoFactorTotpUri = (options) => createAuthEndpoint("/dash/view-two-factor-totp-uri", {
	method: "POST",
	metadata: { scope: "http" },
	use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))]
}, async (ctx) => {
	const { userId } = ctx.context.payload;
	const twoFactorPlugin = ctx.context.getPlugin("two-factor");
	if (!twoFactorPlugin) throw new APIError("BAD_REQUEST", { message: "Two-factor authentication plugin is not enabled" });
	const twoFactorRecord = await ctx.context.adapter.findOne({
		model: "twoFactor",
		where: [{
			field: "userId",
			value: userId
		}]
	});
	if (!twoFactorRecord) throw new APIError("NOT_FOUND", { message: "Two-factor authentication not set up for this user" });
	let secret = twoFactorRecord.secret;
	try {
		const { symmetricDecrypt } = await import("better-auth/crypto");
		secret = await symmetricDecrypt({
			key: ctx.context.secret,
			data: twoFactorRecord.secret
		});
	} catch {}
	const user = await ctx.context.internalAdapter.findUserById(userId);
	const issuer = twoFactorPlugin.options?.issuer || ctx.context.appName || "BetterAuth";
	return {
		totpURI: `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user?.email || userId)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`,
		secret
	};
});
const viewBackupCodes = (options) => createAuthEndpoint("/dash/view-backup-codes", {
	method: "POST",
	use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))]
}, async (ctx) => {
	const { userId } = ctx.context.payload;
	const twoFactorRecord = await ctx.context.adapter.findOne({
		model: "twoFactor",
		where: [{
			field: "userId",
			value: userId
		}]
	});
	if (!twoFactorRecord) throw new APIError("NOT_FOUND", { message: "Two-factor authentication not set up for this user" });
	let backupCodes;
	try {
		backupCodes = JSON.parse(twoFactorRecord.backupCodes);
	} catch {
		try {
			const { symmetricDecrypt } = await import("better-auth/crypto");
			const decrypted = await symmetricDecrypt({
				key: ctx.context.secret,
				data: twoFactorRecord.backupCodes
			});
			backupCodes = JSON.parse(decrypted);
		} catch (decryptError) {
			ctx.context.logger.debug("[Dash] Failed to decrypt backup codes:", decryptError);
			throw new APIError("INTERNAL_SERVER_ERROR", { message: "Failed to decrypt backup codes" });
		}
	}
	return { backupCodes };
});
const disableTwoFactor = (options) => createAuthEndpoint("/dash/disable-two-factor", {
	method: "POST",
	use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))]
}, async (ctx) => {
	const { userId } = ctx.context.payload;
	if (!ctx.context.getPlugin("two-factor")) throw new APIError("BAD_REQUEST", { message: "Two-factor authentication is not enabled" });
	await ctx.context.adapter.delete({
		model: "twoFactor",
		where: [{
			field: "userId",
			value: userId
		}]
	});
	await ctx.context.internalAdapter.updateUser(userId, {
		twoFactorEnabled: false,
		updatedAt: /* @__PURE__ */ new Date()
	});
	return { success: true };
});
const generateBackupCodes = (options) => createAuthEndpoint("/dash/generate-backup-codes", {
	method: "POST",
	use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))]
}, async (ctx) => {
	const { userId } = ctx.context.payload;
	const twoFactorRecord = await ctx.context.adapter.findOne({
		model: "twoFactor",
		where: [{
			field: "userId",
			value: userId
		}]
	});
	if (!twoFactorRecord) throw new APIError("NOT_FOUND", { message: "Two-factor authentication not set up for this user" });
	const backupCodeAmount = 10;
	const backupCodeLength = 10;
	const newBackupCodes = [];
	for (let i = 0; i < backupCodeAmount; i++) newBackupCodes.push(generateId(backupCodeLength).toUpperCase());
	const { symmetricEncrypt } = await import("better-auth/crypto");
	const encryptedCodes = await symmetricEncrypt({
		key: ctx.context.secret,
		data: JSON.stringify(newBackupCodes)
	});
	await ctx.context.adapter.update({
		model: "twoFactor",
		where: [{
			field: "id",
			value: twoFactorRecord.id
		}],
		update: { backupCodes: encryptedCodes }
	});
	return { backupCodes: newBackupCodes };
});
//#endregion
//#region src/routes/users/index.ts
function parseWhereClause(val) {
	if (!val) return [];
	const parsed = JSON.parse(val);
	if (!Array.isArray(parsed)) return [];
	return parsed;
}
const getUsersQuerySchema = z$1.object({
	limit: z$1.number().or(z$1.string().transform(Number)).optional(),
	offset: z$1.number().or(z$1.string().transform(Number)).optional(),
	sortBy: z$1.string().optional(),
	sortOrder: z$1.enum(["asc", "desc"]).optional(),
	where: z$1.string().transform(parseWhereClause).optional(),
	countWhere: z$1.string().transform(parseWhereClause).optional()
}).optional();
const getUsers = (options) => {
	return createAuthEndpoint("/dash/list-users", {
		method: "GET",
		use: [jwtMiddleware(options)],
		query: getUsersQuerySchema
	}, async (ctx) => {
		const activityTrackingEnabled = (() => {
			if (!options.activityTracking?.enabled) return false;
			const fields = getAuthTables(ctx.context.options).user?.fields || {};
			if (!("lastActiveAt" in fields)) return false;
			if (fields.lastActiveAt.type !== "date") return false;
			return true;
		})();
		const where = ctx.query?.where?.length ? ctx.query.where : void 0;
		const countWhere = ctx.query?.countWhere?.length ? ctx.query.countWhere : void 0;
		const userQuery = ctx.context.adapter.findMany({
			model: "user",
			limit: ctx.query?.limit || 10,
			offset: ctx.query?.offset ? ctx.query.offset : 0,
			sortBy: {
				field: ctx.query?.sortBy || "createdAt",
				direction: ctx.query?.sortOrder || "desc"
			},
			where
		});
		const totalQuery = ctx.context.adapter.count({
			model: "user",
			where: countWhere
		});
		const onlineUsersQuery = activityTrackingEnabled ? ctx.context.adapter.count({
			model: "user",
			where: [{
				field: "lastActiveAt",
				value: /* @__PURE__ */ new Date(Date.now() - 1e3 * 60 * 2),
				operator: "gte"
			}]
		}).catch((e) => {
			ctx.context.logger.error("[Dash] Failed to count online users:", e);
			return 0;
		}) : Promise.resolve(0);
		const [users, total, onlineUsers] = await Promise.all([
			userQuery,
			totalQuery,
			onlineUsersQuery
		]);
		const hasAdminPlugin = hasPlugin(ctx.context, "admin");
		return {
			users: users.map((user) => {
				const u = user;
				return {
					...u,
					banned: hasAdminPlugin ? u.banned ?? false : false,
					banReason: hasAdminPlugin ? u.banReason ?? null : null,
					banExpires: hasAdminPlugin ? u.banExpires ?? null : null
				};
			}),
			total,
			offset: ctx.query?.offset || 0,
			limit: ctx.query?.limit || 10,
			onlineUsers,
			activityTrackingEnabled
		};
	});
};
const exportUsers = (options) => {
	return createAuthEndpoint("/dash/export-users", {
		method: "GET",
		use: [jwtMiddleware(options)],
		query: getUsersQuerySchema
	}, async (ctx) => {
		const hasAdminPlugin = hasPlugin(ctx.context, "admin");
		return exportFactory({
			model: "user",
			limit: ctx.query?.limit,
			offset: ctx.query?.offset ? ctx.query.offset : 0,
			sortBy: {
				field: ctx.query?.sortBy || "createdAt",
				direction: ctx.query?.sortOrder || "desc"
			},
			where: ctx.query?.where
		}, { processRow: (u) => ({
			...u,
			banned: hasAdminPlugin ? u.banned ?? false : false,
			banReason: hasAdminPlugin ? u.banReason ?? null : null,
			banExpires: hasAdminPlugin ? u.banExpires ?? null : null
		}) })(ctx);
	});
};
const deleteUser = (options) => {
	return createAuthEndpoint("/dash/delete-user", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))]
	}, async (ctx) => {
		try {
			await ctx.context.adapter.delete({
				model: "user",
				where: [{
					field: "id",
					value: ctx.context.payload.userId
				}]
			});
		} catch (e) {
			ctx.context.logger.error("[Dash] Failed to delete user:", e);
			throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Internal server error" });
		}
	});
};
const deleteManyUsers = (options) => {
	return createAuthEndpoint("/dash/delete-many-users", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ userIds: z$1.string().array() }))]
	}, async (ctx) => {
		const { userIds } = ctx.context.payload;
		const deletedUserIds = /* @__PURE__ */ new Set();
		const skippedUserIds = /* @__PURE__ */ new Set();
		const start = performance.now();
		await withConcurrency(chunkArray(userIds), async (chunk) => {
			const where = [{
				field: "id",
				value: chunk,
				operator: "in"
			}];
			await ctx.context.adapter.deleteMany({
				model: "user",
				where
			});
			const remainingUsers = await ctx.context.adapter.findMany({
				model: "user",
				where
			});
			for (const id of chunk) if (!remainingUsers.some((u) => u.id === id)) deletedUserIds.add(id);
			else skippedUserIds.add(id);
		});
		const end = performance.now();
		console.log(`Time taken to bulk delete ${deletedUserIds.size} users: ${(end - start) / 1e3}s`, skippedUserIds.size > 0 ? `Failed: ${skippedUserIds.size}` : "");
		return ctx.json({
			success: deletedUserIds.size > 0,
			skippedUserIds: Array.from(skippedUserIds),
			deletedUserIds: Array.from(deletedUserIds)
		});
	});
};
const impersonateUser = (options) => {
	return createAuthEndpoint("/dash/impersonate-user", {
		method: "GET",
		query: z$1.object({ impersonation_token: z$1.string() }),
		use: [jwtMiddleware(options, z$1.object({
			userId: z$1.string(),
			redirectUrl: z$1.url(),
			impersonatedBy: z$1.string().optional()
		}), async (ctx) => {
			return ctx.query.impersonation_token;
		})]
	}, async (ctx) => {
		const { userId, redirectUrl, impersonatedBy } = ctx.context.payload;
		if (!(userId && redirectUrl)) throw ctx.error("BAD_REQUEST", { message: "Invalid token" });
		const session = await ctx.context.internalAdapter.createSession(userId, true, {
			expiresAt: new Date(Date.now() + 1e3 * 60 * 10),
			impersonatedBy: impersonatedBy || void 0
		});
		const user = await ctx.context.internalAdapter.findUserById(userId);
		if (!user) throw ctx.error("NOT_FOUND", { message: "User not found" });
		await setSessionCookie(ctx, {
			session,
			user
		}, true);
		throw ctx.redirect(redirectUrl);
	});
};
const createUser = (options) => {
	return createAuthEndpoint("/dash/create-user", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({
			organizationId: z$1.string().optional(),
			organizationRole: z$1.string().optional()
		}))],
		body: z$1.looseObject({
			name: z$1.string(),
			email: z$1.email(),
			image: z$1.string().optional(),
			password: z$1.string().optional(),
			generatePassword: z$1.boolean().optional(),
			emailVerified: z$1.boolean().optional(),
			sendVerificationEmail: z$1.boolean().optional(),
			sendOrganizationInvite: z$1.boolean().optional(),
			organizationRole: z$1.string().optional(),
			organizationId: z$1.string().optional()
		})
	}, async (ctx) => {
		const userData = ctx.body;
		const email = normalizeEmail(userData.email, ctx.context);
		if (await ctx.context.internalAdapter.findUserByEmail(email)) throw new APIError("BAD_REQUEST", { message: "User with this email already exist" });
		let password = null;
		if (userData.generatePassword && !userData.password) password = generateId(12);
		else if (userData.password && userData.password.trim() !== "") password = userData.password;
		const userSchema = getAuthTables(ctx.context.options).user;
		for (const field in userSchema.fields || {}) {
			const value = userSchema.fields[field];
			let discoveredField = null;
			if (userData[field]) discoveredField = field;
			else if (value.fieldName && userData[value.fieldName]) discoveredField = value.fieldName;
			if (discoveredField) {
				const data = userData[discoveredField];
				if (typeof value.type === "string" && value.type.endsWith("[]") && typeof data === "string") try {
					userData[discoveredField] = JSON.parse(data);
				} catch (parseError) {
					ctx.context.logger.debug("[Dash] Malformed array field, JSON parse failed:", parseError);
					throw new APIError("BAD_REQUEST", { message: `Malformed array field: ${discoveredField}` });
				}
			}
		}
		const user = await ctx.context.internalAdapter.createUser({
			...userData,
			email,
			emailVerified: userData.emailVerified,
			createdAt: /* @__PURE__ */ new Date(),
			updatedAt: /* @__PURE__ */ new Date()
		});
		if (password) await ctx.context.internalAdapter.createAccount({
			userId: user.id,
			providerId: "credential",
			accountId: user.id,
			password: await ctx.context.password.hash(password)
		});
		if (userData.sendVerificationEmail && !userData.emailVerified) {
			if (ctx.context.options.emailVerification?.sendVerificationEmail) await sendVerificationEmailFn(ctx, user);
		}
		const organizationId = ctx.context.payload?.organizationId || userData.organizationId;
		const organizationRole = ctx.context.payload?.organizationRole || userData.organizationRole;
		if (organizationId) {
			const orgOptions = requireOrganizationPlugin(ctx).options || {};
			const role = organizationRole || "member";
			const organization = await ctx.context.adapter.findOne({
				model: "organization",
				where: [{
					field: "id",
					value: organizationId
				}]
			});
			if (organization) {
				let memberData = {
					organizationId,
					userId: user.id,
					role,
					createdAt: /* @__PURE__ */ new Date()
				};
				if (orgOptions?.organizationHooks?.beforeAddMember) {
					const response = await orgOptions.organizationHooks.beforeAddMember({
						member: memberData,
						user,
						organization
					});
					if (response && typeof response === "object" && "data" in response) memberData = {
						...memberData,
						...response.data
					};
				}
				const member = await ctx.context.adapter.create({
					model: "member",
					data: memberData
				});
				if (orgOptions?.organizationHooks?.afterAddMember) await orgOptions.organizationHooks.afterAddMember({
					member,
					user,
					organization
				});
			}
		}
		return user;
	});
};
const setPassword = (options) => {
	return createAuthEndpoint("/dash/set-password", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))],
		body: z$1.object({ password: z$1.string().min(8) })
	}, async (ctx) => {
		const { userId } = ctx.context.payload;
		const { password } = ctx.body;
		if (!userId) throw new APIError("FORBIDDEN", { message: "Invalid payload" });
		const hashed = await ctx.context.password.hash(password);
		const credential = (await ctx.context.internalAdapter.findAccounts(userId)).find((a) => a.providerId === "credential");
		if (credential) await ctx.context.internalAdapter.updateAccount(credential.id, {
			password: hashed,
			updatedAt: /* @__PURE__ */ new Date()
		});
		else await ctx.context.internalAdapter.createAccount({
			userId,
			providerId: "credential",
			accountId: userId,
			password: hashed
		});
		return { success: true };
	});
};
const unlinkAccount = (options) => {
	return createAuthEndpoint("/dash/unlink-account", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))],
		body: z$1.object({
			providerId: z$1.string(),
			accountId: z$1.string().optional()
		})
	}, async (ctx) => {
		const { userId } = ctx.context.payload;
		const { providerId, accountId } = ctx.body;
		if (!userId) throw new APIError("BAD_REQUEST", { message: "Invalid payload" });
		const accounts = await ctx.context.internalAdapter.findAccounts(userId);
		const allowUnlinkingAll = ctx.context.options.account?.accountLinking?.allowUnlinkingAll ?? false;
		if (accounts.length === 1 && !allowUnlinkingAll) throw new APIError("BAD_REQUEST", { message: "Cannot unlink the last account. This would lock the user out." });
		const accountToUnlink = accounts.find((account) => accountId ? account.accountId === accountId && account.providerId === providerId : account.providerId === providerId);
		if (!accountToUnlink) throw new APIError("NOT_FOUND", { message: "Account not found" });
		await ctx.context.internalAdapter.deleteAccount(accountToUnlink.id);
		return { success: true };
	});
};
const getUserDetails = (options) => {
	return createAuthEndpoint("/dash/user", {
		method: "GET",
		use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))],
		query: z$1.object({ minimal: z$1.boolean().or(z$1.string().transform((val) => val === "true")).optional() }).optional()
	}, async (ctx) => {
		const { userId } = ctx.context.payload;
		const minimal = !!ctx.query?.minimal;
		const hasAdminPlugin = hasPlugin(ctx.context, "admin");
		const secondaryStorageOnly = isSessionInSecondaryStorageOnly(ctx.context);
		const user = await ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: userId
			}],
			...minimal ? {} : { join: {
				account: true,
				...secondaryStorageOnly ? {} : { session: true }
			} }
		});
		if (!user) throw ctx.error("NOT_FOUND", { message: "User not found" });
		if (minimal) return {
			...user,
			lastActiveAt: user.lastActiveAt ?? null,
			banned: hasAdminPlugin ? user.banned ?? false : false,
			banReason: hasAdminPlugin ? user.banReason ?? null : null,
			banExpires: hasAdminPlugin ? user.banExpires ?? null : null,
			account: [],
			session: []
		};
		const activityTrackingEnabled = !!options.activityTracking?.enabled;
		const sessions = secondaryStorageOnly ? await ctx.context.internalAdapter.listSessions(userId) : user.session || [];
		let lastActiveAt = null;
		if (activityTrackingEnabled) {
			lastActiveAt = user.lastActiveAt ?? null;
			let shouldUpdateLastActiveAt = false;
			if (sessions.length > 0) {
				const mostRecentSession = [...sessions].sort((a, b) => {
					const aTime = new Date(a.updatedAt || a.createdAt).getTime();
					return new Date(b.updatedAt || b.createdAt).getTime() - aTime;
				})[0];
				if (!lastActiveAt && mostRecentSession) {
					lastActiveAt = new Date(mostRecentSession.updatedAt || mostRecentSession.createdAt);
					shouldUpdateLastActiveAt = true;
				}
			}
			if (shouldUpdateLastActiveAt && lastActiveAt) {
				const updateActivity = async () => {
					try {
						await ctx.context.internalAdapter.updateUser(userId, {
							lastActiveAt,
							updatedAt: /* @__PURE__ */ new Date()
						});
					} catch (error) {
						ctx.context.logger.error("[Dash] Failed to update user lastActiveAt:", error);
					}
				};
				updateActivity();
			}
		}
		return {
			...user,
			...secondaryStorageOnly ? { session: sessions } : {},
			lastActiveAt,
			banned: hasAdminPlugin ? user.banned ?? false : false,
			banReason: hasAdminPlugin ? user.banReason ?? null : null,
			banExpires: hasAdminPlugin ? user.banExpires ?? null : null
		};
	});
};
const getUserOrganizations = (options) => {
	return createAuthEndpoint("/dash/user-organizations", {
		method: "GET",
		use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))]
	}, async (ctx) => {
		const { userId } = ctx.context.payload;
		if (!isOrganizationEnabled(ctx)) {
			ctx.context.logger.warn("[Dash] Organization plugin not enabled, returning empty user organizations");
			return { organizations: [] };
		}
		const isTeamEnabled = ctx.context.getPlugin("organization").options?.teams?.enabled;
		const [membersWithOrg, teamMembersWithTeam] = await Promise.all([ctx.context.adapter.findMany({
			model: "member",
			where: [{
				field: "userId",
				value: userId
			}],
			join: { organization: true }
		}), isTeamEnabled ? ctx.context.adapter.findMany({
			model: "teamMember",
			where: [{
				field: "userId",
				value: userId
			}],
			join: { team: true }
		}).catch((e) => {
			ctx.context.logger.error("[Dash] Failed to fetch team members:", e);
			return [];
		}) : Promise.resolve([])]);
		if (membersWithOrg.length === 0) return { organizations: [] };
		const teams = teamMembersWithTeam.map((tm) => Array.isArray(tm.team) ? tm.team[0] : tm.team).filter((t) => t != null);
		return { organizations: membersWithOrg.map((m) => {
			const organization = Array.isArray(m.organization) ? m.organization[0] : m.organization;
			if (!organization) return null;
			return {
				id: organization.id,
				name: organization.name,
				logo: organization.logo,
				createdAt: organization.createdAt,
				slug: organization.slug,
				role: m.role,
				teams: teams.filter((team) => team.organizationId === organization.id)
			};
		}).filter((row) => row != null) };
	});
};
const updateUser = (options) => createAuthEndpoint("/dash/update-user", {
	method: "POST",
	use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))],
	body: z$1.looseObject({
		name: z$1.string().optional(),
		email: z$1.email().optional(),
		image: z$1.string().optional(),
		emailVerified: z$1.boolean().optional()
	})
}, async (ctx) => {
	const updateData = ctx.body;
	const userId = ctx.context.payload?.userId;
	if (!userId) throw new APIError("FORBIDDEN", { message: "Invalid payload" });
	const filteredData = Object.fromEntries(Object.entries(updateData).filter(([, value]) => value !== void 0));
	if (Object.keys(filteredData).length === 0) throw new APIError("BAD_REQUEST", { message: "No valid fields to update" });
	const user = await ctx.context.internalAdapter.updateUser(userId, {
		...filteredData,
		updatedAt: /* @__PURE__ */ new Date()
	});
	if (!user) throw new APIError("NOT_FOUND", { message: "User not found" });
	return user;
});
async function countUniqueActiveUsers(ctx, range, options) {
	const field = options.activityTrackingEnabled ? "lastActiveAt" : "updatedAt";
	const where = [{
		field,
		operator: "gte",
		value: range.from
	}];
	if (range.to !== void 0) where.push({
		field,
		operator: "lt",
		value: range.to
	});
	if (options.activityTrackingEnabled) return ctx.context.adapter.count({
		model: "user",
		where
	});
	if (options.storeInSecondaryStorageOnly) {
		const users = await ctx.context.adapter.findMany({
			model: "user",
			select: ["id"]
		});
		const fromMs = range.from.getTime();
		const toMs = range.to?.getTime();
		const activeUserIds = /* @__PURE__ */ new Set();
		await withConcurrency(users, async (user) => {
			const sessions = await ctx.context.internalAdapter.listSessions(user.id);
			for (const session of sessions) {
				const updatedAt = new Date(session.updatedAt).getTime();
				if (updatedAt >= fromMs && (toMs === void 0 || updatedAt < toMs)) {
					activeUserIds.add(user.id);
					break;
				}
			}
		}, { concurrency: 10 });
		return activeUserIds.size;
	}
	const sessions = await ctx.context.adapter.findMany({
		model: "session",
		select: ["userId"],
		where
	});
	return new Set(sessions.map((s) => s.userId)).size;
}
function optionalQuery(ctx, label, getCount) {
	return async function runQuery() {
		try {
			return {
				ok: true,
				value: await getCount()
			};
		} catch (error) {
			ctx.context.logger.warn(`[Dash] User stats query "${label}" failed`, error);
			return {
				ok: false,
				value: null
			};
		}
	};
}
function signUpPeriod(current, previous, calculatePercentage) {
	return {
		signUps: current.ok ? current.value : null,
		percentage: current.ok && previous.ok ? calculatePercentage(current.value, previous.value) : null
	};
}
function activePeriod(current, previous, calculatePercentage) {
	return {
		active: current.ok ? current.value : null,
		percentage: current.ok && previous.ok ? calculatePercentage(current.value, previous.value) : null
	};
}
const getUserStats = (options) => createAuthEndpoint("/dash/user-stats", {
	method: "GET",
	use: [jwtMiddleware(options)]
}, async (ctx) => {
	const now = /* @__PURE__ */ new Date();
	const oneDayAgo = /* @__PURE__ */ new Date(now.getTime() - 1440 * 60 * 1e3);
	const twoDaysAgo = /* @__PURE__ */ new Date(now.getTime() - 2880 * 60 * 1e3);
	const oneWeekAgo = /* @__PURE__ */ new Date(now.getTime() - 10080 * 60 * 1e3);
	const twoWeeksAgo = /* @__PURE__ */ new Date(now.getTime() - 336 * 60 * 60 * 1e3);
	const oneMonthAgo = /* @__PURE__ */ new Date(now.getTime() - 720 * 60 * 60 * 1e3);
	const twoMonthsAgo = /* @__PURE__ */ new Date(now.getTime() - 1440 * 60 * 60 * 1e3);
	const activityTrackingEnabled = !!options.activityTracking?.enabled;
	const storeInSecondaryStorageOnly = isSessionInSecondaryStorageOnly(ctx.context);
	const [rDailySignups, rPrevDaySignups, rWeeklySignups, rPrevWeekSignups, rMonthlySignups, rPrevMonthSignups, rTotalUsers, rActiveDaily, rActivePrevDay, rActiveWeekly, rActivePrevWeek, rActiveMonthly, rActivePrevMonth] = await withConcurrency([
		optionalQuery(ctx, "daily signups", () => ctx.context.adapter.count({
			model: "user",
			where: [{
				field: "createdAt",
				operator: "gte",
				value: oneDayAgo
			}]
		})),
		optionalQuery(ctx, "previous day signups", () => ctx.context.adapter.count({
			model: "user",
			where: [{
				field: "createdAt",
				operator: "gte",
				value: twoDaysAgo
			}, {
				field: "createdAt",
				operator: "lt",
				value: oneDayAgo
			}]
		})),
		optionalQuery(ctx, "weekly signups", () => ctx.context.adapter.count({
			model: "user",
			where: [{
				field: "createdAt",
				operator: "gte",
				value: oneWeekAgo
			}]
		})),
		optionalQuery(ctx, "previous week signups", () => ctx.context.adapter.count({
			model: "user",
			where: [{
				field: "createdAt",
				operator: "gte",
				value: twoWeeksAgo
			}, {
				field: "createdAt",
				operator: "lt",
				value: oneWeekAgo
			}]
		})),
		optionalQuery(ctx, "monthly signups", () => ctx.context.adapter.count({
			model: "user",
			where: [{
				field: "createdAt",
				operator: "gte",
				value: oneMonthAgo
			}]
		})),
		optionalQuery(ctx, "previous month signups", () => ctx.context.adapter.count({
			model: "user",
			where: [{
				field: "createdAt",
				operator: "gte",
				value: twoMonthsAgo
			}, {
				field: "createdAt",
				operator: "lt",
				value: oneMonthAgo
			}]
		})),
		optionalQuery(ctx, "total users", () => ctx.context.adapter.count({ model: "user" })),
		optionalQuery(ctx, "active users (daily window)", () => countUniqueActiveUsers(ctx, { from: oneDayAgo }, {
			storeInSecondaryStorageOnly,
			activityTrackingEnabled
		})),
		optionalQuery(ctx, "active users (previous day window)", () => countUniqueActiveUsers(ctx, {
			from: twoDaysAgo,
			to: oneDayAgo
		}, {
			storeInSecondaryStorageOnly,
			activityTrackingEnabled
		})),
		optionalQuery(ctx, "active users (weekly window)", () => countUniqueActiveUsers(ctx, { from: oneWeekAgo }, {
			storeInSecondaryStorageOnly,
			activityTrackingEnabled
		})),
		optionalQuery(ctx, "active users (previous week window)", () => countUniqueActiveUsers(ctx, {
			from: twoWeeksAgo,
			to: oneWeekAgo
		}, {
			storeInSecondaryStorageOnly,
			activityTrackingEnabled
		})),
		optionalQuery(ctx, "active users (monthly window)", () => countUniqueActiveUsers(ctx, { from: oneMonthAgo }, {
			storeInSecondaryStorageOnly,
			activityTrackingEnabled
		})),
		optionalQuery(ctx, "active users (previous month window)", () => countUniqueActiveUsers(ctx, {
			from: twoMonthsAgo,
			to: oneMonthAgo
		}, {
			storeInSecondaryStorageOnly,
			activityTrackingEnabled
		}))
	], (fn) => fn(), { concurrency: 5 });
	const calculatePercentage = (current, previous) => {
		if (previous === 0) return current > 0 ? 100 : 0;
		return (current - previous) / previous * 100;
	};
	const degraded = [
		rDailySignups,
		rPrevDaySignups,
		rWeeklySignups,
		rPrevWeekSignups,
		rMonthlySignups,
		rPrevMonthSignups,
		rTotalUsers,
		rActiveDaily,
		rActivePrevDay,
		rActiveWeekly,
		rActivePrevWeek,
		rActiveMonthly,
		rActivePrevMonth
	].some((r) => !r.ok);
	const body = {
		daily: signUpPeriod(rDailySignups, rPrevDaySignups, calculatePercentage),
		weekly: signUpPeriod(rWeeklySignups, rPrevWeekSignups, calculatePercentage),
		monthly: signUpPeriod(rMonthlySignups, rPrevMonthSignups, calculatePercentage),
		total: rTotalUsers.ok ? rTotalUsers.value : null,
		activeUsers: {
			daily: activePeriod(rActiveDaily, rActivePrevDay, calculatePercentage),
			weekly: activePeriod(rActiveWeekly, rActivePrevWeek, calculatePercentage),
			monthly: activePeriod(rActiveMonthly, rActivePrevMonth, calculatePercentage)
		}
	};
	if (degraded) body.degraded = true;
	return body;
});
const getUserGraphData = (options) => createAuthEndpoint("/dash/user-graph-data", {
	method: "GET",
	use: [jwtMiddleware(options)],
	query: z$1.object({ period: z$1.enum([
		"daily",
		"weekly",
		"monthly"
	]).default("daily") })
}, async (ctx) => {
	const { period } = ctx.query;
	const now = /* @__PURE__ */ new Date();
	const activityTrackingEnabled = !!options.activityTracking?.enabled;
	const storeInSecondaryStorageOnly = isSessionInSecondaryStorageOnly(ctx.context);
	const intervals = period === "daily" ? 7 : period === "weekly" ? 8 : 6;
	const msPerInterval = period === "daily" ? 1440 * 60 * 1e3 : period === "weekly" ? 10080 * 60 * 1e3 : 720 * 60 * 60 * 1e3;
	const intervalData = [];
	for (let i = intervals - 1; i >= 0; i--) {
		const endDate = new Date(now.getTime() - i * msPerInterval);
		const startDate = new Date(endDate.getTime() - msPerInterval);
		let label;
		if (period === "daily") label = endDate.toLocaleDateString("en-US", { weekday: "short" });
		else if (period === "weekly") label = endDate.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric"
		});
		else label = endDate.toLocaleDateString("en-US", { month: "short" });
		intervalData.push({
			startDate,
			endDate,
			label
		});
	}
	const allQueries = intervalData.flatMap((interval) => [
		ctx.context.adapter.count({
			model: "user",
			where: [{
				field: "createdAt",
				operator: "lte",
				value: interval.endDate
			}]
		}),
		ctx.context.adapter.count({
			model: "user",
			where: [{
				field: "createdAt",
				operator: "gt",
				value: interval.startDate
			}, {
				field: "createdAt",
				operator: "lte",
				value: interval.endDate
			}]
		}),
		countUniqueActiveUsers(ctx, {
			from: interval.startDate,
			to: interval.endDate
		}, {
			storeInSecondaryStorageOnly,
			activityTrackingEnabled
		})
	]);
	const results = await Promise.all(allQueries);
	return {
		data: intervalData.map((interval, idx) => ({
			date: typeof interval.endDate === "object" ? interval.endDate : interval.endDate,
			label: interval.label,
			totalUsers: results[idx * 3] ?? 0,
			newUsers: results[idx * 3 + 1] ?? 0,
			activeUsers: results[idx * 3 + 2] ?? 0
		})),
		period
	};
});
const getUserRetentionData = (options) => createAuthEndpoint("/dash/user-retention-data", {
	method: "GET",
	use: [jwtMiddleware(options)],
	query: z$1.object({ period: z$1.enum([
		"daily",
		"weekly",
		"monthly"
	]).default("weekly") })
}, async (ctx) => {
	/**
	* Professional cohort retention (calendar-aligned, UTC):
	*
	* D-N retention:
	*   users created during Day(-N) who are active during "today"
	*
	* W-N retention:
	*   users created during Week(-N) who are active during "this week"
	*
	* M-N retention:
	*   users created during Month(-N) who are active during "this month"
	*
	* Active: user.lastActiveAt when activity tracking enabled, else session.updatedAt.
	*/
	const { period } = ctx.query;
	const activityTrackingEnabled = !!options.activityTracking?.enabled;
	const secondaryOnly = isSessionInSecondaryStorageOnly(ctx.context);
	const now = /* @__PURE__ */ new Date();
	const startOfUtcDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	const startOfUtcMonth = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
	const startOfUtcWeek = (d) => {
		const day = d.getUTCDay();
		const diff = day === 0 ? -6 : 1 - day;
		const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
		monday.setUTCDate(monday.getUTCDate() + diff);
		return monday;
	};
	const addUtcDays = (d, days) => {
		const nd = new Date(d);
		nd.setUTCDate(nd.getUTCDate() + days);
		return nd;
	};
	const addUtcMonths = (d, months) => {
		const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
		nd.setUTCMonth(nd.getUTCMonth() + months);
		return nd;
	};
	const horizons = period === "daily" ? 7 : period === "weekly" ? 8 : 6;
	const activeStart = period === "daily" ? startOfUtcDay(now) : period === "weekly" ? startOfUtcWeek(now) : startOfUtcMonth(now);
	const activeEnd = period === "daily" ? addUtcDays(activeStart, 1) : period === "weekly" ? addUtcDays(activeStart, 7) : addUtcMonths(activeStart, 1);
	const prefix = period === "daily" ? "D" : period === "weekly" ? "W" : "M";
	const data = [];
	for (let n = 1; n <= horizons; n++) {
		const cohortStart = period === "daily" ? addUtcDays(activeStart, -n) : period === "weekly" ? addUtcDays(activeStart, -7 * n) : addUtcMonths(activeStart, -n);
		const cohortEnd = period === "daily" ? addUtcDays(cohortStart, 1) : period === "weekly" ? addUtcDays(cohortStart, 7) : addUtcMonths(cohortStart, 1);
		const cohortUsers = await ctx.context.adapter.findMany({
			model: "user",
			select: ["id"],
			where: [{
				field: "createdAt",
				operator: "gte",
				value: cohortStart
			}, {
				field: "createdAt",
				operator: "lt",
				value: cohortEnd
			}]
		});
		const cohortSize = cohortUsers.length;
		if (cohortSize === 0) {
			data.push({
				n,
				label: `${prefix}${n}`,
				cohortStart: cohortStart.toISOString(),
				cohortEnd: cohortEnd.toISOString(),
				activeStart: activeStart.toISOString(),
				activeEnd: activeEnd.toISOString(),
				cohortSize: 0,
				retained: 0,
				retentionRate: 0
			});
			continue;
		}
		const cohortUserIds = cohortUsers.map((u) => u.id);
		let retained;
		if (activityTrackingEnabled) retained = await ctx.context.adapter.count({
			model: "user",
			where: [
				{
					field: "id",
					operator: "in",
					value: cohortUserIds
				},
				{
					field: "lastActiveAt",
					operator: "gte",
					value: activeStart
				},
				{
					field: "lastActiveAt",
					operator: "lt",
					value: activeEnd
				}
			]
		}).catch((error) => {
			ctx.context.logger.warn("[Dash] Failed to count retained users by lastActiveAt:", error);
			return 0;
		});
		else if (secondaryOnly) {
			const activeStartMs = activeStart.getTime();
			const activeEndMs = activeEnd.getTime();
			const retainedUsers = /* @__PURE__ */ new Set();
			await withConcurrency(cohortUserIds, async (userId) => {
				const sessions = await ctx.context.internalAdapter.listSessions(userId);
				for (const session of sessions) {
					const updatedAt = new Date(session.updatedAt).getTime();
					if (updatedAt >= activeStartMs && updatedAt < activeEndMs) {
						retainedUsers.add(userId);
						break;
					}
				}
			}, { concurrency: 50 });
			retained = retainedUsers.size;
		} else {
			const sessionsInActiveWindow = await ctx.context.adapter.findMany({
				model: "session",
				select: ["userId"],
				where: [
					{
						field: "userId",
						operator: "in",
						value: cohortUserIds
					},
					{
						field: "updatedAt",
						operator: "gte",
						value: activeStart
					},
					{
						field: "updatedAt",
						operator: "lt",
						value: activeEnd
					}
				]
			}).catch((error) => {
				ctx.context.logger.warn("[Dash] Failed to fetch cohort sessions:", error);
				return [];
			});
			retained = new Set(sessionsInActiveWindow.map((s) => s.userId)).size;
		}
		const retentionRate = cohortSize > 0 ? Math.round(retained / cohortSize * 100 * 10) / 10 : 0;
		data.push({
			n,
			label: `${prefix}${n}`,
			cohortStart: cohortStart.toISOString(),
			cohortEnd: cohortEnd.toISOString(),
			activeStart: activeStart.toISOString(),
			activeEnd: activeEnd.toISOString(),
			cohortSize,
			retained,
			retentionRate
		});
	}
	return {
		data,
		period
	};
});
const banUser = (options) => createAuthEndpoint("/dash/ban-user", {
	method: "POST",
	use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))],
	body: z$1.object({
		banReason: z$1.string().optional(),
		banExpires: z$1.number().optional()
	})
}, async (ctx) => {
	const { userId } = ctx.context.payload;
	const { banReason, banExpires } = ctx.body;
	if (!await ctx.context.internalAdapter.findUserById(userId)) throw new APIError("NOT_FOUND", { message: "User not found" });
	await ctx.context.internalAdapter.updateUser(userId, {
		banned: true,
		banReason: banReason || null,
		banExpires: banExpires ? new Date(banExpires) : null,
		updatedAt: /* @__PURE__ */ new Date()
	});
	await ctx.context.internalAdapter.deleteSessions(userId);
	return { success: true };
});
const banManyUsers = (options) => {
	return createAuthEndpoint("/dash/ban-many-users", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ userIds: z$1.string().array() }))],
		body: z$1.object({
			banReason: z$1.string().optional(),
			banExpires: z$1.number().optional()
		})
	}, async (ctx) => {
		const { userIds } = ctx.context.payload;
		const { banReason, banExpires } = ctx.body;
		const start = performance.now();
		await withConcurrency(chunkArray(userIds, { batchSize: 50 }), async (chunk) => {
			await ctx.context.adapter.updateMany({
				model: "user",
				where: [{
					field: "id",
					value: chunk,
					operator: "in"
				}],
				update: {
					banned: true,
					banReason: banReason || null,
					banExpires: banExpires ? new Date(banExpires) : null
				}
			});
		}, { concurrency: 3 });
		const skippedUserIds = (await ctx.context.adapter.findMany({
			model: "user",
			where: [{
				field: "id",
				value: userIds,
				operator: "in",
				connector: "AND"
			}, {
				field: "banned",
				value: false,
				operator: "eq"
			}],
			select: ["id"]
		})).map((u) => u.id);
		const bannedUserIds = userIds.filter((id) => !skippedUserIds.includes(id));
		const end = performance.now();
		console.log(`Time taken to ban ${bannedUserIds.length} users: ${(end - start) / 1e3}s`, skippedUserIds.length > 0 ? `Skipped: ${skippedUserIds.length}` : "");
		return ctx.json({
			success: bannedUserIds.length > 0,
			bannedUserIds,
			skippedUserIds
		});
	});
};
const unbanUser = (options) => createAuthEndpoint("/dash/unban-user", {
	method: "POST",
	use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))]
}, async (ctx) => {
	const { userId } = ctx.context.payload;
	if (!await ctx.context.internalAdapter.findUserById(userId)) throw new APIError("NOT_FOUND", { message: "User not found" });
	await ctx.context.internalAdapter.updateUser(userId, {
		banned: false,
		banReason: null,
		banExpires: null,
		updatedAt: /* @__PURE__ */ new Date()
	});
	return { success: true };
});
const sendVerificationEmail = (options) => createAuthEndpoint("/dash/send-verification-email", {
	method: "POST",
	use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))],
	body: z$1.object({ callbackUrl: z$1.url() })
}, async (ctx) => {
	const { userId } = ctx.context.payload;
	const { callbackUrl } = ctx.body;
	const user = await ctx.context.internalAdapter.findUserById(userId);
	if (!user) throw ctx.error("NOT_FOUND", { message: "User not found" });
	if (user.emailVerified) throw ctx.error("BAD_REQUEST", { message: "Email is already verified" });
	if (!user.email) throw ctx.error("BAD_REQUEST", { message: "User has no associated email address" });
	if (!ctx.context.options.emailVerification?.sendVerificationEmail) throw ctx.error("BAD_REQUEST", { message: "Email verification is not enabled" });
	await sendVerificationEmailFn({
		...ctx,
		body: {
			...ctx.body,
			callbackURL: callbackUrl
		}
	}, user);
	return { success: true };
});
const sendManyVerificationEmails = (options) => {
	return createAuthEndpoint("/dash/send-many-verification-emails", {
		method: "POST",
		use: [jwtMiddleware(options, z$1.object({ userIds: z$1.string().array() }))],
		body: z$1.object({ callbackUrl: z$1.url() })
	}, async (ctx) => {
		if (!ctx.context.options.emailVerification?.sendVerificationEmail) throw ctx.error("BAD_REQUEST", { message: "Email verification is not enabled" });
		const { userIds } = ctx.context.payload;
		const { callbackUrl } = ctx.body;
		const sentEmailUserIds = /* @__PURE__ */ new Set();
		const skippedEmailUserIds = /* @__PURE__ */ new Set();
		const start = performance.now();
		await withConcurrency(chunkArray(userIds, { batchSize: 20 }), async (chunk) => {
			const users = await ctx.context.adapter.findMany({
				model: "user",
				where: [{
					field: "id",
					value: chunk,
					operator: "in"
				}, {
					field: "emailVerified",
					value: false
				}]
			});
			if (chunk.length - users.length > 0) for (const id of chunk.filter((id) => !users.some((u) => u.id === id))) skippedEmailUserIds.add(id);
			for (const result of await Promise.allSettled(users.map(async (user) => {
				if (!user.email) return {
					success: false,
					id: user.id
				};
				try {
					await sendVerificationEmailFn({
						...ctx,
						body: {
							...ctx.body,
							callbackURL: callbackUrl
						}
					}, user);
				} catch {
					return {
						success: false,
						id: user.id
					};
				}
				return {
					success: true,
					id: user.id
				};
			}))) if (result.status === "fulfilled") if (result.value.success) sentEmailUserIds.add(result.value.id);
			else skippedEmailUserIds.add(result.value.id);
			else for (const { id } of users) skippedEmailUserIds.add(id);
		}, { concurrency: 2 });
		const end = performance.now();
		console.log(`Time taken to send verification emails to ${sentEmailUserIds.size} users: ${Math.round((end - start) / 1e3)}s`, skippedEmailUserIds.size > 0 ? `Skipped: ${skippedEmailUserIds.size}` : "");
		return ctx.json({
			success: sentEmailUserIds.size > 0,
			sentEmailUserIds: Array.from(sentEmailUserIds),
			skippedEmailUserIds: Array.from(skippedEmailUserIds)
		});
	});
};
const sendResetPasswordEmail = (options) => createAuthEndpoint("/dash/send-reset-password-email", {
	method: "POST",
	use: [jwtMiddleware(options, z$1.object({ userId: z$1.string() }))],
	body: z$1.object({ callbackUrl: z$1.url() })
}, async (ctx) => {
	const { userId } = ctx.context.payload;
	const user = await ctx.context.internalAdapter.findUserById(userId);
	if (!user) throw ctx.error("NOT_FOUND", { message: "User not found" });
	if (!user.email) throw ctx.error("BAD_REQUEST", { message: "User has no associated email address" });
	ctx.body.redirectTo = ctx.body.callbackUrl;
	ctx.body.email = user.email;
	return await requestPasswordReset(ctx);
});
//#endregion
//#region src/pow.ts
/** Default difficulty in bits (18 = ~500ms solve time) */
const DEFAULT_DIFFICULTY = 18;
/** Challenge TTL in seconds */
const CHALLENGE_TTL = 60;
/**
* SHA-256 hash function that works in both Node.js and browser
*/
async function sha256(message) {
	const msgBuffer = new TextEncoder().encode(message);
	const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
	return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/**
* Check if a hash has the required number of leading zero bits
*/
function hasLeadingZeroBits(hash, bits) {
	const fullHexChars = Math.floor(bits / 4);
	const remainingBits = bits % 4;
	for (let i = 0; i < fullHexChars; i++) if (hash[i] !== "0") return false;
	if (remainingBits > 0 && fullHexChars < hash.length) {
		if (parseInt(hash[fullHexChars], 16) > (1 << 4 - remainingBits) - 1) return false;
	}
	return true;
}
/**
* Solve a PoW challenge (browser-compatible)
* This function is designed to run in a browser environment
*/
async function solvePoWChallenge(challenge) {
	const { nonce, difficulty } = challenge;
	let counter = 0;
	while (true) {
		if (hasLeadingZeroBits(await sha256(`${nonce}:${counter}`), difficulty)) return {
			nonce,
			counter
		};
		counter++;
		if (counter % 1e3 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
	}
}
/**
* Decode a base64-encoded challenge string (browser-compatible)
*/
function decodePoWChallenge(encoded) {
	try {
		const decoded = atob(encoded);
		return JSON.parse(decoded);
	} catch {
		return null;
	}
}
/**
* Encode a solution string (browser-compatible)
*/
function encodePoWSolution(solution) {
	const json = JSON.stringify(solution);
	return btoa(json);
}
/**
* Verify a PoW solution locally (for testing purposes)
*/
async function verifyPoWSolution(nonce, counter, difficulty) {
	return hasLeadingZeroBits(await sha256(`${nonce}:${counter}`), difficulty);
}
//#endregion
//#region src/sms.ts
/**
* SMS sending module for @better-auth/infra
*
* This module provides SMS sending functionality for OTP verification codes
* with template support similar to emails.
*/
/**
* SMS template definitions with their required variables
*/
const SMS_TEMPLATES = {
	"phone-verification": { variables: {} },
	"two-factor": { variables: {} },
	"sign-in-otp": { variables: {} }
};
/**
* Create an SMS sender instance
*/
function createSMSSender(config) {
	const baseUrl = config?.apiUrl || INFRA_API_URL;
	const apiUrl = baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
	const apiKey = config?.apiKey || env.BETTER_AUTH_API_KEY || "";
	if (!apiKey) logger.warn("[Dash] No API key provided for SMS sending. Set BETTER_AUTH_API_KEY environment variable or pass apiKey in config.");
	const $api = createFetch({
		baseURL: apiUrl,
		headers: { Authorization: `Bearer ${apiKey}` },
		timeout: config?.apiTimeout ?? 3e3
	});
	/**
	* Send an SMS with OTP code
	*/
	async function send(options) {
		if (!apiKey) return {
			success: false,
			error: "API key not configured"
		};
		try {
			const { data, error } = await $api("/v1/sms/send", {
				method: "POST",
				body: {
					to: options.to,
					code: options.code,
					template: options.template
				}
			});
			if (error) return {
				success: false,
				error: error.message || `HTTP ${error.status}`
			};
			if (typeof data !== "object" || data === null || Array.isArray(data)) return {
				success: false,
				error: "Failed to parse JSON"
			};
			return {
				success: true,
				messageId: data.messageId
			};
		} catch (error) {
			logger.warn("[Dash] SMS send failed:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to send SMS"
			};
		}
	}
	return { send };
}
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
async function sendSMS(options, config) {
	return createSMSSender(config).send(options);
}
//#endregion
//#region src/index.ts
const dash = (options) => {
	const processedBulkOperationContexts = /* @__PURE__ */ new WeakSet();
	const opts = resolveDashOptions(options);
	const $api = createAPI(opts);
	const settings = {
		...opts,
		$api
	};
	const $kv = createKV(opts);
	const activityUpdateInterval = opts.activityTracking?.updateInterval ?? 3e5;
	const { tracker } = initTrackEvents($api);
	const { trackUserSignedUp, trackUserProfileUpdated, trackUserProfileImageUpdated, trackUserEmailVerified, trackUserBanned, trackUserUnBanned, trackUserDeleted } = initUserEvents(tracker);
	const { trackEmailVerificationSent, trackEmailSignInAttempt, trackUserSignedIn, trackUserSignedOut, trackSessionCreated, trackSocialSignInAttempt, trackSocialSignInRedirectionAttempt, trackUserImpersonated, trackUserImpersonationStop, trackSessionRevoked, trackSessionRevokedAll } = initSessionEvents(tracker);
	const { trackAccountLinking, trackAccountUnlink, trackAccountPasswordChange } = initAccountEvents(tracker);
	const { trackPasswordResetRequest, trackPasswordResetRequestCompletion } = initVerificationEvents(tracker);
	const { trackOrganizationCreated, trackOrganizationUpdated } = initOrganizationEvents(tracker);
	const { trackOrganizationTeamCreated, trackOrganizationTeamUpdated, trackOrganizationTeamDeleted, trackOrganizationTeamMemberAdded, trackOrganizationTeamMemberRemoved } = initTeamEvents(tracker);
	const { trackOrganizationMemberAdded, trackOrganizationMemberRemoved, trackOrganizationMemberRoleUpdated } = initMemberEvents(tracker);
	const { trackOrganizationMemberInvited, trackOrganizationMemberInviteAccepted, trackOrganizationMemberInviteCanceled, trackOrganizationMemberInviteRejected } = initInvitationEvents(tracker);
	return {
		id: "dash",
		options: opts,
		version: PLUGIN_VERSION,
		init(ctx) {
			const organizationPlugin = ctx.getPlugin("organization");
			if (organizationPlugin) {
				const instrumentOrganizationHooks = (organizationPluginOptions) => {
					const organizationHooks = organizationPluginOptions.organizationHooks = organizationPluginOptions.organizationHooks ?? {};
					const afterCreateOrganization = organizationHooks.afterCreateOrganization;
					organizationHooks.afterCreateOrganization = async (...args) => {
						const [{ organization, user }] = args;
						trackOrganizationCreated(organization, getOrganizationTriggerInfo(user));
						if (afterCreateOrganization) return afterCreateOrganization(...args);
					};
					const afterUpdateOrganization = organizationHooks.afterUpdateOrganization;
					organizationHooks.afterUpdateOrganization = async (...args) => {
						const [{ organization, user }] = args;
						if (organization) trackOrganizationUpdated(organization, getOrganizationTriggerInfo(user));
						if (afterUpdateOrganization) return afterUpdateOrganization(...args);
					};
					const afterAddMember = organizationHooks.afterAddMember;
					organizationHooks.afterAddMember = async (...args) => {
						const [{ organization, member, user }] = args;
						trackOrganizationMemberAdded(organization, member, user, getOrganizationTriggerInfo(user));
						if (afterAddMember) return afterAddMember(...args);
					};
					const afterRemoveMember = organizationHooks.afterRemoveMember;
					organizationHooks.afterRemoveMember = async (...args) => {
						const [{ organization, member, user }] = args;
						trackOrganizationMemberRemoved(organization, member, user, getOrganizationTriggerInfo(user));
						if (afterRemoveMember) return afterRemoveMember(...args);
					};
					const afterUpdateMemberRole = organizationHooks.afterUpdateMemberRole;
					organizationHooks.afterUpdateMemberRole = async (...args) => {
						const [{ organization, member, user, previousRole }] = args;
						trackOrganizationMemberRoleUpdated(organization, member, user, previousRole, getOrganizationTriggerInfo(user));
						if (afterUpdateMemberRole) return afterUpdateMemberRole(...args);
					};
					const afterCreateInvitation = organizationHooks.afterCreateInvitation;
					organizationHooks.afterCreateInvitation = async (...args) => {
						const [{ organization, invitation, inviter }] = args;
						trackOrganizationMemberInvited(organization, invitation, inviter, getOrganizationTriggerInfo(inviter));
						if (afterCreateInvitation) return afterCreateInvitation(...args);
					};
					const afterAcceptInvitation = organizationHooks.afterAcceptInvitation;
					organizationHooks.afterAcceptInvitation = async (...args) => {
						const [{ organization, invitation, member, user }] = args;
						trackOrganizationMemberInviteAccepted(organization, invitation, member, user, getOrganizationTriggerInfo(user));
						if (afterAcceptInvitation) return afterAcceptInvitation(...args);
					};
					const afterRejectInvitation = organizationHooks.afterRejectInvitation;
					organizationHooks.afterRejectInvitation = async (...args) => {
						const [{ organization, invitation, user }] = args;
						trackOrganizationMemberInviteRejected(organization, invitation, user, getOrganizationTriggerInfo(user));
						if (afterRejectInvitation) return afterRejectInvitation(...args);
					};
					const afterCancelInvitation = organizationHooks.afterCancelInvitation;
					organizationHooks.afterCancelInvitation = async (...args) => {
						const [{ organization, invitation, cancelledBy }] = args;
						trackOrganizationMemberInviteCanceled(organization, invitation, cancelledBy, getOrganizationTriggerInfo(cancelledBy));
						if (afterCancelInvitation) return afterCancelInvitation(...args);
					};
					const afterCreateTeam = organizationHooks.afterCreateTeam;
					organizationHooks.afterCreateTeam = async (...args) => {
						const [{ organization, team, user }] = args;
						trackOrganizationTeamCreated(organization, team, getOrganizationTriggerInfo(user));
						if (afterCreateTeam) return afterCreateTeam(...args);
					};
					const afterUpdateTeam = organizationHooks.afterUpdateTeam;
					organizationHooks.afterUpdateTeam = async (...args) => {
						const [{ organization, team, user }] = args;
						if (team) trackOrganizationTeamUpdated(organization, team, getOrganizationTriggerInfo(user));
						if (afterUpdateTeam) return afterUpdateTeam(...args);
					};
					const afterDeleteTeam = organizationHooks.afterDeleteTeam;
					organizationHooks.afterDeleteTeam = async (...args) => {
						const [{ organization, team, user }] = args;
						trackOrganizationTeamDeleted(organization, team, getOrganizationTriggerInfo(user));
						if (afterDeleteTeam) return afterDeleteTeam(...args);
					};
					const afterAddTeamMember = organizationHooks.afterAddTeamMember;
					organizationHooks.afterAddTeamMember = async (...args) => {
						const [{ organization, team, user, teamMember }] = args;
						trackOrganizationTeamMemberAdded(organization, team, user, teamMember, getOrganizationTriggerInfo(user));
						if (afterAddTeamMember) return afterAddTeamMember(...args);
					};
					const afterRemoveTeamMember = organizationHooks.afterRemoveTeamMember;
					organizationHooks.afterRemoveTeamMember = async (...args) => {
						const [{ organization, team, user, teamMember }] = args;
						trackOrganizationTeamMemberRemoved(organization, team, user, teamMember, getOrganizationTriggerInfo(user));
						if (afterRemoveTeamMember) return afterRemoveTeamMember(...args);
					};
				};
				instrumentOrganizationHooks(organizationPlugin.options = organizationPlugin.options ?? {});
			} else logger.debug("[Dash] Organization plugin not active. Skipping instrumentation");
			return { options: {
				databaseHooks: {
					user: {
						create: { async after(user, _ctx) {
							const ctx = _ctx;
							if (!ctx) return;
							const trigger = getTriggerInfo(ctx, user.id);
							const location = ctx.context.location;
							trackUserSignedUp(user, trigger, location);
						} },
						update: { async after(user, _ctx) {
							const ctx = _ctx;
							if (!ctx) return;
							const path = ctx.path;
							const trigger = getTriggerInfo(ctx, user.id);
							const location = ctx.context.location;
							if (matchesAnyRoute(path, [routes.UPDATE_USER, routes.DASH_UPDATE_USER])) {
								const updatedFields = Object.keys(ctx.body || {});
								const isOnlyImageUpdate = updatedFields.length === 1 && updatedFields[0] === "image";
								const isOnlyEmailVerifiedUpdate = updatedFields.length === 1 && updatedFields[0] === "emailVerified";
								const hasEmailVerifiedUpdate = updatedFields.includes("emailVerified");
								if (isOnlyEmailVerifiedUpdate && user.emailVerified) trackUserEmailVerified(user, trigger, location);
								else if (isOnlyImageUpdate && user.image) trackUserProfileImageUpdated(user, trigger, location);
								else if (!isOnlyImageUpdate && !isOnlyEmailVerifiedUpdate) {
									trackUserProfileUpdated(user, trigger, ctx, location);
									if (hasEmailVerifiedUpdate && user.emailVerified) trackUserEmailVerified(user, trigger, location);
								}
							} else if (matchesAnyRoute(path, [routes.CHANGE_EMAIL])) trackUserProfileUpdated(user, trigger, ctx, location);
							if (matchesAnyRoute(path, [routes.VERIFY_EMAIL]) && user.emailVerified) trackUserEmailVerified(user, trigger, location);
							if (matchesAnyRoute(path, [routes.ADMIN_BAN_USER]) && "banned" in user && user.banned) trackUserBanned(user, trigger, location);
							if (matchesAnyRoute(path, [routes.ADMIN_UNBAN_USER]) && "banned" in user && !user.banned) trackUserUnBanned(user, trigger, location);
						} },
						delete: { async after(user, _ctx) {
							const ctx = _ctx;
							if (!ctx) return;
							const trigger = getTriggerInfo(ctx, user.id);
							const location = ctx.context.location;
							trackUserDeleted(user, trigger, location);
						} }
					},
					session: {
						create: {
							async before(session, _ctx) {
								const ctx = _ctx;
								if (!ctx) return;
								return { data: { loginMethod: getLoginMethod(ctx) } };
							},
							async after(session, _ctx) {
								const ctx = _ctx;
								if (!ctx || !session.userId) return;
								const location = ctx.context.location;
								const loginMethod = getLoginMethod(ctx) ?? void 0;
								const enrichedSession = {
									...session,
									loginMethod,
									ipAddress: location?.ipAddress,
									city: location?.city,
									country: location?.country,
									countryCode: location?.countryCode
								};
								let trigger = null;
								if (matchesAnyRoute(ctx.path, [
									routes.SIGN_IN,
									routes.SIGN_UP,
									routes.SIGN_IN_SOCIAL_CALLBACK,
									routes.SIGN_IN_OAUTH_CALLBACK
								])) {
									trigger = getTriggerInfo(ctx, session.userId, enrichedSession);
									trackUserSignedIn(enrichedSession, trigger, ctx, location);
								} else trigger = getTriggerInfo(ctx, session.userId);
								trackSessionCreated(enrichedSession, trigger, ctx, location);
								if ("impersonatedBy" in session && session.impersonatedBy) {
									trigger = {
										...trigger,
										triggeredBy: session.impersonatedBy
									};
									trackUserImpersonated(enrichedSession, trigger, ctx, location);
								}
								if (opts.activityTracking?.enabled) try {
									await ctx.context.adapter.update({
										model: "user",
										where: [{
											field: "id",
											value: session.userId
										}],
										update: { lastActiveAt: /* @__PURE__ */ new Date() }
									});
								} catch (error) {
									logger.warn("[Dash] Failed to update user activity", error);
								}
							}
						},
						delete: { async after(session, _ctx) {
							const ctx = _ctx;
							if (!ctx) return;
							const path = ctx.path;
							const location = ctx.context.location;
							const enrichedSession = {
								...session,
								ipAddress: location?.ipAddress,
								city: location?.city,
								country: location?.country,
								countryCode: location?.countryCode
							};
							const trigger = getTriggerInfo(ctx, session.userId);
							if (matchesAnyRoute(ctx.path, [
								routes.REVOKE_ALL_SESSIONS,
								routes.ADMIN_REVOKE_USER_SESSIONS,
								routes.DASH_REVOKE_SESSIONS_ALL,
								routes.DASH_BAN_USER
							])) {
								if (!processedBulkOperationContexts.has(ctx)) {
									trackSessionRevokedAll(enrichedSession, trigger, ctx, location);
									processedBulkOperationContexts.add(ctx);
								}
							} else if (matchesAnyRoute(path, [routes.SIGN_OUT])) trackUserSignedOut(enrichedSession, trigger, ctx, location);
							else trackSessionRevoked(enrichedSession, trigger, ctx, location);
							if ("impersonatedBy" in session && session.impersonatedBy) trackUserImpersonationStop(enrichedSession, trigger, ctx, location);
						} }
					},
					account: {
						create: { async after(account, _ctx) {
							const ctx = _ctx;
							if (!ctx || !account.userId) return;
							const trigger = getTriggerInfo(ctx, account.userId);
							const location = ctx.context.location;
							trackAccountLinking(account, trigger, ctx, location);
						} },
						update: { async after(account, _ctx) {
							const ctx = _ctx;
							if (!ctx || !account.userId) return;
							const path = ctx.path;
							const trigger = getTriggerInfo(ctx, account.userId);
							const location = ctx.context.location;
							if (matchesAnyRoute(path, [
								routes.CHANGE_PASSWORD,
								routes.SET_PASSWORD,
								routes.RESET_PASSWORD,
								routes.ADMIN_SET_PASSWORD
							])) trackAccountPasswordChange(account, trigger, ctx, location);
						} },
						delete: { async after(account, _ctx) {
							const ctx = _ctx;
							if (!ctx || !account.userId) return;
							const trigger = getTriggerInfo(ctx, account.userId);
							const location = ctx.context.location;
							trackAccountUnlink(account, trigger, ctx, location);
						} }
					},
					verification: {
						create: { async after(verification, _ctx) {
							const ctx = _ctx;
							if (!ctx) return;
							const path = ctx.path;
							const trigger = getTriggerInfo(ctx, ctx.context.session?.user.id ?? "unknown");
							const location = ctx.context.location;
							if (matchesAnyRoute(path, [routes.REQUEST_PASSWORD_RESET])) trackPasswordResetRequest(verification, trigger, ctx, location);
						} },
						delete: { async after(verification, ctx) {
							if (!ctx) return;
							const path = ctx.path;
							const trigger = getTriggerInfo(ctx, ctx.context.session?.user.id ?? "unknown");
							const location = ctx.context.location;
							if (matchesAnyRoute(path, [routes.RESET_PASSWORD])) trackPasswordResetRequestCompletion(verification, trigger, ctx, location);
						} }
					}
				},
				session: { storeSessionInDatabase: ctx.options.session?.storeSessionInDatabase ?? true }
			} };
		},
		hooks: {
			before: [{
				matcher: (ctx) => {
					if (ctx.request?.method !== "GET") return true;
					const path = new URL(ctx.request.url).pathname;
					return matchesAnyRoute(path, [routes.SIGN_IN_SOCIAL_CALLBACK, routes.SIGN_IN_OAUTH_CALLBACK]);
				},
				handler: createIdentificationMiddleware($kv)
			}],
			after: [{
				matcher: (ctx) => {
					if (ctx.request?.method !== "GET") return true;
					const path = new URL(ctx.request.url).pathname;
					return matchesAnyRoute(path, [routes.SIGN_IN_SOCIAL_CALLBACK, routes.SIGN_IN_OAUTH_CALLBACK]);
				},
				handler: createAuthMiddleware(async (_ctx) => {
					const ctx = _ctx;
					const trigger = getTriggerInfo(ctx, ctx.context.session?.user.id ?? "unknown");
					if (matchesAnyRoute(ctx.path, [routes.SEND_VERIFICATION_EMAIL]) && ctx.context.session && !(ctx.context.returned instanceof Error)) trackEmailVerificationSent(ctx.context.session.session, ctx.context.session.user, trigger, ctx);
					const body = ctx.body;
					if (matchesAnyRoute(ctx.path, [routes.SIGN_IN_EMAIL, routes.SIGN_IN_EMAIL_OTP]) && ctx.context.returned instanceof Error && body?.email) trackEmailSignInAttempt(ctx, trigger);
					if (matchesAnyRoute(ctx.path, [routes.SIGN_IN_SOCIAL]) && ctx.context.returned instanceof Error && ctx.body.provider && ctx.body.idToken) trackSocialSignInAttempt(ctx, trigger);
					if (matchesAnyRoute(ctx.path, [routes.SIGN_IN_SOCIAL_CALLBACK]) && ctx.request?.method === "GET" && ctx.context.returned instanceof Error && !ctx.context.newSession) trackSocialSignInRedirectionAttempt(ctx, trigger);
					const headerRequestId = ctx.request?.headers.get("X-Request-Id");
					if (headerRequestId) ctx.setCookie(IDENTIFICATION_COOKIE_NAME, headerRequestId, {
						maxAge: 600,
						sameSite: "lax",
						httpOnly: true,
						path: "/"
					});
					else if (ctx.context.requestId) ctx.setCookie(IDENTIFICATION_COOKIE_NAME, "", {
						maxAge: 0,
						path: "/"
					});
				})
			}, {
				handler: createAuthMiddleware(async (ctx) => {
					if (!opts.activityTracking?.enabled) return;
					if (activityUpdateInterval === 0) return;
					const session = ctx.context.session || ctx.context.newSession;
					if (!session?.user?.id) return;
					const userId = session.user.id;
					const now = Date.now();
					const lastUpdate = session.user.lastActiveAt;
					if (lastUpdate) {
						if (now - new Date(lastUpdate).getTime() < activityUpdateInterval) return;
					}
					ctx.context.adapter.update({
						model: "user",
						where: [{
							field: "id",
							value: userId
						}],
						update: { lastActiveAt: /* @__PURE__ */ new Date() }
					});
				}),
				matcher: (ctx) => ctx.request?.method !== "GET"
			}]
		},
		endpoints: {
			getDashConfig: getConfig(settings),
			getDashValidate: getValidate(settings),
			getDashUsers: getUsers(settings),
			exportDashUsers: exportUsers(settings),
			createDashUser: createUser(settings),
			deleteDashUser: deleteUser(settings),
			deleteManyDashUsers: deleteManyUsers(settings),
			listDashOrganizations: listOrganizations(settings),
			exportDashOrganizations: exportOrganizations(settings),
			getDashOrganization: getOrganization(settings),
			listDashOrganizationMembers: listOrganizationMembers(settings),
			listDashOrganizationInvitations: listOrganizationInvitations(settings),
			listDashOrganizationTeams: listOrganizationTeams(settings),
			listDashOrganizationSsoProviders: listOrganizationSsoProviders(settings),
			createDashSsoProvider: createSsoProvider(settings),
			updateDashSsoProvider: updateSsoProvider(settings),
			requestDashSsoVerificationToken: requestSsoVerificationToken(settings),
			verifyDashSsoProviderDomain: verifySsoProviderDomain(settings),
			deleteDashSsoProvider: deleteSsoProvider(settings),
			markDashSsoProviderDomainVerified: markSsoProviderDomainVerified(settings),
			listDashTeamMembers: listTeamMembers(settings),
			createDashOrganization: createOrganization(settings),
			deleteDashOrganization: deleteOrganization(settings),
			deleteManyDashOrganizations: deleteManyOrganizations(settings),
			getDashOrganizationOptions: getOrganizationOptions(settings),
			getDashUser: getUserDetails(settings),
			getDashUserOrganizations: getUserOrganizations(settings),
			updateDashUser: updateUser(settings),
			setDashPassword: setPassword(settings),
			unlinkDashAccount: unlinkAccount(settings),
			dashRevokeSession: revokeSession(settings),
			dashRevokeAllSessions: revokeAllSessions(settings),
			dashRevokeManySessions: revokeManySessions(settings),
			dashImpersonateUser: impersonateUser(settings),
			updateDashOrganization: updateOrganization(settings),
			createDashTeam: createTeam(settings),
			updateDashTeam: updateTeam(settings),
			deleteDashTeam: deleteTeam(settings),
			addDashTeamMember: addTeamMember(settings),
			removeDashTeamMember: removeTeamMember(settings),
			addDashMember: addMember(settings),
			removeDashMember: removeMember(settings),
			updateDashMemberRole: updateMemberRole(settings),
			inviteDashMember: inviteMember(settings),
			cancelDashInvitation: cancelInvitation(settings),
			resendDashInvitation: resendInvitation(settings),
			dashCheckUserByEmail: checkUserByEmail(settings),
			dashGetUserStats: getUserStats(settings),
			dashGetUserGraphData: getUserGraphData(settings),
			dashGetUserRetentionData: getUserRetentionData(settings),
			dashBanUser: banUser(settings),
			dashBanManyUsers: banManyUsers(settings),
			dashUnbanUser: unbanUser(settings),
			dashSendVerificationEmail: sendVerificationEmail(settings),
			dashSendManyVerificationEmails: sendManyVerificationEmails(settings),
			dashSendResetPasswordEmail: sendResetPasswordEmail(settings),
			dashEnableTwoFactor: enableTwoFactor(settings),
			dashViewTwoFactorTotpUri: viewTwoFactorTotpUri(settings),
			dashViewBackupCodes: viewBackupCodes(settings),
			dashDisableTwoFactor: disableTwoFactor(settings),
			dashGenerateBackupCodes: generateBackupCodes(settings),
			getUserEvents: getUserEvents(settings),
			getAuditLogs: getAuditLogs(settings),
			getAllAuditLogs: getAllAuditLogs(settings),
			getEventTypes: getEventTypes(settings),
			dashAcceptInvitation: acceptInvitation(settings),
			dashCompleteInvitation: completeInvitation(settings),
			dashCheckUserExists: checkUserExists(settings),
			listDashOrganizationDirectories: listOrganizationDirectories(settings),
			createDashOrganizationDirectory: createOrganizationDirectory(settings),
			deleteDashOrganizationDirectory: deleteOrganizationDirectory(settings),
			regenerateDashDirectoryToken: regenerateDirectoryToken(settings),
			dashExecuteAdapter: executeAdapter(settings)
		},
		schema: opts.activityTracking?.enabled ? { user: { fields: { lastActiveAt: {
			type: "date",
			required: false
		} } } } : {}
	};
};
//#endregion
export { CHALLENGE_TTL, DEFAULT_DIFFICULTY, EMAIL_TEMPLATES, SMS_TEMPLATES, USER_EVENT_TYPES, createEmailSender, createSMSSender, dash, decodePoWChallenge, encodePoWSolution, normalizeEmail, sendBulkEmails, sendEmail, sendSMS, sentinel, solvePoWChallenge, verifyPoWSolution };
