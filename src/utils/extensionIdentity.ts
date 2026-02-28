import * as vscode from "vscode"
import { Package } from "../shared/package"

export const LEGACY_EXTENSION_ID = "novacode.nova-code"

export function getPrimaryExtensionId(): string {
	return `${Package.publisher}.${Package.name}`
}

export function getCurrentOrLegacyExtension(): vscode.Extension<any> | undefined {
	return (
		vscode.extensions.getExtension(getPrimaryExtensionId()) ?? vscode.extensions.getExtension(LEGACY_EXTENSION_ID)
	)
}
