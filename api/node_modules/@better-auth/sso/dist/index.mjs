import { t as PACKAGE_VERSION } from "./version-D_ggtAOl.mjs";
import { APIError, createAuthEndpoint, createAuthMiddleware, getSessionFromCtx, sessionMiddleware } from "better-auth/api";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { X509Certificate } from "node:crypto";
import { getHostname } from "tldts";
import { generateRandomString } from "better-auth/crypto";
import * as z from "zod";
import { isPublicRoutableHost } from "@better-auth/core/utils/host";
import { BetterFetchError, betterFetch } from "@better-fetch/fetch";
import { base64 } from "@better-auth/utils/base64";
import { HIDE_METADATA, createAuthorizationURL, generateGenericState, generateState, parseGenericState, parseState, validateAuthorizationCode, validateToken } from "better-auth";
import { deleteSessionCookie, setSessionCookie } from "better-auth/cookies";
import { handleOAuthUserInfo } from "better-auth/oauth2";
import { decodeJwt } from "jose";
import { defineErrorCodes } from "@better-auth/core/utils/error-codes";
import * as samlifyNamespace from "samlify";
import samlifyDefault from "samlify";
//#region src/constants.ts
/**
* SAML Constants
*
* Centralized constants for SAML SSO functionality.
*/
/** Prefix for AuthnRequest IDs used in InResponseTo validation */
const AUTHN_REQUEST_KEY_PREFIX = "saml-authn-request:";
/** Prefix for used Assertion IDs used in replay protection */
const USED_ASSERTION_KEY_PREFIX = "saml-used-assertion:";
/** Prefix for SAML session data (NameID + SessionIndex) for SLO */
const SAML_SESSION_KEY_PREFIX = "saml-session:";
/** Prefix for reverse lookup of SAML session by Better Auth session ID */
const SAML_SESSION_BY_ID_PREFIX = "saml-session-by-id:";
/** Prefix for LogoutRequest IDs used in SP-initiated SLO validation */
const LOGOUT_REQUEST_KEY_PREFIX = "saml-logout-request:";
/**
* Default TTL for used assertion records (15 minutes).
* This should match the maximum expected NotOnOrAfter window plus clock skew.
*/
const DEFAULT_ASSERTION_TTL_MS = 900 * 1e3;
/**
* Default clock skew tolerance (5 minutes).
* Allows for minor time differences between IdP and SP servers.
*
* Accommodates:
* - Network latency and processing time
* - Clock synchronization differences (NTP drift)
* - Distributed systems across timezones
*/
const DEFAULT_CLOCK_SKEW_MS = 300 * 1e3;
/**
* Default maximum size for SAML responses (256 KB).
* Protects against memory exhaustion from oversized SAML payloads.
*/
const DEFAULT_MAX_SAML_RESPONSE_SIZE = 256 * 1024;
/**
* Default maximum size for IdP metadata (100 KB).
* Protects against oversized metadata documents.
*/
const DEFAULT_MAX_SAML_METADATA_SIZE = 100 * 1024;
const SAML_STATUS_SUCCESS = "urn:oasis:names:tc:SAML:2.0:status:Success";
//#endregion
//#region src/utils.ts
/**
* Safely parses a value that might be a JSON string or already a parsed object.
* This handles cases where ORMs like Drizzle might return already parsed objects
* instead of JSON strings from TEXT/JSON columns.
*
* @param value - The value to parse (string, object, null, or undefined)
* @returns The parsed object or null
* @throws Error if string parsing fails
*/
function safeJsonParse(value) {
	if (!value) return null;
	if (typeof value === "object") return value;
	if (typeof value === "string") try {
		return JSON.parse(value);
	} catch (error) {
		throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
	return null;
}
/**
* Checks if a domain matches any domain in a comma-separated list.
*/
const domainMatches = (searchDomain, domainList) => {
	const search = searchDomain.toLowerCase();
	return domainList.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean).some((d) => search === d || search.endsWith(`.${d}`));
};
/**
* Validates email domain against allowed domain(s).
* Supports comma-separated domains for multi-domain SSO.
*/
const validateEmailDomain = (email, domain) => {
	const emailDomain = email.split("@")[1]?.toLowerCase();
	if (!emailDomain || !domain) return false;
	return domainMatches(emailDomain, domain);
};
function parseCertificate(certPem) {
	const cert = new X509Certificate(certPem.includes("-----BEGIN") ? certPem : `-----BEGIN CERTIFICATE-----\n${certPem}\n-----END CERTIFICATE-----`);
	return {
		fingerprintSha256: cert.fingerprint256,
		notBefore: cert.validFrom,
		notAfter: cert.validTo,
		publicKeyAlgorithm: cert.publicKey.asymmetricKeyType?.toUpperCase() || "UNKNOWN"
	};
}
function getHostnameFromDomain(domain) {
	return getHostname(domain) || null;
}
function maskClientId(clientId) {
	if (clientId.length <= 4) return "****";
	return `****${clientId.slice(-4)}`;
}
//#endregion
//#region src/linking/org-assignment.ts
/**
* Assigns a user to an organization based on the SSO provider's organizationId.
* Used in SSO flows (OIDC, SAML) where the provider is already linked to an org.
*/
async function assignOrganizationFromProvider(ctx, options) {
	const { user, profile, provider, token, provisioningOptions } = options;
	if (!provider.organizationId) return;
	if (provisioningOptions?.disabled) return;
	if (!ctx.context.hasPlugin("organization")) return;
	if (await ctx.context.adapter.findOne({
		model: "member",
		where: [{
			field: "organizationId",
			value: provider.organizationId
		}, {
			field: "userId",
			value: user.id
		}]
	})) return;
	const role = provisioningOptions?.getRole ? await provisioningOptions.getRole({
		user,
		userInfo: profile.rawAttributes || {},
		token,
		provider
	}) : provisioningOptions?.defaultRole || "member";
	await ctx.context.adapter.create({
		model: "member",
		data: {
			organizationId: provider.organizationId,
			userId: user.id,
			role,
			createdAt: /* @__PURE__ */ new Date()
		}
	});
}
/**
* Assigns a user to an organization based on their email domain.
* Looks up SSO providers that match the user's email domain and assigns
* the user to the associated organization.
*
* This enables domain-based org assignment for non-SSO sign-in methods
* (e.g., Google OAuth with @acme.com email gets added to Acme's org).
*/
async function assignOrganizationByDomain(ctx, options) {
	const { user, provisioningOptions, domainVerification } = options;
	if (provisioningOptions?.disabled) return;
	if (!ctx.context.hasPlugin("organization")) return;
	const domain = user.email.split("@")[1];
	if (!domain) return;
	const whereClause = [{
		field: "domain",
		value: domain
	}];
	if (domainVerification?.enabled) whereClause.push({
		field: "domainVerified",
		value: true
	});
	let ssoProvider = await ctx.context.adapter.findOne({
		model: "ssoProvider",
		where: whereClause
	});
	if (!ssoProvider) ssoProvider = (await ctx.context.adapter.findMany({
		model: "ssoProvider",
		where: domainVerification?.enabled ? [{
			field: "domainVerified",
			value: true
		}] : []
	})).find((p) => domainMatches(domain, p.domain)) ?? null;
	if (!ssoProvider || !ssoProvider.organizationId) return;
	if (await ctx.context.adapter.findOne({
		model: "member",
		where: [{
			field: "organizationId",
			value: ssoProvider.organizationId
		}, {
			field: "userId",
			value: user.id
		}]
	})) return;
	const role = provisioningOptions?.getRole ? await provisioningOptions.getRole({
		user,
		userInfo: {},
		provider: ssoProvider
	}) : provisioningOptions?.defaultRole || "member";
	await ctx.context.adapter.create({
		model: "member",
		data: {
			organizationId: ssoProvider.organizationId,
			userId: user.id,
			role,
			createdAt: /* @__PURE__ */ new Date()
		}
	});
}
//#endregion
//#region src/routes/domain-verification.ts
const DNS_LABEL_MAX_LENGTH = 63;
const DEFAULT_TOKEN_PREFIX = "better-auth-token";
const domainVerificationBodySchema = z.object({ providerId: z.string() });
function getVerificationIdentifier(options, providerId) {
	return `_${options.domainVerification?.tokenPrefix || DEFAULT_TOKEN_PREFIX}-${providerId}`;
}
const requestDomainVerification = (options) => {
	return createAuthEndpoint("/sso/request-domain-verification", {
		method: "POST",
		body: domainVerificationBodySchema,
		metadata: { openapi: {
			summary: "Request a domain verification",
			description: "Request a domain verification for the given SSO provider",
			responses: {
				"404": { description: "Provider not found" },
				"409": { description: "Domain has already been verified" },
				"201": { description: "Domain submitted for verification" }
			}
		} },
		use: [sessionMiddleware]
	}, async (ctx) => {
		const body = ctx.body;
		const provider = await ctx.context.adapter.findOne({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: body.providerId
			}]
		});
		if (!provider) throw new APIError("NOT_FOUND", {
			message: "Provider not found",
			code: "PROVIDER_NOT_FOUND"
		});
		const userId = ctx.context.session.user.id;
		let isOrgMember = true;
		if (provider.organizationId) isOrgMember = await ctx.context.adapter.count({
			model: "member",
			where: [{
				field: "userId",
				value: userId
			}, {
				field: "organizationId",
				value: provider.organizationId
			}]
		}) > 0;
		if (provider.userId !== userId || !isOrgMember) throw new APIError("FORBIDDEN", {
			message: "User must be owner of or belong to the SSO provider organization",
			code: "INSUFICCIENT_ACCESS"
		});
		if ("domainVerified" in provider && provider.domainVerified) throw new APIError("CONFLICT", {
			message: "Domain has already been verified",
			code: "DOMAIN_VERIFIED"
		});
		const identifier = getVerificationIdentifier(options, provider.providerId);
		const activeVerification = await ctx.context.internalAdapter.findVerificationValue(identifier);
		if (activeVerification && new Date(activeVerification.expiresAt) > /* @__PURE__ */ new Date()) {
			ctx.setStatus(201);
			return ctx.json({ domainVerificationToken: activeVerification.value });
		}
		const domainVerificationToken = generateRandomString(24);
		await ctx.context.internalAdapter.createVerificationValue({
			identifier,
			value: domainVerificationToken,
			expiresAt: new Date(Date.now() + 3600 * 24 * 7 * 1e3)
		});
		ctx.setStatus(201);
		return ctx.json({ domainVerificationToken });
	});
};
const verifyDomain = (options) => {
	return createAuthEndpoint("/sso/verify-domain", {
		method: "POST",
		body: domainVerificationBodySchema,
		metadata: { openapi: {
			summary: "Verify the provider domain ownership",
			description: "Verify the provider domain ownership via DNS records",
			responses: {
				"404": { description: "Provider not found" },
				"409": { description: "Domain has already been verified or no pending verification exists" },
				"502": { description: "Unable to verify domain ownership due to upstream validator error" },
				"204": { description: "Domain ownership was verified" }
			}
		} },
		use: [sessionMiddleware]
	}, async (ctx) => {
		const body = ctx.body;
		const provider = await ctx.context.adapter.findOne({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: body.providerId
			}]
		});
		if (!provider) throw new APIError("NOT_FOUND", {
			message: "Provider not found",
			code: "PROVIDER_NOT_FOUND"
		});
		const userId = ctx.context.session.user.id;
		let isOrgMember = true;
		if (provider.organizationId) isOrgMember = await ctx.context.adapter.count({
			model: "member",
			where: [{
				field: "userId",
				value: userId
			}, {
				field: "organizationId",
				value: provider.organizationId
			}]
		}) > 0;
		if (provider.userId !== userId || !isOrgMember) throw new APIError("FORBIDDEN", {
			message: "User must be owner of or belong to the SSO provider organization",
			code: "INSUFICCIENT_ACCESS"
		});
		if ("domainVerified" in provider && provider.domainVerified) throw new APIError("CONFLICT", {
			message: "Domain has already been verified",
			code: "DOMAIN_VERIFIED"
		});
		const identifier = getVerificationIdentifier(options, provider.providerId);
		if (identifier.length > DNS_LABEL_MAX_LENGTH) throw new APIError("BAD_REQUEST", {
			message: `Verification identifier exceeds the DNS label limit of ${DNS_LABEL_MAX_LENGTH} characters`,
			code: "IDENTIFIER_TOO_LONG"
		});
		const activeVerification = await ctx.context.internalAdapter.findVerificationValue(identifier);
		if (!activeVerification || new Date(activeVerification.expiresAt) <= /* @__PURE__ */ new Date()) throw new APIError("NOT_FOUND", {
			message: "No pending domain verification exists",
			code: "NO_PENDING_VERIFICATION"
		});
		let records = [];
		let dns;
		try {
			dns = await import("node:dns/promises");
		} catch (error) {
			ctx.context.logger.error("The core node:dns module is required for the domain verification feature", error);
			throw new APIError("INTERNAL_SERVER_ERROR", {
				message: "Unable to verify domain ownership due to server error",
				code: "DOMAIN_VERIFICATION_FAILED"
			});
		}
		const hostname = getHostnameFromDomain(provider.domain);
		if (!hostname) throw new APIError("BAD_REQUEST", {
			message: "Invalid domain",
			code: "INVALID_DOMAIN"
		});
		try {
			records = (await dns.resolveTxt(`${identifier}.${hostname}`)).flat();
		} catch (error) {
			ctx.context.logger.warn("DNS resolution failure while validating domain ownership", error);
		}
		if (!records.find((record) => record.includes(`${activeVerification.identifier}=${activeVerification.value}`))) throw new APIError("BAD_GATEWAY", {
			message: "Unable to verify domain ownership. Try again later",
			code: "DOMAIN_VERIFICATION_FAILED"
		});
		await ctx.context.adapter.update({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: provider.providerId
			}],
			update: { domainVerified: true }
		});
		ctx.setStatus(204);
	});
};
//#endregion
//#region src/oidc/types.ts
/**
* Custom error class for OIDC discovery failures.
* Can be caught and mapped to APIError at the edge.
*/
var DiscoveryError = class DiscoveryError extends Error {
	code;
	details;
	constructor(code, message, details, options) {
		super(message, options);
		this.name = "DiscoveryError";
		this.code = code;
		this.details = details;
		if (Error.captureStackTrace) Error.captureStackTrace(this, DiscoveryError);
	}
};
/**
* Required fields that must be present in a valid discovery document.
*/
const REQUIRED_DISCOVERY_FIELDS = [
	"issuer",
	"authorization_endpoint",
	"token_endpoint",
	"jwks_uri"
];
//#endregion
//#region src/oidc/discovery.ts
/**
* OIDC Discovery Pipeline
*
* Implements OIDC discovery document fetching, validation, and hydration.
* This module is used both at provider registration time (to persist validated config)
* and at runtime (to hydrate legacy providers that are missing metadata).
*
* @see https://openid.net/specs/openid-connect-discovery-1_0.html
*/
/** Default timeout for discovery requests (10 seconds) */
const DEFAULT_DISCOVERY_TIMEOUT = 1e4;
/**
* Main entry point: Discover and hydrate OIDC configuration from an issuer.
*
* This function:
* 1. Computes the discovery URL from the issuer
* 2. Validates the discovery URL
* 3. Fetches the discovery document
* 4. Validates the discovery document (issuer match + required fields)
* 5. Normalizes URLs
* 6. Selects token endpoint auth method
* 7. Merges with existing config (existing values take precedence)
*
* @param params - Discovery parameters
* @param isTrustedOrigin - Origin verification tester function
* @returns Hydrated OIDC configuration ready for persistence
* @throws DiscoveryError on any failure
*/
async function discoverOIDCConfig(params) {
	const { issuer, existingConfig, timeout = DEFAULT_DISCOVERY_TIMEOUT } = params;
	const discoveryUrl = params.discoveryEndpoint || existingConfig?.discoveryEndpoint || computeDiscoveryUrl(issuer);
	validateDiscoveryUrl(discoveryUrl, params.isTrustedOrigin);
	const discoveryDoc = await fetchDiscoveryDocument(discoveryUrl, timeout);
	validateDiscoveryDocument(discoveryDoc, issuer);
	const normalizedDoc = normalizeDiscoveryUrls(discoveryDoc, issuer, params.isTrustedOrigin);
	const tokenEndpointAuth = selectTokenEndpointAuthMethod(normalizedDoc, existingConfig?.tokenEndpointAuthentication);
	return {
		issuer: existingConfig?.issuer ?? normalizedDoc.issuer,
		discoveryEndpoint: existingConfig?.discoveryEndpoint ?? discoveryUrl,
		authorizationEndpoint: existingConfig?.authorizationEndpoint ?? normalizedDoc.authorization_endpoint,
		tokenEndpoint: existingConfig?.tokenEndpoint ?? normalizedDoc.token_endpoint,
		jwksEndpoint: existingConfig?.jwksEndpoint ?? normalizedDoc.jwks_uri,
		userInfoEndpoint: existingConfig?.userInfoEndpoint ?? normalizedDoc.userinfo_endpoint,
		tokenEndpointAuthentication: existingConfig?.tokenEndpointAuthentication ?? tokenEndpointAuth,
		scopesSupported: existingConfig?.scopesSupported ?? normalizedDoc.scopes_supported
	};
}
/**
* Compute the discovery URL from an issuer URL.
*
* Per OIDC Discovery spec, the discovery document is located at:
* <issuer>/.well-known/openid-configuration
*
* Handles trailing slashes correctly.
*/
function computeDiscoveryUrl(issuer) {
	return `${issuer.endsWith("/") ? issuer.slice(0, -1) : issuer}/.well-known/openid-configuration`;
}
/**
* Validate a discovery URL before fetching.
*
* @param url - The discovery URL to validate
* @param isTrustedOrigin - Origin verification tester function
* @throws DiscoveryError if URL is invalid
*/
function validateDiscoveryUrl(url, isTrustedOrigin) {
	const discoveryEndpoint = parseURL("discoveryEndpoint", url).toString();
	if (!isTrustedOrigin(discoveryEndpoint)) throw new DiscoveryError("discovery_untrusted_origin", `The main discovery endpoint "${discoveryEndpoint}" is not trusted by your trusted origins configuration.`, { url: discoveryEndpoint });
}
/**
* Validate that a user-supplied OIDC endpoint URL is safe to fetch.
*
* Layered checks (in order):
*   1. URL parsing + http(s) scheme            → discovery_invalid_url
*   2. Public-routable host (RFC 6890)         → allowed
*   3. Operator-allowlisted via trustedOrigins → allowed (opt-in for internal IdPs)
*   4. Otherwise                               → discovery_private_host
*
* Step 2 rejects loopback, RFC 1918, link-local, ULA, shared-address,
* cloud-metadata FQDNs (e.g. `169.254.169.254`, `metadata.google.internal`),
* multicast, and reserved ranges. See `isPublicRoutableHost` in
* `@better-auth/core/utils/host`.
*
* Step 3 is the documented escape hatch for customers whose IdP runs on a
* private network or behind a corporate VPN: they add the IdP origin to their
* `trustedOrigins` configuration.
*
* @param name - The endpoint field name, used in error messages
* @param endpoint - The URL to validate
* @param isTrustedOrigin - Predicate matching the configured `trustedOrigins`
* @throws DiscoveryError(discovery_invalid_url)  — malformed URL or non-http(s) scheme
* @throws DiscoveryError(discovery_private_host) — host is not publicly routable and not allowlisted
*/
function validateSkipDiscoveryEndpoint(name, endpoint, isTrustedOrigin) {
	const parsed = parseURL(name, endpoint);
	if (isPublicRoutableHost(parsed.hostname)) return;
	if (isTrustedOrigin(parsed.toString())) return;
	throw new DiscoveryError("discovery_private_host", `The ${name} URL (${parsed.toString()}) is not publicly routable: ${parsed.hostname}. If this is an internal IdP, add its origin to trustedOrigins.`, {
		endpoint: name,
		url: endpoint,
		hostname: parsed.hostname
	});
}
/**
* Validate every present OIDC endpoint URL in a registration or update body.
*
* Each provided URL is checked with {@link validateSkipDiscoveryEndpoint}.
* Omitted (undefined / null / empty) fields are skipped.
*
* @param config - OIDC endpoint URLs from the request body
* @param isTrustedOrigin - Predicate matching the configured `trustedOrigins`
* @throws DiscoveryError on the first invalid endpoint
*/
function validateSkipDiscoveryEndpoints(config, isTrustedOrigin) {
	const fields = [
		["authorizationEndpoint", config.authorizationEndpoint],
		["tokenEndpoint", config.tokenEndpoint],
		["userInfoEndpoint", config.userInfoEndpoint],
		["jwksEndpoint", config.jwksEndpoint],
		["discoveryEndpoint", config.discoveryEndpoint]
	];
	for (const [name, url] of fields) if (url) validateSkipDiscoveryEndpoint(name, url, isTrustedOrigin);
}
/**
* Fetch the OIDC discovery document from the IdP.
*
* @param url - The discovery endpoint URL
* @param timeout - Request timeout in milliseconds
* @returns The parsed discovery document
* @throws DiscoveryError on network errors, timeouts, or invalid responses
*/
async function fetchDiscoveryDocument(url, timeout = DEFAULT_DISCOVERY_TIMEOUT) {
	try {
		const response = await betterFetch(url, {
			method: "GET",
			timeout
		});
		if (response.error) {
			const { status } = response.error;
			if (status === 404) throw new DiscoveryError("discovery_not_found", "Discovery endpoint not found", {
				url,
				status
			});
			if (status === 408) throw new DiscoveryError("discovery_timeout", "Discovery request timed out", {
				url,
				timeout
			});
			throw new DiscoveryError("discovery_unexpected_error", `Unexpected discovery error: ${response.error.statusText}`, {
				url,
				...response.error
			});
		}
		if (!response.data) throw new DiscoveryError("discovery_invalid_json", "Discovery endpoint returned an empty response", { url });
		const data = response.data;
		if (typeof data === "string") throw new DiscoveryError("discovery_invalid_json", "Discovery endpoint returned invalid JSON", {
			url,
			bodyPreview: data.slice(0, 200)
		});
		return data;
	} catch (error) {
		if (error instanceof DiscoveryError) throw error;
		if (error instanceof Error && error.name === "AbortError") throw new DiscoveryError("discovery_timeout", "Discovery request timed out", {
			url,
			timeout
		});
		throw new DiscoveryError("discovery_unexpected_error", `Unexpected error during discovery: ${error instanceof Error ? error.message : String(error)}`, { url }, { cause: error });
	}
}
/**
* Validate a discovery document.
*
* Checks:
* 1. All required fields are present
* 2. Issuer matches the configured issuer (case-sensitive, exact match)
*
* Invariant: If this function returns without throwing, the document is safe
* to use for hydrating OIDC config (required fields present, issuer matches
* configured value, basic structural sanity verified).
*
* @param doc - The discovery document to validate
* @param configuredIssuer - The expected issuer value
* @throws DiscoveryError if validation fails
*/
function validateDiscoveryDocument(doc, configuredIssuer) {
	const missingFields = [];
	for (const field of REQUIRED_DISCOVERY_FIELDS) if (!doc[field]) missingFields.push(field);
	if (missingFields.length > 0) throw new DiscoveryError("discovery_incomplete", `Discovery document is missing required fields: ${missingFields.join(", ")}`, { missingFields });
	if ((doc.issuer.endsWith("/") ? doc.issuer.slice(0, -1) : doc.issuer) !== (configuredIssuer.endsWith("/") ? configuredIssuer.slice(0, -1) : configuredIssuer)) throw new DiscoveryError("issuer_mismatch", `Discovered issuer "${doc.issuer}" does not match configured issuer "${configuredIssuer}"`, {
		discovered: doc.issuer,
		configured: configuredIssuer
	});
}
/**
* Normalize URLs in the discovery document.
*
* @param document - The discovery document
* @param issuer - The base issuer URL
* @param isTrustedOrigin - Origin verification tester function
* @returns The normalized discovery document
*/
function normalizeDiscoveryUrls(document, issuer, isTrustedOrigin) {
	const doc = { ...document };
	doc.token_endpoint = normalizeAndValidateUrl("token_endpoint", doc.token_endpoint, issuer, isTrustedOrigin);
	doc.authorization_endpoint = normalizeAndValidateUrl("authorization_endpoint", doc.authorization_endpoint, issuer, isTrustedOrigin);
	doc.jwks_uri = normalizeAndValidateUrl("jwks_uri", doc.jwks_uri, issuer, isTrustedOrigin);
	if (doc.userinfo_endpoint) doc.userinfo_endpoint = normalizeAndValidateUrl("userinfo_endpoint", doc.userinfo_endpoint, issuer, isTrustedOrigin);
	if (doc.revocation_endpoint) doc.revocation_endpoint = normalizeAndValidateUrl("revocation_endpoint", doc.revocation_endpoint, issuer, isTrustedOrigin);
	if (doc.end_session_endpoint) doc.end_session_endpoint = normalizeAndValidateUrl("end_session_endpoint", doc.end_session_endpoint, issuer, isTrustedOrigin);
	if (doc.introspection_endpoint) doc.introspection_endpoint = normalizeAndValidateUrl("introspection_endpoint", doc.introspection_endpoint, issuer, isTrustedOrigin);
	return doc;
}
/**
* Normalizes and validates a single URL endpoint
* @param name The url name
* @param endpoint The url to validate
* @param issuer The issuer base url
* @param isTrustedOrigin - Origin verification tester function
* @returns
*/
function normalizeAndValidateUrl(name, endpoint, issuer, isTrustedOrigin) {
	const url = normalizeUrl(name, endpoint, issuer);
	if (!isTrustedOrigin(url)) throw new DiscoveryError("discovery_untrusted_origin", `The ${name} "${url}" is not trusted by your trusted origins configuration.`, {
		endpoint: name,
		url
	});
	return url;
}
/**
* Normalize a single URL endpoint.
*
* @param name - The endpoint name (e.g token_endpoint)
* @param endpoint - The endpoint URL to normalize
* @param issuer - The base issuer URL
* @returns The normalized endpoint URL
*/
function normalizeUrl(name, endpoint, issuer) {
	try {
		return parseURL(name, endpoint).toString();
	} catch {
		const issuerURL = parseURL(name, issuer);
		const basePath = issuerURL.pathname.replace(/\/+$/, "");
		const endpointPath = endpoint.replace(/^\/+/, "");
		return parseURL(name, basePath + "/" + endpointPath, issuerURL.origin).toString();
	}
}
/**
* Parses the given URL or throws in case of invalid or unsupported protocols
*
* @param name the url name
* @param endpoint the endpoint url
* @param [base] optional base path
* @returns
*/
function parseURL(name, endpoint, base) {
	let endpointURL;
	try {
		endpointURL = new URL(endpoint, base);
		if (endpointURL.protocol === "http:" || endpointURL.protocol === "https:") return endpointURL;
	} catch (error) {
		throw new DiscoveryError("discovery_invalid_url", `The url "${name}" must be valid: ${endpoint}`, { url: endpoint }, { cause: error });
	}
	throw new DiscoveryError("discovery_invalid_url", `The url "${name}" must use the http or https supported protocols: ${endpoint}`, {
		url: endpoint,
		protocol: endpointURL.protocol
	});
}
/**
* Select the token endpoint authentication method.
*
* @param doc - The discovery document
* @param existing - Existing authentication method from config
* @returns The selected authentication method
*/
function selectTokenEndpointAuthMethod(doc, existing) {
	if (existing) return existing;
	const supported = doc.token_endpoint_auth_methods_supported;
	if (!supported || supported.length === 0) return "client_secret_basic";
	if (supported.includes("client_secret_basic")) return "client_secret_basic";
	if (supported.includes("client_secret_post")) return "client_secret_post";
	return "client_secret_basic";
}
/**
* Check if a provider configuration needs runtime discovery.
*
* Returns true if we need discovery at runtime to complete the token exchange
* and validation. Specifically checks for:
* - `tokenEndpoint` - required for exchanging authorization code for tokens
* - `jwksEndpoint` - required for validating ID token signatures
* - `authorizationEndpoint` - required for redirecting users to the IdP for login
*
* @param config - Partial OIDC config from the provider
* @returns true if runtime discovery should be performed
*/
function needsRuntimeDiscovery(config) {
	if (!config) return true;
	return !config.tokenEndpoint || !config.jwksEndpoint || !config.authorizationEndpoint;
}
/**
* Runs runtime OIDC discovery when the stored config is missing required
* endpoints, and merges the hydrated fields back into the config.
* Throws if discovery fails.
*/
async function ensureRuntimeDiscovery(config, issuer, isTrustedOrigin) {
	if (!needsRuntimeDiscovery(config)) return config;
	const hydrated = await discoverOIDCConfig({
		issuer,
		existingConfig: config,
		isTrustedOrigin
	});
	return {
		...config,
		authorizationEndpoint: hydrated.authorizationEndpoint,
		tokenEndpoint: hydrated.tokenEndpoint,
		tokenEndpointAuthentication: hydrated.tokenEndpointAuthentication,
		userInfoEndpoint: hydrated.userInfoEndpoint,
		jwksEndpoint: hydrated.jwksEndpoint
	};
}
//#endregion
//#region src/oidc/errors.ts
/**
* OIDC Discovery Error Mapping
*
* Maps DiscoveryError codes to appropriate APIError responses.
* Used at the boundary between the discovery pipeline and HTTP handlers.
*/
/**
* Maps a DiscoveryError to an appropriate APIError for HTTP responses.
*
* Error code mapping:
* - discovery_invalid_url        → 400 BAD_REQUEST
* - discovery_not_found          → 400 BAD_REQUEST
* - discovery_untrusted_origin   → 400 BAD_REQUEST
* - discovery_private_host       → 400 BAD_REQUEST
* - discovery_invalid_json       → 400 BAD_REQUEST
* - discovery_incomplete         → 400 BAD_REQUEST
* - issuer_mismatch              → 400 BAD_REQUEST
* - unsupported_token_auth_method → 400 BAD_REQUEST
* - discovery_timeout            → 502 BAD_GATEWAY
* - discovery_unexpected_error   → 502 BAD_GATEWAY
*
* @param error - The DiscoveryError to map
* @returns An APIError with appropriate status and message
*/
function mapDiscoveryErrorToAPIError(error) {
	switch (error.code) {
		case "discovery_timeout": return new APIError("BAD_GATEWAY", {
			message: `OIDC discovery timed out: ${error.message}`,
			code: error.code
		});
		case "discovery_unexpected_error": return new APIError("BAD_GATEWAY", {
			message: `OIDC discovery failed: ${error.message}`,
			code: error.code
		});
		case "discovery_not_found": return new APIError("BAD_REQUEST", {
			message: `OIDC discovery endpoint not found. The issuer may not support OIDC discovery, or the URL is incorrect. ${error.message}`,
			code: error.code
		});
		case "discovery_invalid_url": return new APIError("BAD_REQUEST", {
			message: `Invalid OIDC endpoint URL: ${error.message}`,
			code: error.code
		});
		case "discovery_untrusted_origin": return new APIError("BAD_REQUEST", {
			message: `Untrusted OIDC discovery URL: ${error.message}`,
			code: error.code
		});
		case "discovery_private_host": return new APIError("BAD_REQUEST", {
			message: error.message,
			code: error.code
		});
		case "discovery_invalid_json": return new APIError("BAD_REQUEST", {
			message: `OIDC discovery returned invalid data: ${error.message}`,
			code: error.code
		});
		case "discovery_incomplete": return new APIError("BAD_REQUEST", {
			message: `OIDC discovery document is missing required fields: ${error.message}`,
			code: error.code
		});
		case "issuer_mismatch": return new APIError("BAD_REQUEST", {
			message: `OIDC issuer mismatch: ${error.message}`,
			code: error.code
		});
		case "unsupported_token_auth_method": return new APIError("BAD_REQUEST", {
			message: `Incompatible OIDC provider: ${error.message}`,
			code: error.code
		});
		default:
			error.code;
			return new APIError("INTERNAL_SERVER_ERROR", {
				message: `Unexpected discovery error: ${error.message}`,
				code: "discovery_unexpected_error"
			});
	}
}
//#endregion
//#region src/saml/parser.ts
const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	removeNSPrefix: true,
	processEntities: false
});
function findNode(obj, nodeName) {
	if (!obj || typeof obj !== "object") return null;
	const record = obj;
	if (nodeName in record) return record[nodeName];
	for (const value of Object.values(record)) if (Array.isArray(value)) for (const item of value) {
		const found = findNode(item, nodeName);
		if (found) return found;
	}
	else if (typeof value === "object" && value !== null) {
		const found = findNode(value, nodeName);
		if (found) return found;
	}
	return null;
}
function countAllNodes(obj, nodeName) {
	if (!obj || typeof obj !== "object") return 0;
	let count = 0;
	const record = obj;
	if (nodeName in record) {
		const node = record[nodeName];
		count += Array.isArray(node) ? node.length : 1;
	}
	for (const value of Object.values(record)) if (Array.isArray(value)) for (const item of value) count += countAllNodes(item, nodeName);
	else if (typeof value === "object" && value !== null) count += countAllNodes(value, nodeName);
	return count;
}
//#endregion
//#region src/saml/algorithms.ts
const SignatureAlgorithm = {
	RSA_SHA1: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
	RSA_SHA256: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
	RSA_SHA384: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha384",
	RSA_SHA512: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512",
	ECDSA_SHA256: "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
	ECDSA_SHA384: "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha384",
	ECDSA_SHA512: "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha512"
};
const DigestAlgorithm = {
	SHA1: "http://www.w3.org/2000/09/xmldsig#sha1",
	SHA256: "http://www.w3.org/2001/04/xmlenc#sha256",
	SHA384: "http://www.w3.org/2001/04/xmldsig-more#sha384",
	SHA512: "http://www.w3.org/2001/04/xmlenc#sha512"
};
const KeyEncryptionAlgorithm = {
	RSA_1_5: "http://www.w3.org/2001/04/xmlenc#rsa-1_5",
	RSA_OAEP: "http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p",
	RSA_OAEP_SHA256: "http://www.w3.org/2009/xmlenc11#rsa-oaep"
};
const DataEncryptionAlgorithm = {
	TRIPLEDES_CBC: "http://www.w3.org/2001/04/xmlenc#tripledes-cbc",
	AES_128_CBC: "http://www.w3.org/2001/04/xmlenc#aes128-cbc",
	AES_192_CBC: "http://www.w3.org/2001/04/xmlenc#aes192-cbc",
	AES_256_CBC: "http://www.w3.org/2001/04/xmlenc#aes256-cbc",
	AES_128_GCM: "http://www.w3.org/2009/xmlenc11#aes128-gcm",
	AES_192_GCM: "http://www.w3.org/2009/xmlenc11#aes192-gcm",
	AES_256_GCM: "http://www.w3.org/2009/xmlenc11#aes256-gcm"
};
const DEPRECATED_SIGNATURE_ALGORITHMS = [SignatureAlgorithm.RSA_SHA1];
const DEPRECATED_KEY_ENCRYPTION_ALGORITHMS = [KeyEncryptionAlgorithm.RSA_1_5];
const DEPRECATED_DATA_ENCRYPTION_ALGORITHMS = [DataEncryptionAlgorithm.TRIPLEDES_CBC];
const DEPRECATED_DIGEST_ALGORITHMS = [DigestAlgorithm.SHA1];
const SECURE_SIGNATURE_ALGORITHMS = [
	SignatureAlgorithm.RSA_SHA256,
	SignatureAlgorithm.RSA_SHA384,
	SignatureAlgorithm.RSA_SHA512,
	SignatureAlgorithm.ECDSA_SHA256,
	SignatureAlgorithm.ECDSA_SHA384,
	SignatureAlgorithm.ECDSA_SHA512
];
const SECURE_DIGEST_ALGORITHMS = [
	DigestAlgorithm.SHA256,
	DigestAlgorithm.SHA384,
	DigestAlgorithm.SHA512
];
const SHORT_FORM_SIGNATURE_TO_URI = {
	sha1: SignatureAlgorithm.RSA_SHA1,
	sha256: SignatureAlgorithm.RSA_SHA256,
	sha384: SignatureAlgorithm.RSA_SHA384,
	sha512: SignatureAlgorithm.RSA_SHA512,
	"rsa-sha1": SignatureAlgorithm.RSA_SHA1,
	"rsa-sha256": SignatureAlgorithm.RSA_SHA256,
	"rsa-sha384": SignatureAlgorithm.RSA_SHA384,
	"rsa-sha512": SignatureAlgorithm.RSA_SHA512,
	"ecdsa-sha256": SignatureAlgorithm.ECDSA_SHA256,
	"ecdsa-sha384": SignatureAlgorithm.ECDSA_SHA384,
	"ecdsa-sha512": SignatureAlgorithm.ECDSA_SHA512
};
const SHORT_FORM_DIGEST_TO_URI = {
	sha1: DigestAlgorithm.SHA1,
	sha256: DigestAlgorithm.SHA256,
	sha384: DigestAlgorithm.SHA384,
	sha512: DigestAlgorithm.SHA512
};
function normalizeSignatureAlgorithm(alg) {
	return SHORT_FORM_SIGNATURE_TO_URI[alg.toLowerCase()] ?? alg;
}
function normalizeDigestAlgorithm(alg) {
	return SHORT_FORM_DIGEST_TO_URI[alg.toLowerCase()] ?? alg;
}
function extractEncryptionAlgorithms(xml) {
	try {
		const parsed = xmlParser.parse(xml);
		const keyAlg = (findNode(parsed, "EncryptedKey")?.EncryptionMethod)?.["@_Algorithm"];
		const dataAlg = (findNode(parsed, "EncryptedData")?.EncryptionMethod)?.["@_Algorithm"];
		return {
			keyEncryption: keyAlg || null,
			dataEncryption: dataAlg || null
		};
	} catch {
		return {
			keyEncryption: null,
			dataEncryption: null
		};
	}
}
function hasEncryptedAssertion(xml) {
	try {
		return findNode(xmlParser.parse(xml), "EncryptedAssertion") !== null;
	} catch {
		return false;
	}
}
function handleDeprecatedAlgorithm(message, behavior, errorCode) {
	switch (behavior) {
		case "reject": throw new APIError("BAD_REQUEST", {
			message,
			code: errorCode
		});
		case "warn":
			console.warn(`[SAML Security Warning] ${message}`);
			break;
		case "allow": break;
	}
}
function validateSignatureAlgorithm(algorithm, options = {}) {
	if (!algorithm) return;
	const { onDeprecated = "warn", allowedSignatureAlgorithms } = options;
	if (allowedSignatureAlgorithms) {
		if (!allowedSignatureAlgorithms.includes(algorithm)) throw new APIError("BAD_REQUEST", {
			message: `SAML signature algorithm not in allow-list: ${algorithm}`,
			code: "SAML_ALGORITHM_NOT_ALLOWED"
		});
		return;
	}
	if (DEPRECATED_SIGNATURE_ALGORITHMS.includes(algorithm)) {
		handleDeprecatedAlgorithm(`SAML response uses deprecated signature algorithm: ${algorithm}. Please configure your IdP to use SHA-256 or stronger.`, onDeprecated, "SAML_DEPRECATED_ALGORITHM");
		return;
	}
	if (!SECURE_SIGNATURE_ALGORITHMS.includes(algorithm)) throw new APIError("BAD_REQUEST", {
		message: `SAML signature algorithm not recognized: ${algorithm}`,
		code: "SAML_UNKNOWN_ALGORITHM"
	});
}
function validateEncryptionAlgorithms(algorithms, options = {}) {
	const { onDeprecated = "warn", allowedKeyEncryptionAlgorithms, allowedDataEncryptionAlgorithms } = options;
	const { keyEncryption, dataEncryption } = algorithms;
	if (keyEncryption) {
		if (allowedKeyEncryptionAlgorithms) {
			if (!allowedKeyEncryptionAlgorithms.includes(keyEncryption)) throw new APIError("BAD_REQUEST", {
				message: `SAML key encryption algorithm not in allow-list: ${keyEncryption}`,
				code: "SAML_ALGORITHM_NOT_ALLOWED"
			});
		} else if (DEPRECATED_KEY_ENCRYPTION_ALGORITHMS.includes(keyEncryption)) handleDeprecatedAlgorithm(`SAML response uses deprecated key encryption algorithm: ${keyEncryption}. Please configure your IdP to use RSA-OAEP.`, onDeprecated, "SAML_DEPRECATED_ALGORITHM");
	}
	if (dataEncryption) {
		if (allowedDataEncryptionAlgorithms) {
			if (!allowedDataEncryptionAlgorithms.includes(dataEncryption)) throw new APIError("BAD_REQUEST", {
				message: `SAML data encryption algorithm not in allow-list: ${dataEncryption}`,
				code: "SAML_ALGORITHM_NOT_ALLOWED"
			});
		} else if (DEPRECATED_DATA_ENCRYPTION_ALGORITHMS.includes(dataEncryption)) handleDeprecatedAlgorithm(`SAML response uses deprecated data encryption algorithm: ${dataEncryption}. Please configure your IdP to use AES-GCM.`, onDeprecated, "SAML_DEPRECATED_ALGORITHM");
	}
}
function validateSAMLAlgorithms(response, options) {
	validateSignatureAlgorithm(response.sigAlg, options);
	if (hasEncryptedAssertion(response.samlContent)) validateEncryptionAlgorithms(extractEncryptionAlgorithms(response.samlContent), options);
}
function validateConfigAlgorithms(config, options = {}) {
	const { onDeprecated = "warn", allowedSignatureAlgorithms, allowedDigestAlgorithms } = options;
	if (config.signatureAlgorithm) {
		const normalized = normalizeSignatureAlgorithm(config.signatureAlgorithm);
		if (allowedSignatureAlgorithms) {
			if (!allowedSignatureAlgorithms.map(normalizeSignatureAlgorithm).includes(normalized)) throw new APIError("BAD_REQUEST", {
				message: `SAML signature algorithm not in allow-list: ${config.signatureAlgorithm}`,
				code: "SAML_ALGORITHM_NOT_ALLOWED"
			});
		} else if (DEPRECATED_SIGNATURE_ALGORITHMS.includes(normalized)) handleDeprecatedAlgorithm(`SAML config uses deprecated signature algorithm: ${config.signatureAlgorithm}. Consider using SHA-256 or stronger.`, onDeprecated, "SAML_DEPRECATED_CONFIG_ALGORITHM");
		else if (!SECURE_SIGNATURE_ALGORITHMS.includes(normalized)) throw new APIError("BAD_REQUEST", {
			message: `SAML signature algorithm not recognized: ${config.signatureAlgorithm}`,
			code: "SAML_UNKNOWN_ALGORITHM"
		});
	}
	if (config.digestAlgorithm) {
		const normalized = normalizeDigestAlgorithm(config.digestAlgorithm);
		if (allowedDigestAlgorithms) {
			if (!allowedDigestAlgorithms.map(normalizeDigestAlgorithm).includes(normalized)) throw new APIError("BAD_REQUEST", {
				message: `SAML digest algorithm not in allow-list: ${config.digestAlgorithm}`,
				code: "SAML_ALGORITHM_NOT_ALLOWED"
			});
		} else if (DEPRECATED_DIGEST_ALGORITHMS.includes(normalized)) handleDeprecatedAlgorithm(`SAML config uses deprecated digest algorithm: ${config.digestAlgorithm}. Consider using SHA-256 or stronger.`, onDeprecated, "SAML_DEPRECATED_CONFIG_ALGORITHM");
		else if (!SECURE_DIGEST_ALGORITHMS.includes(normalized)) throw new APIError("BAD_REQUEST", {
			message: `SAML digest algorithm not recognized: ${config.digestAlgorithm}`,
			code: "SAML_UNKNOWN_ALGORITHM"
		});
	}
}
//#endregion
//#region src/saml/assertions.ts
function countAssertions(xml) {
	let parsed;
	try {
		parsed = xmlParser.parse(xml);
	} catch {
		throw new APIError("BAD_REQUEST", {
			message: "Failed to parse SAML response XML",
			code: "SAML_INVALID_XML"
		});
	}
	const assertions = countAllNodes(parsed, "Assertion");
	const encryptedAssertions = countAllNodes(parsed, "EncryptedAssertion");
	return {
		assertions,
		encryptedAssertions,
		total: assertions + encryptedAssertions
	};
}
function validateSingleAssertion(samlResponse) {
	let xml;
	try {
		xml = new TextDecoder().decode(base64.decode(samlResponse.replace(/\s+/g, "")));
		if (!xml.includes("<")) throw new Error("Not XML");
	} catch {
		throw new APIError("BAD_REQUEST", {
			message: "Invalid base64-encoded SAML response",
			code: "SAML_INVALID_ENCODING"
		});
	}
	const counts = countAssertions(xml);
	if (counts.total === 0) throw new APIError("BAD_REQUEST", {
		message: "SAML response contains no assertions",
		code: "SAML_NO_ASSERTION"
	});
	if (counts.total > 1) throw new APIError("BAD_REQUEST", {
		message: `SAML response contains ${counts.total} assertions, expected exactly 1`,
		code: "SAML_MULTIPLE_ASSERTIONS"
	});
}
//#endregion
//#region src/routes/schemas.ts
const oidcMappingSchema = z.object({
	id: z.string().optional(),
	email: z.string().optional(),
	emailVerified: z.string().optional(),
	name: z.string().optional(),
	image: z.string().optional(),
	extraFields: z.record(z.string(), z.any()).optional()
}).optional();
const samlMappingSchema = z.object({
	id: z.string().optional(),
	email: z.string().optional(),
	emailVerified: z.string().optional(),
	name: z.string().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	extraFields: z.record(z.string(), z.any()).optional()
}).optional();
const oidcConfigSchema = z.object({
	clientId: z.string().optional(),
	clientSecret: z.string().optional(),
	authorizationEndpoint: z.url().optional(),
	tokenEndpoint: z.url().optional(),
	userInfoEndpoint: z.url().optional(),
	tokenEndpointAuthentication: z.enum(["client_secret_post", "client_secret_basic"]).optional(),
	jwksEndpoint: z.url().optional(),
	discoveryEndpoint: z.url().optional(),
	scopes: z.array(z.string()).optional(),
	pkce: z.boolean().optional(),
	overrideUserInfo: z.boolean().optional(),
	mapping: oidcMappingSchema
});
const samlConfigSchema = z.object({
	entryPoint: z.string().url().optional(),
	cert: z.string().optional(),
	callbackUrl: z.string().url().optional(),
	audience: z.string().optional(),
	idpMetadata: z.object({
		metadata: z.string().optional(),
		entityID: z.string().optional(),
		cert: z.string().optional(),
		privateKey: z.string().optional(),
		privateKeyPass: z.string().optional(),
		isAssertionEncrypted: z.boolean().optional(),
		encPrivateKey: z.string().optional(),
		encPrivateKeyPass: z.string().optional(),
		singleSignOnService: z.array(z.object({
			Binding: z.string(),
			Location: z.string().url()
		})).optional()
	}).optional(),
	spMetadata: z.object({
		metadata: z.string().optional(),
		entityID: z.string().optional(),
		binding: z.string().optional(),
		privateKey: z.string().optional(),
		privateKeyPass: z.string().optional(),
		isAssertionEncrypted: z.boolean().optional(),
		encPrivateKey: z.string().optional(),
		encPrivateKeyPass: z.string().optional()
	}).optional(),
	wantAssertionsSigned: z.boolean().optional(),
	authnRequestsSigned: z.boolean().optional(),
	signatureAlgorithm: z.string().optional(),
	digestAlgorithm: z.string().optional(),
	identifierFormat: z.string().optional(),
	privateKey: z.string().optional(),
	decryptionPvk: z.string().optional(),
	additionalParams: z.record(z.string(), z.any()).optional(),
	mapping: samlMappingSchema
});
const updateSSOProviderBodySchema = z.object({
	issuer: z.string().url().optional(),
	domain: z.string().optional(),
	oidcConfig: oidcConfigSchema.optional(),
	samlConfig: samlConfigSchema.optional()
});
//#endregion
//#region src/routes/providers.ts
const ADMIN_ROLES = ["owner", "admin"];
function hasOrgAdminRole(member) {
	return member.role.split(",").some((r) => ADMIN_ROLES.includes(r.trim()));
}
async function isOrgAdmin(ctx, userId, organizationId) {
	const member = await ctx.context.adapter.findOne({
		model: "member",
		where: [{
			field: "userId",
			value: userId
		}, {
			field: "organizationId",
			value: organizationId
		}]
	});
	return member ? hasOrgAdminRole(member) : false;
}
async function batchCheckOrgAdmin(ctx, userId, organizationIds) {
	if (organizationIds.length === 0) return /* @__PURE__ */ new Set();
	const members = await ctx.context.adapter.findMany({
		model: "member",
		where: [{
			field: "userId",
			value: userId
		}, {
			field: "organizationId",
			value: organizationIds,
			operator: "in"
		}]
	});
	const adminOrgIds = /* @__PURE__ */ new Set();
	for (const member of members) if (hasOrgAdminRole(member)) adminOrgIds.add(member.organizationId);
	return adminOrgIds;
}
function sanitizeProvider(provider, baseURL) {
	let oidcConfig = null;
	let samlConfig = null;
	try {
		oidcConfig = safeJsonParse(provider.oidcConfig);
	} catch {
		oidcConfig = null;
	}
	try {
		samlConfig = safeJsonParse(provider.samlConfig);
	} catch {
		samlConfig = null;
	}
	const type = samlConfig ? "saml" : "oidc";
	return {
		providerId: provider.providerId,
		type,
		issuer: provider.issuer,
		domain: provider.domain,
		organizationId: provider.organizationId || null,
		domainVerified: provider.domainVerified ?? false,
		oidcConfig: oidcConfig ? {
			discoveryEndpoint: oidcConfig.discoveryEndpoint,
			clientIdLastFour: maskClientId(oidcConfig.clientId),
			pkce: oidcConfig.pkce,
			authorizationEndpoint: oidcConfig.authorizationEndpoint,
			tokenEndpoint: oidcConfig.tokenEndpoint,
			userInfoEndpoint: oidcConfig.userInfoEndpoint,
			jwksEndpoint: oidcConfig.jwksEndpoint,
			scopes: oidcConfig.scopes,
			tokenEndpointAuthentication: oidcConfig.tokenEndpointAuthentication
		} : void 0,
		samlConfig: samlConfig ? {
			entryPoint: samlConfig.entryPoint,
			callbackUrl: samlConfig.callbackUrl,
			audience: samlConfig.audience,
			wantAssertionsSigned: samlConfig.wantAssertionsSigned,
			authnRequestsSigned: samlConfig.authnRequestsSigned,
			identifierFormat: samlConfig.identifierFormat,
			signatureAlgorithm: samlConfig.signatureAlgorithm,
			digestAlgorithm: samlConfig.digestAlgorithm,
			certificate: (() => {
				try {
					return parseCertificate(samlConfig.cert);
				} catch {
					return { error: "Failed to parse certificate" };
				}
			})()
		} : void 0,
		spMetadataUrl: `${baseURL}/sso/saml2/sp/metadata?providerId=${encodeURIComponent(provider.providerId)}`
	};
}
const listSSOProviders = () => {
	return createAuthEndpoint("/sso/providers", {
		method: "GET",
		use: [sessionMiddleware],
		metadata: { openapi: {
			operationId: "listSSOProviders",
			summary: "List SSO providers",
			description: "Returns a list of SSO providers the user has access to",
			responses: { "200": { description: "List of SSO providers" } }
		} }
	}, async (ctx) => {
		const userId = ctx.context.session.user.id;
		const allProviders = await ctx.context.adapter.findMany({ model: "ssoProvider" });
		const userOwnedProviders = allProviders.filter((p) => p.userId === userId && !p.organizationId);
		const orgProviders = allProviders.filter((p) => p.organizationId !== null && p.organizationId !== void 0);
		const orgPluginEnabled = ctx.context.hasPlugin("organization");
		let accessibleProviders = [...userOwnedProviders];
		if (orgPluginEnabled && orgProviders.length > 0) {
			const adminOrgIds = await batchCheckOrgAdmin(ctx, userId, [...new Set(orgProviders.map((p) => p.organizationId).filter((id) => id !== null && id !== void 0))]);
			const orgAccessibleProviders = orgProviders.filter((provider) => provider.organizationId && adminOrgIds.has(provider.organizationId));
			accessibleProviders = [...accessibleProviders, ...orgAccessibleProviders];
		} else if (!orgPluginEnabled) {
			const userOwnedOrgProviders = orgProviders.filter((p) => p.userId === userId);
			accessibleProviders = [...accessibleProviders, ...userOwnedOrgProviders];
		}
		const providers = accessibleProviders.map((p) => sanitizeProvider(p, ctx.context.baseURL));
		return ctx.json({ providers });
	});
};
const getSSOProviderQuerySchema = z.object({ providerId: z.string() });
async function checkProviderAccess(ctx, providerId) {
	const userId = ctx.context.session.user.id;
	const provider = await ctx.context.adapter.findOne({
		model: "ssoProvider",
		where: [{
			field: "providerId",
			value: providerId
		}]
	});
	if (!provider) throw new APIError("NOT_FOUND", { message: "Provider not found" });
	let hasAccess = false;
	if (provider.organizationId) if (ctx.context.hasPlugin("organization")) hasAccess = await isOrgAdmin(ctx, userId, provider.organizationId);
	else hasAccess = provider.userId === userId;
	else hasAccess = provider.userId === userId;
	if (!hasAccess) throw new APIError("FORBIDDEN", { message: "You don't have access to this provider" });
	return provider;
}
const getSSOProvider = () => {
	return createAuthEndpoint("/sso/get-provider", {
		method: "GET",
		use: [sessionMiddleware],
		query: getSSOProviderQuerySchema,
		metadata: { openapi: {
			operationId: "getSSOProvider",
			summary: "Get SSO provider details",
			description: "Returns sanitized details for a specific SSO provider",
			responses: {
				"200": { description: "SSO provider details" },
				"404": { description: "Provider not found" },
				"403": { description: "Access denied" }
			}
		} }
	}, async (ctx) => {
		const { providerId } = ctx.query;
		const provider = await checkProviderAccess(ctx, providerId);
		return ctx.json(sanitizeProvider(provider, ctx.context.baseURL));
	});
};
function parseAndValidateConfig(configString, configType) {
	let config = null;
	try {
		config = safeJsonParse(configString);
	} catch {
		config = null;
	}
	if (!config) throw new APIError("BAD_REQUEST", { message: `Cannot update ${configType} config for a provider that doesn't have ${configType} configured` });
	return config;
}
function mergeSAMLConfig(current, updates, issuer) {
	return {
		...current,
		...updates,
		issuer,
		entryPoint: updates.entryPoint ?? current.entryPoint,
		cert: updates.cert ?? current.cert,
		callbackUrl: updates.callbackUrl ?? current.callbackUrl,
		spMetadata: updates.spMetadata ?? current.spMetadata,
		idpMetadata: updates.idpMetadata ?? current.idpMetadata,
		mapping: updates.mapping ?? current.mapping,
		audience: updates.audience ?? current.audience,
		wantAssertionsSigned: updates.wantAssertionsSigned ?? current.wantAssertionsSigned,
		authnRequestsSigned: updates.authnRequestsSigned ?? current.authnRequestsSigned,
		identifierFormat: updates.identifierFormat ?? current.identifierFormat,
		signatureAlgorithm: updates.signatureAlgorithm ?? current.signatureAlgorithm,
		digestAlgorithm: updates.digestAlgorithm ?? current.digestAlgorithm
	};
}
function mergeOIDCConfig(current, updates, issuer) {
	return {
		...current,
		...updates,
		issuer,
		pkce: updates.pkce ?? current.pkce ?? true,
		clientId: updates.clientId ?? current.clientId,
		clientSecret: updates.clientSecret ?? current.clientSecret,
		discoveryEndpoint: updates.discoveryEndpoint ?? current.discoveryEndpoint,
		mapping: updates.mapping ?? current.mapping,
		scopes: updates.scopes ?? current.scopes,
		authorizationEndpoint: updates.authorizationEndpoint ?? current.authorizationEndpoint,
		tokenEndpoint: updates.tokenEndpoint ?? current.tokenEndpoint,
		userInfoEndpoint: updates.userInfoEndpoint ?? current.userInfoEndpoint,
		jwksEndpoint: updates.jwksEndpoint ?? current.jwksEndpoint,
		tokenEndpointAuthentication: updates.tokenEndpointAuthentication ?? current.tokenEndpointAuthentication
	};
}
const updateSSOProvider = (options) => {
	return createAuthEndpoint("/sso/update-provider", {
		method: "POST",
		use: [sessionMiddleware],
		body: updateSSOProviderBodySchema.extend({ providerId: z.string() }),
		metadata: { openapi: {
			operationId: "updateSSOProvider",
			summary: "Update SSO provider",
			description: "Partially update an SSO provider. Only provided fields are updated. If domain changes, domainVerified is reset to false.",
			responses: {
				"200": { description: "SSO provider updated successfully" },
				"404": { description: "Provider not found" },
				"403": { description: "Access denied" }
			}
		} }
	}, async (ctx) => {
		const { providerId, ...body } = ctx.body;
		const { issuer, domain, samlConfig, oidcConfig } = body;
		if (!issuer && !domain && !samlConfig && !oidcConfig) throw new APIError("BAD_REQUEST", { message: "No fields provided for update" });
		const existingProvider = await checkProviderAccess(ctx, providerId);
		const updateData = {};
		if (body.issuer !== void 0) updateData.issuer = body.issuer;
		if (body.domain !== void 0) {
			updateData.domain = body.domain;
			if (body.domain !== existingProvider.domain) updateData.domainVerified = false;
		}
		if (body.samlConfig) {
			if (body.samlConfig.idpMetadata?.metadata) {
				const maxMetadataSize = options?.saml?.maxMetadataSize ?? 102400;
				if (new TextEncoder().encode(body.samlConfig.idpMetadata.metadata).length > maxMetadataSize) throw new APIError("BAD_REQUEST", { message: `IdP metadata exceeds maximum allowed size (${maxMetadataSize} bytes)` });
			}
			if (body.samlConfig.signatureAlgorithm !== void 0 || body.samlConfig.digestAlgorithm !== void 0) validateConfigAlgorithms({
				signatureAlgorithm: body.samlConfig.signatureAlgorithm,
				digestAlgorithm: body.samlConfig.digestAlgorithm
			}, options?.saml?.algorithms);
			const currentSamlConfig = parseAndValidateConfig(existingProvider.samlConfig, "SAML");
			const updatedSamlConfig = mergeSAMLConfig(currentSamlConfig, body.samlConfig, updateData.issuer || currentSamlConfig.issuer || existingProvider.issuer);
			updateData.samlConfig = JSON.stringify(updatedSamlConfig);
		}
		if (body.oidcConfig) {
			try {
				validateSkipDiscoveryEndpoints(body.oidcConfig, (url) => ctx.context.isTrustedOrigin(url));
			} catch (error) {
				if (error instanceof DiscoveryError) throw mapDiscoveryErrorToAPIError(error);
				throw error;
			}
			const currentOidcConfig = parseAndValidateConfig(existingProvider.oidcConfig, "OIDC");
			const updatedOidcConfig = mergeOIDCConfig(currentOidcConfig, body.oidcConfig, updateData.issuer || currentOidcConfig.issuer || existingProvider.issuer);
			updateData.oidcConfig = JSON.stringify(updatedOidcConfig);
		}
		await ctx.context.adapter.update({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: providerId
			}],
			update: updateData
		});
		const fullProvider = await ctx.context.adapter.findOne({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: providerId
			}]
		});
		if (!fullProvider) throw new APIError("NOT_FOUND", { message: "Provider not found after update" });
		return ctx.json(sanitizeProvider(fullProvider, ctx.context.baseURL));
	});
};
const deleteSSOProvider = () => {
	return createAuthEndpoint("/sso/delete-provider", {
		method: "POST",
		use: [sessionMiddleware],
		body: z.object({ providerId: z.string() }),
		metadata: { openapi: {
			operationId: "deleteSSOProvider",
			summary: "Delete SSO provider",
			description: "Deletes an SSO provider",
			responses: {
				"200": { description: "SSO provider deleted successfully" },
				"404": { description: "Provider not found" },
				"403": { description: "Access denied" }
			}
		} }
	}, async (ctx) => {
		const { providerId } = ctx.body;
		await checkProviderAccess(ctx, providerId);
		await ctx.context.adapter.delete({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: providerId
			}]
		});
		return ctx.json({ success: true });
	});
};
//#endregion
//#region src/saml/error-codes.ts
const SAML_ERROR_CODES = defineErrorCodes({
	SINGLE_LOGOUT_NOT_ENABLED: "Single Logout is not enabled",
	INVALID_LOGOUT_RESPONSE: "Invalid LogoutResponse",
	INVALID_LOGOUT_REQUEST: "Invalid LogoutRequest",
	LOGOUT_FAILED_AT_IDP: "Logout failed at IdP",
	IDP_SLO_NOT_SUPPORTED: "IdP does not support Single Logout Service",
	SAML_PROVIDER_NOT_FOUND: "SAML provider not found"
});
//#endregion
//#region src/saml-state.ts
async function generateRelayState(c, link, additionalData) {
	const callbackURL = c.body.callbackURL;
	if (!callbackURL) throw new APIError("BAD_REQUEST", { message: "callbackURL is required" });
	const codeVerifier = generateRandomString(128);
	const stateData = {
		...additionalData ? additionalData : {},
		callbackURL,
		codeVerifier,
		errorURL: c.body.errorCallbackURL,
		newUserURL: c.body.newUserCallbackURL,
		link,
		expiresAt: Date.now() + 600 * 1e3,
		requestSignUp: c.body.requestSignUp
	};
	try {
		return generateGenericState(c, stateData, { cookieName: "relay_state" });
	} catch (error) {
		c.context.logger.error("Failed to create verification for relay state", error);
		throw new APIError("INTERNAL_SERVER_ERROR", {
			message: "State error: Unable to create verification for relay state",
			cause: error
		});
	}
}
async function parseRelayState(c) {
	const state = c.body.RelayState;
	const errorURL = c.context.options.onAPIError?.errorURL || `${c.context.baseURL}/error`;
	let parsedData;
	try {
		parsedData = await parseGenericState(c, state, {
			cookieName: "relay_state",
			skipStateCookieCheck: true
		});
	} catch (error) {
		c.context.logger.error("Failed to parse relay state", error);
		throw new APIError("BAD_REQUEST", {
			message: "State error: failed to validate relay state",
			cause: error
		});
	}
	if (!parsedData.errorURL) parsedData.errorURL = errorURL;
	return parsedData;
}
const saml = typeof samlifyNamespace.SPMetadata === "function" && typeof samlifyNamespace.setSchemaValidator === "function" ? samlifyNamespace : samlifyDefault ?? samlifyNamespace;
//#endregion
//#region src/routes/helpers.ts
async function findSAMLProvider(providerId, options, adapter) {
	if (options?.defaultSSO?.length) {
		const match = options.defaultSSO.find((p) => p.providerId === providerId);
		if (match) return {
			...match,
			userId: "default",
			issuer: match.samlConfig?.issuer || "",
			...options.domainVerification?.enabled ? { domainVerified: true } : {}
		};
	}
	const res = await adapter.findOne({
		model: "ssoProvider",
		where: [{
			field: "providerId",
			value: providerId
		}]
	});
	if (!res) return null;
	return {
		...res,
		samlConfig: res.samlConfig ? safeJsonParse(res.samlConfig) || void 0 : void 0
	};
}
function createSP(config, baseURL, providerId, opts) {
	const spData = config.spMetadata;
	const sloLocation = `${baseURL}/sso/saml2/sp/slo/${providerId}`;
	const acsUrl = config.callbackUrl || `${baseURL}/sso/saml2/sp/acs/${providerId}`;
	return saml.ServiceProvider({
		entityID: spData?.entityID || config.issuer,
		assertionConsumerService: spData?.metadata ? void 0 : [{
			Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
			Location: acsUrl
		}],
		singleLogoutService: [{
			Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
			Location: sloLocation
		}, {
			Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
			Location: sloLocation
		}],
		wantMessageSigned: config.wantAssertionsSigned || false,
		wantLogoutRequestSigned: opts?.sloOptions?.wantLogoutRequestSigned ?? false,
		wantLogoutResponseSigned: opts?.sloOptions?.wantLogoutResponseSigned ?? false,
		metadata: spData?.metadata,
		privateKey: spData?.privateKey || config.privateKey,
		privateKeyPass: spData?.privateKeyPass,
		isAssertionEncrypted: spData?.isAssertionEncrypted || false,
		encPrivateKey: spData?.encPrivateKey,
		encPrivateKeyPass: spData?.encPrivateKeyPass,
		nameIDFormat: config.identifierFormat ? [config.identifierFormat] : void 0,
		relayState: opts?.relayState
	});
}
function createIdP(config) {
	const idpData = config.idpMetadata;
	if (idpData?.metadata) return saml.IdentityProvider({
		metadata: idpData.metadata,
		privateKey: idpData.privateKey,
		privateKeyPass: idpData.privateKeyPass,
		isAssertionEncrypted: idpData.isAssertionEncrypted,
		encPrivateKey: idpData.encPrivateKey,
		encPrivateKeyPass: idpData.encPrivateKeyPass
	});
	return saml.IdentityProvider({
		entityID: idpData?.entityID || config.issuer,
		singleSignOnService: idpData?.singleSignOnService || [{
			Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
			Location: config.entryPoint
		}],
		singleLogoutService: idpData?.singleLogoutService,
		signingCert: idpData?.cert || config.cert,
		wantAuthnRequestsSigned: config.authnRequestsSigned || false,
		isAssertionEncrypted: idpData?.isAssertionEncrypted || false,
		encPrivateKey: idpData?.encPrivateKey,
		encPrivateKeyPass: idpData?.encPrivateKeyPass
	});
}
function escapeHtml(str) {
	if (!str) return "";
	return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function createSAMLPostForm(action, samlParam, samlValue, relayState) {
	const safeAction = escapeHtml(action);
	const safeSamlParam = escapeHtml(samlParam);
	const safeSamlValue = escapeHtml(samlValue);
	const safeRelayState = relayState ? escapeHtml(relayState) : void 0;
	const html = `<!DOCTYPE html><html><body onload="document.forms[0].submit();"><form method="POST" action="${safeAction}"><input type="hidden" name="${safeSamlParam}" value="${safeSamlValue}" />${safeRelayState ? `<input type="hidden" name="RelayState" value="${safeRelayState}" />` : ""}<noscript><input type="submit" value="Continue" /></noscript></form></body></html>`;
	return new Response(html, { headers: { "Content-Type": "text/html" } });
}
//#endregion
//#region src/saml/timestamp.ts
/**
* Validates SAML assertion timestamp conditions (NotBefore/NotOnOrAfter).
* Prevents acceptance of expired or future-dated assertions.
* @throws {APIError} If timestamps are invalid, expired, or not yet valid
*/
function validateSAMLTimestamp(conditions, options = {}) {
	const clockSkew = options.clockSkew ?? 3e5;
	if (!(conditions?.notBefore || conditions?.notOnOrAfter)) {
		if (options.requireTimestamps) throw new APIError("BAD_REQUEST", {
			message: "SAML assertion missing required timestamp conditions",
			details: "Assertions must include NotBefore and/or NotOnOrAfter conditions"
		});
		options.logger?.warn("SAML assertion accepted without timestamp conditions", { hasConditions: !!conditions });
		return;
	}
	const now = Date.now();
	if (conditions?.notBefore) {
		const notBeforeTime = new Date(conditions.notBefore).getTime();
		if (Number.isNaN(notBeforeTime)) throw new APIError("BAD_REQUEST", {
			message: "SAML assertion has invalid NotBefore timestamp",
			details: `Unable to parse NotBefore value: ${conditions.notBefore}`
		});
		if (now < notBeforeTime - clockSkew) throw new APIError("BAD_REQUEST", {
			message: "SAML assertion is not yet valid",
			details: `Current time is before NotBefore (with ${clockSkew}ms clock skew tolerance)`
		});
	}
	if (conditions?.notOnOrAfter) {
		const notOnOrAfterTime = new Date(conditions.notOnOrAfter).getTime();
		if (Number.isNaN(notOnOrAfterTime)) throw new APIError("BAD_REQUEST", {
			message: "SAML assertion has invalid NotOnOrAfter timestamp",
			details: `Unable to parse NotOnOrAfter value: ${conditions.notOnOrAfter}`
		});
		if (now > notOnOrAfterTime + clockSkew) throw new APIError("BAD_REQUEST", {
			message: "SAML assertion has expired",
			details: `Current time is after NotOnOrAfter (with ${clockSkew}ms clock skew tolerance)`
		});
	}
}
//#endregion
//#region src/routes/saml-pipeline.ts
/**
* Validates and returns a safe redirect URL.
* - Prevents open redirect attacks by validating against trusted origins
* - Prevents redirect loops by checking if URL points to callback route
* - Falls back to appOrigin if URL is invalid or unsafe
*/
function getSafeRedirectUrl(url, callbackPath, appOrigin, isTrustedOrigin) {
	if (!url) return appOrigin;
	if (url.startsWith("/") && !url.startsWith("//")) {
		try {
			const absoluteUrl = new URL(url, appOrigin);
			if (absoluteUrl.origin !== appOrigin) return appOrigin;
			const callbackPathname = new URL(callbackPath).pathname;
			if (absoluteUrl.pathname === callbackPathname) return appOrigin;
		} catch {
			return appOrigin;
		}
		return url;
	}
	if (!isTrustedOrigin(url, { allowRelativePaths: false })) return appOrigin;
	try {
		const callbackPathname = new URL(callbackPath).pathname;
		if (new URL(url).pathname === callbackPathname) return appOrigin;
	} catch {
		if (url === callbackPath || url.startsWith(`${callbackPath}?`)) return appOrigin;
	}
	return url;
}
/**
* Extracts the Assertion ID from a SAML response XML.
* Used for replay protection per SAML 2.0 Core section 2.3.3.
*/
function extractAssertionId(samlContent) {
	try {
		const parsed = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
			removeNSPrefix: true
		}).parse(samlContent);
		const response = parsed.Response || parsed["samlp:Response"];
		if (!response) return null;
		const rawAssertion = response.Assertion || response["saml:Assertion"];
		const assertion = Array.isArray(rawAssertion) ? rawAssertion[0] : rawAssertion;
		if (!assertion) return null;
		return assertion["@_ID"] || null;
	} catch {
		return null;
	}
}
/**
* Unified SAML response processing pipeline.
*
* Both `/sso/saml2/callback/:providerId` (POST) and `/sso/saml2/sp/acs/:providerId`
* delegate to this function. It handles the full lifecycle: provider lookup,
* SP/IdP construction, response validation, session creation, and redirect
* URL computation.
*/
async function processSAMLResponse(ctx, params, options) {
	const { providerId, currentCallbackPath } = params;
	const appOrigin = new URL(ctx.context.baseURL).origin;
	const maxResponseSize = options?.saml?.maxResponseSize ?? 262144;
	if (new TextEncoder().encode(params.SAMLResponse).length > maxResponseSize) throw new APIError("BAD_REQUEST", { message: `SAML response exceeds maximum allowed size (${maxResponseSize} bytes)` });
	const SAMLResponse = params.SAMLResponse.replace(/\s+/g, "");
	let relayState = null;
	if (params.RelayState) try {
		relayState = await parseRelayState(ctx);
	} catch {
		relayState = null;
	}
	const provider = await findSAMLProvider(providerId, options, ctx.context.adapter);
	if (!provider?.samlConfig) throw new APIError("NOT_FOUND", { message: "No SAML provider found" });
	if (options?.domainVerification?.enabled && !("domainVerified" in provider && provider.domainVerified)) throw new APIError("UNAUTHORIZED", { message: "Provider domain has not been verified" });
	const parsedSamlConfig = typeof provider.samlConfig === "object" ? provider.samlConfig : safeJsonParse(provider.samlConfig);
	if (!parsedSamlConfig) throw new APIError("BAD_REQUEST", { message: "Invalid SAML configuration" });
	const sp = createSP(parsedSamlConfig, ctx.context.baseURL, providerId);
	const idp = createIdP(parsedSamlConfig);
	const samlRedirectUrl = getSafeRedirectUrl(relayState?.callbackURL || parsedSamlConfig.callbackUrl, params.currentCallbackPath, appOrigin, (url, settings) => ctx.context.isTrustedOrigin(url, settings));
	validateSingleAssertion(SAMLResponse);
	let parsedResponse;
	try {
		parsedResponse = await sp.parseLoginResponse(idp, "post", { body: {
			SAMLResponse,
			RelayState: params.RelayState || void 0
		} });
		if (!parsedResponse?.extract) throw new Error("Invalid SAML response structure");
	} catch (error) {
		ctx.context.logger.error("SAML response validation failed", {
			error,
			samlResponsePreview: SAMLResponse.slice(0, 200)
		});
		throw new APIError("BAD_REQUEST", {
			message: "Invalid SAML response",
			details: error instanceof Error ? error.message : String(error)
		});
	}
	const { extract } = parsedResponse;
	validateSAMLAlgorithms(parsedResponse, options?.saml?.algorithms);
	validateSAMLTimestamp(extract.conditions, {
		clockSkew: options?.saml?.clockSkew,
		requireTimestamps: options?.saml?.requireTimestamps,
		logger: ctx.context.logger
	});
	const inResponseTo = extract.inResponseTo;
	if (options?.saml?.enableInResponseToValidation !== false) {
		const allowIdpInitiated = options?.saml?.allowIdpInitiated !== false;
		if (inResponseTo) {
			let storedRequest = null;
			const verification = await ctx.context.internalAdapter.findVerificationValue(`${AUTHN_REQUEST_KEY_PREFIX}${inResponseTo}`);
			if (verification) try {
				storedRequest = JSON.parse(verification.value);
				if (storedRequest && storedRequest.expiresAt < Date.now()) storedRequest = null;
			} catch {
				storedRequest = null;
			}
			if (!storedRequest) {
				ctx.context.logger.error("SAML InResponseTo validation failed: unknown or expired request ID", {
					inResponseTo,
					providerId
				});
				throw ctx.redirect(`${samlRedirectUrl}?error=invalid_saml_response&error_description=Unknown+or+expired+request+ID`);
			}
			if (storedRequest.providerId !== providerId) {
				ctx.context.logger.error("SAML InResponseTo validation failed: provider mismatch", {
					inResponseTo,
					expectedProvider: storedRequest.providerId,
					actualProvider: providerId
				});
				await ctx.context.internalAdapter.deleteVerificationByIdentifier(`${AUTHN_REQUEST_KEY_PREFIX}${inResponseTo}`);
				throw ctx.redirect(`${samlRedirectUrl}?error=invalid_saml_response&error_description=Provider+mismatch`);
			}
			await ctx.context.internalAdapter.deleteVerificationByIdentifier(`${AUTHN_REQUEST_KEY_PREFIX}${inResponseTo}`);
		} else if (!allowIdpInitiated) {
			ctx.context.logger.error("SAML IdP-initiated SSO rejected: InResponseTo missing and allowIdpInitiated is false", { providerId });
			throw ctx.redirect(`${samlRedirectUrl}?error=unsolicited_response&error_description=IdP-initiated+SSO+not+allowed`);
		}
	}
	const samlContent = parsedResponse.samlContent;
	const assertionId = samlContent ? extractAssertionId(samlContent) : null;
	if (assertionId) {
		const issuer = idp.entityMeta.getEntityID();
		const conditions = extract.conditions;
		const clockSkew = options?.saml?.clockSkew ?? 3e5;
		const expiresAt = conditions?.notOnOrAfter ? new Date(conditions.notOnOrAfter).getTime() + clockSkew : Date.now() + DEFAULT_ASSERTION_TTL_MS;
		const existingAssertion = await ctx.context.internalAdapter.findVerificationValue(`${USED_ASSERTION_KEY_PREFIX}${assertionId}`);
		let isReplay = false;
		if (existingAssertion) try {
			if (JSON.parse(existingAssertion.value).expiresAt >= Date.now()) isReplay = true;
		} catch (error) {
			ctx.context.logger.warn("Failed to parse stored assertion record", {
				assertionId,
				error
			});
		}
		if (isReplay) {
			ctx.context.logger.error("SAML assertion replay detected: assertion ID already used", {
				assertionId,
				issuer,
				providerId
			});
			throw ctx.redirect(`${samlRedirectUrl}?error=replay_detected&error_description=SAML+assertion+has+already+been+used`);
		}
		await ctx.context.internalAdapter.createVerificationValue({
			identifier: `${USED_ASSERTION_KEY_PREFIX}${assertionId}`,
			value: JSON.stringify({
				assertionId,
				issuer,
				providerId,
				usedAt: Date.now(),
				expiresAt
			}),
			expiresAt: new Date(expiresAt)
		});
	} else ctx.context.logger.warn("Could not extract assertion ID for replay protection", { providerId });
	const attributes = extract.attributes || {};
	const mapping = parsedSamlConfig.mapping ?? {};
	const userInfo = {
		...Object.fromEntries(Object.entries(mapping.extraFields || {}).map(([key, value]) => [key, attributes[value]])),
		id: attributes[mapping.id || "nameID"] || extract.nameID,
		email: (attributes[mapping.email || "email"] || extract.nameID).toLowerCase(),
		name: [attributes[mapping.firstName || "givenName"], attributes[mapping.lastName || "surname"]].filter(Boolean).join(" ") || attributes[mapping.name || "displayName"] || extract.nameID,
		emailVerified: options?.trustEmailVerified && mapping.emailVerified ? attributes[mapping.emailVerified] || false : false
	};
	if (!userInfo.id || !userInfo.email) {
		ctx.context.logger.error("Missing essential user info from SAML response", {
			attributes: Object.keys(attributes),
			mapping,
			extractedId: userInfo.id,
			extractedEmail: userInfo.email
		});
		throw new APIError("BAD_REQUEST", { message: "Unable to extract user ID or email from SAML response" });
	}
	const isTrustedProvider = ctx.context.trustedProviders.includes(providerId) || "domainVerified" in provider && !!provider.domainVerified && validateEmailDomain(userInfo.email, provider.domain);
	const callbackUrl = relayState?.callbackURL || parsedSamlConfig.callbackUrl || ctx.context.baseURL;
	const result = await handleOAuthUserInfo(ctx, {
		userInfo: {
			email: userInfo.email,
			name: userInfo.name || userInfo.email,
			id: userInfo.id,
			emailVerified: Boolean(userInfo.emailVerified)
		},
		account: {
			providerId,
			accountId: userInfo.id,
			accessToken: "",
			refreshToken: ""
		},
		callbackURL: callbackUrl,
		disableSignUp: options?.disableImplicitSignUp,
		isTrustedProvider
	});
	if (result.error) throw ctx.redirect(`${callbackUrl}?error=${result.error.split(" ").join("_")}`);
	const { session, user } = result.data;
	if (options?.provisionUser && (result.isRegister || options.provisionUserOnEveryLogin)) await options.provisionUser({
		user,
		userInfo,
		provider
	});
	await assignOrganizationFromProvider(ctx, {
		user,
		profile: {
			providerType: "saml",
			providerId,
			accountId: userInfo.id,
			email: userInfo.email,
			emailVerified: Boolean(userInfo.emailVerified),
			rawAttributes: attributes
		},
		provider,
		provisioningOptions: options?.organizationProvisioning
	});
	await setSessionCookie(ctx, {
		session,
		user
	});
	if (options?.saml?.enableSingleLogout && extract.nameID) {
		const samlSessionKey = `${SAML_SESSION_KEY_PREFIX}${providerId}:${extract.nameID}`;
		const samlSessionData = {
			sessionId: session.id,
			providerId,
			nameID: extract.nameID,
			sessionIndex: extract.sessionIndex
		};
		await ctx.context.internalAdapter.createVerificationValue({
			identifier: samlSessionKey,
			value: JSON.stringify(samlSessionData),
			expiresAt: session.expiresAt
		}).catch((e) => ctx.context.logger.warn("Failed to create SAML session record", { error: e }));
		await ctx.context.internalAdapter.createVerificationValue({
			identifier: `${SAML_SESSION_BY_ID_PREFIX}${session.id}`,
			value: samlSessionKey,
			expiresAt: session.expiresAt
		}).catch((e) => ctx.context.logger.warn("Failed to create SAML session lookup record", e));
	}
	return getSafeRedirectUrl(relayState?.callbackURL || parsedSamlConfig.callbackUrl, currentCallbackPath, appOrigin, (url, settings) => ctx.context.isTrustedOrigin(url, settings));
}
//#endregion
//#region src/routes/sso.ts
/**
* Builds the OIDC redirect URI. Uses the shared `redirectURI` option
* when set, otherwise falls back to `/sso/callback/:providerId`.
*/
function getOIDCRedirectURI(baseURL, providerId, options) {
	if (options?.redirectURI?.trim()) try {
		new URL(options.redirectURI);
		return options.redirectURI;
	} catch {
		return `${baseURL}${options.redirectURI.startsWith("/") ? options.redirectURI : `/${options.redirectURI}`}`;
	}
	return `${baseURL}/sso/callback/${providerId}`;
}
const spMetadataQuerySchema = z.object({
	providerId: z.string(),
	format: z.enum(["xml", "json"]).default("xml")
});
const spMetadata = (options) => {
	return createAuthEndpoint("/sso/saml2/sp/metadata", {
		method: "GET",
		query: spMetadataQuerySchema,
		metadata: { openapi: {
			operationId: "getSSOServiceProviderMetadata",
			summary: "Get Service Provider metadata",
			description: "Returns the SAML metadata for the Service Provider",
			responses: { "200": { description: "SAML metadata in XML format" } }
		} }
	}, async (ctx) => {
		const provider = await findSAMLProvider(ctx.query.providerId, options, ctx.context.adapter);
		if (!provider) throw new APIError("NOT_FOUND", { message: "No provider found for the given providerId" });
		const parsedSamlConfig = provider.samlConfig;
		if (!parsedSamlConfig) throw new APIError("BAD_REQUEST", { message: "Invalid SAML configuration" });
		const sloLocation = `${ctx.context.baseURL}/sso/saml2/sp/slo/${ctx.query.providerId}`;
		const singleLogoutService = options?.saml?.enableSingleLogout ? [{
			Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
			Location: sloLocation
		}, {
			Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
			Location: sloLocation
		}] : void 0;
		const sp = parsedSamlConfig.spMetadata.metadata ? saml.ServiceProvider({ metadata: parsedSamlConfig.spMetadata.metadata }) : saml.SPMetadata({
			entityID: parsedSamlConfig.spMetadata?.entityID || parsedSamlConfig.issuer,
			assertionConsumerService: [{
				Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
				Location: parsedSamlConfig.callbackUrl || `${ctx.context.baseURL}/sso/saml2/sp/acs/${ctx.query.providerId}`
			}],
			singleLogoutService,
			wantMessageSigned: parsedSamlConfig.wantAssertionsSigned || false,
			authnRequestsSigned: parsedSamlConfig.authnRequestsSigned || false,
			nameIDFormat: parsedSamlConfig.identifierFormat ? [parsedSamlConfig.identifierFormat] : void 0
		});
		return new Response(sp.getMetadata(), { headers: { "Content-Type": "application/xml" } });
	});
};
const ssoProviderBodySchema = z.object({
	providerId: z.string({}).meta({ description: "The ID of the provider. This is used to identify the provider during login and callback" }),
	issuer: z.string({}).meta({ description: "The issuer of the provider" }),
	domain: z.string({}).meta({ description: "The domain(s) of the provider. For enterprise multi-domain SSO where a single IdP serves multiple email domains, use comma-separated values (e.g., 'company.com,subsidiary.com,acquired-company.com')" }),
	oidcConfig: z.object({
		clientId: z.string({}).meta({ description: "The client ID" }),
		clientSecret: z.string({}).meta({ description: "The client secret" }),
		authorizationEndpoint: z.url().meta({ description: "The authorization endpoint" }).optional(),
		tokenEndpoint: z.url().meta({ description: "The token endpoint" }).optional(),
		userInfoEndpoint: z.url().meta({ description: "The user info endpoint" }).optional(),
		tokenEndpointAuthentication: z.enum(["client_secret_post", "client_secret_basic"]).optional(),
		jwksEndpoint: z.url().meta({ description: "The JWKS endpoint" }).optional(),
		discoveryEndpoint: z.url().optional(),
		skipDiscovery: z.boolean().meta({ description: "Skip OIDC discovery during registration. When true, you must provide authorizationEndpoint, tokenEndpoint, and jwksEndpoint manually." }).optional(),
		scopes: z.array(z.string(), {}).meta({ description: "The scopes to request. Defaults to ['openid', 'email', 'profile', 'offline_access']" }).optional(),
		pkce: z.boolean({}).meta({ description: "Whether to use PKCE for the authorization flow" }).default(true).optional(),
		mapping: z.object({
			id: z.string({}).meta({ description: "Field mapping for user ID (defaults to 'sub')" }),
			email: z.string({}).meta({ description: "Field mapping for email (defaults to 'email')" }),
			emailVerified: z.string({}).meta({ description: "Field mapping for email verification (defaults to 'email_verified')" }).optional(),
			name: z.string({}).meta({ description: "Field mapping for name (defaults to 'name')" }),
			image: z.string({}).meta({ description: "Field mapping for image (defaults to 'picture')" }).optional(),
			extraFields: z.record(z.string(), z.any()).optional()
		}).optional()
	}).optional(),
	samlConfig: z.object({
		entryPoint: z.string({}).meta({ description: "The entry point of the provider" }),
		cert: z.string({}).meta({ description: "The certificate of the provider" }),
		callbackUrl: z.string({}).meta({ description: "The callback URL of the provider" }),
		audience: z.string().optional(),
		idpMetadata: z.object({
			metadata: z.string().optional(),
			entityID: z.string().optional(),
			cert: z.string().optional(),
			privateKey: z.string().optional(),
			privateKeyPass: z.string().optional(),
			isAssertionEncrypted: z.boolean().optional(),
			encPrivateKey: z.string().optional(),
			encPrivateKeyPass: z.string().optional(),
			singleSignOnService: z.array(z.object({
				Binding: z.string().meta({ description: "The binding type for the SSO service" }),
				Location: z.string().meta({ description: "The URL for the SSO service" })
			})).optional().meta({ description: "Single Sign-On service configuration" })
		}).optional(),
		spMetadata: z.object({
			metadata: z.string().optional(),
			entityID: z.string().optional(),
			binding: z.string().optional(),
			privateKey: z.string().optional(),
			privateKeyPass: z.string().optional(),
			isAssertionEncrypted: z.boolean().optional(),
			encPrivateKey: z.string().optional(),
			encPrivateKeyPass: z.string().optional()
		}),
		wantAssertionsSigned: z.boolean().optional(),
		authnRequestsSigned: z.boolean().optional(),
		signatureAlgorithm: z.string().optional(),
		digestAlgorithm: z.string().optional(),
		identifierFormat: z.string().optional(),
		privateKey: z.string().optional(),
		decryptionPvk: z.string().optional(),
		additionalParams: z.record(z.string(), z.any()).optional(),
		mapping: z.object({
			id: z.string({}).meta({ description: "Field mapping for user ID (defaults to 'nameID')" }),
			email: z.string({}).meta({ description: "Field mapping for email (defaults to 'email')" }),
			emailVerified: z.string({}).meta({ description: "Field mapping for email verification" }).optional(),
			name: z.string({}).meta({ description: "Field mapping for name (defaults to 'displayName')" }),
			firstName: z.string({}).meta({ description: "Field mapping for first name (defaults to 'givenName')" }).optional(),
			lastName: z.string({}).meta({ description: "Field mapping for last name (defaults to 'surname')" }).optional(),
			extraFields: z.record(z.string(), z.any()).optional()
		}).optional()
	}).optional(),
	organizationId: z.string({}).meta({ description: "If organization plugin is enabled, the organization id to link the provider to" }).optional(),
	overrideUserInfo: z.boolean({}).meta({ description: "Override user info with the provider info. Defaults to false" }).default(false).optional()
});
const registerSSOProvider = (options) => {
	return createAuthEndpoint("/sso/register", {
		method: "POST",
		body: ssoProviderBodySchema,
		use: [sessionMiddleware],
		metadata: { openapi: {
			operationId: "registerSSOProvider",
			summary: "Register an OIDC provider",
			description: "This endpoint is used to register an OIDC provider. This is used to configure the provider and link it to an organization",
			responses: { "200": {
				description: "OIDC provider created successfully",
				content: { "application/json": { schema: {
					type: "object",
					properties: {
						issuer: {
							type: "string",
							format: "uri",
							description: "The issuer URL of the provider"
						},
						domain: {
							type: "string",
							description: "The domain of the provider, used for email matching"
						},
						domainVerified: {
							type: "boolean",
							description: "A boolean indicating whether the domain has been verified or not"
						},
						domainVerificationToken: {
							type: "string",
							description: "Domain verification token. It can be used to prove ownership over the SSO domain"
						},
						oidcConfig: {
							type: "object",
							properties: {
								issuer: {
									type: "string",
									format: "uri",
									description: "The issuer URL of the provider"
								},
								pkce: {
									type: "boolean",
									description: "Whether PKCE is enabled for the authorization flow"
								},
								clientId: {
									type: "string",
									description: "The client ID for the provider"
								},
								clientSecret: {
									type: "string",
									description: "The client secret for the provider"
								},
								authorizationEndpoint: {
									type: "string",
									format: "uri",
									nullable: true,
									description: "The authorization endpoint URL"
								},
								discoveryEndpoint: {
									type: "string",
									format: "uri",
									description: "The discovery endpoint URL"
								},
								userInfoEndpoint: {
									type: "string",
									format: "uri",
									nullable: true,
									description: "The user info endpoint URL"
								},
								scopes: {
									type: "array",
									items: { type: "string" },
									nullable: true,
									description: "The scopes requested from the provider"
								},
								tokenEndpoint: {
									type: "string",
									format: "uri",
									nullable: true,
									description: "The token endpoint URL"
								},
								tokenEndpointAuthentication: {
									type: "string",
									enum: ["client_secret_post", "client_secret_basic"],
									nullable: true,
									description: "Authentication method for the token endpoint"
								},
								jwksEndpoint: {
									type: "string",
									format: "uri",
									nullable: true,
									description: "The JWKS endpoint URL"
								},
								mapping: {
									type: "object",
									nullable: true,
									properties: {
										id: {
											type: "string",
											description: "Field mapping for user ID (defaults to 'sub')"
										},
										email: {
											type: "string",
											description: "Field mapping for email (defaults to 'email')"
										},
										emailVerified: {
											type: "string",
											nullable: true,
											description: "Field mapping for email verification (defaults to 'email_verified')"
										},
										name: {
											type: "string",
											description: "Field mapping for name (defaults to 'name')"
										},
										image: {
											type: "string",
											nullable: true,
											description: "Field mapping for image (defaults to 'picture')"
										},
										extraFields: {
											type: "object",
											additionalProperties: { type: "string" },
											nullable: true,
											description: "Additional field mappings"
										}
									},
									required: [
										"id",
										"email",
										"name"
									]
								}
							},
							required: [
								"issuer",
								"pkce",
								"clientId",
								"clientSecret",
								"discoveryEndpoint"
							],
							description: "OIDC configuration for the provider"
						},
						organizationId: {
							type: "string",
							nullable: true,
							description: "ID of the linked organization, if any"
						},
						userId: {
							type: "string",
							description: "ID of the user who registered the provider"
						},
						providerId: {
							type: "string",
							description: "Unique identifier for the provider"
						},
						redirectURI: {
							type: "string",
							format: "uri",
							description: "The redirect URI for the provider callback"
						}
					},
					required: [
						"issuer",
						"domain",
						"oidcConfig",
						"userId",
						"providerId",
						"redirectURI"
					]
				} } }
			} }
		} }
	}, async (ctx) => {
		const user = ctx.context.session?.user;
		if (!user) throw new APIError("UNAUTHORIZED");
		const limit = typeof options?.providersLimit === "function" ? await options.providersLimit(user) : options?.providersLimit ?? 10;
		if (!limit) throw new APIError("FORBIDDEN", { message: "SSO provider registration is disabled" });
		if ((await ctx.context.adapter.findMany({
			model: "ssoProvider",
			where: [{
				field: "userId",
				value: user.id
			}]
		})).length >= limit) throw new APIError("FORBIDDEN", { message: "You have reached the maximum number of SSO providers" });
		const body = ctx.body;
		if (z.string().url().safeParse(body.issuer).error) throw new APIError("BAD_REQUEST", { message: "Invalid issuer. Must be a valid URL" });
		if (body.samlConfig?.idpMetadata?.metadata) {
			const maxMetadataSize = options?.saml?.maxMetadataSize ?? 102400;
			if (new TextEncoder().encode(body.samlConfig.idpMetadata.metadata).length > maxMetadataSize) throw new APIError("BAD_REQUEST", { message: `IdP metadata exceeds maximum allowed size (${maxMetadataSize} bytes)` });
		}
		if (ctx.body.organizationId) {
			const member = await ctx.context.adapter.findOne({
				model: "member",
				where: [{
					field: "userId",
					value: user.id
				}, {
					field: "organizationId",
					value: ctx.body.organizationId
				}]
			});
			if (!member) throw new APIError("BAD_REQUEST", { message: "You are not a member of the organization" });
			if (ctx.context.hasPlugin("organization") && !hasOrgAdminRole(member)) throw new APIError("FORBIDDEN", { message: "You must be an organization owner or admin to register SSO providers" });
		}
		if (await ctx.context.adapter.findOne({
			model: "ssoProvider",
			where: [{
				field: "providerId",
				value: body.providerId
			}]
		})) {
			ctx.context.logger.info(`SSO provider creation attempt with existing providerId: ${body.providerId}`);
			throw new APIError("UNPROCESSABLE_ENTITY", { message: "SSO provider with this providerId already exists" });
		}
		if (body.oidcConfig) try {
			validateSkipDiscoveryEndpoints(body.oidcConfig, (url) => ctx.context.isTrustedOrigin(url));
		} catch (error) {
			if (error instanceof DiscoveryError) throw mapDiscoveryErrorToAPIError(error);
			throw error;
		}
		let hydratedOIDCConfig = null;
		if (body.oidcConfig && !body.oidcConfig.skipDiscovery) try {
			hydratedOIDCConfig = await discoverOIDCConfig({
				issuer: body.issuer,
				existingConfig: {
					discoveryEndpoint: body.oidcConfig.discoveryEndpoint,
					authorizationEndpoint: body.oidcConfig.authorizationEndpoint,
					tokenEndpoint: body.oidcConfig.tokenEndpoint,
					jwksEndpoint: body.oidcConfig.jwksEndpoint,
					userInfoEndpoint: body.oidcConfig.userInfoEndpoint,
					tokenEndpointAuthentication: body.oidcConfig.tokenEndpointAuthentication
				},
				isTrustedOrigin: (url) => ctx.context.isTrustedOrigin(url)
			});
		} catch (error) {
			if (error instanceof DiscoveryError) throw mapDiscoveryErrorToAPIError(error);
			throw error;
		}
		const buildOIDCConfig = () => {
			if (!body.oidcConfig) return null;
			if (body.oidcConfig.skipDiscovery) return JSON.stringify({
				issuer: body.issuer,
				clientId: body.oidcConfig.clientId,
				clientSecret: body.oidcConfig.clientSecret,
				authorizationEndpoint: body.oidcConfig.authorizationEndpoint,
				tokenEndpoint: body.oidcConfig.tokenEndpoint,
				tokenEndpointAuthentication: body.oidcConfig.tokenEndpointAuthentication || "client_secret_basic",
				jwksEndpoint: body.oidcConfig.jwksEndpoint,
				pkce: body.oidcConfig.pkce,
				discoveryEndpoint: body.oidcConfig.discoveryEndpoint || `${body.issuer}/.well-known/openid-configuration`,
				mapping: body.oidcConfig.mapping,
				scopes: body.oidcConfig.scopes,
				userInfoEndpoint: body.oidcConfig.userInfoEndpoint,
				overrideUserInfo: ctx.body.overrideUserInfo || options?.defaultOverrideUserInfo || false
			});
			if (!hydratedOIDCConfig) return null;
			return JSON.stringify({
				issuer: hydratedOIDCConfig.issuer,
				clientId: body.oidcConfig.clientId,
				clientSecret: body.oidcConfig.clientSecret,
				authorizationEndpoint: hydratedOIDCConfig.authorizationEndpoint,
				tokenEndpoint: hydratedOIDCConfig.tokenEndpoint,
				tokenEndpointAuthentication: hydratedOIDCConfig.tokenEndpointAuthentication,
				jwksEndpoint: hydratedOIDCConfig.jwksEndpoint,
				pkce: body.oidcConfig.pkce,
				discoveryEndpoint: hydratedOIDCConfig.discoveryEndpoint,
				mapping: body.oidcConfig.mapping,
				scopes: body.oidcConfig.scopes,
				userInfoEndpoint: hydratedOIDCConfig.userInfoEndpoint,
				overrideUserInfo: ctx.body.overrideUserInfo || options?.defaultOverrideUserInfo || false
			});
		};
		if (body.samlConfig) {
			validateConfigAlgorithms({
				signatureAlgorithm: body.samlConfig.signatureAlgorithm,
				digestAlgorithm: body.samlConfig.digestAlgorithm
			}, options?.saml?.algorithms);
			const hasIdpMetadata = body.samlConfig.idpMetadata?.metadata;
			let hasEntryPoint = false;
			if (body.samlConfig.entryPoint) try {
				new URL(body.samlConfig.entryPoint);
				hasEntryPoint = true;
			} catch {}
			const hasSingleSignOnService = body.samlConfig.idpMetadata?.singleSignOnService?.length;
			if (!hasIdpMetadata && !hasEntryPoint && !hasSingleSignOnService) throw new APIError("BAD_REQUEST", { message: "SAML configuration requires either idpMetadata.metadata (IdP metadata XML), idpMetadata.singleSignOnService, or a valid entryPoint URL" });
		}
		const provider = await ctx.context.adapter.create({
			model: "ssoProvider",
			data: {
				issuer: body.issuer,
				domain: body.domain,
				domainVerified: false,
				oidcConfig: buildOIDCConfig(),
				samlConfig: body.samlConfig ? JSON.stringify({
					issuer: body.issuer,
					entryPoint: body.samlConfig.entryPoint,
					cert: body.samlConfig.cert,
					callbackUrl: body.samlConfig.callbackUrl,
					audience: body.samlConfig.audience,
					idpMetadata: body.samlConfig.idpMetadata,
					spMetadata: body.samlConfig.spMetadata,
					wantAssertionsSigned: body.samlConfig.wantAssertionsSigned,
					authnRequestsSigned: body.samlConfig.authnRequestsSigned,
					signatureAlgorithm: body.samlConfig.signatureAlgorithm,
					digestAlgorithm: body.samlConfig.digestAlgorithm,
					identifierFormat: body.samlConfig.identifierFormat,
					privateKey: body.samlConfig.privateKey,
					decryptionPvk: body.samlConfig.decryptionPvk,
					additionalParams: body.samlConfig.additionalParams,
					mapping: body.samlConfig.mapping
				}) : null,
				organizationId: body.organizationId,
				userId: ctx.context.session.user.id,
				providerId: body.providerId
			}
		});
		let domainVerificationToken;
		let domainVerified;
		if (options?.domainVerification?.enabled) {
			domainVerified = false;
			domainVerificationToken = generateRandomString(24);
			await ctx.context.internalAdapter.createVerificationValue({
				identifier: getVerificationIdentifier(options, provider.providerId),
				value: domainVerificationToken,
				expiresAt: new Date(Date.now() + 3600 * 24 * 7 * 1e3)
			});
		}
		const result = {
			...provider,
			oidcConfig: safeJsonParse(provider.oidcConfig),
			samlConfig: safeJsonParse(provider.samlConfig),
			redirectURI: getOIDCRedirectURI(ctx.context.baseURL, provider.providerId, options),
			...options?.domainVerification?.enabled ? { domainVerified } : {},
			...options?.domainVerification?.enabled ? { domainVerificationToken } : {}
		};
		return ctx.json(result);
	});
};
const signInSSOBodySchema = z.object({
	email: z.string({}).meta({ description: "The email address to sign in with. This is used to identify the issuer to sign in with. It's optional if the issuer is provided" }).optional(),
	organizationSlug: z.string({}).meta({ description: "The slug of the organization to sign in with" }).optional(),
	providerId: z.string({}).meta({ description: "The ID of the provider to sign in with. This can be provided instead of email or issuer" }).optional(),
	domain: z.string({}).meta({ description: "The domain of the provider." }).optional(),
	callbackURL: z.string({}).meta({ description: "The URL to redirect to after login" }),
	errorCallbackURL: z.string({}).meta({ description: "The URL to redirect to after login" }).optional(),
	newUserCallbackURL: z.string({}).meta({ description: "The URL to redirect to after login if the user is new" }).optional(),
	scopes: z.array(z.string(), {}).meta({ description: "Scopes to request from the provider." }).optional(),
	loginHint: z.string({}).meta({ description: "Login hint to send to the identity provider (e.g., email or identifier). If supported, will be sent as 'login_hint'." }).optional(),
	requestSignUp: z.boolean({}).meta({ description: "Explicitly request sign-up. Useful when disableImplicitSignUp is true for this provider" }).optional(),
	providerType: z.enum(["oidc", "saml"]).optional()
});
const signInSSO = (options) => {
	return createAuthEndpoint("/sign-in/sso", {
		method: "POST",
		body: signInSSOBodySchema,
		metadata: { openapi: {
			operationId: "signInWithSSO",
			summary: "Sign in with SSO provider",
			description: "This endpoint is used to sign in with an SSO provider. It redirects to the provider's authorization URL",
			requestBody: { content: { "application/json": { schema: {
				type: "object",
				properties: {
					email: {
						type: "string",
						description: "The email address to sign in with. This is used to identify the issuer to sign in with. It's optional if the issuer is provided"
					},
					issuer: {
						type: "string",
						description: "The issuer identifier, this is the URL of the provider and can be used to verify the provider and identify the provider during login. It's optional if the email is provided"
					},
					providerId: {
						type: "string",
						description: "The ID of the provider to sign in with. This can be provided instead of email or issuer"
					},
					callbackURL: {
						type: "string",
						description: "The URL to redirect to after login"
					},
					errorCallbackURL: {
						type: "string",
						description: "The URL to redirect to after login"
					},
					newUserCallbackURL: {
						type: "string",
						description: "The URL to redirect to after login if the user is new"
					},
					loginHint: {
						type: "string",
						description: "Login hint to send to the identity provider (e.g., email or identifier). If supported, sent as 'login_hint'."
					}
				},
				required: ["callbackURL"]
			} } } },
			responses: { "200": {
				description: "Authorization URL generated successfully for SSO sign-in",
				content: { "application/json": { schema: {
					type: "object",
					properties: {
						url: {
							type: "string",
							format: "uri",
							description: "The authorization URL to redirect the user to for SSO sign-in"
						},
						redirect: {
							type: "boolean",
							description: "Indicates that the client should redirect to the provided URL",
							enum: [true]
						}
					},
					required: ["url", "redirect"]
				} } }
			} }
		} }
	}, async (ctx) => {
		const body = ctx.body;
		let { email, organizationSlug, providerId, domain } = body;
		if (!options?.defaultSSO?.length && !email && !organizationSlug && !domain && !providerId) throw new APIError("BAD_REQUEST", { message: "email, organizationSlug, domain or providerId is required" });
		domain = body.domain || email?.split("@")[1];
		let orgId = "";
		if (organizationSlug) orgId = await ctx.context.adapter.findOne({
			model: "organization",
			where: [{
				field: "slug",
				value: organizationSlug
			}]
		}).then((res) => {
			if (!res) return "";
			return res.id;
		});
		let provider = null;
		if (options?.defaultSSO?.length) {
			const matchingDefault = providerId ? options.defaultSSO.find((defaultProvider) => defaultProvider.providerId === providerId) : options.defaultSSO.find((defaultProvider) => defaultProvider.domain === domain);
			if (matchingDefault) provider = {
				issuer: matchingDefault.samlConfig?.issuer || matchingDefault.oidcConfig?.issuer || "",
				providerId: matchingDefault.providerId,
				userId: "default",
				oidcConfig: matchingDefault.oidcConfig,
				samlConfig: matchingDefault.samlConfig,
				domain: matchingDefault.domain,
				...options.domainVerification?.enabled ? { domainVerified: true } : {}
			};
		}
		if (!providerId && !orgId && !domain) throw new APIError("BAD_REQUEST", { message: "providerId, orgId or domain is required" });
		if (!provider) {
			const parseProvider = (res) => {
				if (!res) return null;
				return {
					...res,
					oidcConfig: res.oidcConfig ? safeJsonParse(res.oidcConfig) || void 0 : void 0,
					samlConfig: res.samlConfig ? safeJsonParse(res.samlConfig) || void 0 : void 0
				};
			};
			if (providerId || orgId) provider = parseProvider(await ctx.context.adapter.findOne({
				model: "ssoProvider",
				where: [{
					field: providerId ? "providerId" : "organizationId",
					value: providerId || orgId
				}]
			}));
			else if (domain) {
				provider = parseProvider(await ctx.context.adapter.findOne({
					model: "ssoProvider",
					where: [{
						field: "domain",
						value: domain
					}]
				}));
				if (!provider) provider = parseProvider((await ctx.context.adapter.findMany({ model: "ssoProvider" })).find((p) => domainMatches(domain, p.domain)) ?? null);
			}
		}
		if (!provider) throw new APIError("NOT_FOUND", { message: "No provider found for the issuer" });
		if (body.providerType) {
			if (body.providerType === "oidc" && !provider.oidcConfig) throw new APIError("BAD_REQUEST", { message: "OIDC provider is not configured" });
			if (body.providerType === "saml" && !provider.samlConfig) throw new APIError("BAD_REQUEST", { message: "SAML provider is not configured" });
		}
		if (options?.domainVerification?.enabled && !("domainVerified" in provider && provider.domainVerified)) throw new APIError("UNAUTHORIZED", { message: "Provider domain has not been verified" });
		if (provider.oidcConfig && body.providerType !== "saml") {
			let config = provider.oidcConfig;
			try {
				config = await ensureRuntimeDiscovery(provider.oidcConfig, provider.issuer, (url) => ctx.context.isTrustedOrigin(url));
			} catch (error) {
				if (error instanceof DiscoveryError) throw mapDiscoveryErrorToAPIError(error);
				throw error;
			}
			if (!config.authorizationEndpoint) throw new APIError("BAD_REQUEST", { message: "Invalid OIDC configuration. Authorization URL not found." });
			const state = await generateState(ctx, void 0, options?.redirectURI?.trim() ? { ssoProviderId: provider.providerId } : false);
			const redirectURI = getOIDCRedirectURI(ctx.context.baseURL, provider.providerId, options);
			const authorizationURL = await createAuthorizationURL({
				id: provider.issuer,
				options: {
					clientId: config.clientId,
					clientSecret: config.clientSecret
				},
				redirectURI,
				state: state.state,
				codeVerifier: config.pkce ? state.codeVerifier : void 0,
				scopes: ctx.body.scopes || config.scopes || [
					"openid",
					"email",
					"profile",
					"offline_access"
				],
				loginHint: ctx.body.loginHint || email,
				authorizationEndpoint: config.authorizationEndpoint
			});
			return ctx.json({
				url: authorizationURL.toString(),
				redirect: true
			});
		}
		if (provider.samlConfig) {
			const parsedSamlConfig = typeof provider.samlConfig === "object" ? provider.samlConfig : safeJsonParse(provider.samlConfig);
			if (!parsedSamlConfig) throw new APIError("BAD_REQUEST", { message: "Invalid SAML configuration" });
			if (parsedSamlConfig.authnRequestsSigned && !parsedSamlConfig.spMetadata?.privateKey && !parsedSamlConfig.privateKey) throw new APIError("BAD_REQUEST", { message: "authnRequestsSigned is enabled but no privateKey provided in spMetadata or samlConfig" });
			const { state: relayState } = await generateRelayState(ctx, void 0, false);
			let metadata = parsedSamlConfig.spMetadata.metadata;
			if (!metadata) metadata = saml.SPMetadata({
				entityID: parsedSamlConfig.spMetadata?.entityID || parsedSamlConfig.issuer,
				assertionConsumerService: [{
					Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
					Location: parsedSamlConfig.callbackUrl || `${ctx.context.baseURL}/sso/saml2/sp/acs/${provider.providerId}`
				}],
				wantMessageSigned: parsedSamlConfig.wantAssertionsSigned || false,
				authnRequestsSigned: parsedSamlConfig.authnRequestsSigned || false,
				nameIDFormat: parsedSamlConfig.identifierFormat ? [parsedSamlConfig.identifierFormat] : void 0
			}).getMetadata() || "";
			const sp = saml.ServiceProvider({
				metadata,
				allowCreate: true,
				privateKey: parsedSamlConfig.spMetadata?.privateKey || parsedSamlConfig.privateKey,
				privateKeyPass: parsedSamlConfig.spMetadata?.privateKeyPass,
				relayState
			});
			const idpData = parsedSamlConfig.idpMetadata;
			let idp;
			if (!idpData?.metadata) idp = saml.IdentityProvider({
				entityID: idpData?.entityID || parsedSamlConfig.issuer,
				singleSignOnService: idpData?.singleSignOnService || [{
					Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
					Location: parsedSamlConfig.entryPoint
				}],
				signingCert: idpData?.cert || parsedSamlConfig.cert,
				wantAuthnRequestsSigned: parsedSamlConfig.authnRequestsSigned || false,
				isAssertionEncrypted: idpData?.isAssertionEncrypted || false,
				encPrivateKey: idpData?.encPrivateKey,
				encPrivateKeyPass: idpData?.encPrivateKeyPass
			});
			else idp = saml.IdentityProvider({
				metadata: idpData.metadata,
				privateKey: idpData.privateKey,
				privateKeyPass: idpData.privateKeyPass,
				isAssertionEncrypted: idpData.isAssertionEncrypted,
				encPrivateKey: idpData.encPrivateKey,
				encPrivateKeyPass: idpData.encPrivateKeyPass
			});
			const loginRequest = sp.createLoginRequest(idp, "redirect");
			if (!loginRequest) throw new APIError("BAD_REQUEST", { message: "Invalid SAML request" });
			if (loginRequest.id && options?.saml?.enableInResponseToValidation !== false) {
				const ttl = options?.saml?.requestTTL ?? 3e5;
				const record = {
					id: loginRequest.id,
					providerId: provider.providerId,
					createdAt: Date.now(),
					expiresAt: Date.now() + ttl
				};
				await ctx.context.internalAdapter.createVerificationValue({
					identifier: `${AUTHN_REQUEST_KEY_PREFIX}${record.id}`,
					value: JSON.stringify(record),
					expiresAt: new Date(record.expiresAt)
				});
			}
			return ctx.json({
				url: loginRequest.context,
				redirect: true
			});
		}
		throw new APIError("BAD_REQUEST", { message: "Invalid SSO provider" });
	});
};
const callbackSSOQuerySchema = z.object({
	code: z.string().optional(),
	state: z.string(),
	error: z.string().optional(),
	error_description: z.string().optional()
});
/**
* Core OIDC callback handler logic, shared between the per-provider and
* shared callback endpoints. Resolves the provider, exchanges the
* authorization code for tokens, and creates a session.
*
* @param stateData - Pre-parsed state data. If not provided, it will be
*   parsed from the request context.
*/
async function handleOIDCCallback(ctx, options, providerId, stateData) {
	const { code, error, error_description } = ctx.query;
	if (!stateData) stateData = await parseState(ctx);
	if (!stateData) {
		const errorURL = ctx.context.options.onAPIError?.errorURL || `${ctx.context.baseURL}/error`;
		throw ctx.redirect(`${errorURL}?error=invalid_state`);
	}
	const { callbackURL, errorURL, newUserURL, requestSignUp } = stateData;
	if (!code || error) throw ctx.redirect(`${errorURL || callbackURL}?error=${error}&error_description=${error_description}`);
	let provider = null;
	if (options?.defaultSSO?.length) {
		const matchingDefault = options.defaultSSO.find((defaultProvider) => defaultProvider.providerId === providerId);
		if (matchingDefault) provider = {
			...matchingDefault,
			issuer: matchingDefault.oidcConfig?.issuer || "",
			userId: "default",
			...options.domainVerification?.enabled ? { domainVerified: true } : {}
		};
	}
	if (!provider) provider = await ctx.context.adapter.findOne({
		model: "ssoProvider",
		where: [{
			field: "providerId",
			value: providerId
		}]
	}).then((res) => {
		if (!res) return null;
		return {
			...res,
			oidcConfig: safeJsonParse(res.oidcConfig) || void 0
		};
	});
	if (!provider) throw ctx.redirect(`${errorURL || callbackURL}?error=invalid_provider&error_description=provider not found`);
	if (options?.domainVerification?.enabled && !("domainVerified" in provider && provider.domainVerified)) throw new APIError("UNAUTHORIZED", { message: "Provider domain has not been verified" });
	let config = provider.oidcConfig;
	if (!config) throw ctx.redirect(`${errorURL || callbackURL}?error=invalid_provider&error_description=provider not found`);
	try {
		config = await ensureRuntimeDiscovery(config, provider.issuer, (url) => ctx.context.isTrustedOrigin(url));
	} catch (error) {
		if (error instanceof DiscoveryError) throw ctx.redirect(`${errorURL || callbackURL}?error=discovery_failed&error_description=${encodeURIComponent(error.message)}`);
		throw ctx.redirect(`${errorURL || callbackURL}?error=discovery_failed&error_description=unexpected_discovery_error`);
	}
	if (!config.scopes) config = {
		...config,
		scopes: [
			"openid",
			"email",
			"profile",
			"offline_access"
		]
	};
	if (!config.tokenEndpoint) throw ctx.redirect(`${errorURL || callbackURL}?error=invalid_provider&error_description=token_endpoint_not_found`);
	const tokenResponse = await validateAuthorizationCode({
		code,
		codeVerifier: config.pkce ? stateData.codeVerifier : void 0,
		redirectURI: getOIDCRedirectURI(ctx.context.baseURL, provider.providerId, options),
		options: {
			clientId: config.clientId,
			clientSecret: config.clientSecret
		},
		tokenEndpoint: config.tokenEndpoint,
		authentication: config.tokenEndpointAuthentication === "client_secret_post" ? "post" : "basic"
	}).catch((e) => {
		ctx.context.logger.error("Error validating authorization code", e);
		if (e instanceof BetterFetchError) throw ctx.redirect(`${errorURL || callbackURL}?error=invalid_provider&error_description=${e.message}`);
		return null;
	});
	if (!tokenResponse) throw ctx.redirect(`${errorURL || callbackURL}?error=invalid_provider&error_description=token_response_not_found`);
	let userInfo = null;
	const mapping = config.mapping || {};
	if (config.userInfoEndpoint) {
		const userInfoResponse = await betterFetch(config.userInfoEndpoint, { headers: { Authorization: `Bearer ${tokenResponse.accessToken}` } });
		if (userInfoResponse.error) throw ctx.redirect(`${errorURL || callbackURL}?error=invalid_provider&error_description=${userInfoResponse.error.message}`);
		const rawUserInfo = userInfoResponse.data;
		userInfo = {
			...Object.fromEntries(Object.entries(mapping.extraFields || {}).map(([key, value]) => [key, rawUserInfo[value]])),
			id: rawUserInfo[mapping.id || "sub"],
			email: rawUserInfo[mapping.email || "email"],
			emailVerified: options?.trustEmailVerified ? rawUserInfo[mapping.emailVerified || "email_verified"] : false,
			name: rawUserInfo[mapping.name || "name"],
			image: rawUserInfo[mapping.image || "picture"]
		};
	} else if (tokenResponse.idToken) {
		const idToken = decodeJwt(tokenResponse.idToken);
		if (!config.jwksEndpoint) throw ctx.redirect(`${errorURL || callbackURL}?error=invalid_provider&error_description=jwks_endpoint_not_found`);
		const verified = await validateToken(tokenResponse.idToken, config.jwksEndpoint, {
			audience: config.clientId,
			issuer: provider.issuer
		}).catch((e) => {
			ctx.context.logger.error(e);
			return null;
		});
		if (!verified) throw ctx.redirect(`${errorURL || callbackURL}?error=invalid_provider&error_description=token_not_verified`);
		userInfo = {
			...Object.fromEntries(Object.entries(mapping.extraFields || {}).map(([key, value]) => [key, verified.payload[value]])),
			id: idToken[mapping.id || "sub"],
			email: idToken[mapping.email || "email"],
			emailVerified: options?.trustEmailVerified ? idToken[mapping.emailVerified || "email_verified"] : false,
			name: idToken[mapping.name || "name"],
			image: idToken[mapping.image || "picture"]
		};
	} else throw ctx.redirect(`${errorURL || callbackURL}?error=invalid_provider&error_description=user_info_endpoint_not_found`);
	if (!userInfo.email || !userInfo.id) throw ctx.redirect(`${errorURL || callbackURL}?error=invalid_provider&error_description=missing_user_info`);
	const isTrustedProvider = "domainVerified" in provider && provider.domainVerified === true && validateEmailDomain(userInfo.email, provider.domain);
	const linked = await handleOAuthUserInfo(ctx, {
		userInfo: {
			email: userInfo.email,
			name: userInfo.name || "",
			id: userInfo.id,
			image: userInfo.image,
			emailVerified: options?.trustEmailVerified ? userInfo.emailVerified || false : false
		},
		account: {
			idToken: tokenResponse.idToken,
			accessToken: tokenResponse.accessToken,
			refreshToken: tokenResponse.refreshToken,
			accountId: userInfo.id,
			providerId: provider.providerId,
			accessTokenExpiresAt: tokenResponse.accessTokenExpiresAt,
			refreshTokenExpiresAt: tokenResponse.refreshTokenExpiresAt,
			scope: tokenResponse.scopes?.join(",")
		},
		callbackURL,
		disableSignUp: options?.disableImplicitSignUp && !requestSignUp,
		overrideUserInfo: config.overrideUserInfo,
		isTrustedProvider
	});
	if (linked.error) throw ctx.redirect(`${errorURL || callbackURL}?error=${linked.error}`);
	const { session, user } = linked.data;
	if (options?.provisionUser && (linked.isRegister || options.provisionUserOnEveryLogin)) await options.provisionUser({
		user,
		userInfo,
		token: tokenResponse,
		provider
	});
	await assignOrganizationFromProvider(ctx, {
		user,
		profile: {
			providerType: "oidc",
			providerId: provider.providerId,
			accountId: userInfo.id,
			email: userInfo.email,
			emailVerified: Boolean(userInfo.emailVerified),
			rawAttributes: userInfo
		},
		provider,
		token: tokenResponse,
		provisioningOptions: options?.organizationProvisioning
	});
	await setSessionCookie(ctx, {
		session,
		user
	});
	let toRedirectTo;
	try {
		toRedirectTo = (linked.isRegister ? newUserURL || callbackURL : callbackURL).toString();
	} catch {
		toRedirectTo = linked.isRegister ? newUserURL || callbackURL : callbackURL;
	}
	throw ctx.redirect(toRedirectTo);
}
const callbackSSOEndpointConfig = {
	method: "GET",
	query: callbackSSOQuerySchema,
	allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"],
	metadata: {
		...HIDE_METADATA,
		openapi: {
			operationId: "handleSSOCallback",
			summary: "Callback URL for SSO provider",
			description: "This endpoint is used as the callback URL for SSO providers. It handles the authorization code and exchanges it for an access token",
			responses: { "302": { description: "Redirects to the callback URL" } }
		}
	}
};
const callbackSSO = (options) => {
	return createAuthEndpoint("/sso/callback/:providerId", callbackSSOEndpointConfig, async (ctx) => {
		return handleOIDCCallback(ctx, options, ctx.params.providerId);
	});
};
/**
* Shared OIDC callback endpoint (no `:providerId` in path).
* Used when `options.redirectURI` is set — the `providerId` is read from
* the OAuth state instead of the URL path.
*/
const callbackSSOShared = (options) => {
	return createAuthEndpoint("/sso/callback", {
		...callbackSSOEndpointConfig,
		metadata: {
			...callbackSSOEndpointConfig.metadata,
			openapi: {
				...callbackSSOEndpointConfig.metadata.openapi,
				operationId: "handleSSOCallbackShared",
				summary: "Shared callback URL for all SSO providers",
				description: "This endpoint is used as a shared callback URL for all SSO providers when `redirectURI` is configured. The provider is identified via the OAuth state parameter."
			}
		}
	}, async (ctx) => {
		const stateData = await parseState(ctx);
		if (!stateData) {
			const errorURL = ctx.context.options.onAPIError?.errorURL || `${ctx.context.baseURL}/error`;
			throw ctx.redirect(`${errorURL}?error=invalid_state`);
		}
		const providerId = stateData.ssoProviderId;
		if (!providerId) {
			const errorURL = stateData.errorURL || stateData.callbackURL;
			throw ctx.redirect(`${errorURL}?error=invalid_state&error_description=missing_provider_id`);
		}
		return handleOIDCCallback(ctx, options, providerId, stateData);
	});
};
const callbackSSOSAMLBodySchema = z.object({
	SAMLResponse: z.string(),
	RelayState: z.string().optional()
});
const callbackSSOSAML = (options) => {
	return createAuthEndpoint("/sso/saml2/callback/:providerId", {
		method: ["GET", "POST"],
		body: callbackSSOSAMLBodySchema.optional(),
		query: z.object({ RelayState: z.string().optional() }).optional(),
		metadata: {
			...HIDE_METADATA,
			allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"],
			openapi: {
				operationId: "handleSAMLCallback",
				summary: "Callback URL for SAML provider",
				description: "This endpoint is used as the callback URL for SAML providers. Supports both GET and POST methods for IdP-initiated and SP-initiated flows.",
				responses: {
					"302": { description: "Redirects to the callback URL" },
					"400": { description: "Invalid SAML response" },
					"401": { description: "Unauthorized - SAML authentication failed" }
				}
			}
		}
	}, async (ctx) => {
		const { providerId } = ctx.params;
		const appOrigin = new URL(ctx.context.baseURL).origin;
		const errorURL = ctx.context.options.onAPIError?.errorURL || `${appOrigin}/error`;
		const currentCallbackPath = `${ctx.context.baseURL}/sso/saml2/callback/${providerId}`;
		if (ctx.method === "GET" && !ctx.body?.SAMLResponse) {
			if (!(await getSessionFromCtx(ctx))?.session) throw ctx.redirect(`${errorURL}?error=invalid_request`);
			const relayState = ctx.query?.RelayState;
			const safeRedirectUrl = getSafeRedirectUrl(relayState, currentCallbackPath, appOrigin, (url, settings) => ctx.context.isTrustedOrigin(url, settings));
			throw ctx.redirect(safeRedirectUrl);
		}
		if (!ctx.body?.SAMLResponse) throw new APIError("BAD_REQUEST", { message: "SAMLResponse is required for POST requests" });
		const safeRedirectUrl = await processSAMLResponse(ctx, {
			SAMLResponse: ctx.body.SAMLResponse,
			RelayState: ctx.body.RelayState,
			providerId,
			currentCallbackPath
		}, options);
		throw ctx.redirect(safeRedirectUrl);
	});
};
const acsEndpointBodySchema = z.object({
	SAMLResponse: z.string(),
	RelayState: z.string().optional()
});
const acsEndpoint = (options) => {
	return createAuthEndpoint("/sso/saml2/sp/acs/:providerId", {
		method: "POST",
		body: acsEndpointBodySchema,
		metadata: {
			...HIDE_METADATA,
			allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"],
			openapi: {
				operationId: "handleSAMLAssertionConsumerService",
				summary: "SAML Assertion Consumer Service",
				description: "Handles SAML responses from IdP after successful authentication",
				responses: { "302": { description: "Redirects to the callback URL after successful authentication" } }
			}
		}
	}, async (ctx) => {
		const { providerId } = ctx.params;
		const currentCallbackPath = `${ctx.context.baseURL}/sso/saml2/sp/acs/${providerId}`;
		const appOrigin = new URL(ctx.context.baseURL).origin;
		try {
			const safeRedirectUrl = await processSAMLResponse(ctx, {
				SAMLResponse: ctx.body.SAMLResponse,
				RelayState: ctx.body.RelayState,
				providerId,
				currentCallbackPath
			}, options);
			throw ctx.redirect(safeRedirectUrl);
		} catch (error) {
			if (error instanceof Response || error && typeof error === "object" && "status" in error && error.status === 302) throw error;
			if (error instanceof APIError && error.statusCode === 400) {
				const internalCode = error.body?.code || "";
				const errorCode = internalCode === "SAML_MULTIPLE_ASSERTIONS" ? "multiple_assertions" : internalCode === "SAML_NO_ASSERTION" ? "no_assertion" : internalCode.toLowerCase() || "saml_error";
				const redirectUrl = getSafeRedirectUrl(ctx.body.RelayState || void 0, currentCallbackPath, appOrigin, (url, settings) => ctx.context.isTrustedOrigin(url, settings));
				throw ctx.redirect(`${redirectUrl}${redirectUrl.includes("?") ? "&" : "?"}error=${encodeURIComponent(errorCode)}&error_description=${encodeURIComponent(error.message)}`);
			}
			throw error;
		}
	});
};
const sloSchema = z.object({
	SAMLRequest: z.string().optional(),
	SAMLResponse: z.string().optional(),
	RelayState: z.string().optional(),
	SigAlg: z.string().optional(),
	Signature: z.string().optional()
});
const sloEndpoint = (options) => {
	return createAuthEndpoint("/sso/saml2/sp/slo/:providerId", {
		method: ["GET", "POST"],
		body: sloSchema.optional(),
		query: sloSchema.optional(),
		metadata: {
			...HIDE_METADATA,
			allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"]
		}
	}, async (ctx) => {
		if (!options?.saml?.enableSingleLogout) throw APIError.from("BAD_REQUEST", SAML_ERROR_CODES.SINGLE_LOGOUT_NOT_ENABLED);
		const { providerId } = ctx.params;
		const samlRequest = ctx.body?.SAMLRequest || ctx.query?.SAMLRequest;
		const samlResponse = ctx.body?.SAMLResponse || ctx.query?.SAMLResponse;
		const relayState = ctx.body?.RelayState || ctx.query?.RelayState;
		const appOrigin = new URL(ctx.context.baseURL).origin;
		const safeErrorURL = getSafeRedirectUrl(relayState, `${appOrigin}/sso/saml2/sp/slo/${providerId}`, appOrigin, (url, settings) => ctx.context.isTrustedOrigin(url, settings));
		if (!samlRequest && !samlResponse) throw ctx.redirect(`${safeErrorURL}?error=invalid_request&error_description=missing_logout_data`);
		const provider = await findSAMLProvider(providerId, options, ctx.context.adapter);
		if (!provider?.samlConfig) throw APIError.from("NOT_FOUND", SAML_ERROR_CODES.SAML_PROVIDER_NOT_FOUND);
		const config = provider.samlConfig;
		const sp = createSP(config, ctx.context.baseURL, providerId, { sloOptions: {
			wantLogoutRequestSigned: options?.saml?.wantLogoutRequestSigned,
			wantLogoutResponseSigned: options?.saml?.wantLogoutResponseSigned
		} });
		const idp = createIdP(config);
		if (samlResponse) return handleLogoutResponse(ctx, sp, idp, relayState, providerId);
		return handleLogoutRequest(ctx, sp, idp, relayState, providerId);
	});
};
async function handleLogoutResponse(ctx, sp, idp, relayState, providerId) {
	const binding = ctx.method === "POST" && ctx.body?.SAMLResponse ? "post" : "redirect";
	let parsed;
	try {
		parsed = await sp.parseLogoutResponse(idp, binding, {
			body: ctx.body,
			query: ctx.query
		});
	} catch (error) {
		ctx.context.logger.error("LogoutResponse validation failed", { error });
		throw APIError.from("BAD_REQUEST", SAML_ERROR_CODES.INVALID_LOGOUT_RESPONSE);
	}
	const extract = parsed?.extract;
	const statusCode = extract?.statusCode || extract?.status || parsed?.samlContent?.status?.statusCode;
	if (statusCode && statusCode !== "urn:oasis:names:tc:SAML:2.0:status:Success") {
		ctx.context.logger.warn("LogoutResponse indicates failure", { statusCode });
		throw APIError.from("BAD_REQUEST", SAML_ERROR_CODES.LOGOUT_FAILED_AT_IDP);
	}
	const inResponseTo = extract?.response?.inResponseTo;
	if (inResponseTo) {
		const key = `${LOGOUT_REQUEST_KEY_PREFIX}${inResponseTo}`;
		if (!await ctx.context.internalAdapter.findVerificationValue(key)) ctx.context.logger.warn("LogoutResponse references unknown or expired request", { inResponseTo });
		await ctx.context.internalAdapter.deleteVerificationByIdentifier(key).catch((e) => ctx.context.logger.warn("Failed to delete logout request verification value", e));
	}
	deleteSessionCookie(ctx);
	const appOrigin = new URL(ctx.context.baseURL).origin;
	const safeRedirectUrl = getSafeRedirectUrl(relayState, `${appOrigin}/sso/saml2/sp/slo/${providerId}`, appOrigin, (url, settings) => ctx.context.isTrustedOrigin(url, settings));
	throw ctx.redirect(safeRedirectUrl);
}
async function handleLogoutRequest(ctx, sp, idp, relayState, providerId) {
	const binding = ctx.method === "POST" && ctx.body?.SAMLRequest ? "post" : "redirect";
	let parsed;
	try {
		parsed = await sp.parseLogoutRequest(idp, binding, {
			body: ctx.body,
			query: ctx.query
		});
	} catch (error) {
		ctx.context.logger.error("LogoutRequest validation failed", { error });
		throw APIError.from("BAD_REQUEST", SAML_ERROR_CODES.INVALID_LOGOUT_REQUEST);
	}
	if (!parsed?.extract) throw APIError.from("BAD_REQUEST", SAML_ERROR_CODES.INVALID_LOGOUT_REQUEST);
	const { nameID } = parsed.extract;
	const sessionIndex = parsed.extract.sessionIndex;
	const key = `${SAML_SESSION_KEY_PREFIX}${providerId}:${nameID}`;
	const stored = await ctx.context.internalAdapter.findVerificationValue(key);
	if (stored) {
		const data = safeJsonParse(stored.value);
		if (data) if (!sessionIndex || !data.sessionIndex || sessionIndex === data.sessionIndex) {
			await ctx.context.internalAdapter.deleteSession(data.sessionId).catch((e) => ctx.context.logger.warn("Failed to delete session during SLO", { error: e }));
			await ctx.context.internalAdapter.deleteVerificationByIdentifier(`${SAML_SESSION_BY_ID_PREFIX}${data.sessionId}`).catch((e) => ctx.context.logger.warn("Failed to delete SAML session lookup during SLO", e));
		} else ctx.context.logger.warn("SessionIndex mismatch in LogoutRequest - skipping session deletion", {
			providerId,
			requestedSessionIndex: sessionIndex,
			storedSessionIndex: data.sessionIndex
		});
		await ctx.context.internalAdapter.deleteVerificationByIdentifier(key).catch((e) => ctx.context.logger.warn("Failed to delete SAML session key during SLO", e));
	}
	const currentSession = await getSessionFromCtx(ctx);
	if (currentSession?.session) await ctx.context.internalAdapter.deleteSession(currentSession.session.id);
	deleteSessionCookie(ctx);
	const requestId = parsed.extract.request?.id || "";
	const res = sp.createLogoutResponse(idp, null, binding, relayState || "", (template) => template.replace("{InResponseTo}", requestId).replace("{StatusCode}", SAML_STATUS_SUCCESS));
	if (binding === "post" && res.entityEndpoint) return createSAMLPostForm(res.entityEndpoint, "SAMLResponse", res.context, relayState);
	throw ctx.redirect(res.context);
}
const initiateSLO = (options) => {
	return createAuthEndpoint("/sso/saml2/logout/:providerId", {
		method: "POST",
		body: z.object({ callbackURL: z.string().optional() }),
		use: [sessionMiddleware],
		metadata: HIDE_METADATA
	}, async (ctx) => {
		if (!options?.saml?.enableSingleLogout) throw APIError.from("BAD_REQUEST", SAML_ERROR_CODES.SINGLE_LOGOUT_NOT_ENABLED);
		const { providerId } = ctx.params;
		const callbackURL = ctx.body.callbackURL || ctx.context.baseURL;
		const provider = await findSAMLProvider(providerId, options, ctx.context.adapter);
		if (!provider?.samlConfig) throw APIError.from("NOT_FOUND", SAML_ERROR_CODES.SAML_PROVIDER_NOT_FOUND);
		const config = provider.samlConfig;
		if (!(config.idpMetadata?.singleLogoutService?.length || config.idpMetadata?.metadata && config.idpMetadata.metadata.includes("SingleLogoutService"))) throw APIError.from("BAD_REQUEST", SAML_ERROR_CODES.IDP_SLO_NOT_SUPPORTED);
		const sp = createSP(config, ctx.context.baseURL, providerId, { sloOptions: {
			wantLogoutRequestSigned: options?.saml?.wantLogoutRequestSigned,
			wantLogoutResponseSigned: options?.saml?.wantLogoutResponseSigned
		} });
		const idp = createIdP(config);
		const session = ctx.context.session;
		const sessionLookupKey = `${SAML_SESSION_BY_ID_PREFIX}${session.session.id}`;
		const sessionLookup = await ctx.context.internalAdapter.findVerificationValue(sessionLookupKey);
		let nameID = session.user.email;
		let sessionIndex;
		let samlSessionKey;
		if (sessionLookup) {
			samlSessionKey = sessionLookup.value;
			const stored = await ctx.context.internalAdapter.findVerificationValue(samlSessionKey);
			if (stored) {
				const data = safeJsonParse(stored.value);
				if (data) {
					nameID = data.nameID || nameID;
					sessionIndex = data.sessionIndex;
				}
			}
		}
		const logoutRequest = sp.createLogoutRequest(idp, "redirect", {
			logoutNameID: nameID,
			sessionIndex,
			relayState: callbackURL
		});
		const ttl = options?.saml?.logoutRequestTTL ?? 3e5;
		await ctx.context.internalAdapter.createVerificationValue({
			identifier: `${LOGOUT_REQUEST_KEY_PREFIX}${logoutRequest.id}`,
			value: providerId,
			expiresAt: new Date(Date.now() + ttl)
		});
		if (samlSessionKey) await ctx.context.internalAdapter.deleteVerificationByIdentifier(samlSessionKey).catch((e) => ctx.context.logger.warn("Failed to delete SAML session key during logout", e));
		await ctx.context.internalAdapter.deleteVerificationByIdentifier(sessionLookupKey).catch((e) => ctx.context.logger.warn("Failed to delete session lookup key during logout", e));
		await ctx.context.internalAdapter.deleteSession(session.session.id);
		deleteSessionCookie(ctx);
		throw ctx.redirect(logoutRequest.context);
	});
};
//#endregion
//#region src/index.ts
saml.setSchemaValidator({ async validate(xml) {
	if (XMLValidator.validate(xml, { allowBooleanAttributes: true }) === true) return "SUCCESS_VALIDATE_XML";
	throw "ERR_INVALID_XML";
} });
/**
* SAML endpoint paths that should skip origin check validation.
* These endpoints receive POST requests from external Identity Providers,
* which won't have a matching Origin header.
*/
const SAML_SKIP_ORIGIN_CHECK_PATHS = [
	"/sso/saml2/callback",
	"/sso/saml2/sp/acs",
	"/sso/saml2/sp/slo"
];
function sso(options) {
	const optionsWithStore = options;
	let endpoints = {
		spMetadata: spMetadata(optionsWithStore),
		registerSSOProvider: registerSSOProvider(optionsWithStore),
		signInSSO: signInSSO(optionsWithStore),
		callbackSSO: callbackSSO(optionsWithStore),
		callbackSSOShared: callbackSSOShared(optionsWithStore),
		callbackSSOSAML: callbackSSOSAML(optionsWithStore),
		acsEndpoint: acsEndpoint(optionsWithStore),
		sloEndpoint: sloEndpoint(optionsWithStore),
		initiateSLO: initiateSLO(optionsWithStore),
		listSSOProviders: listSSOProviders(),
		getSSOProvider: getSSOProvider(),
		updateSSOProvider: updateSSOProvider(optionsWithStore),
		deleteSSOProvider: deleteSSOProvider()
	};
	if (options?.domainVerification?.enabled) {
		const domainVerificationEndpoints = {
			requestDomainVerification: requestDomainVerification(optionsWithStore),
			verifyDomain: verifyDomain(optionsWithStore)
		};
		endpoints = {
			...endpoints,
			...domainVerificationEndpoints
		};
	}
	return {
		id: "sso",
		version: PACKAGE_VERSION,
		init(ctx) {
			const existing = ctx.skipOriginCheck;
			if (existing === true) return {};
			return { context: { skipOriginCheck: [...Array.isArray(existing) ? existing : [], ...SAML_SKIP_ORIGIN_CHECK_PATHS] } };
		},
		endpoints,
		hooks: {
			before: [{
				matcher(context) {
					return context.path === "/sign-out";
				},
				handler: createAuthMiddleware(async (ctx) => {
					if (!options?.saml?.enableSingleLogout) return;
					const session = await getSessionFromCtx(ctx);
					if (!session?.session?.id) return;
					const sessionLookupKey = `${SAML_SESSION_BY_ID_PREFIX}${session.session.id}`;
					const sessionLookup = await ctx.context.internalAdapter.findVerificationValue(sessionLookupKey);
					if (sessionLookup?.value) {
						await ctx.context.internalAdapter.deleteVerificationByIdentifier(sessionLookup.value).catch(() => {});
						await ctx.context.internalAdapter.deleteVerificationByIdentifier(sessionLookupKey).catch(() => {});
					}
				})
			}],
			after: [{
				matcher(context) {
					return context.path?.startsWith("/callback/") ?? false;
				},
				handler: createAuthMiddleware(async (ctx) => {
					const newSession = ctx.context.newSession;
					if (!newSession?.user) return;
					if (!ctx.context.hasPlugin("organization")) return;
					await assignOrganizationByDomain(ctx, {
						user: newSession.user,
						provisioningOptions: options?.organizationProvisioning,
						domainVerification: options?.domainVerification
					});
				})
			}]
		},
		schema: { ssoProvider: {
			modelName: options?.modelName ?? "ssoProvider",
			fields: {
				issuer: {
					type: "string",
					required: true,
					fieldName: options?.fields?.issuer ?? "issuer"
				},
				oidcConfig: {
					type: "string",
					required: false,
					fieldName: options?.fields?.oidcConfig ?? "oidcConfig"
				},
				samlConfig: {
					type: "string",
					required: false,
					fieldName: options?.fields?.samlConfig ?? "samlConfig"
				},
				userId: {
					type: "string",
					references: {
						model: "user",
						field: "id"
					},
					fieldName: options?.fields?.userId ?? "userId"
				},
				providerId: {
					type: "string",
					required: true,
					unique: true,
					fieldName: options?.fields?.providerId ?? "providerId"
				},
				organizationId: {
					type: "string",
					required: false,
					fieldName: options?.fields?.organizationId ?? "organizationId"
				},
				domain: {
					type: "string",
					required: true,
					fieldName: options?.fields?.domain ?? "domain"
				},
				...options?.domainVerification?.enabled ? { domainVerified: {
					type: "boolean",
					required: false
				} } : {}
			}
		} },
		options
	};
}
//#endregion
export { DEFAULT_CLOCK_SKEW_MS, DEFAULT_MAX_SAML_METADATA_SIZE, DEFAULT_MAX_SAML_RESPONSE_SIZE, DataEncryptionAlgorithm, DigestAlgorithm, DiscoveryError, KeyEncryptionAlgorithm, REQUIRED_DISCOVERY_FIELDS, SignatureAlgorithm, computeDiscoveryUrl, discoverOIDCConfig, fetchDiscoveryDocument, needsRuntimeDiscovery, normalizeDiscoveryUrls, normalizeUrl, selectTokenEndpointAuthMethod, sso, validateDiscoveryDocument, validateDiscoveryUrl, validateSAMLTimestamp };
