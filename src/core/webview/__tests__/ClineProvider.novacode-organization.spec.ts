// novacode_change - new file
// npx vitest core/webview/__tests__/ClineProvider.novacode-organization.spec.ts

import { setupCommonMocks, setupProvider, createMockWebviewView } from "../../../__tests__/common-mocks"

// Setup all mocks before any imports
setupCommonMocks()

describe("ClineProvider", () => {
	let provider: any
	let mockWebviewView: any

	beforeEach(() => {
		vi.clearAllMocks()
		const setup = setupProvider()
		provider = setup.provider
		mockWebviewView = createMockWebviewView()
	})

	describe("novacodeOrganizationId", () => {
		test("preserves novacodeOrganizationId when no previous token exists", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			const mockUpsertProviderProfile = vi.fn()
			;(provider as any).upsertProviderProfile = mockUpsertProviderProfile
			;(provider as any).providerSettingsManager = {
				getProfile: vi.fn().mockResolvedValue({
					// Simulate saved config with NO novacodeToken (common case)
					name: "test-config",
					apiProvider: "anthropic",
					apiKey: "test-key",
					id: "test-id",
				}),
			} as any

			await messageHandler({
				type: "upsertApiConfiguration",
				text: "test-config",
				apiConfiguration: {
					apiProvider: "anthropic" as const,
					apiKey: "test-key",
					novacodeToken: "test-nova-token",
					novacodeOrganizationId: "org-123",
				},
			})

			expect(mockUpsertProviderProfile).toHaveBeenCalledWith(
				"test-config",
				expect.objectContaining({
					novacodeToken: "test-nova-token",
					novacodeOrganizationId: "org-123", // Should be preserved
				}),
				false, // activate parameter
			)
		})

		test("clears novacodeOrganizationId when token actually changes", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			const mockUpsertProviderProfile = vi.fn()
			;(provider as any).upsertProviderProfile = mockUpsertProviderProfile
			;(provider as any).providerSettingsManager = {
				getProfile: vi.fn().mockResolvedValue({
					// Simulate saved config with DIFFERENT novacodeToken
					name: "test-config",
					apiProvider: "anthropic",
					apiKey: "test-key",
					novacodeToken: "old-nova-token",
					id: "test-id",
				}),
			} as any

			await messageHandler({
				type: "upsertApiConfiguration",
				text: "test-config",
				apiConfiguration: {
					apiProvider: "anthropic" as const,
					apiKey: "test-key",
					novacodeToken: "new-nova-token", // Different token
					novacodeOrganizationId: "org-123",
				},
			})

			// Verify the organization ID was cleared for security
			expect(mockUpsertProviderProfile).toHaveBeenCalledWith(
				"test-config",
				expect.objectContaining({
					novacodeToken: "new-nova-token",
					novacodeOrganizationId: undefined, // Should be cleared
				}),
				false, // activate parameter
			)
		})
	})
})
