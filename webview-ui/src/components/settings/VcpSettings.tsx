import { useEffect, useState } from "react"
import {
	VSCodeCheckbox,
	VSCodeDropdown,
	VSCodeLink,
	VSCodeOption,
	VSCodeTextArea,
	VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react"
import { getDefaultVcpConfig, type VcpBridgeLogEntry, type VcpBridgeTestResult, type VcpConfig } from "@roo-code/types"

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
	const defaults = getDefaultVcpConfig()
	const currentVcpConfig: VcpConfig = {
		...defaults,
		...(vcpConfig ?? {}),
		contextFold: { ...defaults.contextFold, ...(vcpConfig?.contextFold ?? {}) },
		vcpInfo: { ...defaults.vcpInfo, ...(vcpConfig?.vcpInfo ?? {}) },
		html: { ...defaults.html, ...(vcpConfig?.html ?? {}) },
		toolRequest: { ...defaults.toolRequest, ...(vcpConfig?.toolRequest ?? {}) },
		agentTeam: { ...defaults.agentTeam, ...(vcpConfig?.agentTeam ?? {}) },
		memory: {
			...defaults.memory,
			...(vcpConfig?.memory ?? {}),
			passive: { ...defaults.memory.passive, ...(vcpConfig?.memory?.passive ?? {}) },
			writer: { ...defaults.memory.writer, ...(vcpConfig?.memory?.writer ?? {}) },
			retrieval: { ...defaults.memory.retrieval, ...(vcpConfig?.memory?.retrieval ?? {}) },
			refresh: { ...defaults.memory.refresh, ...(vcpConfig?.memory?.refresh ?? {}) },
		},
		toolbox: { ...defaults.toolbox, ...(vcpConfig?.toolbox ?? {}) },
		snowCompat: {
			...defaults.snowCompat,
			...(vcpConfig?.snowCompat ?? {}),
			responsesReasoning: {
				...defaults.snowCompat.responsesReasoning,
				...(vcpConfig?.snowCompat?.responsesReasoning ?? {}),
			},
			proxy: {
				...defaults.snowCompat.proxy,
				...(vcpConfig?.snowCompat?.proxy ?? {}),
			},
		},
	}
	const [bridgeLogs, setBridgeLogs] = useState<VcpBridgeLogEntry[]>([])
	const [bridgeTestResult, setBridgeTestResult] = useState<VcpBridgeTestResult | undefined>(undefined)
	const [isTestingBridge, setIsTestingBridge] = useState(false)

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
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

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
			snowCompat: {
				...currentVcpConfig.snowCompat,
				...(patch.snowCompat ?? {}),
				responsesReasoning: {
					...currentVcpConfig.snowCompat.responsesReasoning,
					...(patch.snowCompat?.responsesReasoning ?? {}),
				},
				proxy: {
					...currentVcpConfig.snowCompat.proxy,
					...(patch.snowCompat?.proxy ?? {}),
				},
			},
		}

		setCachedStateField("vcpConfig", next)
	}

	const movedSettings = [
		{
			label: "YOLO 路由",
			value: yoloMode ? "已启用" : "已关闭",
			target: "请前往“自动批准/代理行为”页面调整",
		},
		{
			label: "自动批准快捷菜单",
			value: (showAutoApproveMenu ?? true) ? "显示" : "隐藏",
			target: "请前往“自动批准”页面调整",
		},
		{
			label: "浏览器工具",
			value: (browserToolEnabled ?? true) ? "已启用" : "已关闭",
			target: remoteBrowserEnabled ? "当前已启用远程浏览器模式" : "请前往“浏览器”相关设置调整",
		},
		{
			label: "自动补全",
			value:
				ghostServiceSettings?.enableAutoTrigger ||
				ghostServiceSettings?.enableSmartInlineTaskKeybinding ||
				ghostServiceSettings?.enableChatAutocomplete
					? "已配置"
					: "未配置",
			target: "请前往“自动补全”页面调整",
		},
	]
	void setAutocompleteServiceSettingsField

	return (
		<div className="space-y-3">
			<SectionHeader description="统一管理 VCP 协议、桥接通道与兼容层，重复开关已迁移到专门页面。">
				VCP
			</SectionHeader>
			<Section>
				<div className="rounded border border-vscode-panel-border bg-[var(--vscode-editorWidget-background)] p-3">
					<div className="font-medium text-vscode-foreground">重复设置已迁移</div>
					<div className="mt-1 text-sm text-vscode-descriptionForeground">
						YOLO、自动批准、浏览器模式和自动补全已从这里移出，避免和其他设置页重复维护。
					</div>
					<div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
						{movedSettings.map((item) => (
							<div key={item.label} className="rounded border border-vscode-panel-border p-3 text-sm">
								<div className="font-medium text-vscode-foreground">{item.label}</div>
								<div className="mt-1 text-vscode-descriptionForeground">当前状态：{item.value}</div>
								<div className="mt-1 text-xs text-vscode-descriptionForeground">{item.target}</div>
							</div>
						))}
					</div>
				</div>
			</Section>

			<Section>
				<details open>
					<summary className="cursor-pointer font-medium mb-2">🧹 协议桥接</summary>
					<div className="pb-2 text-xs text-vscode-descriptionForeground">
						控制上下文折叠、VCP 信息标记、HTML 渲染与消息桥接标记。
					</div>
					<div className="space-y-2">
						<VSCodeCheckbox
							checked={currentVcpConfig.enabled}
							onChange={(e: any) => updateVcpConfig({ enabled: e.target.checked === true })}
							data-testid="vcp-enabled-checkbox">
							启用 VCP 协议
						</VSCodeCheckbox>
						<VSCodeCheckbox
							checked={currentVcpConfig.contextFold.enabled}
							onChange={(e: any) =>
								updateVcpConfig({
									contextFold: { enabled: e.target.checked === true },
								})
							}
							data-testid="vcp-context-fold-enabled-checkbox">
							启用上下文折叠解析
						</VSCodeCheckbox>
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
							<VSCodeOption value="details">details 标签</VSCodeOption>
							<VSCodeOption value="comment">注释标记</VSCodeOption>
						</VSCodeDropdown>
						<VSCodeTextField
							value={currentVcpConfig.contextFold.startMarker}
							onInput={(e: any) =>
								updateVcpConfig({
									contextFold: { startMarker: String(e.target.value || "") },
								})
							}
							data-testid="vcp-context-fold-start-marker-input">
							折叠开始标记
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.contextFold.endMarker}
							onInput={(e: any) =>
								updateVcpConfig({
									contextFold: { endMarker: String(e.target.value || "") },
								})
							}
							data-testid="vcp-context-fold-end-marker-input">
							折叠结束标记
						</VSCodeTextField>
						<VSCodeCheckbox
							checked={currentVcpConfig.vcpInfo.enabled}
							onChange={(e: any) =>
								updateVcpConfig({
									vcpInfo: { enabled: e.target.checked === true },
								})
							}
							data-testid="vcp-vcpinfo-enabled-checkbox">
							启用 VCP 信息解析
						</VSCodeCheckbox>
						<VSCodeTextField
							value={currentVcpConfig.vcpInfo.startMarker}
							onInput={(e: any) =>
								updateVcpConfig({ vcpInfo: { startMarker: String(e.target.value || "") } })
							}
							data-testid="vcp-vcpinfo-start-marker-input">
							VCPINFO 开始标记
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.vcpInfo.endMarker}
							onInput={(e: any) =>
								updateVcpConfig({ vcpInfo: { endMarker: String(e.target.value || "") } })
							}
							data-testid="vcp-vcpinfo-end-marker-input">
							VCPINFO 结束标记
						</VSCodeTextField>
						<VSCodeCheckbox
							checked={currentVcpConfig.html.enabled}
							onChange={(e: any) => updateVcpConfig({ html: { enabled: e.target.checked === true } })}
							data-testid="vcp-html-enabled-checkbox">
							允许在 VCP 内容中渲染 HTML
						</VSCodeCheckbox>
					</div>
				</details>
			</Section>

			<Section>
				<details open>
					<summary className="cursor-pointer font-medium mb-2">📡 WS 通道与 Tool Request</summary>
					<div className="pb-2 text-xs text-vscode-descriptionForeground">
						这里集中管理 Tool Request 解析器、Bridge 连接状态和 VCPToolBox 通道。
					</div>
					<div className="space-y-2">
						<VSCodeCheckbox
							checked={currentVcpConfig.toolRequest.enabled}
							onChange={(e: any) =>
								updateVcpConfig({
									toolRequest: { enabled: e.target.checked === true },
								})
							}
							data-testid="vcp-tool-request-enabled-checkbox">
							启用 Tool Request 解析
						</VSCodeCheckbox>
						<VSCodeDropdown
							value={currentVcpConfig.toolRequest.bridgeMode}
							onChange={(e: any) =>
								updateVcpConfig({
									toolRequest: {
										bridgeMode: (e.target as HTMLSelectElement).value as "execute" | "event",
									},
								})
							}
							data-testid="vcp-tool-request-bridge-mode-dropdown">
							<VSCodeOption value="execute">直接执行</VSCodeOption>
							<VSCodeOption value="event">事件转发</VSCodeOption>
						</VSCodeDropdown>
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
							data-testid="vcp-tool-request-max-per-message-input">
							每条消息最多 Tool Request 数
						</VSCodeTextField>
						<VSCodeCheckbox
							checked={currentVcpConfig.toolRequest.keepBlockInText}
							onChange={(e: any) =>
								updateVcpConfig({
									toolRequest: { keepBlockInText: e.target.checked === true },
								})
							}
							data-testid="vcp-tool-request-keep-block-checkbox">
							保留助手文本中的原始 Tool Request 块
						</VSCodeCheckbox>
						<VSCodeTextArea
							value={currentVcpConfig.toolRequest.allowTools.join("\n")}
							onInput={(e: any) =>
								updateVcpConfig({
									toolRequest: { allowTools: parseList(String(e.target.value || "")) },
								})
							}
							rows={4}
							data-testid="vcp-tool-request-allow-tools-input">
							允许的工具（逗号或换行分隔）
						</VSCodeTextArea>
						<VSCodeTextArea
							value={currentVcpConfig.toolRequest.denyTools.join("\n")}
							onInput={(e: any) =>
								updateVcpConfig({
									toolRequest: { denyTools: parseList(String(e.target.value || "")) },
								})
							}
							rows={4}
							data-testid="vcp-tool-request-deny-tools-input">
							禁止的工具（逗号或换行分隔）
						</VSCodeTextArea>
						<VSCodeTextField
							value={currentVcpConfig.toolRequest.startMarker}
							onInput={(e: any) =>
								updateVcpConfig({
									toolRequest: { startMarker: String(e.target.value || "") },
								})
							}
							data-testid="vcp-tool-request-start-marker-input">
							Tool Request 开始标记
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.toolRequest.endMarker}
							onInput={(e: any) =>
								updateVcpConfig({
									toolRequest: { endMarker: String(e.target.value || "") },
								})
							}
							data-testid="vcp-tool-request-end-marker-input">
							Tool Request 结束标记
						</VSCodeTextField>
						<VSCodeCheckbox
							checked={currentVcpConfig.toolbox.enabled}
							onChange={(e: any) => updateVcpConfig({ toolbox: { enabled: e.target.checked === true } })}
							data-testid="vcp-toolbox-enabled-checkbox">
							启用 VCPToolBox Bridge
						</VSCodeCheckbox>
						<VSCodeTextField
							value={currentVcpConfig.toolbox.url}
							onInput={(e: any) => updateVcpConfig({ toolbox: { url: String(e.target.value || "") } })}
							data-testid="vcp-toolbox-url-input">
							WebSocket 地址
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.toolbox.key}
							type="password"
							onInput={(e: any) => updateVcpConfig({ toolbox: { key: String(e.target.value || "") } })}
							data-testid="vcp-toolbox-key-input">
							Bridge 密钥
						</VSCodeTextField>
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
							data-testid="vcp-toolbox-reconnect-interval-input">
							重连间隔（毫秒）
						</VSCodeTextField>
						<div
							className="rounded-md p-2 text-xs"
							style={{
								background: "var(--vscode-editorWidget-background)",
								border: "1px solid var(--vscode-editorWidget-border)",
							}}>
							<div className="font-medium text-[var(--vscode-foreground)] mb-1">
								连接状态：{vcpBridgeStatus?.connected ? "已连接" : "未连接"}
							</div>
							<div className="text-vscode-descriptionForeground">
								端点：{vcpBridgeStatus?.endpoint || currentVcpConfig.toolbox.url || "未设置"}
							</div>
							<div className="text-vscode-descriptionForeground">
								最近延迟：{vcpBridgeStatus?.lastLatencyMs ?? bridgeTestResult?.latencyMs ?? "-"} ms
							</div>
							<div className="text-vscode-descriptionForeground">
								重连次数：{vcpBridgeStatus?.reconnectAttempts ?? 0}
							</div>
							{vcpBridgeStatus?.lastError && (
								<div className="text-vscode-errorForeground mt-1">
									最近错误：{vcpBridgeStatus.lastError}
								</div>
							)}
						</div>
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
								连接 Bridge
							</Button>
							<Button
								variant="secondary"
								onClick={() => {
									setBridgeTestResult(undefined)
									setIsTestingBridge(true)
									vscode.postMessage({
										type: "updateVcpConfig",
										config: { toolbox: currentVcpConfig.toolbox },
									})
									vscode.postMessage({ type: "requestVcpBridgeTest", timeout: 5000 })
								}}
								data-testid="vcp-toolbox-test-button">
								{isTestingBridge ? "测试中..." : "测试连接"}
							</Button>
							<Button
								onClick={() => vscode.postMessage({ type: "requestVcpBridgeDisconnect" })}
								data-testid="vcp-toolbox-disconnect-button">
								断开连接
							</Button>
						</div>
						{bridgeTestResult && (
							<div
								className="rounded-md p-2 text-xs"
								style={{
									background: bridgeTestResult.success
										? "var(--vscode-testing-iconPassed)"
										: "var(--vscode-inputValidation-errorBackground)",
									color: "var(--vscode-editor-foreground)",
									opacity: 0.85,
								}}>
								{bridgeTestResult.success
									? `连接测试成功（${bridgeTestResult.latencyMs ?? 0}ms）`
									: `连接测试失败：${bridgeTestResult.error ?? "未知错误"}`}
								{bridgeTestResult.endpoint ? ` | ${bridgeTestResult.endpoint}` : ""}
							</div>
						)}
						{bridgeLogs.length > 0 && (
							<details>
								<summary className="cursor-pointer font-medium text-xs">
									Bridge 日志（{bridgeLogs.length}）
								</summary>
								<div
									className="max-h-40 overflow-y-auto text-xs mt-1 rounded p-2"
									style={{
										background: "var(--vscode-textCodeBlock-background)",
										border: "1px solid var(--vscode-editorWidget-border)",
									}}>
									{bridgeLogs
										.slice()
										.reverse()
										.map((entry, index) => (
											<div key={`${entry.timestamp}-${index}`} className="mb-1">
												<span className="opacity-70">
													[{new Date(entry.timestamp).toLocaleTimeString()}]
												</span>{" "}
												<span className="font-medium">{entry.level.toUpperCase()}</span>{" "}
												{entry.message}
											</div>
										))}
								</div>
							</details>
						)}
					</div>
				</details>
			</Section>

			<Section>
				<details>
					<summary className="cursor-pointer font-medium mb-2">🔌 分布式服务与兼容层</summary>
					<div className="pb-2 text-xs text-vscode-descriptionForeground">
						Snow Compat 用于兼容外部服务协议，后续可继续扩展分布式节点与插件桥接能力。
					</div>
					<div className="space-y-2">
						<VSCodeCheckbox
							checked={currentVcpConfig.snowCompat.enabled}
							onChange={(e: any) =>
								updateVcpConfig({ snowCompat: { enabled: e.target.checked === true } })
							}
							data-testid="vcp-snow-compat-enabled-checkbox">
							启用 Snow 兼容层
						</VSCodeCheckbox>
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.basicModel}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { basicModel: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-basic-model-input">
							基础模型
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.advancedModel}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { advancedModel: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-advanced-model-input">
							高级模型
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.baseUrl}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { baseUrl: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-base-url-input">
							Base URL
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.requestMethod}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { requestMethod: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-request-method-input">
							请求方法
						</VSCodeTextField>
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
							data-testid="vcp-snow-compat-max-context-tokens-input">
							最大上下文 Tokens
						</VSCodeTextField>
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
							data-testid="vcp-snow-compat-max-tokens-input">
							最大输出 Tokens
						</VSCodeTextField>
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
							data-testid="vcp-snow-compat-tool-result-token-limit-input">
							工具结果 Token 上限
						</VSCodeTextField>
						<VSCodeCheckbox
							checked={currentVcpConfig.snowCompat.showThinking}
							onChange={(e: any) =>
								updateVcpConfig({ snowCompat: { showThinking: e.target.checked === true } })
							}
							data-testid="vcp-snow-compat-show-thinking-checkbox">
							显示 Thinking
						</VSCodeCheckbox>
						<VSCodeCheckbox
							checked={currentVcpConfig.snowCompat.enableAutoCompress}
							onChange={(e: any) =>
								updateVcpConfig({ snowCompat: { enableAutoCompress: e.target.checked === true } })
							}
							data-testid="vcp-snow-compat-auto-compress-checkbox">
							启用自动压缩
						</VSCodeCheckbox>
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
							data-testid="vcp-snow-compat-edit-similarity-threshold-input">
							编辑相似度阈值（0-1）
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.anthropicBeta}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { anthropicBeta: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-anthropic-beta-input">
							Anthropic Beta
						</VSCodeTextField>
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.anthropicCacheTTL}
							onInput={(e: any) =>
								updateVcpConfig({ snowCompat: { anthropicCacheTTL: String(e.target.value || "") } })
							}
							data-testid="vcp-snow-compat-anthropic-cache-ttl-input">
							Anthropic Cache TTL
						</VSCodeTextField>
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
						<VSCodeTextField
							value={currentVcpConfig.snowCompat.responsesReasoning.effort}
							onInput={(e: any) =>
								updateVcpConfig({
									snowCompat: {
										responsesReasoning: { effort: String(e.target.value || "") },
									},
								})
							}
							data-testid="vcp-snow-compat-reasoning-effort-input">
							Responses Reasoning 强度
						</VSCodeTextField>
						<VSCodeCheckbox
							checked={currentVcpConfig.snowCompat.proxy.enabled}
							onChange={(e: any) =>
								updateVcpConfig({
									snowCompat: { proxy: { enabled: e.target.checked === true } },
								})
							}
							data-testid="vcp-snow-compat-proxy-enabled-checkbox">
							启用 Snow 代理
						</VSCodeCheckbox>
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
							data-testid="vcp-snow-compat-proxy-port-input">
							代理端口
						</VSCodeTextField>
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
							data-testid="vcp-snow-compat-proxy-browser-debug-port-input">
							浏览器调试端口
						</VSCodeTextField>
					</div>
				</details>
			</Section>

			<Section>
				<details>
					<summary className="cursor-pointer font-medium mb-2">Agent Team 与 Memory</summary>
					<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
						<div className="rounded border border-vscode-panel-border p-3 text-sm">
							<div className="font-medium text-vscode-foreground">Agent Team</div>
							<div className="mt-1 text-vscode-descriptionForeground">
								成员编排、波次策略和文件隔离规则已迁移到“代理行为”页面统一管理。
							</div>
							<div className="mt-2 text-xs text-vscode-descriptionForeground">
								当前状态：{currentVcpConfig.agentTeam.enabled ? "已启用" : "未启用"}，成员数{" "}
								{currentVcpConfig.agentTeam.members.length}
							</div>
						</div>
						<div className="rounded border border-vscode-panel-border p-3 text-sm">
							<div className="font-medium text-vscode-foreground">记忆系统</div>
							<div className="mt-1 text-vscode-descriptionForeground">
								被动记忆、写入记忆、检索记忆与刷新调度已迁移到“上下文管理”页面，避免与压缩配置重复。
							</div>
							<div className="mt-2 text-xs text-vscode-descriptionForeground">
								当前状态：Passive {currentVcpConfig.memory.passive.enabled ? "开" : "关"} / Writer{" "}
								{currentVcpConfig.memory.writer.enabled ? "开" : "关"} / Retrieval{" "}
								{currentVcpConfig.memory.retrieval.enabled ? "开" : "关"}
							</div>
						</div>
					</div>
				</details>
			</Section>

			<Section>
				<div className="text-vscode-descriptionForeground text-sm">
					项目地址：{" "}
					<VSCodeLink href="https://github.com/DerstedtCasper/vcp-code-2.0">
						github.com/DerstedtCasper/vcp-code-2.0
					</VSCodeLink>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button onClick={() => openExternal("https://github.com/DerstedtCasper/vcp-code-2.0/issues")}>
						打开 Issues
					</Button>
					<Button
						variant="destructive"
						onClick={() => vscode.postMessage({ type: "resetState" })}
						data-testid="vcp-reset-state-button">
						重置扩展状态
					</Button>
				</div>
			</Section>
		</div>
	)
}
