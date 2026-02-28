import { HTMLAttributes } from "react"

import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"

type SettingsFooterProps = HTMLAttributes<HTMLDivElement> & {
	version: string
}

export const SettingsFooter = ({ version, className, ...props }: SettingsFooterProps) => (
	<div className={cn("text-vscode-descriptionForeground p-5", className)} {...props}>
		<p style={{ wordWrap: "break-word", margin: 0, padding: 0 }}>
			If you have any questions or feedback, feel free to open an issue at{" "}
			<VSCodeLink href="https://github.com/Nova-Org/novacode" style={{ display: "inline" }}>
				github.com/Nova-Org/novacode
			</VSCodeLink>{" "}
			or join{" "}
			<VSCodeLink href="https://www.reddit.com/r/NovaCode/" style={{ display: "inline" }}>
				reddit.com/r/NovaCode
			</VSCodeLink>
			.
		</p>
		<p style={{ wordWrap: "break-word", margin: 0, padding: 0 }}>
			Regarding financial questions, please contact Customer Service at{" "}
			<VSCodeLink href="mail:hi@nova.ai" style={{ display: "inline" }}>
				hi@nova.ai
			</VSCodeLink>{" "}
		</p>
		<p className="italic">Nova Code v{version}</p>
		<div className="flex justify-between items-center gap-3">
			<p>Reset all global state and secret storage in the extension.</p>
			<VSCodeButton
				onClick={() => vscode.postMessage({ type: "resetState" })}
				appearance="secondary"
				className="shrink-0">
				<span className="codicon codicon-warning text-vscode-errorForeground mr-1" />
				Reset
			</VSCodeButton>
		</div>
	</div>
)
