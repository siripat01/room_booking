import "./constants-CvriWQVc.mjs";
import { n as createKV } from "./fetch-DiAhoiKA.mjs";
import { a as resolveSentinelClientIdentifyUrl, c as bytesToHex, i as solvePoWChallenge, n as decodePoWChallenge, r as encodePoWSolution, s as identify, t as createPowRetryTimeout, u as dashClient } from "./pow-retry-D2RRftJr.mjs";
import { env } from "@better-auth/core/env";
import { Dimensions, InteractionManager, PixelRatio, Platform } from "react-native";
//#region src/sentinel/native/components.ts
/**
* Default first-party component payload for React Native / Expo.
* Avoids browser-style entropy; sets `clientRuntime` for durable-kv bot scoring.
*/
async function defaultCollectNativeComponents() {
	const windowDims = Dimensions.get("window");
	const scale = PixelRatio.get();
	let locale = "en";
	let locales = ["en"];
	try {
		locale = Intl.DateTimeFormat().resolvedOptions().locale || locale;
		locales = [locale];
	} catch {}
	const nav = globalThis.navigator;
	if (nav?.languages?.length) locales = [...nav.languages];
	let timezone = "";
	let timezoneOffset = 0;
	try {
		timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
		timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	} catch {
		timezone = "unknown";
	}
	const components = {
		clientRuntime: "react-native",
		platform: Platform.OS,
		screenResolution: `${Math.round(windowDims.width)}x${Math.round(windowDims.height)}`,
		pixelRatio: scale,
		fontScale: windowDims.fontScale,
		language: locales[0] ?? locale,
		languages: locales,
		locale,
		timezone,
		timezoneOffset,
		touchSupport: true,
		maxTouchPoints: Platform.OS === "ios" ? 5 : 10
	};
	if (nav?.userAgent) components.userAgent = nav.userAgent;
	await applyOptionalExpoMetadata(components);
	return components;
}
async function applyOptionalExpoMetadata(components) {
	try {
		const c = (await import("expo-constants")).default;
		if (c?.expoConfig?.version) components.appVersion = c.expoConfig.version;
		else if (c?.nativeAppVersion) components.appVersion = c.nativeAppVersion;
		if (c?.expoConfig?.slug) components.expoSlug = c.expoConfig.slug;
	} catch {}
	try {
		const d = (await import("expo-device")).default;
		if (d?.modelName) components.deviceModel = d.modelName;
		if (d?.osVersion) components.osVersion = d.osVersion;
	} catch {}
}
//#endregion
//#region src/sentinel/native/crypto.ts
/**
* Cryptographically secure random bytes for React Native, Node (e.g. Expo API routes),
* and other runtimes
*/
async function randomBytesAsync(length) {
	const c = globalThis.crypto;
	if (c && typeof c.getRandomValues === "function") {
		const bytes = new Uint8Array(length);
		c.getRandomValues(bytes);
		return bytes;
	}
	try {
		const { getRandomBytesAsync } = await import("expo-crypto");
		return await getRandomBytesAsync(length);
	} catch {
		throw new Error("[@better-auth/infra] No secure RNG available: use Web Crypto / Node, add `import \"react-native-get-random-values\"` at app entry (before other imports), or install `expo-crypto` with a native dev build.");
	}
}
//#endregion
//#region src/sentinel/native/fingerprint.ts
async function randomVisitorId() {
	return bytesToHex(await randomBytesAsync(10)).slice(0, 20);
}
async function generateRequestId() {
	const h = bytesToHex(await randomBytesAsync(16));
	return [
		h.slice(0, 8),
		h.slice(8, 12),
		h.slice(12, 16),
		h.slice(16, 20),
		h.slice(20, 32)
	].join("-");
}
/** Conservative confidence for first-party native payloads (not web-grade signals). */
const NATIVE_IDENTIFY_CONFIDENCE = .52;
/** Logical URL recorded with native identify payloads. */
const NATIVE_IDENTIFY_CONTEXT_URL = "react-native://identify";
function createNativeFingerprintRuntime(deps) {
	let cached = null;
	let pending = null;
	let identifySent = false;
	let identifyComplete = null;
	let identifyCompleteResolve = null;
	async function getFingerprint() {
		if (cached != null) return cached;
		if (pending != null) return pending;
		pending = (async () => {
			try {
				const visitorId = await deps.getOrCreateVisitorId();
				const components = await defaultCollectNativeComponents();
				const result = {
					visitorId,
					requestId: await generateRequestId(),
					confidence: NATIVE_IDENTIFY_CONFIDENCE,
					components
				};
				cached = result;
				return result;
			} catch (error) {
				console.warn("[Sentinel native] Fingerprint generation failed:", error);
				pending = null;
				return null;
			}
		})();
		return pending;
	}
	async function sendIdentify() {
		if (identifySent) return;
		const fingerprint = await getFingerprint();
		if (!fingerprint) return;
		identifySent = true;
		identifyComplete = new Promise((resolve) => {
			identifyCompleteResolve = resolve;
		});
		const payload = {
			visitorId: fingerprint.visitorId,
			requestId: fingerprint.requestId,
			confidence: fingerprint.confidence,
			components: fingerprint.components,
			url: NATIVE_IDENTIFY_CONTEXT_URL,
			incognito: false
		};
		try {
			await identify(deps.$kv, payload);
		} catch (error) {
			console.warn("[Sentinel native] Identify request failed:", error);
		} finally {
			identifyCompleteResolve?.();
			identifyCompleteResolve = null;
		}
	}
	async function waitForIdentify(timeoutMs) {
		if (!identifyComplete) return;
		const ms = timeoutMs ?? 1e3;
		await Promise.race([identifyComplete, new Promise((resolve) => setTimeout(resolve, ms))]);
	}
	return {
		getFingerprint,
		sendIdentify,
		waitForIdentify
	};
}
const VISITOR_STORAGE_KEY = "better-auth.infra.sentinel.visitorId";
let memoryVisitorId = null;
/**
* Stable per-install visitor id. Prefer passing `storage` (e.g. secure storage).
* Otherwise tries `@react-native-async-storage/async-storage`, then falls back to an in-memory id (session only).
*/
async function getOrCreateVisitorId(storage) {
	if (storage) {
		const existing = await storage.getItem(VISITOR_STORAGE_KEY);
		if (existing) return existing;
		const id = await randomVisitorId();
		await storage.setItem(VISITOR_STORAGE_KEY, id);
		return id;
	}
	try {
		const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
		const existing = await AsyncStorage.getItem(VISITOR_STORAGE_KEY);
		if (existing) return existing;
		const id = await randomVisitorId();
		await AsyncStorage.setItem(VISITOR_STORAGE_KEY, id);
		return id;
	} catch {
		memoryVisitorId ??= await randomVisitorId();
		return memoryVisitorId;
	}
}
//#endregion
//#region src/sentinel/native/client.ts
function scheduleIdentify(send) {
	const run = () => {
		try {
			send();
		} catch (e) {
			console.warn("[Sentinel native] identify schedule error:", e);
		}
	};
	try {
		const im = InteractionManager;
		if (im && typeof im.runAfterInteractions === "function") {
			im.runAfterInteractions(run);
			return;
		}
	} catch {}
	if (typeof queueMicrotask === "function") queueMicrotask(run);
	else setTimeout(run, 0);
}
const sentinelNativeClient = (options) => {
	const autoSolve = options?.autoSolveChallenge !== false;
	const runtime = createNativeFingerprintRuntime({
		$kv: createKV({
			kvUrl: resolveSentinelClientIdentifyUrl({
				identifyUrl: options?.identifyUrl,
				envKvUrl: env.BETTER_AUTH_KV_URL
			}),
			kvTimeout: options?.kvTimeout
		}),
		getOrCreateVisitorId: () => getOrCreateVisitorId(options?.storage)
	});
	scheduleIdentify(() => {
		runtime.sendIdentify();
	});
	return {
		id: "sentinel",
		fetchPlugins: [{
			id: "sentinel-fingerprint",
			name: "sentinel-fingerprint",
			hooks: { async onRequest(context) {
				await runtime.waitForIdentify(options?.kvTimeout);
				const fingerprint = await runtime.getFingerprint();
				if (!fingerprint) return context;
				const headers = context.headers || new Headers();
				if (headers instanceof Headers) {
					headers.set("X-Visitor-Id", fingerprint.visitorId);
					headers.set("X-Request-Id", fingerprint.requestId);
				}
				return {
					...context,
					headers
				};
			} }
		}, {
			id: "sentinel-pow-solver",
			name: "sentinel-pow-solver",
			hooks: {
				async onResponse(context) {
					if (context.response.status !== 423 || !autoSolve) return context;
					const challengeHeader = context.response.headers.get("X-PoW-Challenge");
					const reason = context.response.headers.get("X-PoW-Reason") || "";
					if (!challengeHeader) return context;
					options?.onChallengeReceived?.(reason);
					const challenge = decodePoWChallenge(challengeHeader);
					if (!challenge) return context;
					try {
						const startTime = Date.now();
						const solution = await solvePoWChallenge(challenge);
						const solveTime = Date.now() - startTime;
						options?.onChallengeSolved?.(solveTime);
						const originalUrl = context.response.url;
						const fingerprint = await runtime.getFingerprint();
						const retryHeaders = new Headers();
						retryHeaders.set("X-PoW-Solution", encodePoWSolution(solution));
						if (fingerprint) {
							retryHeaders.set("X-Visitor-Id", fingerprint.visitorId);
							retryHeaders.set("X-Request-Id", fingerprint.requestId);
						}
						retryHeaders.set("Content-Type", "application/json");
						let body;
						if (context.request?.body) body = context.request._originalBody;
						const req = context.request;
						const powRetry = createPowRetryTimeout(req.timeout);
						try {
							const retryResponse = await fetch(originalUrl, {
								method: req.method || "POST",
								headers: retryHeaders,
								body,
								...powRetry.signal ? { signal: powRetry.signal } : {}
							});
							return {
								...context,
								response: retryResponse
							};
						} finally {
							powRetry.cleanup?.();
						}
					} catch (err) {
						console.error("[Sentinel native] Failed to solve PoW challenge:", err);
						options?.onChallengeFailed?.(err instanceof Error ? err : new Error(String(err)));
						return context;
					}
				},
				async onRequest(context) {
					if (context.body) {
						const ctx = context;
						ctx._originalBody = context.body;
					}
					return context;
				}
			}
		}]
	};
};
//#endregion
export { dashClient, sentinelNativeClient };
