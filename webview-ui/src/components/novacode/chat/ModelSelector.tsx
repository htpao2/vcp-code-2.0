import { type ProviderSettings } from "@roo-code/types"

import { CrossProfileModelSelector } from "@/components/chat/CrossProfileModelSelector"

interface ModelSelectorProps {
	currentApiConfigName?: string
	apiConfiguration: ProviderSettings
	fallbackText: string
	virtualQuotaActiveModel?: { id: string; name: string; activeProfileNumber?: number }
}

export const ModelSelector = ({
	currentApiConfigName,
	apiConfiguration,
	fallbackText,
	virtualQuotaActiveModel,
}: ModelSelectorProps) => (
	<CrossProfileModelSelector
		currentApiConfigName={currentApiConfigName}
		apiConfiguration={apiConfiguration}
		fallbackText={fallbackText}
		virtualQuotaActiveModel={virtualQuotaActiveModel}
	/>
)
