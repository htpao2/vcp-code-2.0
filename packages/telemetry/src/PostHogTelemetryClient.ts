import { PostHog } from "posthog-node"
import * as vscode from "vscode"

import { getNovaUrlFromToken, type TelemetryEvent, TelemetryEventName } from "@roo-code/types"

import { BaseTelemetryClient } from "./BaseTelemetryClient"

/**
 * PostHogTelemetryClient handles telemetry event tracking for the Roo Code extension.
 * Uses PostHog analytics to track user interactions and system events.
 * Respects user privacy settings and VSCode's global telemetry configuration.
 */
export class PostHogTelemetryClient extends BaseTelemetryClient {
	private client: PostHog
	private distinctId: string = vscode.env.machineId
	// Git repository properties that should be filtered out for all users
	private readonly gitPropertyNames = ["repositoryUrl", "repositoryName", "defaultBranch"]
	// novacode_change start: filter sensitive error properties for organization users
	private readonly orgFilteredProperties = ["errorMessage", "cliPath", "stderrPreview"]
	// novacode_change end

	constructor(debug = false) {
		super(
			{
				type: "exclude",
				events: [
					TelemetryEventName.TASK_MESSAGE,
					// TelemetryEventName.LLM_COMPLETION // novacode_change
				],
			},
			debug,
		)

		this.client = new PostHog(process.env.NOVACODE_POSTHOG_API_KEY || "", {
			host: "https://us.i.posthog.com",
			disableGeoip: false, // novacode_change
		})
	}

	/**
	 * Filter out properties based on privacy rules
	 * - Git repository properties are filtered for all users
	 * - Error details (paths, messages) are filtered for organization users
	 * @param propertyName The property name to check
	 * @param allProperties All properties for context (to check organization membership)
	 * @returns Whether the property should be included in telemetry events
	 */
	// novacode_change start: add allProperties parameter for org-based filtering
	protected override isPropertyCapturable(propertyName: string, allProperties: Record<string, unknown>): boolean {
		// Filter out git repository properties for all users
		if (this.gitPropertyNames.includes(propertyName)) {
			return false
		}
		if (allProperties.novacodeOrganizationId && this.orgFilteredProperties.includes(propertyName)) {
			return false
		}
		return true
	}
	// novacode_change end

	public override async capture(event: TelemetryEvent): Promise<void> {
		if (!this.isTelemetryEnabled() || !this.isEventCapturable(event.event)) {
			if (this.debug) {
				console.info(`[PostHogTelemetryClient#capture] Skipping event: ${event.event}`)
			}

			return
		}

		if (this.debug) {
			console.info(`[PostHogTelemetryClient#capture] ${event.event}`)
		}

		const properties = await this.getEventProperties(event)

		this.client.capture({
			distinctId: this.distinctId,
			event: event.event,
			properties,
		})
	}

	/**
	 * Updates the telemetry state based on user preferences and VSCode settings.
	 * Only enables telemetry if both VSCode global telemetry is enabled and
	 * user has opted in.
	 * @param didUserOptIn Whether the user has explicitly opted into telemetry
	 */
	public override updateTelemetryState(didUserOptIn: boolean): void {
		this.telemetryEnabled = false

		// First check global telemetry level - telemetry should only be enabled when level is "all".
		const telemetryLevel = vscode.workspace.getConfiguration("telemetry").get<string>("telemetryLevel", "all")
		const globalTelemetryEnabled = telemetryLevel === "all"

		// We only enable telemetry if global vscode telemetry is enabled.
		if (globalTelemetryEnabled) {
			this.telemetryEnabled = didUserOptIn
		}

		// Update PostHog client state based on telemetry preference.
		if (this.telemetryEnabled) {
			this.client.optIn()
		} else {
			this.client.optOut()
		}
	}

	public override async shutdown(): Promise<void> {
		await this.client.shutdown()
	}

	// novacode_change start
	public override async captureException(error: Error, properties?: Record<string | number, unknown>): Promise<void> {
		if (this.isTelemetryEnabled()) {
			let providerProperties = {}
			try {
				providerProperties = (await this.providerRef?.deref()?.getTelemetryProperties()) || {}
			} catch (error) {
				console.error("Error getting provider properties", error)
			}
			this.client.captureException(error, this.distinctId, {
				...(providerProperties || {}),
				...(properties || {}),
			})
		}
	}

	private counter = 0
	private novacodeToken = ""

	public override async updateIdentity(novacodeToken: string) {
		if (novacodeToken === this.novacodeToken) {
			console.debug("NOVATEL: Identity up-to-date")
			return
		}
		if (!novacodeToken) {
			console.debug("NOVATEL: Updating identity to machine ID")
			this.distinctId = vscode.env.machineId
			this.novacodeToken = ""
			return
		}
		const id = ++this.counter
		try {
			const response = await fetch(getNovaUrlFromToken("https://api.nova.ai/api/profile", novacodeToken), {
				headers: {
					Authorization: `Bearer ${novacodeToken}`,
					"Content-Type": "application/json",
				},
			})
			const data = await response.json()
			if (!data?.user?.email) {
				throw new Error("Invalid response")
			}
			if (id === this.counter) {
				this.distinctId = data.user.email
				this.novacodeToken = novacodeToken
				console.debug("NOVATEL: Identity updated to:", this.distinctId)
			} else {
				console.debug("NOVATEL: Identity update ignored, newer request in progress")
			}
		} catch (error) {
			console.error("NOVATEL: Failed to update identity", error)
			if (id === this.counter) {
				this.distinctId = vscode.env.machineId
				this.novacodeToken = ""
			}
		}
	}
	// novacode_change end
}
