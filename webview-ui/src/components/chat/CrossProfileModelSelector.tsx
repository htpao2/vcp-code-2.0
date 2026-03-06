import { useCallback, useEffect, useMemo, useState } from "react"
import { Fzf } from "fzf"
import { Check, RefreshCw } from "lucide-react"
import {
	OPENROUTER_DEFAULT_PROVIDER_NAME,
	type ProviderSettings,
	type VcpRuntimeModelCatalogEntry,
} from "@roo-code/types"

import { Popover, PopoverContent, PopoverTrigger, StandardTooltip, Button } from "@/components/ui"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { getModelIdKey, getSelectedModelId } from "@/components/nova/hooks/useSelectedModel"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"
import { prettyModelName } from "@/utils/prettyModelName"
import { vscode } from "@/utils/vscode"

export interface CrossProfileModelSelectorProps {
	currentApiConfigName?: string
	apiConfiguration: ProviderSettings
	fallbackText: string
	virtualQuotaActiveModel?: { id: string; name: string; activeProfileNumber?: number }
}

const getProviderLabel = (provider: string) => {
	switch (provider) {
		case "openai":
			return "OpenAI Compatible"
		case "openrouter":
			return "OpenRouter"
		case "vscode-lm":
			return "VS Code LM"
		default:
			return provider
	}
}

export const CrossProfileModelSelector = ({
	currentApiConfigName,
	apiConfiguration,
	fallbackText,
	virtualQuotaActiveModel,
}: CrossProfileModelSelectorProps) => {
	const { t } = useAppTranslation()
	const portalContainer = useRooPortal("roo-portal")
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [models, setModels] = useState<VcpRuntimeModelCatalogEntry[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [hasFetched, setHasFetched] = useState(false)

	const provider = apiConfiguration.apiProvider ?? "anthropic"
	const providerLabel = getProviderLabel(provider)
	const selectedModelId = getSelectedModelId({
		provider,
		apiConfiguration,
		defaultModelId: "",
	})

	const requestModels = useCallback((refresh: boolean) => {
		setIsLoading(true)
		vscode.postMessage({ type: refresh ? "refreshRuntimeProviderModels" : "fetchRuntimeProviderModels" })
	}, [])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type !== "runtimeProviderModels") {
				return
			}

			setModels((message.runtimeProviderModels ?? []) as VcpRuntimeModelCatalogEntry[])
			setHasFetched(true)
			setIsLoading(false)
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	useEffect(() => {
		setModels([])
		setHasFetched(false)
		setIsLoading(false)
		setSearchValue("")
	}, [apiConfiguration, currentApiConfigName, provider])

	useEffect(() => {
		if (
			open &&
			!hasFetched &&
			provider !== "virtual-quota-fallback" &&
			apiConfiguration.profileType !== "autocomplete"
		) {
			requestModels(false)
		}
	}, [apiConfiguration.profileType, hasFetched, open, provider, requestModels])

	const searchableItems = useMemo(
		() =>
			models.map((model) => ({
				original: model,
				searchStr: [model.displayName, model.id, model.owned_by].filter(Boolean).join(" "),
			})),
		[models],
	)

	const fzfInstance = useMemo(
		() => new Fzf(searchableItems, { selector: (item) => item.searchStr }),
		[searchableItems],
	)

	const filteredModelIds = useMemo(() => {
		if (!searchValue) {
			return null
		}

		return new Set(fzfInstance.find(searchValue).map((result) => result.item.original.id))
	}, [fzfInstance, searchValue])

	const visibleModels = useMemo(() => {
		if (!filteredModelIds) {
			return models
		}

		return models.filter((model) => filteredModelIds.has(model.id))
	}, [filteredModelIds, models])

	const selectedEntry = useMemo(() => models.find((model) => model.id === selectedModelId), [models, selectedModelId])

	const handleSelect = useCallback(
		(model: VcpRuntimeModelCatalogEntry) => {
			if (!currentApiConfigName || model.id === selectedModelId) {
				setOpen(false)
				return
			}

			if (provider === "vscode-lm") {
				const [vendor, ...familyParts] = model.id.split("/")
				if (!vendor || familyParts.length === 0) {
					setOpen(false)
					return
				}

				vscode.postMessage({
					type: "upsertApiConfiguration",
					text: currentApiConfigName,
					apiConfiguration: {
						...apiConfiguration,
						vsCodeLmModelSelector: {
							vendor,
							family: familyParts.join("/"),
						},
					},
				})
			} else {
				const modelIdKey = getModelIdKey({ provider })
				vscode.postMessage({
					type: "upsertApiConfiguration",
					text: currentApiConfigName,
					apiConfiguration: {
						...apiConfiguration,
						[modelIdKey]: model.id,
						openRouterSpecificProvider:
							provider === "openrouter"
								? OPENROUTER_DEFAULT_PROVIDER_NAME
								: apiConfiguration.openRouterSpecificProvider,
					},
				})
			}

			vscode.postMessage({
				type: "updateVcpRuntimeModelBindings",
				defaultModelId: model.id,
			})

			setSearchValue("")
			setOpen(false)
		},
		[apiConfiguration, currentApiConfigName, provider, selectedModelId],
	)

	if (provider === "virtual-quota-fallback" && virtualQuotaActiveModel) {
		return (
			<span className="truncate text-xs text-vscode-descriptionForeground opacity-70">
				{prettyModelName(virtualQuotaActiveModel.id)}
				{virtualQuotaActiveModel.activeProfileNumber !== undefined && (
					<> ({virtualQuotaActiveModel.activeProfileNumber})</>
				)}
			</span>
		)
	}

	if (apiConfiguration.profileType === "autocomplete") {
		return <span className="truncate text-xs text-vscode-descriptionForeground opacity-70">{fallbackText}</span>
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<StandardTooltip content={t("chat:selectApiConfig")}>
				<PopoverTrigger
					data-testid="dropdown-trigger"
					className={cn(
						"min-w-0 inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						"opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						"w-full overflow-hidden p-0 bg-transparent border-transparent hover:bg-transparent hover:border-transparent",
					)}>
					<span className="truncate">
						{selectedEntry
							? `${providerLabel} · ${selectedEntry.displayName || selectedEntry.id}`
							: fallbackText}
					</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="w-[360px] overflow-hidden p-0">
				<div className="flex flex-col">
					<div className="border-b border-vscode-dropdown-border p-2">
						<input
							autoFocus
							value={searchValue}
							onChange={(event) => setSearchValue(event.target.value)}
							placeholder={t("common:ui.search_placeholder")}
							className="h-8 w-full rounded border border-vscode-input-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-input-foreground focus:outline-0"
						/>
					</div>
					<div className="border-b border-vscode-dropdown-border/40 px-3 py-2 text-[11px] text-vscode-descriptionForeground">
						当前仅切换「{currentApiConfigName || "default"}」配置文件的模型。配置文件切换仍使用单独的
						Profile 下拉。
					</div>
					<div className="flex items-center justify-between gap-2 border-b border-vscode-dropdown-border/40 px-3 py-2">
						<div className="min-w-0">
							<div className="truncate text-xs font-medium text-vscode-foreground">{providerLabel}</div>
							<div className="truncate text-[11px] text-vscode-descriptionForeground">
								{currentApiConfigName || "default"}
							</div>
						</div>
						<Button variant="secondary" size="sm" onClick={() => requestModels(true)} disabled={isLoading}>
							<RefreshCw className="mr-1 h-3.5 w-3.5" />
							刷新
						</Button>
					</div>
					{isLoading && (
						<div className="px-3 py-3 text-sm text-vscode-descriptionForeground">
							正在读取当前 Provider 模型列表...
						</div>
					)}
					{!isLoading && visibleModels.length === 0 && (
						<div className="px-3 py-3 text-sm text-vscode-descriptionForeground">
							{hasFetched ? t("common:ui.no_results") : "点击刷新或展开时自动读取模型列表。"}
						</div>
					)}
					{!isLoading && visibleModels.length > 0 && (
						<div className="max-h-[360px] overflow-y-auto">
							{visibleModels.map((model) => {
								const isCurrentModel = model.id === selectedModelId

								return (
									<button
										key={model.id}
										type="button"
										onClick={() => handleSelect(model)}
										className={cn(
											"flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-vscode-list-hoverBackground",
											isCurrentModel &&
												"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
										)}>
										<div className="min-w-0 flex-1">
											<div className="truncate">{model.displayName || model.id}</div>
											<div className="truncate text-[11px] text-vscode-descriptionForeground">
												{model.id}
											</div>
										</div>
										{isCurrentModel && <Check className="h-4 w-4 shrink-0" />}
									</button>
								)
							})}
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}
