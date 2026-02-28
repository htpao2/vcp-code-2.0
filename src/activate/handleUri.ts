import * as vscode from "vscode"

import { CloudService } from "@roo-code/cloud"

import { ClineProvider } from "../core/webview/ClineProvider"
import { Package } from "../shared/package"

export const handleUri = async (uri: vscode.Uri) => {
	const path = uri.path
	const query = new URLSearchParams(uri.query.replace(/\+/g, "%2B"))

	// novacode_change start: Handle /nova/chat path specially - it needs to open the extension first
	// before we can get a provider instance
	if (path === "/nova/chat") {
		// Focus the sidebar first to open the Nova Code extension
		await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
		// Use getInstance() which waits for the provider to become visible after focusing
		const provider = await ClineProvider.getInstance()
		if (!provider) {
			return
		}
		// Open a fresh chat (same as clicking the + button)
		await provider.removeClineFromStack()
		await provider.refreshWorkspace()
		await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		await provider.postMessageToWebview({ type: "action", action: "focusInput" })
		return
	}
	// novacode_change end

	const visibleProvider = ClineProvider.getVisibleInstance()

	if (!visibleProvider) {
		return
	}

	switch (path) {
		// novacode_change start
		case "/glama": {
			const code = query.get("code")
			if (code) {
				await visibleProvider.handleGlamaCallback(code)
			}
			break
		}
		// novacode_change end
		case "/openrouter": {
			const code = query.get("code")
			if (code) {
				await visibleProvider.handleOpenRouterCallback(code)
			}
			break
		}
		case "/novacode": {
			const token = query.get("token")
			if (token) {
				await visibleProvider.handleNovaCodeCallback(token)
			}
			break
		}
		// novacode_change start
		case "/nova/profile": {
			// Focus the sidebar first so users can see the profile
			await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
			await visibleProvider.postMessageToWebview({
				type: "action",
				action: "profileButtonClicked",
			})
			await visibleProvider.postMessageToWebview({
				type: "updateProfileData",
			})
			break
		}
		case "/nova/fork": {
			const id = query.get("id")
			if (id) {
				// Focus the sidebar first so users can see the fork
				await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
				await visibleProvider.postMessageToWebview({
					type: "invoke",
					invoke: "setChatBoxMessage",
					text: `/session fork ${id}`,
				})
				await visibleProvider.postMessageToWebview({
					type: "action",
					action: "focusInput",
				})
			}
			break
		}
		// novacode_change end
		case "/requesty": {
			const code = query.get("code")
			const baseUrl = query.get("baseUrl")
			if (code) {
				await visibleProvider.handleRequestyCallback(code, baseUrl)
			}
			break
		}
		case "/auth/clerk/callback": {
			const code = query.get("code")
			const state = query.get("state")
			const organizationId = query.get("organizationId")
			const providerModel = query.get("provider_model")

			await CloudService.instance.handleAuthCallback(
				code,
				state,
				organizationId === "null" ? null : organizationId,
				providerModel,
			)
			break
		}
		default:
			break
	}
}
