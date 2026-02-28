import crypto from "crypto"
import { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { OpenRouterHandler } from "./openrouter"
import type { CompletionUsage } from "./openrouter"
import { getModelParams } from "../transform/model-params"
import { getModels } from "./fetchers/modelCache"
import { DEEP_SEEK_DEFAULT_TEMPERATURE, openRouterDefaultModelId, openRouterDefaultModelInfo } from "@roo-code/types"
import { getNovaUrlFromToken } from "@roo-code/types"
import type { ApiHandlerCreateMessageMetadata } from ".."
import { getModelEndpoints } from "./fetchers/modelEndpointCache"
import { getNovacodeDefaultModel } from "./nova/getNovacodeDefaultModel"
import {
	X_NOVACODE_ORGANIZATIONID,
	X_NOVACODE_TASKID,
	X_NOVACODE_PROJECTID,
	X_NOVACODE_MODE,
	X_NOVACODE_TESTER,
	X_NOVACODE_EDITORNAME,
	X_NOVACODE_MACHINEID,
	X_NOVACODE_FEATURE, // novacode_change
} from "../../shared/nova/headers"
import { DEFAULT_HEADERS } from "./constants"
import { streamSse } from "../../services/autocomplete/continuedev/core/fetch/stream"
import { getEditorNameHeader, getNovaCodeWrapperProperties } from "../../core/nova/wrapper"
import type { FimHandler } from "./nova/FimHandler"
import * as vscode from "vscode"

/**
 * A custom OpenRouter handler that overrides the getModel function
 * to provide custom model information and fetches models from the NovaCode OpenRouter endpoint.
 */
export class NovacodeOpenrouterHandler extends OpenRouterHandler {
	protected override models: ModelRecord = {}
	defaultModel: string = openRouterDefaultModelId
	private apiFIMBase: string

	protected override get providerName() {
		return "NovaCode" as const
	}

	constructor(options: ApiHandlerOptions) {
		const baseApiUrl = getNovaUrlFromToken("https://api.nova.ai/api/", options.novacodeToken ?? "")

		options = {
			...options,
			openRouterBaseUrl: `${baseApiUrl}openrouter/`,
			openRouterApiKey: options.novacodeToken,
		}

		super(options)

		this.apiFIMBase = baseApiUrl
	}

	public getRolloutHash(): number | undefined {
		const token = this.options.novacodeToken
		return !token ? undefined : crypto.createHash("sha256").update(token).digest().readUInt32BE(0)
	}

	override customRequestOptions(metadata?: ApiHandlerCreateMessageMetadata) {
		const headers: Record<string, string> = {
			[X_NOVACODE_EDITORNAME]: getEditorNameHeader(),
		}

		if (vscode?.env?.isTelemetryEnabled && vscode.env.machineId) {
			headers[X_NOVACODE_MACHINEID] = vscode.env.machineId
		}

		if (metadata?.mode) {
			headers[X_NOVACODE_MODE] = metadata.mode
		}

		if (metadata?.taskId) {
			headers[X_NOVACODE_TASKID] = metadata.taskId
		}

		const novacodeOptions = this.options

		if (novacodeOptions.novacodeOrganizationId) {
			headers[X_NOVACODE_ORGANIZATIONID] = novacodeOptions.novacodeOrganizationId

			if (metadata?.projectId) {
				headers[X_NOVACODE_PROJECTID] = metadata.projectId
			}
		}

		// Add X-NOVACODE-TESTER: SUPPRESS header if the setting is enabled
		if (
			novacodeOptions.novacodeTesterWarningsDisabledUntil &&
			novacodeOptions.novacodeTesterWarningsDisabledUntil > Date.now()
		) {
			headers[X_NOVACODE_TESTER] = "SUPPRESS"
		}

		// novacode_change start: Feature attribution for microdollar usage tracking
		headers[X_NOVACODE_FEATURE] = this.resolveFeature(metadata)
		// novacode_change end

		return Object.keys(headers).length > 0 ? { headers } : undefined
	}

	// novacode_change start
	/**
	 * Determine the feature value for microdollar usage tracking.
	 * Priority: explicit metadata override > wrapper detection > default
	 */
	private resolveFeature(metadata?: ApiHandlerCreateMessageMetadata): string {
		// 1. Explicit override from metadata (e.g. 'parallel-agent', 'autocomplete')
		if (metadata?.feature) {
			return metadata.feature
		}

		// 2. Detect context from wrapper properties
		const wrapperProps = getNovaCodeWrapperProperties()
		if (wrapperProps.novaCodeWrapperJetbrains) {
			return "jetbrains-extension"
		}
		if (wrapperProps.novaCodeWrapper === "agent-manager") {
			return "agent-manager"
		}

		// 3. Default: VS Code extension
		return "vscode-extension"
	}
	// novacode_change end

	override getTotalCost(lastUsage: CompletionUsage): number {
		const model = this.getModel().info
		if (!model.inputPrice && !model.outputPrice) {
			return 0
		}
		// https://github.com/Nova-Org/novacode-backend/blob/eb3d382df1e933a089eea95b9c4387db0c676e35/src/lib/processUsage.ts#L281
		if (lastUsage.is_byok) {
			return lastUsage.cost_details?.upstream_inference_cost || 0
		}

		return lastUsage.cost || 0
	}

	override getModel() {
		let id = this.options.novacodeModel ?? this.defaultModel
		let info = this.models[id] ?? openRouterDefaultModelInfo

		// If a specific provider is requested, use the endpoint for that provider.
		if (this.options.openRouterSpecificProvider && this.endpoints[this.options.openRouterSpecificProvider]) {
			info = this.endpoints[this.options.openRouterSpecificProvider]
		}

		const isDeepSeekR1 = id.startsWith("deepseek/deepseek-r1") || id === "perplexity/sonar-reasoning"

		const params = getModelParams({
			format: "openrouter",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0,
		})

		return { id, info, topP: isDeepSeekR1 ? 0.95 : undefined, ...params }
	}

	public override async fetchModel() {
		if (!this.options.openRouterBaseUrl) {
			throw new Error("OpenRouter base URL is required")
		}

		const [models, endpoints, defaultModel] = await Promise.all([
			getModels({
				provider: "novacode",
				novacodeToken: this.options.novacodeToken,
				novacodeOrganizationId: this.options.novacodeOrganizationId,
			}),
			getModelEndpoints({
				router: "openrouter",
				modelId: this.options.novacodeModel,
				endpoint: this.options.openRouterSpecificProvider,
			}),
			getNovacodeDefaultModel(this.options.novacodeToken, this.options.novacodeOrganizationId),
		])

		this.models = models
		this.endpoints = endpoints
		this.defaultModel = defaultModel.defaultModel
		return this.getModel()
	}

	fimSupport(): FimHandler | undefined {
		const modelId = this.options.novacodeModel ?? this.defaultModel
		if (!modelId.includes("codestral")) {
			return undefined
		}

		return this
	}

	async *streamFim(
		prefix: string,
		suffix: string,
		taskId?: string,
		onUsage?: (usage: CompletionUsage) => void,
	): AsyncGenerator<string> {
		const model = await this.fetchModel()
		const endpoint = new URL("fim/completions", this.apiFIMBase)

		// Build headers using customRequestOptions for consistency
		// novacode_change: pass feature: "autocomplete" through metadata so resolveFeature() handles it centrally
		const headers: Record<string, string> = {
			...DEFAULT_HEADERS,
			"Content-Type": "application/json",
			Accept: "application/json",
			"x-api-key": this.options.novacodeToken ?? "",
			Authorization: `Bearer ${this.options.novacodeToken}`,
			...this.customRequestOptions({ taskId: taskId ?? "autocomplete", mode: "code", feature: "autocomplete" })
				?.headers,
		}

		// temperature: 0.2 is mentioned as a sane example in mistral's docs and is what continue uses.
		const temperature = 0.2
		const maxTokens = 256

		const response = await fetch(endpoint, {
			method: "POST",
			body: JSON.stringify({
				model: model.id,
				prompt: prefix,
				suffix,
				max_tokens: Math.min(maxTokens, model.maxTokens ?? maxTokens),
				temperature,
				top_p: model.topP,
				stream: true,
			}),
			headers,
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`FIM streaming failed: ${response.status} ${response.statusText} - ${errorText}`)
		}

		for await (const data of streamSse(response)) {
			const content = data.choices?.[0]?.delta?.content
			if (content) {
				yield content
			}

			// Call usage callback when available
			if (data.usage && onUsage) {
				onUsage(data.usage)
			}
		}
	}
}
