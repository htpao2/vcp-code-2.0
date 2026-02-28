import { z } from "zod"
import type { ProviderConfig } from "../config/provider.js"

/**
 * Organization data from Novacode API
 */
export const novacodeOrganizationSchema = z.object({
	id: z.string(),
	name: z.string(),
	role: z.string(),
})

/**
 * Profile data structure from Novacode API
 */
export const novacodeProfileDataSchema = z.object({
	user: z
		.object({
			name: z.string().optional(),
			email: z.string().optional(),
			image: z.string().optional(),
		})
		.optional(),
	organizations: z.array(novacodeOrganizationSchema).optional(),
})

/**
 * Options for polling operations
 */
export const pollingOptionsSchema = z.object({
	/** Interval between polls in milliseconds */
	interval: z.number(),
	/** Maximum number of attempts before timeout */
	maxAttempts: z.number(),
	/** Function to execute on each poll */
	pollFn: z.custom<() => Promise<unknown>>((val) => typeof val === "function"),
	/** Optional callback for progress updates */
	onProgress: z.custom<(current: number, total: number) => void>((val) => typeof val === "function").optional(),
})

/**
 * Result of a poll operation
 */
export const pollResultSchema = z.object({
	/** Whether polling should continue */
	continue: z.boolean(),
	/** Optional data returned when polling completes */
	data: z.unknown().optional(),
	/** Optional error if polling failed */
	error: z.instanceof(Error).optional(),
})

// Inferred types
export type NovacodeOrganization = z.infer<typeof novacodeOrganizationSchema>
export type NovacodeProfileData = z.infer<typeof novacodeProfileDataSchema>
export type PollingOptions = z.infer<typeof pollingOptionsSchema>
export type PollResult = z.infer<typeof pollResultSchema>

/**
 * Result of a successful authentication flow
 */
export interface AuthResult {
	providerConfig: ProviderConfig
}

/**
 * Base interface for all authentication providers
 */
export interface AuthProvider {
	/** Display name shown to users */
	name: string
	/** Unique identifier for the provider */
	value: string
	/** Execute the authentication flow */
	authenticate(): Promise<AuthResult>
}
