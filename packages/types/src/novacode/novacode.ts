import { z } from "zod"

declare global {
	interface Window {
		NOVACODE_BACKEND_BASE_URL: string | undefined
	}
}

export const autocompleteServiceSettingsSchema = z
	.object({
		enableAutoTrigger: z.boolean().optional(),
		enableSmartInlineTaskKeybinding: z.boolean().optional(),
		enableChatAutocomplete: z.boolean().optional(),
		provider: z.string().optional(),
		model: z.string().optional(),
		snoozeUntil: z.number().optional(),
		hasNovacodeProfileWithNoBalance: z.boolean().optional(),
	})
	.optional()

export type AutocompleteServiceSettings = z.infer<typeof autocompleteServiceSettingsSchema>

/**
 * Map of provider names to their default autocomplete models.
 * These are the providers that support autocomplete functionality.
 */
export const AUTOCOMPLETE_PROVIDER_MODELS = new Map([
	["mistral", "codestral-latest"],
	["novacode", "mistralai/codestral-2508"],
	["openrouter", "mistralai/codestral-2508"],
	["requesty", "mistral/codestral-latest"],
	["bedrock", "mistral.codestral-2508-v1:0"],
	["huggingface", "mistralai/Codestral-22B-v0.1"],
	["litellm", "codestral/codestral-latest"],
	["lmstudio", "mistralai/codestral-22b-v0.1"],
	["ollama", "codestral:latest"],
] as const)

export type AutocompleteProviderKey = typeof AUTOCOMPLETE_PROVIDER_MODELS extends Map<infer K, unknown> ? K : never

export const commitRangeSchema = z.object({
	from: z.string(),
	fromTimeStamp: z.number().optional(),
	to: z.string(),
})

export type CommitRange = z.infer<typeof commitRangeSchema>

export const novaCodeMetaDataSchema = z.object({
	commitRange: commitRangeSchema.optional(),
})

export type NovaCodeMetaData = z.infer<typeof novaCodeMetaDataSchema>

export const fastApplyModelSchema = z.enum([
	"auto",
	"morph/morph-v3-fast",
	"morph/morph-v3-large",
	"relace/relace-apply-3",
])

export type FastApplyModel = z.infer<typeof fastApplyModelSchema>

export const fastApplyApiProviderSchema = z.enum(["current", "morph", "novacode", "openrouter"])

export type FastApplyApiProvider = z.infer<typeof fastApplyApiProviderSchema>

export const DEFAULT_NOVACODE_BACKEND_URL = "https://nova.ai"

export function getNovaBaseUriFromToken(novacodeToken?: string) {
	if (novacodeToken) {
		try {
			const payload_string = novacodeToken.split(".")[1]
			if (!payload_string) return "https://api.nova.ai"

			const payload_json =
				typeof atob !== "undefined" ? atob(payload_string) : Buffer.from(payload_string, "base64").toString()
			const payload = JSON.parse(payload_json)
			//note: this is UNTRUSTED, so we need to make sure we're OK with this being manipulated by an attacker; e.g. we should not read uri's from the JWT directly.
			// For dev tokens, check if NOVACODE_BACKEND_BASE_URL is set to a custom value
			if (payload.env === "development") {
				const baseUrl = getGlobalNovacodeBackendUrl()
				// This allows pointing to custom dev backends beyond just those accessible on localhost
				// (e.g., 192.168.x.x, staging servers)
				if (baseUrl !== DEFAULT_NOVACODE_BACKEND_URL) {
					return baseUrl
				}
				return "http://localhost:3000"
			}
		} catch (_error) {
			console.warn("Failed to get base URL from Nova Code token")
		}
	}
	return "https://api.nova.ai"
}

/**
 * Helper function that combines token-based base URL resolution with URL construction.
 * Takes a token and a full URL, uses the token to get the appropriate base URL,
 * then constructs the final URL by replacing the domain in the target URL.
 *
 * @param targetUrl The target URL to transform
 * @param novacodeToken The NovaCode authentication token
 * @returns Fully constructed NovaCode URL with proper backend mapping based on token
 */
export function getNovaUrlFromToken(targetUrl: string, novacodeToken?: string): string {
	const baseUrl = getNovaBaseUriFromToken(novacodeToken)
	const target = new URL(targetUrl)

	const { protocol, host } = new URL(baseUrl)
	Object.assign(target, { protocol, host })

	return target.toString()
}

function getGlobalNovacodeBackendUrl(): string {
	return (
		(typeof window !== "undefined" ? window.NOVACODE_BACKEND_BASE_URL : undefined) ||
		process.env.NOVACODE_BACKEND_BASE_URL ||
		DEFAULT_NOVACODE_BACKEND_URL
	)
}

/**
 * Gets the app/web URL for the current environment.
 * In development: http://localhost:3000
 * In production: https://nova.ai
 */
export function getAppUrl(path: string = ""): string {
	return new URL(path, getGlobalNovacodeBackendUrl()).toString()
}

/**
 * Gets the API URL for the current environment.
 * Respects NOVACODE_BACKEND_BASE_URL environment variable for local development.
 * In development: http://localhost:3000
 * In production: https://api.nova.ai
 */
export function getApiUrl(path: string = ""): string {
	const backend = getGlobalNovacodeBackendUrl()

	// If using a custom backend (not the default production URL), use it directly
	if (backend !== DEFAULT_NOVACODE_BACKEND_URL) {
		return new URL(path, backend).toString()
	}

	// In production, use the api subdomain
	return new URL(path, "https://api.nova.ai").toString()
}

/**
 * Gets the extension config URL, which uses a legacy subdomain structure.
 * In development: http://localhost:3000/extension-config.json
 * In production: https://api.nova.ai/extension-config.json
 */
export function getExtensionConfigUrl(): string {
	try {
		const backend = getGlobalNovacodeBackendUrl()
		if (backend !== DEFAULT_NOVACODE_BACKEND_URL) {
			return getAppUrl("/extension-config.json")
		} else {
			return "https://api.nova.ai/extension-config.json"
		}
	} catch (error) {
		console.warn("Failed to build extension config URL:", error)
		return "https://api.nova.ai/extension-config.json"
	}
}
