// novacode_change - new file
import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

import { inputEventTransform } from "../transforms"

type ApertisProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const Apertis = ({ apiConfiguration, setApiConfigurationField, simplifySettings }: ApertisProps) => {
	const { t } = useAppTranslation()
	const [apertisBaseUrlSelected, setApertisBaseUrlSelected] = useState(!!apiConfiguration?.apertisBaseUrl)

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
				value={apiConfiguration?.apertisApiKey || ""}
				type="password"
				onInput={handleInputChange("apertisApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.apertisApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.apertisApiKey && (
				<VSCodeButtonLink href="https://apertis.ai/token" appearance="secondary">
					{t("settings:providers.getApertisApiKey")}
				</VSCodeButtonLink>
			)}
			{!simplifySettings && (
				<>
					<div>
						<Checkbox
							checked={apertisBaseUrlSelected}
							onChange={(checked: boolean) => {
								setApertisBaseUrlSelected(checked)
								if (!checked) {
									setApiConfigurationField("apertisBaseUrl", "")
								}
							}}>
							{t("settings:providers.useCustomBaseUrl")}
						</Checkbox>
						{apertisBaseUrlSelected && (
							<VSCodeTextField
								value={apiConfiguration?.apertisBaseUrl || ""}
								type="url"
								onInput={handleInputChange("apertisBaseUrl")}
								placeholder="Default: https://api.apertis.ai"
								className="w-full mt-1"
							/>
						)}
					</div>
					<VSCodeTextField
						value={apiConfiguration?.apertisInstructions || ""}
						onInput={handleInputChange("apertisInstructions")}
						placeholder="Optional instruction override for Responses API"
						className="w-full">
						<label className="block font-medium mb-1">Apertis Instructions</label>
					</VSCodeTextField>
					<div>
						<label className="block font-medium mb-1">Apertis Reasoning Effort</label>
						<Select
							value={apiConfiguration?.apertisReasoningEffort || "unset"}
							onValueChange={(value) =>
								setApiConfigurationField(
									"apertisReasoningEffort",
									value === "unset" ? undefined : (value as "low" | "medium" | "high"),
								)
							}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder={t("settings:common.select")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="unset">Default</SelectItem>
								<SelectItem value="low">Low</SelectItem>
								<SelectItem value="medium">Medium</SelectItem>
								<SelectItem value="high">High</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<label className="block font-medium mb-1">Apertis Reasoning Summary</label>
						<Select
							value={apiConfiguration?.apertisReasoningSummary || "unset"}
							onValueChange={(value) =>
								setApiConfigurationField(
									"apertisReasoningSummary",
									value === "unset" ? undefined : (value as "auto" | "concise" | "detailed"),
								)
							}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder={t("settings:common.select")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="unset">Default</SelectItem>
								<SelectItem value="auto">Auto</SelectItem>
								<SelectItem value="concise">Concise</SelectItem>
								<SelectItem value="detailed">Detailed</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</>
			)}
		</>
	)
}
