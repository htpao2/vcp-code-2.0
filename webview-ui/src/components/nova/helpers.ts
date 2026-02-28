import { JETBRAIN_PRODUCTS } from "../../../../src/shared/nova/wrapper"
import { getAppUrl } from "@roo-code/types"

type WrapperPropsForWebview =
	| import("@roo-code/types").NovaCodeWrapperProperties
	| import("../../../../src/shared/nova/wrapper").NovaCodeWrapperProperties // novacode_change

const getJetbrainsUrlScheme = (code: string) => {
	return JETBRAIN_PRODUCTS[code as keyof typeof JETBRAIN_PRODUCTS]?.urlScheme || "jetbrains"
}

const getNovaCodeSource = (uriScheme: string = "vscode", novaCodeWrapperProperties?: WrapperPropsForWebview) => {
	if (
		!novaCodeWrapperProperties?.novaCodeWrapped ||
		!(novaCodeWrapperProperties as any).novaCodeWrapper ||
		!(novaCodeWrapperProperties as any).novaCodeWrapperCode
	) {
		return uriScheme
	}

	return `${getJetbrainsUrlScheme((novaCodeWrapperProperties as any).novaCodeWrapperCode)}` // novacode_change
}

export function getNovaCodeBackendSignInUrl(
	uriScheme: string = "vscode",
	uiKind: string = "Desktop",
	novaCodeWrapperProperties?: WrapperPropsForWebview, // novacode_change
) {
	const source = uiKind === "Web" ? "web" : getNovaCodeSource(uriScheme, novaCodeWrapperProperties)
	return getAppUrl(`/sign-in-to-editor?source=${source}`)
}

export function getNovaCodeBackendSignUpUrl(
	uriScheme: string = "vscode",
	uiKind: string = "Desktop",
	novaCodeWrapperProperties?: WrapperPropsForWebview, // novacode_change
) {
	const source = uiKind === "Web" ? "web" : getNovaCodeSource(uriScheme, novaCodeWrapperProperties)
	return getAppUrl(`/users/sign_up?source=${source}`)
}
