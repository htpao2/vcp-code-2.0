import * as vscode from "vscode"
import { JETBRAIN_PRODUCTS, NovaCodeWrapperProperties } from "../../shared/nova/wrapper"
import { TelemetrySetting } from "@roo-code/types"

export const getNovaCodeWrapperProperties = (): NovaCodeWrapperProperties => {
	const appName = vscode.env.appName
	const novaCodeWrapped = appName.includes("wrapper")
	let novaCodeWrapper = null
	let novaCodeWrapperTitle = null
	let novaCodeWrapperCode = null
	let novaCodeWrapperVersion = null
	let novaCodeWrapperJetbrains = false

	if (novaCodeWrapped) {
		const wrapperMatch = appName.split("|")
		novaCodeWrapper = wrapperMatch[1].trim() || null
		novaCodeWrapperCode = wrapperMatch[2].trim() || null
		novaCodeWrapperVersion = wrapperMatch[3].trim() || null
		novaCodeWrapperJetbrains = novaCodeWrapperCode !== "cli"
		novaCodeWrapperTitle =
			novaCodeWrapperCode === "cli"
				? "Nova Code CLI"
				: JETBRAIN_PRODUCTS[novaCodeWrapperCode as keyof typeof JETBRAIN_PRODUCTS]?.name || "JetBrains IDE"
	}

	return {
		novaCodeWrapped,
		novaCodeWrapper,
		novaCodeWrapperTitle,
		novaCodeWrapperCode,
		novaCodeWrapperVersion,
		novaCodeWrapperJetbrains,
	}
}

export const getEditorNameHeader = () => {
	const props = getNovaCodeWrapperProperties()
	return (
		props.novaCodeWrapped
			? [props.novaCodeWrapperTitle, props.novaCodeWrapperVersion]
			: [vscode.env.appName, vscode.version]
	)
		.filter(Boolean)
		.join(" ")
}

export function getEffectiveTelemetrySetting(telemetrySetting: TelemetrySetting | undefined) {
	const isVsCode = !getNovaCodeWrapperProperties().novaCodeWrapped
	return isVsCode && vscode.env.isTelemetryEnabled
		? "enabled"
		: telemetrySetting === "disabled"
			? "disabled"
			: "enabled"
}
