// npx vitest run src/__tests__/novacode.test.ts

import { describe, it, expect, vi, afterEach } from "vitest"
import {
	autocompleteServiceSettingsSchema,
	getAppUrl,
	getApiUrl,
	getNovaUrlFromToken,
	getExtensionConfigUrl,
} from "../nova/novacode.js"

describe("autocompleteServiceSettingsSchema", () => {
	it("should accept all boolean settings", () => {
		const result = autocompleteServiceSettingsSchema.safeParse({
			enableAutoTrigger: true,
			enableQuickInlineTaskKeybinding: false,
			enableSmartInlineTaskKeybinding: true,
		})
		expect(result.success).toBe(true)
	})

	it("should accept combined settings", () => {
		const result = autocompleteServiceSettingsSchema.safeParse({
			enableAutoTrigger: true,
			enableQuickInlineTaskKeybinding: true,
			enableSmartInlineTaskKeybinding: true,
		})
		expect(result.success).toBe(true)
	})

	it("should be optional", () => {
		const result = autocompleteServiceSettingsSchema.safeParse({
			enableAutoTrigger: true,
		})
		expect(result.success).toBe(true)
	})
})

describe("URL functions", () => {
	const originalEnv = process.env.NOVACODE_BACKEND_BASE_URL

	// Helper functions to create properly formatted test tokens
	const createDevToken = () => {
		const payload = { env: "development" }
		return `header.${btoa(JSON.stringify(payload))}.signature`
	}

	const createProdToken = () => {
		const payload = {}
		return `header.${btoa(JSON.stringify(payload))}.signature`
	}

	afterEach(() => {
		// Reset environment variable after each test
		if (originalEnv) {
			process.env.NOVACODE_BACKEND_BASE_URL = originalEnv
		} else {
			delete process.env.NOVACODE_BACKEND_BASE_URL
		}
	})

	describe("getExtensionConfigUrl", () => {
		it("should use path structure for development", () => {
			process.env.NOVACODE_BACKEND_BASE_URL = "http://localhost:3000"
			expect(getExtensionConfigUrl()).toBe("http://localhost:3000/extension-config.json")
		})
		it("should use subdomain structure for production", () => {
			expect(getExtensionConfigUrl()).toBe("https://api.nova.ai/extension-config.json")
		})
		it("should use path structure for custom backend URLs", () => {
			process.env.NOVACODE_BACKEND_BASE_URL = "http://192.168.200.70:3000"
			expect(getExtensionConfigUrl()).toBe("http://192.168.200.70:3000/extension-config.json")
		})
	})

	describe("getApiUrl", () => {
		it("should handle production URLs with api subdomain", () => {
			expect(getApiUrl()).toBe("https://api.nova.ai/")
			expect(getApiUrl("/trpc/cliSessions.get")).toBe("https://api.nova.ai/trpc/cliSessions.get")
			expect(getApiUrl("/api/profile")).toBe("https://api.nova.ai/api/profile")
		})

		it("should handle localhost development URLs", () => {
			process.env.NOVACODE_BACKEND_BASE_URL = "http://localhost:3000"

			expect(getApiUrl()).toBe("http://localhost:3000/")
			expect(getApiUrl("/api/trpc/cliSessions.get")).toBe("http://localhost:3000/api/trpc/cliSessions.get")
			expect(getApiUrl("/api/profile")).toBe("http://localhost:3000/api/profile")
		})

		it("should handle custom backend URLs (non-localhost)", () => {
			process.env.NOVACODE_BACKEND_BASE_URL = "http://192.168.200.70:3000"

			expect(getApiUrl()).toBe("http://192.168.200.70:3000/")
			expect(getApiUrl("/api/trpc/cliSessions.get")).toBe("http://192.168.200.70:3000/api/trpc/cliSessions.get")
			expect(getApiUrl("/api/profile")).toBe("http://192.168.200.70:3000/api/profile")
		})
	})

	describe("getAppUrl", () => {
		it("should handle production URLs correctly", () => {
			expect(getAppUrl()).toBe("https://nova.ai/")
			expect(getAppUrl("/profile")).toBe("https://nova.ai/profile")
			expect(getAppUrl("/support")).toBe("https://nova.ai/support")
			expect(getAppUrl("/sign-in-to-editor")).toBe("https://nova.ai/sign-in-to-editor")
			expect(getAppUrl("/sign-in-to-editor?source=vscode")).toBe(
				"https://nova.ai/sign-in-to-editor?source=vscode",
			)
		})

		it("should handle development environment", () => {
			process.env.NOVACODE_BACKEND_BASE_URL = "http://localhost:3000"

			expect(getAppUrl()).toBe("http://localhost:3000/")
			expect(getAppUrl("/profile")).toBe("http://localhost:3000/profile")
			expect(getAppUrl("/support")).toBe("http://localhost:3000/support")
		})

		it("should handle paths without leading slash", () => {
			process.env.NOVACODE_BACKEND_BASE_URL = "http://localhost:3000"
			expect(getAppUrl("profile")).toBe("http://localhost:3000/profile")
		})

		it("should handle empty and root paths", () => {
			expect(getAppUrl("")).toBe("https://nova.ai/")
			expect(getAppUrl("/")).toBe("https://nova.ai/")
		})
	})

	describe("getNovaUrlFromToken", () => {
		it("should handle production token URLs correctly", () => {
			const prodToken = createProdToken()

			// Token-based URLs using api.nova.ai subdomain
			expect(getNovaUrlFromToken("https://api.nova.ai/api/profile", prodToken)).toBe(
				"https://api.nova.ai/api/profile",
			)
			expect(getNovaUrlFromToken("https://api.nova.ai/api/profile/balance", prodToken)).toBe(
				"https://api.nova.ai/api/profile/balance",
			)
			expect(getNovaUrlFromToken("https://api.nova.ai/api/organizations/123/defaults", prodToken)).toBe(
				"https://api.nova.ai/api/organizations/123/defaults",
			)
			expect(getNovaUrlFromToken("https://api.nova.ai/api/openrouter/", prodToken)).toBe(
				"https://api.nova.ai/api/openrouter/",
			)
			expect(getNovaUrlFromToken("https://api.nova.ai/api/users/notifications", prodToken)).toBe(
				"https://api.nova.ai/api/users/notifications",
			)
		})

		it("should map development tokens to localhost correctly", () => {
			const devToken = createDevToken()

			// Development token should map to localhost:3000
			expect(getNovaUrlFromToken("https://api.nova.ai/api/profile", devToken)).toBe(
				"http://localhost:3000/api/profile",
			)
			expect(getNovaUrlFromToken("https://api.nova.ai/api/profile/balance", devToken)).toBe(
				"http://localhost:3000/api/profile/balance",
			)
			expect(getNovaUrlFromToken("https://api.nova.ai/api/organizations/456/defaults", devToken)).toBe(
				"http://localhost:3000/api/organizations/456/defaults",
			)
			expect(getNovaUrlFromToken("https://api.nova.ai/api/openrouter/", devToken)).toBe(
				"http://localhost:3000/api/openrouter/",
			)
			expect(getNovaUrlFromToken("https://api.nova.ai/api/users/notifications", devToken)).toBe(
				"http://localhost:3000/api/users/notifications",
			)
		})

		it("should handle invalid tokens gracefully", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			// Use a token that looks like JWT but has invalid JSON payload
			const result = getNovaUrlFromToken("https://api.nova.ai/api/test", "header.invalid-json.signature")
			expect(result).toBe("https://api.nova.ai/api/test")
			expect(consoleSpy).toHaveBeenCalledWith("Failed to get base URL from Nova Code token")
			consoleSpy.mockRestore()
		})
	})

	describe("Real-world URL patterns from application", () => {
		it("should correctly handle marketplace endpoints", () => {
			// These are the actual endpoints used in RemoteConfigLoader
			expect(getAppUrl("/api/marketplace/modes")).toBe("https://nova.ai/api/marketplace/modes")
			expect(getAppUrl("/api/marketplace/mcps")).toBe("https://nova.ai/api/marketplace/mcps")
		})

		it("should correctly handle app navigation URLs", () => {
			// These are the actual URLs used in Task.ts and webviewMessageHandler.ts
			expect(getAppUrl("/profile")).toBe("https://nova.ai/profile")
			expect(getAppUrl("/support")).toBe("https://nova.ai/support")
		})

		it("should correctly handle token-based API calls", () => {
			// These are the actual API endpoints used throughout the application
			const prodToken = createProdToken()
			expect(getNovaUrlFromToken("https://api.nova.ai/api/profile", prodToken)).toBe(
				"https://api.nova.ai/api/profile",
			)
			expect(getNovaUrlFromToken("https://api.nova.ai/api/profile/balance", prodToken)).toBe(
				"https://api.nova.ai/api/profile/balance",
			)
			expect(getNovaUrlFromToken("https://api.nova.ai/api/users/notifications", prodToken)).toBe(
				"https://api.nova.ai/api/users/notifications",
			)
		})

		it("should maintain backwards compatibility for legacy endpoints", () => {
			expect(getExtensionConfigUrl()).toBe("https://api.nova.ai/extension-config.json")
			expect(getAppUrl("/api/extension-config.json")).toBe("https://nova.ai/api/extension-config.json")
			expect(getAppUrl("/api/extension-config.json")).not.toBe(getExtensionConfigUrl())
		})
	})

	describe("Edge cases and error handling", () => {
		it("should handle various localhost configurations", () => {
			process.env.NOVACODE_BACKEND_BASE_URL = "http://localhost:8080"
			expect(getAppUrl("/api/test")).toBe("http://localhost:8080/api/test")

			process.env.NOVACODE_BACKEND_BASE_URL = "http://127.0.0.1:3000"
			expect(getAppUrl("/api/test")).toBe("http://127.0.0.1:3000/api/test")
		})

		it("should handle custom backend URLs", () => {
			process.env.NOVACODE_BACKEND_BASE_URL = "https://staging.example.com"

			expect(getAppUrl()).toBe("https://staging.example.com/")
			expect(getAppUrl("/api/test")).toBe("https://staging.example.com/api/test")
			expect(getAppUrl("/dashboard")).toBe("https://staging.example.com/dashboard")
		})
	})
})
