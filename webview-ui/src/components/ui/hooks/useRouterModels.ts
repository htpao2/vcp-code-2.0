import { useQuery } from "@tanstack/react-query"

import { type RouterModels, type ExtensionMessage, type ProviderSettings } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"

type UseRouterModelsOptions = {
	provider?: string // single provider filter (e.g. "roo")
	enabled?: boolean // gate fetching entirely
}

type ConnectionState = "connecting" | "ready" | "error"

const ROUTER_MODELS_TIMEOUT_MS = 10000
const EMPTY_ROUTER_MODELS = {} as RouterModels

const createRequestId = () => `router-models-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

type RouterModelsQueryKey = Partial<ProviderSettings>

export const getRouterModels = async (
	provider?: string,
	apiConfigurationOverride?: RouterModelsQueryKey,
	refresh = false,
) => getRouterModelsInternal(provider, apiConfigurationOverride, refresh)

const getRouterModelsInternal = async (
	provider?: string,
	apiConfigurationOverride?: RouterModelsQueryKey,
	refresh = false,
) =>
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

				if (provider !== msgProvider) {
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
		vscode.postMessage({
			type: "requestRouterModels",
			requestId,
			values: {
				provider,
				requestId,
				refresh,
				apiConfigurationOverride,
			},
		})
	})

export const useRouterModels = (queryKey: RouterModelsQueryKey, opts: UseRouterModelsOptions = {}) => {
	const provider = opts.provider || undefined
	return useQuery({
		queryKey: ["routerModels", provider || "all", queryKey],
		queryFn: () => getRouterModelsInternal(provider, queryKey),
		enabled: opts.enabled !== false,
	})
}
