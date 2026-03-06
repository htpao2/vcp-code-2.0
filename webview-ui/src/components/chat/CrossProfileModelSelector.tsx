import { useCallback, useMemo, useState } from "react"
import { Fzf } from "fzf"
import { Check, RefreshCw } from "lucide-react"
import { OPENROUTER_DEFAULT_PROVIDER_NAME, type ProviderSettings } from "@roo-code/types"

import { Popover, PopoverContent, PopoverTrigger, StandardTooltip, Button } from "@/components/ui"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { getSelectedModelId } from "@/components/nova/hooks/useSelectedModel"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"
import { prettyModelName } from "@/utils/prettyModelName"
import { vscode } from "@/utils/vscode"
import { type ProfileModelItem, useProfileModelCatalog } from "./useProfileModelCatalog"

export interface CrossProfileModelSelectorProps {
	currentApiConfigName?: string
	apiConfiguration: ProviderSettings
	fallbackText: string
	virtualQuotaActiveModel?: { id: string; name: string; activeProfileNumber?: number }
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

	const provider = apiConfiguration.apiProvider ?? "anthropic"
	const selectedModelId = getSelectedModelId({
		provider,
		apiConfiguration,
		defaultModelId: "",
	})
	const selectedModelValue = selectedModelId || ""

	const { groups, isLoading, isError } = useProfileModelCatalog(
		currentApiConfigName,
		apiConfiguration,
		selectedModelValue,
	)

	const searchableItems = useMemo(
		() =>
			groups.flatMap((group) =>
				group.items.map((item) => ({
					original: item,
					searchStr: item.searchText,
				})),
			),
		[groups],
	)

	const fzfInstance = useMemo(
		() => new Fzf(searchableItems, { selector: (item) => item.searchStr }),
		[searchableItems],
	)

	const filteredItemKeys = useMemo(() => {
		if (!searchValue) {
			return null
		}

		return new Set(fzfInstance.find(searchValue).map((result) => result.item.original.key))
	}, [fzfInstance, searchValue])

	const visibleGroups = useMemo(() => {
		if (!filteredItemKeys) {
			return groups
		}

		return groups
			.map((group) => ({
				...group,
				items: group.items.filter((item) => filteredItemKeys.has(item.key)),
			}))
			.filter((group) => group.items.length > 0)
	}, [filteredItemKeys, groups])

	const selectedItem = useMemo(
		() =>
			groups.flatMap((group) => group.items).find((item) => item.isCurrentModel) ??
			groups.flatMap((group) => group.items).find((item) => item.profileName === currentApiConfigName),
		[currentApiConfigName, groups],
	)

	const handleSelect = useCallback(
		(item: ProfileModelItem) => {
			const isSameProfile = item.profileName === currentApiConfigName
			const isSameModel = item.isCurrentModel

			if (isSameProfile && isSameModel) {
				setOpen(false)
				return
			}

			vscode.postMessage({
				type: "upsertApiConfiguration",
				text: item.profileName,
				apiConfiguration: {
					...item.profileConfig,
					openRouterSpecificProvider:
						item.provider === "openrouter"
							? OPENROUTER_DEFAULT_PROVIDER_NAME
							: item.profileConfig.openRouterSpecificProvider,
				},
			})

			if (!isSameProfile) {
				vscode.postMessage({
					type: "loadApiConfigurationById",
					text: item.profileId,
				})
			}

			setSearchValue("")
			setOpen(false)
		},
		[currentApiConfigName],
	)

	if (isLoading) {
		return null
	}

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

	if (apiConfiguration.profileType === "autocomplete" || isError || groups.length === 0) {
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
						{selectedItem ? `${selectedItem.providerLabel} · ${selectedItem.modelLabel}` : fallbackText}
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
					{visibleGroups.length === 0 ? (
						<div className="px-3 py-3 text-sm text-vscode-descriptionForeground">
							{t("common:ui.no_results")}
						</div>
					) : (
						<div className="max-h-[360px] overflow-y-auto">
							{visibleGroups.map((group) => (
								<div
									key={group.key}
									className="border-b border-vscode-dropdown-border/40 last:border-b-0">
									<div className="sticky top-0 bg-vscode-dropdown-background px-3 py-2 text-xs font-medium text-vscode-descriptionForeground">
										<div>{group.providerLabel}</div>
										<div className="mt-0.5 text-[11px] opacity-80">{group.profileName}</div>
									</div>
									{group.isEmpty && !searchValue ? (
										<div className="px-3 py-3">
											<Button
												variant="secondary"
												size="sm"
												onClick={() => void group.refresh()}
												className="h-7 text-xs">
												<RefreshCw className="mr-1 h-3.5 w-3.5" />
												获取模型列表
											</Button>
										</div>
									) : (
										group.items.map((item) => (
											<button
												key={item.key}
												type="button"
												onClick={() => handleSelect(item)}
												className={cn(
													"flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-vscode-list-hoverBackground",
													item.isCurrentModel &&
														"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
												)}>
												<div className="min-w-0 flex-1">
													<div className="truncate">{item.modelLabel}</div>
													<div className="truncate text-[11px] text-vscode-descriptionForeground">
														{item.modelId}
													</div>
												</div>
												{item.isCurrentModel && <Check className="h-4 w-4 shrink-0" />}
											</button>
										))
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}
