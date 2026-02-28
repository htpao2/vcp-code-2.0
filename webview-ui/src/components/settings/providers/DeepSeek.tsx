import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type DeepSeekProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const DeepSeek = ({ apiConfiguration, setApiConfigurationField, simplifySettings }: DeepSeekProps) => {
	const { t } = useAppTranslation()
	const [deepSeekBaseUrlSelected, setDeepSeekBaseUrlSelected] = useState(!!apiConfiguration?.deepSeekBaseUrl)

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.deepSeekApiKey || ""}
				type="password"
				onInput={handleInputChange("deepSeekApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.deepSeekApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.deepSeekApiKey && (
				<VSCodeButtonLink href="https://platform.deepseek.com/" appearance="secondary">
					{t("settings:providers.getDeepSeekApiKey")}
				</VSCodeButtonLink>
			)}
			{!simplifySettings && (
				<div>
					<Checkbox
						checked={deepSeekBaseUrlSelected}
						onChange={(checked: boolean) => {
							setDeepSeekBaseUrlSelected(checked)
							if (!checked) {
								setApiConfigurationField("deepSeekBaseUrl", "")
							}
						}}>
						{t("settings:providers.useCustomBaseUrl")}
					</Checkbox>
					{deepSeekBaseUrlSelected && (
						<VSCodeTextField
							value={apiConfiguration?.deepSeekBaseUrl || ""}
							type="url"
							onInput={handleInputChange("deepSeekBaseUrl")}
							placeholder="Default: https://api.deepseek.com"
							className="w-full mt-1"
						/>
					)}
				</div>
			)}
		</>
	)
}
