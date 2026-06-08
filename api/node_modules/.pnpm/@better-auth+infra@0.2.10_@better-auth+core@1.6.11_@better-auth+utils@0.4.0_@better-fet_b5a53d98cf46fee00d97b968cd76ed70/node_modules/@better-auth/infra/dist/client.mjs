import "./constants-CvriWQVc.mjs";
import { n as createKV } from "./fetch-DiAhoiKA.mjs";
import { a as resolveSentinelClientIdentifyUrl, i as solvePoWChallenge, l as hash, n as decodePoWChallenge, o as generateRequestId, r as encodePoWSolution, s as identify, t as createPowRetryTimeout, u as dashClient } from "./pow-retry-D2RRftJr.mjs";
import { env } from "@better-auth/core/env";
//#region src/sentinel/fingerprint.ts
function murmurhash3(str, seed = 0) {
	let h1 = seed;
	const c1 = 3432918353;
	const c2 = 461845907;
	for (let i = 0; i < str.length; i++) {
		let k1 = str.charCodeAt(i);
		k1 = Math.imul(k1, c1);
		k1 = k1 << 15 | k1 >>> 17;
		k1 = Math.imul(k1, c2);
		h1 ^= k1;
		h1 = h1 << 13 | h1 >>> 19;
		h1 = Math.imul(h1, 5) + 3864292196;
	}
	h1 ^= str.length;
	h1 ^= h1 >>> 16;
	h1 = Math.imul(h1, 2246822507);
	h1 ^= h1 >>> 13;
	h1 = Math.imul(h1, 3266489909);
	h1 ^= h1 >>> 16;
	return h1 >>> 0;
}
function getScreenInfo() {
	return {
		screenResolution: `${screen.width}x${screen.height}`,
		colorDepth: screen.colorDepth,
		pixelRatio: window.devicePixelRatio || 1
	};
}
function getBrowserInfo() {
	const nav = navigator;
	return {
		userAgent: navigator.userAgent,
		platform: navigator.platform,
		language: navigator.language,
		languages: [...navigator.languages || []],
		cookiesEnabled: navigator.cookieEnabled,
		doNotTrack: navigator.doNotTrack,
		vendor: navigator.vendor || "",
		vendorSub: nav.vendorSub || "",
		productSub: nav.productSub || "",
		oscpu: nav.oscpu,
		pdfViewerEnabled: nav.pdfViewerEnabled ?? false
	};
}
function getHardwareInfo() {
	const nav = navigator;
	return {
		hardwareConcurrency: navigator.hardwareConcurrency || 0,
		deviceMemory: nav.deviceMemory,
		maxTouchPoints: navigator.maxTouchPoints || 0
	};
}
function getTimezoneInfo() {
	let timezone = "";
	try {
		timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		timezone = "unknown";
	}
	return {
		timezone,
		timezoneOffset: (/* @__PURE__ */ new Date()).getTimezoneOffset()
	};
}
function getCanvasFingerprint() {
	try {
		const canvas = document.createElement("canvas");
		canvas.width = 280;
		canvas.height = 60;
		const ctx = canvas.getContext("2d");
		if (!ctx) return "no-canvas";
		ctx.fillStyle = "#f60";
		ctx.fillRect(100, 1, 62, 20);
		ctx.fillStyle = "#069";
		ctx.font = "14px 'Arial'";
		ctx.fillText("Fingerprint Canvas", 2, 15);
		ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
		ctx.font = "18px 'Times New Roman'";
		ctx.fillText("Security Check", 4, 45);
		ctx.beginPath();
		ctx.arc(50, 50, 20, 0, Math.PI * 2, true);
		ctx.closePath();
		ctx.fillStyle = "#8B4513";
		ctx.fill();
		const gradient = ctx.createLinearGradient(0, 0, 280, 0);
		gradient.addColorStop(0, "red");
		gradient.addColorStop(.5, "green");
		gradient.addColorStop(1, "blue");
		ctx.fillStyle = gradient;
		ctx.fillRect(200, 30, 75, 25);
		ctx.beginPath();
		ctx.moveTo(170, 10);
		ctx.bezierCurveTo(130, 100, 230, 100, 190, 10);
		ctx.strokeStyle = "#FF1493";
		ctx.lineWidth = 2;
		ctx.stroke();
		return murmurhash3(canvas.toDataURL()).toString(36);
	} catch {
		return "canvas-error";
	}
}
function getWebGLFingerprint() {
	try {
		const canvas = document.createElement("canvas");
		const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
		if (!gl || !(gl instanceof WebGLRenderingContext)) return null;
		const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
		const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
		const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
		const extensions = gl.getSupportedExtensions() || [];
		return {
			vendor: vendor || "unknown",
			renderer: renderer || "unknown",
			extensions: extensions.sort()
		};
	} catch {
		return null;
	}
}
async function getAudioFingerprint() {
	try {
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		if (!AudioContextClass) return null;
		const context = new AudioContextClass();
		const oscillator = context.createOscillator();
		const analyser = context.createAnalyser();
		const gain = context.createGain();
		const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
		gain.gain.value = 0;
		oscillator.type = "triangle";
		oscillator.frequency.setValueAtTime(1e4, context.currentTime);
		oscillator.connect(analyser);
		analyser.connect(scriptProcessor);
		scriptProcessor.connect(gain);
		gain.connect(context.destination);
		oscillator.start(0);
		let resolved = false;
		const cleanup = () => {
			if (resolved) return;
			resolved = true;
			try {
				oscillator.stop();
				oscillator.disconnect();
				analyser.disconnect();
				scriptProcessor.disconnect();
				gain.disconnect();
			} catch {}
			try {
				if (context.state !== "closed") context.close();
			} catch {}
		};
		return new Promise((resolve) => {
			scriptProcessor.onaudioprocess = (e) => {
				if (resolved) return;
				const output = e.inputBuffer.getChannelData(0);
				let sum = 0;
				for (let i = 0; i < output.length; i++) {
					const val = output[i];
					if (val !== void 0) sum += Math.abs(val);
				}
				cleanup();
				resolve(sum);
			};
			setTimeout(() => {
				if (resolved) return;
				cleanup();
				resolve(null);
			}, 1e3);
		});
	} catch {
		return null;
	}
}
function detectFonts() {
	const baseFonts = [
		"monospace",
		"sans-serif",
		"serif"
	];
	const testFonts = [
		"Arial",
		"Arial Black",
		"Calibri",
		"Cambria",
		"Comic Sans MS",
		"Consolas",
		"Courier New",
		"Georgia",
		"Helvetica",
		"Impact",
		"Lucida Console",
		"Monaco",
		"Segoe UI",
		"Tahoma",
		"Times New Roman",
		"Trebuchet MS",
		"Verdana",
		"Futura",
		"Geneva",
		"Gill Sans",
		"Menlo",
		"SF Pro",
		"DejaVu Sans",
		"Ubuntu"
	];
	const testString = "mmmmmmmmmmlli";
	const testSize = "72px";
	const ctx = document.createElement("canvas").getContext("2d");
	if (!ctx) return [];
	const getWidth = (font) => {
		ctx.font = `${testSize} ${font}`;
		return ctx.measureText(testString).width;
	};
	const baseWidths = {};
	baseFonts.forEach((font) => {
		baseWidths[font] = getWidth(font);
	});
	const detectedFonts = [];
	testFonts.forEach((font) => {
		for (const baseFont of baseFonts) if (getWidth(`'${font}', ${baseFont}`) !== baseWidths[baseFont]) {
			detectedFonts.push(font);
			break;
		}
	});
	return detectedFonts.sort();
}
function getStorageInfo() {
	const checkStorage = (storage) => {
		if (!storage) return false;
		try {
			const key = "__fp_test__";
			storage.setItem(key, "1");
			storage.removeItem(key);
			return true;
		} catch {
			return false;
		}
	};
	return {
		localStorage: checkStorage(window.localStorage),
		sessionStorage: checkStorage(window.sessionStorage),
		indexedDB: !!window.indexedDB
	};
}
function getBrowserFeatures() {
	const plugins = [];
	if (navigator.plugins) for (let i = 0; i < navigator.plugins.length; i++) {
		const plugin = navigator.plugins[i];
		if (plugin) plugins.push(plugin.name);
	}
	return {
		webdriver: !!navigator.webdriver,
		plugins: plugins.sort(),
		touchSupport: "ontouchstart" in window || navigator.maxTouchPoints > 0
	};
}
function getConnectionInfo() {
	const connection = navigator.connection;
	return {
		connectionType: connection?.effectiveType,
		downlink: connection?.downlink,
		rtt: connection?.rtt
	};
}
function detectIncognito() {
	try {
		if ("storage" in navigator && "estimate" in navigator.storage) return false;
		return false;
	} catch {
		return true;
	}
}
async function collectFingerprint() {
	const components = {};
	try {
		Object.assign(components, getScreenInfo());
	} catch {}
	try {
		Object.assign(components, getBrowserInfo());
	} catch {}
	try {
		Object.assign(components, getHardwareInfo());
	} catch {}
	try {
		Object.assign(components, getTimezoneInfo());
	} catch {}
	try {
		components.canvas = getCanvasFingerprint();
	} catch {}
	try {
		components.webgl = getWebGLFingerprint();
	} catch {}
	try {
		components.fonts = detectFonts();
	} catch {}
	try {
		Object.assign(components, getStorageInfo());
	} catch {}
	try {
		Object.assign(components, getBrowserFeatures());
	} catch {}
	try {
		Object.assign(components, getConnectionInfo());
	} catch {}
	try {
		components.audio = await getAudioFingerprint();
	} catch {}
	return components;
}
async function generateVisitorId(components) {
	const stableData = {
		screenResolution: components.screenResolution,
		colorDepth: components.colorDepth,
		pixelRatio: components.pixelRatio,
		platform: components.platform,
		hardwareConcurrency: components.hardwareConcurrency,
		deviceMemory: components.deviceMemory,
		timezone: components.timezone,
		canvas: components.canvas,
		webgl: components.webgl,
		fonts: components.fonts,
		maxTouchPoints: components.maxTouchPoints
	};
	return (await hash(JSON.stringify(stableData))).slice(0, 20);
}
function calculateConfidence(components) {
	const weights = {
		canvas: 15,
		webgl: 15,
		audio: 10,
		fonts: 15,
		screenResolution: 5,
		colorDepth: 3,
		pixelRatio: 5,
		hardwareConcurrency: 5,
		deviceMemory: 5,
		timezone: 5,
		platform: 3,
		maxTouchPoints: 3,
		plugins: 6,
		localStorage: 2,
		sessionStorage: 2,
		indexedDB: 1
	};
	let score = 0;
	let maxScore = 0;
	for (const [key, weight] of Object.entries(weights)) {
		maxScore += weight;
		const value = components[key];
		if (value !== void 0 && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)) score += weight;
	}
	return Math.round(score / maxScore * 100) / 100;
}
let cachedFingerprint = null;
let fingerprintPromise = null;
let identifySent = false;
let identifyCompletePromise = null;
let identifyCompleteResolve = null;
async function getFingerprint() {
	if (typeof window === "undefined") return null;
	if (await cachedFingerprint) return cachedFingerprint;
	if (await fingerprintPromise) return fingerprintPromise;
	fingerprintPromise = (async () => {
		const components = await collectFingerprint();
		const visitorId = await generateVisitorId(components);
		const confidence = calculateConfidence(components);
		const result = {
			visitorId,
			requestId: generateRequestId(),
			confidence,
			components
		};
		cachedFingerprint = result;
		return result;
	})();
	try {
		return await fingerprintPromise;
	} catch {
		fingerprintPromise = null;
		return null;
	}
}
async function sendIdentify($kv) {
	if (identifySent || typeof window === "undefined") return;
	const fingerprint = await getFingerprint();
	if (!fingerprint) return;
	identifySent = true;
	identifyCompletePromise = new Promise((resolve) => {
		identifyCompleteResolve = resolve;
	});
	const payload = {
		visitorId: fingerprint.visitorId,
		requestId: fingerprint.requestId,
		confidence: fingerprint.confidence,
		components: fingerprint.components,
		url: window.location.href,
		incognito: detectIncognito()
	};
	try {
		await identify($kv, payload);
	} catch (error) {
		console.warn("[Dash] Identify request failed:", error);
	} finally {
		identifyCompleteResolve?.();
	}
}
/**
* Wait for identify to complete, with a timeout
* Returns immediately if identify hasn't started or has completed
*
* When `timeoutMs` is omitted or nullish, {@link KV_TIMEOUT_MS} is used.
*/
async function waitForIdentify(timeoutMs) {
	if (!identifyCompletePromise) return;
	const ms = timeoutMs ?? 1e3;
	await Promise.race([identifyCompletePromise, new Promise((resolve) => setTimeout(resolve, ms))]);
}
//#endregion
//#region src/sentinel/client.ts
const sentinelClient = (options) => {
	const autoSolve = options?.autoSolveChallenge !== false;
	const $kv = createKV({
		kvUrl: resolveSentinelClientIdentifyUrl({
			identifyUrl: options?.identifyUrl,
			envKvUrl: env.BETTER_AUTH_KV_URL
		}),
		kvTimeout: options?.kvTimeout
	});
	if (typeof window !== "undefined") {
		const scheduleIdentify = () => {
			if ("requestIdleCallback" in window) window.requestIdleCallback(() => {
				sendIdentify($kv);
			});
			else setTimeout(() => {
				sendIdentify($kv);
			}, 100);
		};
		if (document.readyState === "complete") scheduleIdentify();
		else window.addEventListener("load", scheduleIdentify, { once: true });
	}
	return {
		id: "sentinel",
		fetchPlugins: [{
			id: "sentinel-fingerprint",
			name: "sentinel-fingerprint",
			hooks: { async onRequest(context) {
				if (typeof window === "undefined") return context;
				await waitForIdentify(options?.kvTimeout);
				const fingerprint = await getFingerprint();
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
					if (typeof window === "undefined") return context;
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
						const fingerprint = await getFingerprint();
						const retryHeaders = new Headers();
						retryHeaders.set("X-PoW-Solution", encodePoWSolution(solution));
						if (fingerprint) {
							retryHeaders.set("X-Visitor-Id", fingerprint.visitorId);
							retryHeaders.set("X-Request-Id", fingerprint.requestId);
						}
						retryHeaders.set("Content-Type", "application/json");
						let body;
						if (context.request && context.request.body) body = context.request._originalBody;
						const req = context.request;
						const powRetry = createPowRetryTimeout(req.timeout);
						try {
							const retryResponse = await fetch(originalUrl, {
								method: req.method || "POST",
								headers: retryHeaders,
								body,
								credentials: "include",
								...powRetry.signal ? { signal: powRetry.signal } : {}
							});
							return {
								...context,
								response: retryResponse
							};
						} finally {
							powRetry.cleanup?.();
						}
					} catch (error) {
						console.error("[Sentinel] Failed to solve PoW challenge:", error);
						options?.onChallengeFailed?.(error instanceof Error ? error : new Error(String(error)));
						return context;
					}
				},
				async onRequest(context) {
					if (context.body) context._originalBody = context.body;
					return context;
				}
			}
		}]
	};
};
//#endregion
export { dashClient, sentinelClient };
