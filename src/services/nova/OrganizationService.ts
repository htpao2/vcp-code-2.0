// novacode_change - new file
import { getNovaUrlFromToken } from "@roo-code/types"
import { X_NOVACODE_ORGANIZATIONID, X_NOVACODE_TESTER } from "../../shared/nova/headers"
import { NovaOrganization, NovaOrganizationSchema } from "../../shared/nova/organization"
import { CompactLogger } from "../../utils/logging/CompactLogger"
import { fetchWithRetries } from "../../shared/http"

/**
 * Service for fetching and managing Nova Code organization settings
 */
export class OrganizationService {
	/**
	 * Fetches organization details from the Nova Code API
	 * @param novacodeToken - The authentication token
	 * @param organizationId - The organization ID
	 * @param novacodeTesterWarningsDisabledUntil - Timestamp for suppressing tester warnings
	 * @returns The organization object with settings
	 */
	public static async fetchOrganization(
		novacodeToken: string,
		organizationId: string,
		novacodeTesterWarningsDisabledUntil?: number,
	): Promise<NovaOrganization | null> {
		try {
			if (!organizationId || !novacodeToken) {
				console.warn("[OrganizationService] Missing required parameters for fetching organization")
				return null
			}

			const headers: Record<string, string> = {
				Authorization: `Bearer ${novacodeToken}`,
				"Content-Type": "application/json",
			}

			headers[X_NOVACODE_ORGANIZATIONID] = organizationId

			// Add X-NOVACODE-TESTER: SUPPRESS header if the setting is enabled
			if (novacodeTesterWarningsDisabledUntil && novacodeTesterWarningsDisabledUntil > Date.now()) {
				headers[X_NOVACODE_TESTER] = "SUPPRESS"
			}

			const url = getNovaUrlFromToken(`https://api.nova.ai/api/organizations/${organizationId}`, novacodeToken)

			const response = await fetchWithRetries({
				url,
				method: "GET",
				headers,
			})

			if (!response.ok) {
				throw new Error(`Failed to fetch organization: ${response.statusText}`)
			}

			const data = await response.json()

			// Validate the response against the schema
			const validationResult = NovaOrganizationSchema.safeParse(data)

			if (!validationResult.success) {
				console.error("[OrganizationService] Invalid organization response format", {
					organizationId,
					errors: validationResult.error.errors,
				})
				return data
			}

			console.info("[OrganizationService] Successfully fetched organization", {
				organizationId,
				codeIndexingEnabled: validationResult.data.settings.code_indexing_enabled,
			})

			return validationResult.data
		} catch (error) {
			// Log error but don't throw - gracefully degrade
			console.error("[OrganizationService] Failed to fetch organization", {
				organizationId,
				error: error instanceof Error ? error.message : String(error),
			})
			return null
		}
	}

	/**
	 * Checks if code indexing is enabled for an organization
	 * @param organization - The organization object
	 * @returns true if code indexing is enabled (defaults to false if not specified)
	 */
	public static isCodeIndexingEnabled(organization: NovaOrganization | null): boolean {
		// Default to true if organization is null or setting is not specified
		return organization?.settings?.code_indexing_enabled ?? false
	}
}
