import { useQuery } from "@tanstack/react-query"

import { type RouterModels, type ExtensionMessage } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"

type UseRouterModelsOptions = {
	provider?: string // single provider filter (e.g. "roo")
	enabled?: boolean // gate fetching entirely
}

type ConnectionState = "connecting" | "ready" | "error"

const ROUTER_MODELS_TIMEOUT_MS = 10000
const EMPTY_ROUTER_MODELS = {} as RouterModels

const createRequestId = () => `router-models-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const getRouterModels = async (provider?: string) =>
	new Promise<RouterModels>((resolve) => {
		const requestId = createRequestId()
		let connectionState: ConnectionState = "connecting"
		let isSettled = false

		const settle = (models: RouterModels) => {
			if (isSettled) {
				return
			}
			isSettled = true
			clearTimeout(timeout)
			cleanup()
			resolve(models)
		}

		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			connectionState = "error"
			console.warn(`[useRouterModels] timed out: requestId=${requestId}, provider=${provider ?? "all"}`)
			settle(provider ? ({ [provider]: {} } as RouterModels) : EMPTY_ROUTER_MODELS)
		}, ROUTER_MODELS_TIMEOUT_MS)

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.requestId && message.requestId !== requestId) {
				return
			}

			if (message.type === "singleRouterModelFetchResponse" && message.success === false) {
				const errorProvider = message?.values?.provider as string | undefined
				const errorRequestId = message?.values?.requestId as string | undefined
				if (errorRequestId && errorRequestId !== requestId) {
					return
				}
				if (!provider || errorProvider !== provider) {
					return
				}

				connectionState = "error"
				console.warn(
					`[useRouterModels] provider fetch failed: requestId=${requestId}, provider=${errorProvider}, error=${message.error ?? "unknown"}`,
				)
				settle({ [provider]: {} } as RouterModels)
				return
			}

			if (message.type === "routerModels") {
				const msgProvider = message?.values?.provider as string | undefined
				const msgRequestId = message?.values?.requestId as string | undefined

				// Verify response matches request
				if (provider !== msgProvider) {
					// Not our response; ignore and wait for the matching one
					return
				}

				if (msgRequestId && msgRequestId !== requestId) {
					return
				}

				connectionState = "ready"
				if (message.routerModels) {
					settle(message.routerModels)
				} else {
					connectionState = "error"
					console.warn(
						`[useRouterModels] empty routerModels response: requestId=${requestId}, provider=${provider ?? "all"}, state=${connectionState}`,
					)
					settle(provider ? ({ [provider]: {} } as RouterModels) : EMPTY_ROUTER_MODELS)
				}
			}
		}

		window.addEventListener("message", handler)
		if (provider) {
			vscode.postMessage({ type: "requestRouterModels", requestId, values: { provider, requestId } })
		} else {
			vscode.postMessage({ type: "requestRouterModels", requestId, values: { requestId } })
		}
	})

// novacode_change start
type RouterModelsQueryKey = {
	openRouterBaseUrl?: string
	openRouterApiKey?: string
	lmStudioBaseUrl?: string
	ollamaBaseUrl?: string
	novaOrganizationId?: string
	novacodeOrganizationId?: string
	deepInfraApiKey?: string
	geminiApiKey?: string
	googleGeminiBaseUrl?: string
	chutesApiKey?: string
	nanoGptApiKey?: string
	nanoGptModelList?: "all" | "personalized" | "subscription"
	syntheticApiKey?: string
	zenmuxBaseUrl?: string
	zenmuxApiKey?: string
	// Requesty, Unbound, etc should perhaps also be here, but they already have their own hacks for reloading
}
// novacode_change end

export const useRouterModels = (queryKey: RouterModelsQueryKey, opts: UseRouterModelsOptions = {}) => {
	const provider = opts.provider || undefined
	return useQuery({
		queryKey: ["routerModels", provider || "all", queryKey],
		queryFn: () => getRouterModels(provider),
		enabled: opts.enabled !== false,
	})
}
