import * as os from "os"
import * as vscode from "vscode"
import { getCurrentOrLegacyExtension } from "../../utils/extensionIdentity"

interface NotificationOptions {
	title?: string
	subtitle?: string
	message: string
}

let execaRunner: ((file: string, args?: readonly string[]) => Promise<unknown>) | undefined

async function runExeca(file: string, args?: readonly string[]): Promise<unknown> {
	if (!execaRunner) {
		const { execa } = await import("execa")
		execaRunner = execa as (file: string, args?: readonly string[]) => Promise<unknown>
	}
	return execaRunner(file, args)
}

async function showMacOSNotification(options: NotificationOptions): Promise<void> {
	const { title, subtitle = "", message } = options

	// Try terminal-notifier first if available
	try {
		const args = ["-message", message]
		if (title) {
			args.push("-title", title)
		}
		if (subtitle) {
			args.push("-subtitle", subtitle)
		}
		args.push("-sound", "Tink")

		// Add Nova Code logo
		const extensionUri = getCurrentOrLegacyExtension()?.extensionUri
		if (!extensionUri) {
			throw new Error("Extension URI not found")
		}
		const iconPath = vscode.Uri.joinPath(extensionUri, "assets", "icons", "nova.png").fsPath
		args.push("-appIcon", iconPath)

		await runExeca("terminal-notifier", args)
		return
	} catch (error) {
		// If terminal-notifier fails, fall back to osascript
		// This could be because terminal-notifier is not installed or other error
	}

	// Fallback to osascript
	const script = `display notification "${message}" with title "${title}" subtitle "${subtitle}" sound name "Tink"`

	try {
		await runExeca("osascript", ["-e", script])
	} catch (error) {
		throw new Error(`Failed to show macOS notification: ${error}`)
	}
}

async function showWindowsNotification(options: NotificationOptions): Promise<void> {
	const { subtitle, message } = options

	const script = `
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

    $template = @"
    <toast>
        <visual>
            <binding template="ToastText02">
                <text id="1">${subtitle}</text>
                <text id="2">${message}</text>
            </binding>
        </visual>
    </toast>
"@

    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($template)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Nova Code").Show($toast)
    `

	try {
		await runExeca("powershell", ["-Command", script])
	} catch (error) {
		throw new Error(`Failed to show Windows notification: ${error}`)
	}
}

async function showLinuxNotification(options: NotificationOptions): Promise<void> {
	const { title = "", subtitle = "", message } = options

	// Combine subtitle and message if subtitle exists
	const fullMessage = subtitle ? `${subtitle}\n${message}` : message

	try {
		await runExeca("notify-send", [title, fullMessage])
	} catch (error) {
		throw new Error(`Failed to show Linux notification: ${error}`)
	}
}

export async function showSystemNotification(options: NotificationOptions): Promise<void> {
	try {
		const { title = "Nova Code", message } = options

		if (!message) {
			throw new Error("Message is required")
		}

		const escapedOptions = {
			...options,
			title: title.replace(/"/g, '\\"'),
			message: message.replace(/"/g, '\\"'),
			subtitle: options.subtitle?.replace(/"/g, '\\"') || "",
		}

		switch (os.platform()) {
			case "darwin":
				await showMacOSNotification(escapedOptions)
				break
			case "win32":
				await showWindowsNotification(escapedOptions)
				break
			case "linux":
				await showLinuxNotification(escapedOptions)
				break
			default:
				throw new Error("Unsupported platform")
		}
	} catch (error) {
		console.error("Could not show system notification", error)
	}
}
