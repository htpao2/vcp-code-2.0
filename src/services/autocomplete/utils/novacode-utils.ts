import { getNovaBaseUriFromToken, AUTOCOMPLETE_PROVIDER_MODELS, AutocompleteProviderKey } from "@roo-code/types"

export { AUTOCOMPLETE_PROVIDER_MODELS }
export type { AutocompleteProviderKey }

/**
 * Check if the Novacode account has a positive balance
 * @param novacodeToken - The Novacode JWT token
 * @param novacodeOrganizationId - Optional organization ID to include in headers
 * @returns Promise<boolean> - True if balance > 0, false otherwise
 */
export async function checkNovacodeBalance(novacodeToken: string, novacodeOrganizationId?: string): Promise<boolean> {
	try {
		const baseUrl = getNovaBaseUriFromToken(novacodeToken)

		const headers: Record<string, string> = {
			Authorization: `Bearer ${novacodeToken}`,
		}

		if (novacodeOrganizationId) {
			headers["X-NovaCode-OrganizationId"] = novacodeOrganizationId
		}

		const response = await fetch(`${baseUrl}/api/profile/balance`, {
			headers,
		})

		if (!response.ok) {
			return false
		}

		const data = await response.json()
		const balance = data.balance ?? 0
		return balance > 0
	} catch (error) {
		console.error("Error checking novacode balance:", error)
		return false
	}
}
