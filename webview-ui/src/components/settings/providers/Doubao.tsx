import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type DoubaoProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const Doubao = ({ apiConfiguration, setApiConfigurationField, simplifySettings }: DoubaoProps) => {
	const { t } = useAppTranslation()
	const [doubaoBaseUrlSelected, setDoubaoBaseUrlSelected] = useState(!!apiConfiguration?.doubaoBaseUrl)

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
				value={apiConfiguration?.doubaoApiKey || ""}
				type="password"
				onInput={handleInputChange("doubaoApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.doubaoApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.doubaoApiKey && (
				<VSCodeButtonLink
					href="https://www.volcengine.com/experience/ark?model=doubao-1-5-thinking-vision-pro-250428"
					appearance="secondary">
					{t("settings:providers.getDoubaoApiKey")}
				</VSCodeButtonLink>
			)}
			{!simplifySettings && (
				<div>
					<Checkbox
						checked={doubaoBaseUrlSelected}
						onChange={(checked: boolean) => {
							setDoubaoBaseUrlSelected(checked)
							if (!checked) {
								setApiConfigurationField("doubaoBaseUrl", "")
							}
						}}>
						{t("settings:providers.useCustomBaseUrl")}
					</Checkbox>
					{doubaoBaseUrlSelected && (
						<VSCodeTextField
							value={apiConfiguration?.doubaoBaseUrl || ""}
							type="url"
							onInput={handleInputChange("doubaoBaseUrl")}
							placeholder="Default: https://ark.cn-beijing.volces.com/api/v3"
							className="w-full mt-1"
						/>
					)}
				</div>
			)}
		</>
	)
}
