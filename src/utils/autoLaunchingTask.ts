// novacode_change - new file Support JSON-based launch configurations
import * as vscode from "vscode"
import { executeCommandWithPrefixFallback, focusSidebarProvider } from "./commandFallback"

interface LaunchConfig {
	prompt: string
	profile?: string
	mode?: string
}

/**
 * Checks for launch configuration and runs the task immediately if found.
 * Reads .novacode/launchConfig.json from the workspace root (fallback: .novacode/launchConfig.json).
 */
export async function checkAndRunAutoLaunchingTask(context: vscode.ExtensionContext): Promise<void> {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		return
	}

	const workspaceFolderUri = vscode.workspace.workspaceFolders[0].uri
	const configCandidates = [
		vscode.Uri.joinPath(workspaceFolderUri, ".novacode", "launchConfig.json"),
		vscode.Uri.joinPath(workspaceFolderUri, ".novacode", "launchConfig.json"),
	]

	for (const configPath of configCandidates) {
		try {
			const configContent = await vscode.workspace.fs.readFile(configPath)
			const configText = Buffer.from(configContent).toString("utf8")
			const config = JSON.parse(configText) as LaunchConfig
			console.log(`🚀 Auto-launching task from '${configPath}' with config:\n${JSON.stringify(config)}`)

			await new Promise((resolve) => setTimeout(resolve, 500))
			await focusSidebarProvider()
			await executeCommandWithPrefixFallback("newTask", config) // Pass the full config to newTask
			return
		} catch (error) {
			if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
				continue
			}
			console.error(`Error reading launch config:`, error)
			return
		}
	}

	// No config file found
}
