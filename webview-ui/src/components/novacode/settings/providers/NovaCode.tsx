import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Button } from "@src/components/ui"
import { type ProviderSettings, type OrganizationAllowList } from "@roo-code/types"
import type { RouterModels } from "@roo/api"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { inputEventTransform } from "../../../settings/transforms"
import { ModelPicker } from "../../../settings/ModelPicker"
import { vscode } from "@src/utils/vscode"
import { OrganizationSelector } from "../../common/OrganizationSelector"
import { getAppUrl } from "@roo-code/types"
import { useNovaIdentity } from "@src/utils/nova/useNovaIdentity"

type NovaCodeProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	currentApiConfigName?: string
	hideNovaCodeButton?: boolean
	routerModels?: RouterModels
	organizationAllowList: OrganizationAllowList
	novacodeDefaultModel: string
}

export const NovaCode = ({
	apiConfiguration,
	setApiConfigurationField,
	currentApiConfigName,
	hideNovaCodeButton,
	routerModels,
	organizationAllowList,
	novacodeDefaultModel,
}: NovaCodeProps) => {
	const { t } = useAppTranslation()

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

	// Use the existing hook to get user identity
	const userIdentity = useNovaIdentity(apiConfiguration.novacodeToken || "", "")
	const isNovaCodeAiUser = userIdentity.endsWith("@nova.ai")

	const areNovacodeWarningsDisabled = apiConfiguration.novacodeTesterWarningsDisabledUntil
		? apiConfiguration.novacodeTesterWarningsDisabledUntil > Date.now()
		: false

	const handleToggleTesterWarnings = useCallback(() => {
		const newTimestamp = Date.now() + (areNovacodeWarningsDisabled ? 0 : 24 * 60 * 60 * 1000)
		setApiConfigurationField("novacodeTesterWarningsDisabledUntil", newTimestamp)
	}, [areNovacodeWarningsDisabled, setApiConfigurationField])

	return (
		<>
			<div>
				<label className="block font-medium -mb-2">{t("novacode:settings.provider.account")}</label>
			</div>
			{!hideNovaCodeButton &&
				(apiConfiguration.novacodeToken ? (
					<div>
						<Button
							variant="secondary"
							onClick={async () => {
								setApiConfigurationField("novacodeToken", "")

								vscode.postMessage({
									type: "upsertApiConfiguration",
									text: currentApiConfigName,
									apiConfiguration: {
										...apiConfiguration,
										novacodeToken: "",
										novacodeOrganizationId: undefined,
									},
								})
							}}>
							{t("novacode:settings.provider.logout")}
						</Button>
					</div>
				) : (
					<>
						<div className="flex flex-row items-center gap-1 text-vscode-charts-green text-sm">
							<div className="codicon codicon-info" />
							<div>{t("novacode:settings.provider.loginForPremiumModels")}</div>
						</div>
						<Button
							variant="secondary"
							onClick={() => {
								vscode.postMessage({
									type: "switchTab",
									tab: "auth",
									values: { returnTo: "settings", profileName: currentApiConfigName },
								})
							}}>
							{t("novacode:settings.provider.login")}
						</Button>
					</>
				))}

			<VSCodeTextField
				value={apiConfiguration?.novacodeToken || ""}
				type="password"
				onInput={handleInputChange("novacodeToken")}
				placeholder={t("novacode:settings.provider.apiKey")}
				className="w-full">
				<div className="flex justify-between items-center mb-1">
					<label className="block font-medium">{t("novacode:settings.provider.apiKey")}</label>
				</div>
			</VSCodeTextField>

			<OrganizationSelector showLabel />

			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={novacodeDefaultModel}
				models={routerModels?.novacode ?? {}}
				modelIdKey="novacodeModel"
				serviceName="Nova Code"
				serviceUrl={getAppUrl()}
				organizationAllowList={organizationAllowList}
			/>

			{/* NOVACODE-TESTER warnings setting - only visible for @nova.ai users */}
			{isNovaCodeAiUser && (
				<div className="mb-4">
					<label className="block font-medium mb-2">Disable NOVACODE-TESTER warnings</label>
					<div className="text-sm text-vscode-descriptionForeground mb-2">
						{areNovacodeWarningsDisabled
							? `Warnings disabled until ${new Date(apiConfiguration.novacodeTesterWarningsDisabledUntil || 0).toLocaleString()}`
							: "NOVACODE-TESTER warnings are currently enabled"}
					</div>
					<Button variant="secondary" onClick={handleToggleTesterWarnings} className="text-sm">
						{areNovacodeWarningsDisabled ? "Enable warnings now" : "Disable warnings for 1 day"}
					</Button>
				</div>
			)}
		</>
	)
}
