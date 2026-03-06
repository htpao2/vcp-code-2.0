import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import type { ModelRecord, RouterModels } from "@roo/api"
import type { ProviderName, ProviderSettings, ProviderSettingsEntry } from "@roo-code/types"

import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { prettyModelName } from "@/utils/prettyModelName"
import { getRouterModels } from "@/components/ui/hooks/useRouterModels"
import { getModelsByProvider, getOptionsForProvider } from "@/components/nova/hooks/useProviderModels"
import { getModelIdKey, getSelectedModelId } from "@/components/nova/hooks/useSelectedModel"

const ROUTER_PROVIDERS = new Set<ProviderName>([
	"openrouter",
	"requesty",
	"glama",
	"apertis",
	"unbound",
	"litellm",
	"chutes",
	"ollama",
	"lmstudio",
	"novacode",
	"poe",
	"synthetic",
	"ovhcloud",
	"inception",
	"sap-ai-core",
	"io-intelligence",
	"deepinfra",
	"roo",
	"nano-gpt",
	"aihubmix",
	"zenmux",
	"gemini",
	"vercel-ai-gateway",
])

const FALLBACK_ROUTER_MODELS = {} as RouterModels

const formatProviderLabel = (provider: string) => {
	const labels: Record<string, string> = {
		aihubmix: "AIHubMix",
		anthropic: "Anthropic",
		apertis: "Apertis",
		"claude-code": "Claude Code",
		deepinfra: "DeepInfra",
		deepseek: "DeepSeek",
		featherless: "Featherless",
		fireworks: "Fireworks",
		gemini: "Gemini",
		glama: "Glama",
		groq: "Groq",
		inception: "Inception",
		"io-intelligence": "IO Intelligence",
		litellm: "LiteLLM",
		lmstudio: "LM Studio",
		minimax: "MiniMax",
		moonshot: "Moonshot",
		"nano-gpt": "NanoGPT",
		novacode: "NovaCode",
		ollama: "Ollama",
		"openai-codex": "OpenAI Codex",
		"openai-native": "OpenAI Native",
		openai: "OpenAI Compatible",
		openrouter: "OpenRouter",
		ovhcloud: "OVHcloud",
		poe: "Poe",
		"qwen-code": "Qwen Code",
		requesty: "Requesty",
		roo: "Roo",
		"sap-ai-core": "SAP AI Core",
		sambanova: "SambaNova",
		synthetic: "Synthetic",
		unbound: "Unbound",
		"vercel-ai-gateway": "Vercel AI Gateway",
		"virtual-quota-fallback": "Virtual Quota Fallback",
		xai: "xAI",
		zenmux: "ZenMux",
		zai: "Z.AI",
	}

	return labels[provider] ?? provider.replace(/[-_]/g, " ").replace(/\b\w/g, (match) => match.toUpperCase())
}

export type ProfileModelItem = {
	key: string
	profileId: string
	profileName: string
	profileConfig: ProviderSettings
	provider: ProviderName
	providerLabel: string
	modelId: string
	modelLabel: string
	isCurrentProfile: boolean
	isCurrentModel: boolean
	searchText: string
}

export type ProfileModelGroup = {
	key: string
	provider: ProviderName
	providerLabel: string
	items: ProfileModelItem[]
	isEmpty: boolean
	profileName: string
	refresh: () => Promise<void>
}

const sortProfiles = (profiles: ProviderSettingsEntry[], currentApiConfigName?: string) =>
	[...profiles].sort((a, b) => {
		if (a.name === currentApiConfigName) {
			return -1
		}
		if (b.name === currentApiConfigName) {
			return 1
		}
		return a.name.localeCompare(b.name)
	})

export const useProfileModelCatalog = (
	currentApiConfigName: string | undefined,
	apiConfiguration: ProviderSettings,
	selectedModelId: string,
) => {
	const queryClient = useQueryClient()
	const { listApiConfigMeta, novacodeDefaultModel } = useExtensionState()
	const [profileConfigsByName, setProfileConfigsByName] = useState<Record<string, ProviderSettings>>({})
	const [requestedNames, setRequestedNames] = useState<Record<string, boolean>>({})

	useEffect(() => {
		if (currentApiConfigName) {
			setProfileConfigsByName((prev) => ({ ...prev, [currentApiConfigName]: apiConfiguration }))
		}
	}, [apiConfiguration, currentApiConfigName])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "profileConfigurationForEditing" && message.text && message.apiConfiguration) {
				setProfileConfigsByName((prev) => ({
					...prev,
					[message.text]: message.apiConfiguration as ProviderSettings,
				}))
				setRequestedNames((prev) => {
					const next = { ...prev }
					delete next[message.text as string]
					return next
				})
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const eligibleProfiles = useMemo(
		() =>
			sortProfiles(
				(listApiConfigMeta ?? []).filter((entry) => entry.profileType !== "autocomplete"),
				currentApiConfigName,
			),
		[currentApiConfigName, listApiConfigMeta],
	)

	useEffect(() => {
		const namesToRequest = eligibleProfiles
			.filter((entry) => entry.name !== currentApiConfigName)
			.filter((entry) => !profileConfigsByName[entry.name] && !requestedNames[entry.name])
			.map((entry) => entry.name)

		if (namesToRequest.length === 0) {
			return
		}

		setRequestedNames((prev) => {
			const next = { ...prev }
			namesToRequest.forEach((name) => {
				next[name] = true
				vscode.postMessage({
					type: "getProfileConfigurationForEditing",
					text: name,
				})
			})
			return next
		})
	}, [currentApiConfigName, eligibleProfiles, profileConfigsByName, requestedNames])

	const resolvedProfiles = useMemo(
		() =>
			eligibleProfiles
				.map((entry) => ({
					entry,
					config: entry.name === currentApiConfigName ? apiConfiguration : profileConfigsByName[entry.name],
				}))
				.filter(
					(profile): profile is { entry: ProviderSettingsEntry; config: ProviderSettings } =>
						!!profile.config,
				),
		[apiConfiguration, currentApiConfigName, eligibleProfiles, profileConfigsByName],
	)

	const queries = useQueries({
		queries: resolvedProfiles.map(({ entry, config }) => {
			const provider = (config.apiProvider ?? "anthropic") as ProviderName
			return {
				queryKey: ["profile-model-catalog", entry.id, config],
				queryFn: async () => {
					const routerModels = ROUTER_PROVIDERS.has(provider)
						? await getRouterModels(provider, config)
						: FALLBACK_ROUTER_MODELS

					return getModelsByProvider({
						provider,
						routerModels: routerModels as RouterModels,
						novacodeDefaultModel,
						options: getOptionsForProvider(provider, config),
					})
				},
				staleTime: 5 * 60 * 1000,
			}
		}),
	})

	const refreshGroup = useCallback(
		async (profile: { entry: ProviderSettingsEntry; config: ProviderSettings }) => {
			const provider = (profile.config.apiProvider ?? "anthropic") as ProviderName
			const queryKey = ["profile-model-catalog", profile.entry.id, profile.config]

			if (!ROUTER_PROVIDERS.has(provider)) {
				await queryClient.invalidateQueries({ queryKey })
				return
			}

			const routerModels = await getRouterModels(provider, profile.config, true)
			queryClient.setQueryData(
				queryKey,
				getModelsByProvider({
					provider,
					routerModels: routerModels as RouterModels,
					novacodeDefaultModel,
					options: getOptionsForProvider(provider, profile.config),
				}),
			)
		},
		[novacodeDefaultModel, queryClient],
	)

	const groups = useMemo<ProfileModelGroup[]>(() => {
		return resolvedProfiles
			.map((profile, index) => {
				const query = queries[index]
				const provider = (profile.config.apiProvider ?? "anthropic") as ProviderName
				const providerLabel = formatProviderLabel(provider)
				const queryData = query.data
				const models = (queryData?.models ?? {}) as ModelRecord
				const defaultModel = queryData?.defaultModel ?? ""
				const profileSelectedModel = getSelectedModelId({
					provider,
					apiConfiguration: profile.config,
					defaultModelId: defaultModel,
				})
				const modelIdKey = getModelIdKey({ provider })
				const modelIds = Object.keys(models)

				if (profileSelectedModel && !modelIds.includes(profileSelectedModel)) {
					modelIds.unshift(profileSelectedModel)
				}

				const items = modelIds
					.filter(Boolean)
					.map((modelId) => {
						const modelLabel = models[modelId]?.displayName ?? prettyModelName(modelId)
						return {
							key: `${profile.entry.id}:${modelId}`,
							profileId: profile.entry.id,
							profileName: profile.entry.name,
							profileConfig: {
								...profile.config,
								[modelIdKey]: modelId,
							},
							provider,
							providerLabel,
							modelId,
							modelLabel,
							isCurrentProfile: profile.entry.name === currentApiConfigName,
							isCurrentModel: profile.entry.name === currentApiConfigName && selectedModelId === modelId,
							searchText: `${providerLabel} ${profile.entry.name} ${modelLabel} ${modelId}`.toLowerCase(),
						}
					})
					.sort((a, b) => {
						if (a.isCurrentModel) {
							return -1
						}
						if (b.isCurrentModel) {
							return 1
						}
						return a.modelLabel.localeCompare(b.modelLabel)
					})

				return {
					key: `${provider}:${profile.entry.id}`,
					provider,
					providerLabel,
					items,
					isEmpty: items.length === 0,
					profileName: profile.entry.name,
					refresh: () => refreshGroup(profile),
				}
			})
			.sort((a, b) => {
				if (a.profileName === currentApiConfigName) {
					return -1
				}
				if (b.profileName === currentApiConfigName) {
					return 1
				}
				if (a.providerLabel !== b.providerLabel) {
					return a.providerLabel.localeCompare(b.providerLabel)
				}
				return a.profileName.localeCompare(b.profileName)
			})
	}, [currentApiConfigName, queries, refreshGroup, resolvedProfiles, selectedModelId])

	return {
		groups,
		isLoading:
			Object.keys(profileConfigsByName).length === 0 ||
			queries.some((query) => query.isLoading) ||
			eligibleProfiles.some((entry) => !profileConfigsByName[entry.name] && entry.name !== currentApiConfigName),
		isError: queries.some((query) => query.isError),
	}
}
