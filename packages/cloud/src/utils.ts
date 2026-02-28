import type { ExtensionContext } from "vscode"

export function getUserAgent(context?: ExtensionContext): string {
	return `Nova-Code ${context?.extension?.packageJSON?.version || "unknown"}`
}
