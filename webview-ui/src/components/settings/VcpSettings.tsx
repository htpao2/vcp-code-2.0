import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
	VSCodeCheckbox,
	VSCodeDropdown,
	VSCodeOption,
	VSCodeTextArea,
	VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react"
import {
	getDefaultVcpConfig,
	getDefaultVcpRuntimeConfig,
	type VcpBridgeLogEntry,
	type VcpBridgeTestResult,
	type VcpConfig,
	type VcpDistributedSkillRegistration,
	type VcpRuntimeConfig,
	type VcpRuntimeModelCatalogEntry,
} from "@roo-code/types"

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

type SettingsCardProps = {
	title: string
	description: string
	status?: boolean
	statusLabel?: string
	children?: ReactNode
}

const parseList = (value: string): string[] =>
	value
		.split(/[\n,]/g)
		.map((item) => item.trim())
		.filter((item) => item.length > 0)

const toInt = (value: string, min: number, fallback: number): number => {
	const next = Number(value)
	if (!Number.isFinite(next)) {
		return fallback
	}
	return Math.max(min, Math.floor(next))
}

const toFloat = (value: string, min: number, max: number, fallback: number): number => {
	const next = Number(value)
	if (!Number.isFinite(next)) {
		return fallback
	}
	return Math.min(max, Math.max(min, next))
}

const mergeRuntimeConfig = (current: VcpRuntimeConfig, patch?: DeepPartial<VcpRuntimeConfig>): VcpRuntimeConfig => ({
	...current,
	...(patch ?? {}),
	models: {
		...current.models,
		...(patch?.models ?? {}),
		default: { ...current.models.default, ...(patch?.models?.default ?? {}) },
		quick: { ...current.models.quick, ...(patch?.models?.quick ?? {}) },
		routes: { ...current.models.routes, ...(patch?.models?.routes ?? {}) },
		catalogCache: {
			...current.models.catalogCache,
			...(patch?.models?.catalogCache ?? {}),
			providers: {
				...current.models.catalogCache.providers,
				...((patch?.models?.catalogCache?.providers ??
					{}) as VcpRuntimeConfig["models"]["catalogCache"]["providers"]),
			},
		},
	},
	media: { ...current.media, ...(patch?.media ?? {}) },
	distributedSkills: {
		...current.distributedSkills,
		...(patch?.distributedSkills ?? {}),
		registrations: {
			...current.distributedSkills.registrations,
			...((patch?.distributedSkills?.registrations ??
				{}) as VcpRuntimeConfig["distributedSkills"]["registrations"]),
		},
	},
	preinstalledSkills: {
		...current.preinstalledSkills,
		...(patch?.preinstalledSkills ?? {}),
	},
})

const normalizeVcpConfig = (stored?: VcpConfig): VcpConfig => {
	const defaults = getDefaultVcpConfig()
	const runtimeDefaults = getDefaultVcpRuntimeConfig()

	return {
		...defaults,
		...(stored ?? {}),
		contextFold: { ...defaults.contextFold, ...(stored?.contextFold ?? {}) },
		vcpInfo: { ...defaults.vcpInfo, ...(stored?.vcpInfo ?? {}) },
		html: { ...defaults.html, ...(stored?.html ?? {}) },
		toolRequest: { ...defaults.toolRequest, ...(stored?.toolRequest ?? {}) },
		agentTeam: { ...defaults.agentTeam, ...(stored?.agentTeam ?? {}) },
		memory: {
			...defaults.memory,
			...(stored?.memory ?? {}),
			passive: { ...defaults.memory.passive, ...(stored?.memory?.passive ?? {}) },
			writer: { ...defaults.memory.writer, ...(stored?.memory?.writer ?? {}) },
			retrieval: { ...defaults.memory.retrieval, ...(stored?.memory?.retrieval ?? {}) },
			refresh: { ...defaults.memory.refresh, ...(stored?.memory?.refresh ?? {}) },
		},
		toolbox: { ...defaults.toolbox, ...(stored?.toolbox ?? {}) },
		snowCompat: {
			...defaults.snowCompat,
			...(stored?.snowCompat ?? {}),
			responsesReasoning: {
				...defaults.snowCompat.responsesReasoning,
				...(stored?.snowCompat?.responsesReasoning ?? {}),
			},
			proxy: {
				...defaults.snowCompat.proxy,
				...(stored?.snowCompat?.proxy ?? {}),
			},
		},
		runtime: mergeRuntimeConfig(runtimeDefaults, stored?.runtime),
	}
}

const mergeVcpConfig = (current: VcpConfig, patch: DeepPartial<VcpConfig>): VcpConfig => {
	const normalized = normalizeVcpConfig(current)

	return {
		...normalized,
		...patch,
		contextFold: { ...normalized.contextFold, ...(patch.contextFold ?? {}) },
		vcpInfo: { ...normalized.vcpInfo, ...(patch.vcpInfo ?? {}) },
		html: { ...normalized.html, ...(patch.html ?? {}) },
		toolRequest: { ...normalized.toolRequest, ...(patch.toolRequest ?? {}) },
		agentTeam: { ...normalized.agentTeam, ...(patch.agentTeam ?? {}) },
		memory: {
			...normalized.memory,
			...(patch.memory ?? {}),
			passive: { ...normalized.memory.passive, ...(patch.memory?.passive ?? {}) },
			writer: { ...normalized.memory.writer, ...(patch.memory?.writer ?? {}) },
			retrieval: { ...normalized.memory.retrieval, ...(patch.memory?.retrieval ?? {}) },
			refresh: { ...normalized.memory.refresh, ...(patch.memory?.refresh ?? {}) },
		},
		toolbox: { ...normalized.toolbox, ...(patch.toolbox ?? {}) },
		snowCompat: {
			...normalized.snowCompat,
			...(patch.snowCompat ?? {}),
			responsesReasoning: {
				...normalized.snowCompat.responsesReasoning,
				...(patch.snowCompat?.responsesReasoning ?? {}),
			},
			proxy: {
				...normalized.snowCompat.proxy,
				...(patch.snowCompat?.proxy ?? {}),
			},
		},
		runtime: patch.runtime ? mergeRuntimeConfig(normalized.runtime!, patch.runtime) : normalized.runtime,
	}
}

const StatusDot = ({ active, label }: { active: boolean; label: string }) => (
	<span className="inline-flex items-center gap-1.5 text-xs text-vscode-descriptionForeground">
		<span
			className="inline-block h-2 w-2 rounded-full"
			style={{
				background: active
					? "var(--vscode-testing-iconPassed, #4ec9b0)"
					: "var(--vscode-disabledForeground, #6e7681)",
			}}
		/>
		<span>{label}</span>
	</span>
)

const SettingsCard = ({ title, description, status, statusLabel, children }: SettingsCardProps) => (
	<div
		className="rounded-lg p-4"
		style={{
			background: "var(--vscode-editorWidget-background)",
			border: "1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border))",
		}}>
		<div className="font-medium text-vscode-foreground">{title}</div>
		{status !== undefined && (
			<div className="mt-1">
				<StatusDot active={status} label={statusLabel ?? (status ? "已启用" : "已关闭")} />
			</div>
		)}
		<div className="mt-1 text-xs text-vscode-descriptionForeground">{description}</div>
		{children && <div className="mt-3">{children}</div>}
	</div>
)

const LabeledRow = ({ label, children }: { label: string; children: ReactNode }) => (
	<div className="space-y-1">
		<div className="text-xs font-medium text-vscode-descriptionForeground">{label}</div>
		{children}
	</div>
)

const FieldGrid = ({ children, columns = 1 }: { children: ReactNode; columns?: 1 | 2 }) => (
	<div className={columns === 2 ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "space-y-3"}>{children}</div>
)

const CollapsibleSection = ({
	title,
	description,
	defaultOpen = false,
	children,
}: {
	title: string
	description: string
	defaultOpen?: boolean
	children: ReactNode
}) => (
	<Section>
		<details open={defaultOpen || undefined}>
			<summary className="cursor-pointer select-none text-sm font-semibold text-vscode-foreground">
				{title}
			</summary>
			<div className="mt-2 text-xs text-vscode-descriptionForeground">{description}</div>
			<div className="mt-3 space-y-3">{children}</div>
		</details>
	</Section>
)

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
	const currentVcpConfig = useMemo(() => normalizeVcpConfig(vcpConfig), [vcpConfig])
	const runtime = currentVcpConfig.runtime ?? getDefaultVcpRuntimeConfig()

	const [bridgeLogs, setBridgeLogs] = useState<VcpBridgeLogEntry[]>([])
	const [bridgeTestResult, setBridgeTestResult] = useState<VcpBridgeTestResult | undefined>(undefined)
	const [isTestingBridge, setIsTestingBridge] = useState(false)
	const [runtimeModels, setRuntimeModels] = useState<VcpRuntimeModelCatalogEntry[]>([])
	const [isLoadingModels, setIsLoadingModels] = useState(false)

	const updateVcpConfig = useCallback(
		(patch: DeepPartial<VcpConfig>) => {
			setCachedStateField("vcpConfig", mergeVcpConfig(currentVcpConfig, patch))
		},
		[currentVcpConfig, setCachedStateField],
	)

	const updateRuntime = useCallback(
		(patch: DeepPartial<VcpRuntimeConfig>) => {
			updateVcpConfig({ runtime: patch as any })
		},
		[updateVcpConfig],
	)

	const fetchProviderModels = useCallback((refresh: boolean) => {
		setIsLoadingModels(true)
		vscode.postMessage({ type: refresh ? "refreshRuntimeProviderModels" : "fetchRuntimeProviderModels" })
	}, [])

	const applyRuntimeModel = useCallback(
		(target: "default" | "quick", model: VcpRuntimeModelCatalogEntry) => {
			updateRuntime({
				models: {
					[target]: {
						modelId: model.id,
						displayName: model.displayName || model.id,
						providerId: model.owned_by ?? runtime.models[target].providerId,
					},
				},
			})
		},
		[runtime.models, updateRuntime],
	)

	const distributedRegistrations = useMemo(
		() =>
			Object.values(runtime.distributedSkills.registrations).sort((a, b) =>
				a.canonicalName.localeCompare(b.canonicalName),
			),
		[runtime.distributedSkills.registrations],
	)

	const movedSettings = useMemo(
		() => [
			{
				label: "YOLO 审批",
				status: !!yoloMode,
				statusLabel: yoloMode ? "已启用" : "已关闭",
				target: "请前往“自动批准/代理行为”页面调整。",
			},
			{
				label: "自动批准快捷菜单",
				status: showAutoApproveMenu ?? true,
				statusLabel: (showAutoApproveMenu ?? true) ? "显示" : "隐藏",
				target: "请前往“自动批准”页面调整。",
			},
			{
				label: "浏览器工具",
				status: browserToolEnabled ?? true,
				statusLabel: (browserToolEnabled ?? true) ? "已启用" : "已关闭",
				target: remoteBrowserEnabled ? "当前已启用远程浏览器模式。" : "请前往“浏览器”相关页面调整。",
			},
			{
				label: "自动补全",
				status: !!(
					ghostServiceSettings?.enableAutoTrigger ||
					ghostServiceSettings?.enableSmartInlineTaskKeybinding ||
					ghostServiceSettings?.enableChatAutocomplete
				),
				statusLabel:
					ghostServiceSettings?.enableAutoTrigger ||
					ghostServiceSettings?.enableSmartInlineTaskKeybinding ||
					ghostServiceSettings?.enableChatAutocomplete
						? "已配置"
						: "未配置",
				target: "请前往“自动补全”页面调整。",
			},
		],
		[
			browserToolEnabled,
			ghostServiceSettings?.enableAutoTrigger,
			ghostServiceSettings?.enableChatAutocomplete,
			ghostServiceSettings?.enableSmartInlineTaskKeybinding,
			remoteBrowserEnabled,
			showAutoApproveMenu,
			yoloMode,
		],
	)

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "vcpBridgeLog") {
				const entries = (message.vcpBridgeLogEntries ?? message.entries ?? []) as VcpBridgeLogEntry[]
				if (entries.length > 0) {
					setBridgeLogs((prev) => [...prev, ...entries].slice(-100))
				}
				return
			}

			if (message.type === "vcpBridgeTestResult") {
				setIsTestingBridge(false)
				setBridgeTestResult(message.vcpBridgeTestResult)
				return
			}

			if (message.type === "runtimeProviderModels") {
				setIsLoadingModels(false)
				setRuntimeModels((message.runtimeProviderModels ?? []) as VcpRuntimeModelCatalogEntry[])
			}
		}

		window.addEventListener("message", handleMessage)
		vscode.postMessage({ type: "bootstrapPreinstalledSkills" })
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	void setAutocompleteServiceSettingsField

	return (
		<div className="space-y-1">
			<SectionHeader description="VCP 协议、桥接和运行时能力统一配置，重复设置已迁移到更合适的页面。">
				VCP
			</SectionHeader>

			<Section>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{movedSettings.map((item) => (
						<SettingsCard
							key={item.label}
							title={item.label}
							status={item.status}
							statusLabel={item.statusLabel}
							description={item.target}
						/>
					))}
				</div>
			</Section>

			<CollapsibleSection
				title="协议与渲染"
				description="控制 VCP 协议开关、上下文折叠、VCPInfo 标记以及 HTML 渲染。"
				defaultOpen>
				<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
					<VSCodeCheckbox
						checked={currentVcpConfig.enabled}
						onChange={(e: any) => updateVcpConfig({ enabled: e.target.checked === true })}
						data-testid="vcp-enabled-checkbox">
						启用 VCP 协议
					</VSCodeCheckbox>
					<VSCodeCheckbox
						checked={currentVcpConfig.contextFold.enabled}
						onChange={(e: any) => updateVcpConfig({ contextFold: { enabled: e.target.checked === true } })}
						data-testid="vcp-context-fold-enabled-checkbox">
						启用上下文折叠
					</VSCodeCheckbox>
					<VSCodeCheckbox
						checked={currentVcpConfig.vcpInfo.enabled}
						onChange={(e: any) => updateVcpConfig({ vcpInfo: { enabled: e.target.checked === true } })}
						data-testid="vcp-vcpinfo-enabled-checkbox">
						启用 VCPInfo 标记
					</VSCodeCheckbox>
					<VSCodeCheckbox
						checked={currentVcpConfig.html.enabled}
						onChange={(e: any) => updateVcpConfig({ html: { enabled: e.target.checked === true } })}
						data-testid="vcp-html-enabled-checkbox">
						启用 HTML 渲染
					</VSCodeCheckbox>
				</div>

				<FieldGrid columns={2}>
					<LabeledRow label="上下文折叠样式">
						<VSCodeDropdown
							value={currentVcpConfig.contextFold.style}
							onChange={(e: any) =>
								updateVcpConfig({
									contextFold: {
										style: (e.target as HTMLSelectElement).value as "details" | "comment",
									},
								})
							}
							data-testid="vcp-context-fold-style-dropdown">
							<VSCodeOption value="details">details</VSCodeOption>
							<VSCodeOption value="comment">comment</VSCodeOption>
						</VSCodeDropdown>
					</LabeledRow>
					<LabeledRow label="折叠起始标记">
						<VSCodeTextField
							value={currentVcpConfig.contextFold.startMarker}
							onInput={(e: any) =>
								updateVcpConfig({ contextFold: { startMarker: String(e.target.value || "") } })
							}
							data-testid="vcp-context-fold-start-marker-input"
						/>
					</LabeledRow>
					<LabeledRow label="折叠结束标记">
						<VSCodeTextField
							value={currentVcpConfig.contextFold.endMarker}
							onInput={(e: any) =>
								updateVcpConfig({ contextFold: { endMarker: String(e.target.value || "") } })
							}
							data-testid="vcp-context-fold-end-marker-input"
						/>
					</LabeledRow>
					<LabeledRow label="VCPInfo 起始标记">
						<VSCodeTextField
							value={currentVcpConfig.vcpInfo.startMarker}
							onInput={(e: any) =>
								updateVcpConfig({ vcpInfo: { startMarker: String(e.target.value || "") } })
							}
							data-testid="vcp-vcpinfo-start-marker-input"
						/>
					</LabeledRow>
					<LabeledRow label="VCPInfo 结束标记">
						<VSCodeTextField
							value={currentVcpConfig.vcpInfo.endMarker}
							onInput={(e: any) =>
								updateVcpConfig({ vcpInfo: { endMarker: String(e.target.value || "") } })
							}
							data-testid="vcp-vcpinfo-end-marker-input"
						/>
					</LabeledRow>
				</FieldGrid>
			</CollapsibleSection>

			<CollapsibleSection title="Tool Request" description="维护工具请求块的桥接模式、白名单和黑名单。">
				<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
					<VSCodeCheckbox
						checked={currentVcpConfig.toolRequest.enabled}
						onChange={(e: any) => updateVcpConfig({ toolRequest: { enabled: e.target.checked === true } })}>
						启用 Tool Request
					</VSCodeCheckbox>
					<VSCodeCheckbox
						checked={currentVcpConfig.toolRequest.keepBlockInText}
						onChange={(e: any) =>
							updateVcpConfig({ toolRequest: { keepBlockInText: e.target.checked === true } })
						}>
						保留工具块文本
					</VSCodeCheckbox>
				</div>

				<FieldGrid columns={2}>
					<LabeledRow label="桥接模式">
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
					</LabeledRow>
					<LabeledRow label="单条消息最大工具数">
						<VSCodeTextField
							value={String(currentVcpConfig.toolRequest.maxPerMessage)}
							onInput={(e: any) =>
								updateVcpConfig({
									toolRequest: {
										maxPerMessage: toInt(
											String(e.target.value ?? ""),
											1,
											currentVcpConfig.toolRequest.maxPerMessage,
										),
									},
								})
							}
						/>
					</LabeledRow>
					<LabeledRow label="允许工具列表">
						<VSCodeTextArea
							value={currentVcpConfig.toolRequest.allowTools.join("\n")}
							onInput={(e: any) =>
								updateVcpConfig({
									toolRequest: { allowTools: parseList(String(e.target.value || "")) },
								})
							}
							data-testid="vcp-tool-request-allow-tools-input"
						/>
					</LabeledRow>
					<LabeledRow label="拒绝工具列表">
						<VSCodeTextArea
							value={currentVcpConfig.toolRequest.denyTools.join("\n")}
							onInput={(e: any) =>
								updateVcpConfig({ toolRequest: { denyTools: parseList(String(e.target.value || "")) } })
							}
							data-testid="vcp-tool-request-deny-tools-input"
						/>
					</LabeledRow>
				</FieldGrid>
			</CollapsibleSection>

			<CollapsibleSection
				title="VCP ToolBox Bridge"
				description="连接 VCPToolBox WebSocket，桥接分布式插件、日志和状态。"
				defaultOpen>
				<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
					<VSCodeCheckbox
						checked={currentVcpConfig.toolbox.enabled}
						onChange={(e: any) => updateVcpConfig({ toolbox: { enabled: e.target.checked === true } })}
						data-testid="vcp-toolbox-enabled-checkbox">
						启用 ToolBox Bridge
					</VSCodeCheckbox>
					<StatusDot
						active={vcpBridgeStatus?.connected === true}
						label={vcpBridgeStatus?.connected ? "Bridge 在线" : "Bridge 离线"}
					/>
				</div>

				<FieldGrid columns={2}>
					<LabeledRow label="Bridge URL">
						<VSCodeTextField
							value={currentVcpConfig.toolbox.url}
							onInput={(e: any) => updateVcpConfig({ toolbox: { url: String(e.target.value || "") } })}
							data-testid="vcp-toolbox-url-input"
						/>
					</LabeledRow>
					<LabeledRow label="Bridge Key">
						<VSCodeTextField
							value={currentVcpConfig.toolbox.key}
							onInput={(e: any) => updateVcpConfig({ toolbox: { key: String(e.target.value || "") } })}
							data-testid="vcp-toolbox-key-input"
						/>
					</LabeledRow>
					<LabeledRow label="重连间隔（毫秒）">
						<VSCodeTextField
							value={String(currentVcpConfig.toolbox.reconnectInterval)}
							onInput={(e: any) =>
								updateVcpConfig({
									toolbox: {
										reconnectInterval: toInt(
											String(e.target.value ?? ""),
											250,
											currentVcpConfig.toolbox.reconnectInterval,
										),
									},
								})
							}
							data-testid="vcp-toolbox-reconnect-interval-input"
						/>
					</LabeledRow>
				</FieldGrid>

				<div className="flex flex-wrap gap-2">
					<Button
						onClick={() => {
							vscode.postMessage({
								type: "updateVcpConfig",
								config: { toolbox: currentVcpConfig.toolbox },
							})
							vscode.postMessage({ type: "requestVcpBridgeConnect" })
						}}
						data-testid="vcp-toolbox-connect-button">
						连接
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							setIsTestingBridge(true)
							vscode.postMessage({
								type: "updateVcpConfig",
								config: { toolbox: currentVcpConfig.toolbox },
							})
							vscode.postMessage({ type: "requestVcpBridgeTest" })
						}}
						data-testid="vcp-toolbox-test-button">
						{isTestingBridge ? "测试中..." : "测试连接"}
					</Button>
					<Button
						variant="secondary"
						onClick={() => vscode.postMessage({ type: "requestVcpBridgeDisconnect" })}
						data-testid="vcp-toolbox-disconnect-button">
						断开
					</Button>
				</div>

				{bridgeTestResult && (
					<div
						className="rounded p-2 text-xs"
						style={{
							background: bridgeTestResult.success
								? "var(--vscode-testing-iconPassed)"
								: "var(--vscode-inputValidation-errorBackground)",
							color: "var(--vscode-editor-foreground)",
							opacity: 0.85,
						}}>
						{bridgeTestResult.success
							? `测试成功，延迟 ${bridgeTestResult.latencyMs ?? 0}ms`
							: `测试失败：${bridgeTestResult.error ?? "未知错误"}`}
						{bridgeTestResult.endpoint ? ` | ${bridgeTestResult.endpoint}` : ""}
					</div>
				)}

				{bridgeLogs.length > 0 && (
					<details>
						<summary className="cursor-pointer text-xs font-medium text-vscode-descriptionForeground">
							Bridge 日志（{bridgeLogs.length}）
						</summary>
						<div
							className="mt-1 max-h-32 overflow-y-auto rounded p-2 text-xs"
							style={{
								background: "var(--vscode-textCodeBlock-background)",
								border: "1px solid var(--vscode-editorWidget-border)",
							}}>
							{bridgeLogs
								.slice()
								.reverse()
								.map((entry, index) => (
									<div key={`${entry.timestamp}-${index}`} className="mb-0.5">
										<span className="opacity-60">
											[{new Date(entry.timestamp).toLocaleTimeString()}]
										</span>{" "}
										<span className="font-medium">{entry.level.toUpperCase()}</span> {entry.message}
									</div>
								))}
						</div>
					</details>
				)}
			</CollapsibleSection>

			<CollapsibleSection
				title="运行时模型"
				description="区分默认模型和快速模型，并为自动补全、YOLO 审批、文件切片、上下文压缩设置路由。"
				defaultOpen>
				<FieldGrid columns={2}>
					<LabeledRow label="默认模型（主对话 / 工作模型）">
						<VSCodeTextField
							value={runtime.models.default.modelId}
							onInput={(e: any) =>
								updateRuntime({ models: { default: { modelId: String(e.target.value || "") } } })
							}
							data-testid="vcp-runtime-default-model-input"
						/>
					</LabeledRow>
					<LabeledRow label="快速模型（补全 / YOLO / 轻任务）">
						<VSCodeTextField
							value={runtime.models.quick.modelId}
							onInput={(e: any) =>
								updateRuntime({ models: { quick: { modelId: String(e.target.value || "") } } })
							}
							data-testid="vcp-runtime-quick-model-input"
						/>
					</LabeledRow>
				</FieldGrid>

				<div className="text-xs font-medium text-vscode-descriptionForeground">任务路由</div>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{(
						[
							["autocomplete", "自动补全"],
							["yoloGatekeeper", "YOLO 审批"],
							["fileSlice", "文件切片"],
							["contextCondense", "上下文压缩"],
						] as const
					).map(([key, label]) => (
						<LabeledRow key={key} label={label}>
							<VSCodeDropdown
								value={runtime.models.routes[key]}
								onChange={(e: any) =>
									updateRuntime({
										models: {
											routes: {
												[key]: (e.target as HTMLSelectElement).value as "default" | "quick",
											},
										},
									})
								}
								data-testid={`vcp-runtime-route-${key}-dropdown`}>
								<VSCodeOption value="default">默认模型</VSCodeOption>
								<VSCodeOption value="quick">快速模型</VSCodeOption>
							</VSCodeDropdown>
						</LabeledRow>
					))}
				</div>

				<div className="flex flex-wrap gap-2">
					<Button variant="secondary" onClick={() => fetchProviderModels(false)} disabled={isLoadingModels}>
						{isLoadingModels ? "加载中..." : "拉取当前 Provider 模型列表"}
					</Button>
					<Button variant="secondary" onClick={() => fetchProviderModels(true)} disabled={isLoadingModels}>
						强制刷新
					</Button>
				</div>

				{runtimeModels.length > 0 && (
					<div
						className="max-h-40 space-y-1 overflow-y-auto rounded p-2 text-xs"
						style={{
							background: "var(--vscode-textCodeBlock-background)",
							border: "1px solid var(--vscode-editorWidget-border)",
						}}>
						{runtimeModels.map((model) => (
							<div
								key={model.id}
								className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-[var(--vscode-list-hoverBackground)]">
								<div className="min-w-0 flex-1">
									<div className="truncate text-vscode-foreground">
										{model.displayName || model.id}
									</div>
									<div className="truncate text-vscode-descriptionForeground">{model.id}</div>
								</div>
								<div className="flex shrink-0 gap-1">
									<Button
										variant="secondary"
										size="sm"
										onClick={() => applyRuntimeModel("default", model)}>
										设为默认
									</Button>
									<Button
										variant="secondary"
										size="sm"
										onClick={() => applyRuntimeModel("quick", model)}>
										设为快速
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</CollapsibleSection>

			<CollapsibleSection
				title="多媒体发送通道"
				description="控制 VCP 媒体通道，用于转发本地或远程图源，而不是内置静态表情包。">
				<VSCodeCheckbox
					checked={runtime.media.enabled}
					onChange={(e: any) => updateRuntime({ media: { enabled: e.target.checked === true } })}
					data-testid="vcp-runtime-media-enabled-checkbox">
					启用多媒体发送通道
				</VSCodeCheckbox>

				<FieldGrid columns={2}>
					<LabeledRow label="最大资源大小（字节）">
						<VSCodeTextField
							value={String(runtime.media.maxAssetBytes)}
							onInput={(e: any) =>
								updateRuntime({
									media: {
										maxAssetBytes: toInt(
											String(e.target.value ?? ""),
											0,
											runtime.media.maxAssetBytes,
										),
									},
								})
							}
							data-testid="vcp-runtime-media-max-bytes-input"
						/>
					</LabeledRow>
					<LabeledRow label="允许的协议（逗号或换行分隔）">
						<VSCodeTextField
							value={runtime.media.allowedSchemes.join(", ")}
							onInput={(e: any) =>
								updateRuntime({
									media: {
										allowedSchemes: parseList(String(e.target.value || "")),
									},
								})
							}
							data-testid="vcp-runtime-media-schemes-input"
						/>
					</LabeledRow>
				</FieldGrid>
			</CollapsibleSection>

			<CollapsibleSection title="Snow Compat" description="保留对外部 Snow 风格服务的兼容配置。">
				<VSCodeCheckbox
					checked={currentVcpConfig.snowCompat.enabled}
					onChange={(e: any) => updateVcpConfig({ snowCompat: { enabled: e.target.checked === true } })}
					data-testid="vcp-snow-compat-enabled-checkbox">
					启用 Snow Compat
				</VSCodeCheckbox>

				<FieldGrid columns={2}>
					<LabeledRow label="基础模型">
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.basicModel}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { basicModel: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-basic-model-input"
						/>
					</LabeledRow>
					<LabeledRow label="高级模型">
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.advancedModel}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { advancedModel: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-advanced-model-input"
						/>
					</LabeledRow>
					<LabeledRow label="Base URL">
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.baseUrl}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { baseUrl: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-base-url-input"
						/>
					</LabeledRow>
					<LabeledRow label="请求方法">
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.requestMethod}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { requestMethod: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-request-method-input"
						/>
					</LabeledRow>
					<LabeledRow label="最大上下文 Tokens">
						<VSCodeTextField
							value={String(currentVcpConfig.snowCompat.maxContextTokens)}
							onInput={(e: any) =>
								updateVcpConfig({
									snowCompat: {
										maxContextTokens: toInt(
											String(e.target.value ?? ""),
											0,
											currentVcpConfig.snowCompat.maxContextTokens,
										),
									},
								})
							}
							data-testid="vcp-snow-compat-max-context-tokens-input"
						/>
					</LabeledRow>
					<LabeledRow label="最大输出 Tokens">
						<VSCodeTextField
							value={String(currentVcpConfig.snowCompat.maxTokens)}
							onInput={(e: any) =>
								updateVcpConfig({
									snowCompat: {
										maxTokens: toInt(
											String(e.target.value ?? ""),
											1,
											currentVcpConfig.snowCompat.maxTokens,
										),
									},
								})
							}
							data-testid="vcp-snow-compat-max-tokens-input"
						/>
					</LabeledRow>
					<LabeledRow label="工具结果 Token 限制">
						<VSCodeTextField
							value={String(currentVcpConfig.snowCompat.toolResultTokenLimit)}
							onInput={(e: any) =>
								updateVcpConfig({
									snowCompat: {
										toolResultTokenLimit: toInt(
											String(e.target.value ?? ""),
											1,
											currentVcpConfig.snowCompat.toolResultTokenLimit,
										),
									},
								})
							}
							data-testid="vcp-snow-compat-tool-result-token-limit-input"
						/>
					</LabeledRow>
					<LabeledRow label="编辑相似度阈值">
						<VSCodeTextField
							value={String(currentVcpConfig.snowCompat.editSimilarityThreshold)}
							onInput={(e: any) =>
								updateVcpConfig({
									snowCompat: {
										editSimilarityThreshold: toFloat(
											String(e.target.value ?? ""),
											0,
											1,
											currentVcpConfig.snowCompat.editSimilarityThreshold,
										),
									},
								})
							}
							data-testid="vcp-snow-compat-edit-similarity-threshold-input"
						/>
					</LabeledRow>
					<LabeledRow label="Anthropic Beta">
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.anthropicBeta}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { anthropicBeta: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-anthropic-beta-input"
						/>
					</LabeledRow>
					<LabeledRow label="Anthropic Cache TTL">
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.anthropicCacheTTL}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { anthropicCacheTTL: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-anthropic-cache-ttl-input"
						/>
					</LabeledRow>
				</FieldGrid>

				<FieldGrid columns={2}>
					<LabeledRow label="Reasoning Effort">
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.responsesReasoning.effort}
							onInput={(e: any) =>
								updateVcpConfig({
									snowCompat: {
										responsesReasoning: { effort: String(e.target.value || "") },
									},
								})
							}
							data-testid="vcp-snow-compat-reasoning-effort-input"
						/>
					</LabeledRow>
					<LabeledRow label="代理端口">
						<VSCodeTextField
							value={String(currentVcpConfig.snowCompat.proxy.port)}
							onInput={(e: any) =>
								updateVcpConfig({
									snowCompat: {
										proxy: {
											port: toInt(
												String(e.target.value ?? ""),
												1,
												currentVcpConfig.snowCompat.proxy.port,
											),
										},
									},
								})
							}
							data-testid="vcp-snow-compat-proxy-port-input"
						/>
					</LabeledRow>
					<LabeledRow label="浏览器调试端口">
						<VSCodeTextField
							value={String(currentVcpConfig.snowCompat.proxy.browserDebugPort)}
							onInput={(e: any) =>
								updateVcpConfig({
									snowCompat: {
										proxy: {
											browserDebugPort: toInt(
												String(e.target.value ?? ""),
												1,
												currentVcpConfig.snowCompat.proxy.browserDebugPort,
											),
										},
									},
								})
							}
							data-testid="vcp-snow-compat-proxy-browser-debug-port-input"
						/>
					</LabeledRow>
				</FieldGrid>

				<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
					<VSCodeCheckbox
						checked={currentVcpConfig.snowCompat.showThinking}
						onChange={(e: any) =>
							updateVcpConfig({ snowCompat: { showThinking: e.target.checked === true } })
						}
						data-testid="vcp-snow-compat-show-thinking-checkbox">
						显示思考过程
					</VSCodeCheckbox>
					<VSCodeCheckbox
						checked={currentVcpConfig.snowCompat.enableAutoCompress}
						onChange={(e: any) =>
							updateVcpConfig({ snowCompat: { enableAutoCompress: e.target.checked === true } })
						}
						data-testid="vcp-snow-compat-auto-compress-checkbox">
						启用自动压缩
					</VSCodeCheckbox>
					<VSCodeCheckbox
						checked={currentVcpConfig.snowCompat.responsesReasoning.enabled}
						onChange={(e: any) =>
							updateVcpConfig({
								snowCompat: {
									responsesReasoning: { enabled: e.target.checked === true },
								},
							})
						}
						data-testid="vcp-snow-compat-reasoning-enabled-checkbox">
						启用 Responses Reasoning
					</VSCodeCheckbox>
					<VSCodeCheckbox
						checked={currentVcpConfig.snowCompat.proxy.enabled}
						onChange={(e: any) =>
							updateVcpConfig({ snowCompat: { proxy: { enabled: e.target.checked === true } } })
						}
						data-testid="vcp-snow-compat-proxy-enabled-checkbox">
						启用代理模式
					</VSCodeCheckbox>
				</div>
			</CollapsibleSection>

			<CollapsibleSection title="运行时概览" description="查看分布式技能注册和预装技能清单。">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<SettingsCard
						title="Agent Team"
						status={currentVcpConfig.agentTeam.enabled}
						statusLabel={`${currentVcpConfig.agentTeam.enabled ? "已启用" : "未启用"}，${currentVcpConfig.agentTeam.members.length} 位成员`}
						description="成员编排、波次策略和文件隔离规则已迁移到“代理行为”页面统一管理。"
					/>
					<SettingsCard
						title="记忆系统"
						status={
							currentVcpConfig.memory.passive.enabled ||
							currentVcpConfig.memory.writer.enabled ||
							currentVcpConfig.memory.retrieval.enabled
						}
						statusLabel={`Passive ${currentVcpConfig.memory.passive.enabled ? "开" : "关"} / Writer ${currentVcpConfig.memory.writer.enabled ? "开" : "关"} / Retrieval ${currentVcpConfig.memory.retrieval.enabled ? "开" : "关"}`}
						description="被动记忆、写入记忆、检索记忆与刷新调度已迁移到“上下文管理”页面。"
					/>
				</div>

				<SettingsCard
					title="分布式技能"
					description="展示 Skills -> VCPToolBox 的注册状态，可通过重新同步刷新。">
					<div className="flex flex-wrap gap-2">
						<Button
							variant="secondary"
							onClick={() => vscode.postMessage({ type: "bootstrapPreinstalledSkills" })}>
							同步预装技能清单
						</Button>
					</div>
					<div className="mt-3 space-y-2 text-xs">
						{distributedRegistrations.length === 0 ? (
							<div className="text-vscode-descriptionForeground">当前还没有已登记的分布式技能。</div>
						) : (
							distributedRegistrations.map((registration: VcpDistributedSkillRegistration) => (
								<div
									key={registration.canonicalName}
									className="rounded border border-vscode-panel-border px-2 py-1">
									<div className="font-medium text-vscode-foreground">
										{registration.canonicalName}
									</div>
									<div className="text-vscode-descriptionForeground">
										状态：{registration.status}
										{registration.sourceScope ? ` | 来源：${registration.sourceScope}` : ""}
										{registration.error ? ` | 错误：${registration.error}` : ""}
									</div>
								</div>
							))
						)}
					</div>
				</SettingsCard>

				<SettingsCard
					title="预装 Skills"
					description={`manifest ${runtime.preinstalledSkills.manifestVersion}，用于初始化全局和工作区预装技能。`}>
					<div className="space-y-2 text-xs text-vscode-descriptionForeground">
						<div>Global: {runtime.preinstalledSkills.globalSkills.join(", ") || "无"}</div>
						<div>Workspace: {runtime.preinstalledSkills.workspaceSkills.join(", ") || "无"}</div>
						<div>Internal: {runtime.preinstalledSkills.internalOnly.join(", ") || "无"}</div>
					</div>
				</SettingsCard>
			</CollapsibleSection>
		</div>
	)
}
