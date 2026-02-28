import { openRouterDefaultModelId } from "@roo-code/types"
import { getNovaUrlFromToken } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { z } from "zod"
import { DEFAULT_HEADERS } from "../constants"

type NovacodeToken = string

type OrganizationId = string

const defaultsSchema = z.object({
	defaultModel: z.string(),
	defaultFreeModel: z.string().optional(),
})

type Defaults = z.infer<typeof defaultsSchema>

const cache = new Map<string, Promise<Defaults>>()

async function fetchNovacodeDefaultModel(
	novacodeToken?: NovacodeToken,
	organizationId?: OrganizationId,
): Promise<Defaults> {
	try {
		const path = organizationId ? `/organizations/${organizationId}/defaults` : `/defaults`
		const url = getNovaUrlFromToken(`https://api.nova.ai/api${path}`, novacodeToken ?? "")

		const headers: Record<string, string> = {
			...DEFAULT_HEADERS,
		}

		if (novacodeToken) {
			headers["Authorization"] = `Bearer ${novacodeToken}`
		}

		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), 5000)
		const response = await fetch(url, { headers, signal: controller.signal })
		clearTimeout(timeout)
		if (!response.ok) {
			throw new Error(`Fetching default model from ${url} failed: ${response.status}`)
		}
		const defaultModel = await defaultsSchema.safeParseAsync(await response.json())
		if (!defaultModel.data) {
			throw new Error(
				`Default model from ${url} was invalid: ${JSON.stringify(defaultModel.error.format(), undefined, 2)}`,
			)
		}
		console.info(`Fetched default model from ${url}: ${defaultModel.data.defaultModel}`)
		return defaultModel.data
	} catch (err) {
		console.error("Failed to get default model", err)
		TelemetryService.instance.captureException(err, { context: "getNovacodeDefaultModel" })
		return { defaultModel: openRouterDefaultModelId, defaultFreeModel: undefined }
	}
}

export async function getNovacodeDefaultModel(
	novacodeToken?: NovacodeToken,
	organizationId?: OrganizationId,
): Promise<Defaults> {
	const key = JSON.stringify({
		novacodeToken: novacodeToken ?? "anonymous",
		organizationId,
	})
	let defaultModelPromise = cache.get(key)
	if (!defaultModelPromise) {
		defaultModelPromise = fetchNovacodeDefaultModel(novacodeToken, organizationId)
		cache.set(key, defaultModelPromise)
	}
	return await defaultModelPromise
}
