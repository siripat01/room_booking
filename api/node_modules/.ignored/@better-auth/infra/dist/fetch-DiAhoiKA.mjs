import "./constants-CvriWQVc.mjs";
import { createFetch } from "@better-fetch/fetch";
//#region src/fetch.ts
function createAPI(options, fetchOptions) {
	return createFetch({
		baseURL: options.apiUrl,
		headers: {
			"user-agent": "better-auth",
			"x-api-key": options.apiKey
		},
		timeout: options.apiTimeout,
		...fetchOptions
	});
}
function createKV(options, fetchOptions) {
	const headers = { "user-agent": "better-auth" };
	if (options.apiKey) headers["x-api-key"] = options.apiKey;
	return createFetch({
		baseURL: options.kvUrl,
		headers,
		timeout: options.kvTimeout ?? 1e3,
		...fetchOptions
	});
}
//#endregion
export { createKV as n, createAPI as t };
