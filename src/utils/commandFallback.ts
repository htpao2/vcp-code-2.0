import * as vscode from "vscode"

import { Package } from "../shared/package"

async function isCommandRegistered(command: string): Promise<boolean> {
	try {
		const commands = await vscode.commands.getCommands(true)
		return commands.includes(command)
	} catch {
		return false
	}
}

export async function executeNamedCommandWithFallback<T = unknown>(
	primaryCommand: string,
	fallbackCommand: string,
	...args: unknown[]
): Promise<T> {
	if (await isCommandRegistered(primaryCommand)) {
		return vscode.commands.executeCommand<T>(primaryCommand, ...args)
	}

	if (primaryCommand !== fallbackCommand && (await isCommandRegistered(fallbackCommand))) {
		return vscode.commands.executeCommand<T>(fallbackCommand, ...args)
	}

	try {
		return await vscode.commands.executeCommand<T>(primaryCommand, ...args)
	} catch (primaryError) {
		if (primaryCommand !== fallbackCommand) {
			return vscode.commands.executeCommand<T>(fallbackCommand, ...args)
		}

		throw primaryError
	}
}

export async function executeCommandWithPrefixFallback<T = unknown>(
	commandSuffix: string,
	...args: unknown[]
): Promise<T> {
	const primaryCommand = `${Package.name}.${commandSuffix}`
	const fallbackCommand = `nova-code.${commandSuffix}`
	return executeNamedCommandWithFallback<T>(primaryCommand, fallbackCommand, ...args)
}

export async function focusSidebarProvider(): Promise<void> {
	await executeCommandWithPrefixFallback("SidebarProvider.focus")
}
