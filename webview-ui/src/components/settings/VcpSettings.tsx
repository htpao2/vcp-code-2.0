import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import type { ExtensionStateContextType } from "@/context/ExtensionStateContext"
import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"

import { Section } from "./Section"
import { SectionHeader } from "./SectionHeader"
import type { SetCachedStateField } from "./types"

type AutocompleteSettingField = "enableAutoTrigger" | "enableSmartInlineTaskKeybinding" | "enableChatAutocomplete"

type VcpSettingsProps = {
	yoloMode?: boolean
	showAutoApproveMenu?: boolean
	browserToolEnabled?: boolean
	remoteBrowserEnabled?: boolean
	ghostServiceSettings?: ExtensionStateContextType["ghostServiceSettings"]
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
	setAutocompleteServiceSettingsField: (field: AutocompleteSettingField, value: boolean) => void
}

export const VcpSettings = ({
	yoloMode,
	showAutoApproveMenu,
	browserToolEnabled,
	remoteBrowserEnabled,
	ghostServiceSettings,
	setCachedStateField,
	setAutocompleteServiceSettingsField,
}: VcpSettingsProps) => {
	const openExternal = (url: string) => vscode.postMessage({ type: "openExternal", url })

	return (
		<div>
			<SectionHeader description="Core VCP toggles and quick links.">VCP</SectionHeader>
			<Section>
				<VSCodeCheckbox
					checked={yoloMode ?? false}
					onChange={(e: any) => setCachedStateField("yoloMode", e.target.checked === true)}
					data-testid="vcp-yolo-checkbox">
					Enable YOLO routing
				</VSCodeCheckbox>
				<VSCodeCheckbox
					checked={showAutoApproveMenu ?? true}
					onChange={(e: any) => setCachedStateField("showAutoApproveMenu", e.target.checked === true)}
					data-testid="vcp-auto-approve-menu-checkbox">
					Show auto-approve quick menu in chat
				</VSCodeCheckbox>
				<VSCodeCheckbox
					checked={browserToolEnabled ?? true}
					onChange={(e: any) => setCachedStateField("browserToolEnabled", e.target.checked === true)}
					data-testid="vcp-browser-tool-checkbox">
					Enable browser automation tool
				</VSCodeCheckbox>
				<VSCodeCheckbox
					checked={remoteBrowserEnabled ?? false}
					onChange={(e: any) => setCachedStateField("remoteBrowserEnabled", e.target.checked === true)}
					data-testid="vcp-remote-browser-checkbox">
					Enable remote browser mode
				</VSCodeCheckbox>
				<VSCodeCheckbox
					checked={ghostServiceSettings?.enableAutoTrigger ?? false}
					onChange={(e: any) =>
						setAutocompleteServiceSettingsField("enableAutoTrigger", e.target.checked === true)
					}
					data-testid="vcp-autocomplete-auto-trigger-checkbox">
					Enable autocomplete auto trigger
				</VSCodeCheckbox>
				<VSCodeCheckbox
					checked={ghostServiceSettings?.enableSmartInlineTaskKeybinding ?? false}
					onChange={(e: any) =>
						setAutocompleteServiceSettingsField(
							"enableSmartInlineTaskKeybinding",
							e.target.checked === true,
						)
					}
					data-testid="vcp-autocomplete-inline-keybinding-checkbox">
					Enable smart inline task keybinding
				</VSCodeCheckbox>
				<VSCodeCheckbox
					checked={ghostServiceSettings?.enableChatAutocomplete ?? false}
					onChange={(e: any) =>
						setAutocompleteServiceSettingsField("enableChatAutocomplete", e.target.checked === true)
					}
					data-testid="vcp-chat-autocomplete-checkbox">
					Enable chat autocomplete
				</VSCodeCheckbox>
			</Section>

			<Section>
				<div className="text-vscode-descriptionForeground text-sm">
					Project:{" "}
					<VSCodeLink href="https://github.com/DerstedtCasper/vcp-code-2.0">
						github.com/DerstedtCasper/vcp-code-2.0
					</VSCodeLink>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button onClick={() => openExternal("https://github.com/DerstedtCasper/vcp-code-2.0/issues")}>
						Open Issues
					</Button>
					<Button
						variant="destructive"
						onClick={() => vscode.postMessage({ type: "resetState" })}
						data-testid="vcp-reset-state-button">
						Reset Extension State
					</Button>
				</div>
			</Section>
		</div>
	)
}
