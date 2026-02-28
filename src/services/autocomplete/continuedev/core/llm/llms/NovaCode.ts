import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js"
import { X_NOVACODE_VERSION } from "../../../../../../shared/nova/headers"
import { Package } from "../../../../../../shared/package"
import OpenRouter from "./OpenRouter"
import { IFimProvider } from "../../../../../../api/providers/nova/IFimProvider"
import { getNovaUrlFromToken } from "@roo-code/types"

/**
 * Extended CompletionOptions to include NovaCode-specific per-request metadata
 */
export interface NovaCodeCompletionOptions extends CompletionOptions {
	novacodeTaskId?: string
	novacodeProjectId?: string
}

/**
 * NovaCode LLM provider that extends OpenRouter with NovaCode-specific features:
 * - Custom base URL using getNovaUrlFromToken()
 * - NovaCode-specific headers (organizationId, taskId, projectId, version, tester)
 * - Support for both static (organizationId) and per-request (taskId, projectId) metadata
 *
 * This provider maintains API parity with the novacode-openrouter API provider
 * while working within the continuedev LLM architecture.
 */
class NovaCode extends OpenRouter {
	static override providerName = "novacode"

	// Instance variables to store per-request metadata
	private currentTaskId?: string
	private currentProjectId?: string
	public fimProvider?: IFimProvider

	constructor(options: LLMOptions) {
		// Extract NovaCode-specific config from env
		const novacodeToken = options.apiKey ?? ""

		// Extract fimProvider before passing to parent
		const { fimProvider, ...parentOptions } = options

		// Transform apiBase to use NovaCode backend
		const transformedOptions = {
			...parentOptions,
			apiBase: getNovaUrlFromToken("https://api.nova.ai/api/openrouter/v1/", novacodeToken),
		}

		super(transformedOptions)

		// Use provided handler or create a new one if not provided
		this.fimProvider = fimProvider
	}

	/**
	 * Override _streamChat to extract per-request metadata from options
	 * This allows dynamic taskId and projectId per request
	 */
	protected override async *_streamChat(
		messages: ChatMessage[],
		signal: AbortSignal,
		options: CompletionOptions,
	): AsyncGenerator<ChatMessage> {
		// Extract NovaCode metadata from options if available
		const novacodeOptions = options as NovaCodeCompletionOptions
		this.currentTaskId = novacodeOptions.novacodeTaskId
		this.currentProjectId = novacodeOptions.novacodeProjectId

		try {
			// Call parent implementation
			yield* super._streamChat(messages, signal, options)
		} finally {
			// Clear per-request metadata after stream completes
			this.currentTaskId = undefined
			this.currentProjectId = undefined
		}
	}

	/**
	 * Override _streamComplete to support per-request metadata
	 */
	protected override async *_streamComplete(
		prompt: string,
		signal: AbortSignal,
		options: CompletionOptions,
	): AsyncGenerator<string> {
		// Extract metadata (same pattern as _streamChat)
		const novacodeOptions = options as NovaCodeCompletionOptions
		this.currentTaskId = novacodeOptions.novacodeTaskId
		this.currentProjectId = novacodeOptions.novacodeProjectId

		try {
			yield* super._streamComplete(prompt, signal, options)
		} finally {
			// Clear metadata
			this.currentTaskId = undefined
			this.currentProjectId = undefined
		}
	}

	/**
	 * Override _streamFim to delegate to IFimProvider
	 * This reuses the FIM implementation from the API handler
	 */
	protected override async *_streamFim(
		prefix: string,
		suffix: string,
		signal: AbortSignal,
		options: CompletionOptions,
	): AsyncGenerator<string> {
		if (!this.fimProvider) {
			throw new Error("FIM provider not initialized")
		}

		// Extract metadata (same pattern as _streamChat)
		const novacodeOptions = options as NovaCodeCompletionOptions
		this.currentTaskId = novacodeOptions.novacodeTaskId
		this.currentProjectId = novacodeOptions.novacodeProjectId

		try {
			// Delegate to FIM provider's streamFim method
			yield* this.fimProvider.streamFim(prefix, suffix, this.currentTaskId)
		} finally {
			// Clear metadata
			this.currentTaskId = undefined
			this.currentProjectId = undefined
		}
	}

	/**
	 * Override _getHeaders to inject NovaCode-specific headers
	 * Delegates to FIM provider's customRequestOptions() for consistency
	 */
	protected override _getHeaders() {
		const baseHeaders = super._getHeaders()

		// Always add version header
		const novacodeHeaders: Record<string, string> = {
			[X_NOVACODE_VERSION]: Package.version,
		}

		// Delegate to FIM provider's customRequestOptions for other NovaCode headers
		// Only call if we have a taskId (required by the metadata interface)
		if (this.fimProvider && this.currentTaskId) {
			const customOptions = this.fimProvider.customRequestOptions({
				taskId: this.currentTaskId,
				projectId: this.currentProjectId,
				mode: "code", // Default mode for LLM operations
			})

			if (customOptions?.headers) {
				Object.assign(novacodeHeaders, customOptions.headers)
			}
		}

		return {
			...baseHeaders,
			...novacodeHeaders,
		}
	}

	override supportsFim(): boolean {
		return this.fimProvider?.supportsFim() || false
	}
}

export default NovaCode
