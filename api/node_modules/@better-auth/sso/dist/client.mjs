import { t as PACKAGE_VERSION } from "./version-D_ggtAOl.mjs";
//#region src/client.ts
const ssoClient = (options) => {
	return {
		id: "sso-client",
		version: PACKAGE_VERSION,
		$InferServerPlugin: {},
		pathMethods: {
			"/sso/providers": "GET",
			"/sso/get-provider": "GET"
		}
	};
};
//#endregion
export { ssoClient };
