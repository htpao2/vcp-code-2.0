import {
	VSCodeCheckbox,
	VSCodeDropdown,
	VSCodeLink,
	VSCodeOption,
	VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react"
import { getDefaultVcpConfig, type VcpConfig } from "@roo-code/types"

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
	vcpConfig?: ExtensionStateContextType["vcpConfig"]
	vcpBridgeStatus?: ExtensionStateContextType["vcpBridgeStatus"]
	ghostServiceSettings?: ExtensionStateContextType["ghostServiceSettings"]
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
	setAutocompleteServiceSettingsField: (field: AutocompleteSettingField, value: boolean) => void
}

type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends Array<infer U> ? Array<U> : T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export const VcpSettings = ({
	yoloMode,
	showAutoApproveMenu,
	browserToolEnabled,
	remoteBrowserEnabled,
	vcpConfig,
	vcpBridgeStatus,
	ghostServiceSettings,
	setCachedStateField,
	setAutocompleteServiceSettingsField,
}: VcpSettingsProps) => {
	const openExternal = (url: string) => vscode.postMessage({ type: "openExternal", url })
	const currentVcpConfig = vcpConfig ?? getDefaultVcpConfig()

	const updateVcpConfig = (patch: DeepPartial<VcpConfig>) => {
		const next: VcpConfig = {
			...currentVcpConfig,
			...patch,
			contextFold: { ...currentVcpConfig.contextFold, ...(patch.contextFold ?? {}) },
			vcpInfo: { ...currentVcpConfig.vcpInfo, ...(patch.vcpInfo ?? {}) },
			html: { ...currentVcpConfig.html, ...(patch.html ?? {}) },
			toolRequest: { ...currentVcpConfig.toolRequest, ...(patch.toolRequest ?? {}) },
			agentTeam: { ...currentVcpConfig.agentTeam, ...(patch.agentTeam ?? {}) },
			memory: {
				...currentVcpConfig.memory,
				...(patch.memory ?? {}),
				passive: { ...currentVcpConfig.memory.passive, ...(patch.memory?.passive ?? {}) },
				writer: { ...currentVcpConfig.memory.writer, ...(patch.memory?.writer ?? {}) },
				retrieval: { ...currentVcpConfig.memory.retrieval, ...(patch.memory?.retrieval ?? {}) },
				refresh: { ...currentVcpConfig.memory.refresh, ...(patch.memory?.refresh ?? {}) },
			},
			toolbox: { ...currentVcpConfig.toolbox, ...(patch.toolbox ?? {}) },
		}

		setCachedStateField("vcpConfig", next)
	}

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
				<details open>
					<summary className="cursor-pointer font-medium mb-2">VCP 协议配置</summary>
					<div className="space-y-2">
						<VSCodeCheckbox
							checked={currentVcpConfig.enabled}
							onChange={(e: any) => updateVcpConfig({ enabled: e.target.checked === true })}>
							Enable VCP protocol
						</VSCodeCheckbox>
						<VSCodeCheckbox
							checked={currentVcpConfig.contextFold.enabled}
							onChange={(e: any) =>
								updateVcpConfig({
									contextFold: { enabled: e.target.checked === true },
								})
							}>
							Enable context fold parser
						</VSCodeCheckbox>
						<VSCodeDropdown
							value={currentVcpConfig.contextFold.style}
							onChange={(e: any) =>
								updateVcpConfig({
									contextFold: {
										style: (e.target as HTMLSelectElement).value as "details" | "comment",
									},
								})
							}>
							<VSCodeOption value="details">details</VSCodeOption>
							<VSCodeOption value="comment">comment</VSCodeOption>
						</VSCodeDropdown>
						<VSCodeTextField
							value={currentVcpConfig.contextFold.startMarker}
							onInput={(e: any) =>
								updateVcpConfig({
									contextFold: { startMarker: String(e.target.value || "") },
								})
							}>
							Context Fold Start Marker
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.contextFold.endMarker}
							onInput={(e: any) =>
								updateVcpConfig({
									contextFold: { endMarker: String(e.target.value || "") },
								})
							}>
							Context Fold End Marker
						</VSCodeTextField>
					</div>
				</details>
			</Section>

			<Section>
				<details>
					<summary className="cursor-pointer font-medium mb-2">Tool Request 与 Bridge</summary>
					<div className="space-y-2">
						<VSCodeCheckbox
							checked={currentVcpConfig.toolRequest.enabled}
							onChange={(e: any) =>
								updateVcpConfig({
									toolRequest: { enabled: e.target.checked === true },
								})
							}>
							Enable tool request parser
						</VSCodeCheckbox>
						<VSCodeDropdown
							value={currentVcpConfig.toolRequest.bridgeMode}
							onChange={(e: any) =>
								updateVcpConfig({
									toolRequest: {
										bridgeMode: (e.target as HTMLSelectElement).value as "execute" | "event",
									},
								})
							}>
							<VSCodeOption value="execute">execute</VSCodeOption>
							<VSCodeOption value="event">event</VSCodeOption>
						</VSCodeDropdown>
						<VSCodeTextField
							value={String(currentVcpConfig.toolRequest.maxPerMessage)}
							onInput={(e: any) => {
								const next = Number(e.target.value)
								if (Number.isFinite(next)) {
									updateVcpConfig({ toolRequest: { maxPerMessage: Math.max(1, Math.floor(next)) } })
								}
							}}>
							Max Tool Requests Per Message
						</VSCodeTextField>
						<VSCodeCheckbox
							checked={currentVcpConfig.toolbox.enabled}
							onChange={(e: any) =>
								updateVcpConfig({
									toolbox: { enabled: e.target.checked === true },
								})
							}>
							Enable VCPToolBox bridge
						</VSCodeCheckbox>
						<VSCodeTextField
							value={currentVcpConfig.toolbox.url}
							onInput={(e: any) =>
								updateVcpConfig({
									toolbox: { url: String(e.target.value || "") },
								})
							}>
							WebSocket URL
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.toolbox.key}
							type="password"
							onInput={(e: any) =>
								updateVcpConfig({
									toolbox: { key: String(e.target.value || "") },
								})
							}>
							Bridge Key
						</VSCodeTextField>
						<div className="text-xs text-vscode-descriptionForeground">
							Bridge: {vcpBridgeStatus?.connected ? "Connected" : "Disconnected"}
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								onClick={() => {
									vscode.postMessage({
										type: "updateVcpConfig",
										config: { toolbox: currentVcpConfig.toolbox },
									})
									vscode.postMessage({ type: "requestVcpBridgeConnect" })
								}}>
								Connect Bridge
							</Button>
							<Button onClick={() => vscode.postMessage({ type: "requestVcpBridgeDisconnect" })}>
								Disconnect Bridge
							</Button>
						</div>
					</div>
				</details>
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
