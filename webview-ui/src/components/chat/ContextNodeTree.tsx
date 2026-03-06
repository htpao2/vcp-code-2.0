import { useEffect, useMemo, useState, type ComponentType } from "react"
import { FileText, FolderTree, HardDrive, MessageSquareText, Network, Settings2 } from "lucide-react"

import { useExtensionState } from "@/context/ExtensionStateContext"
import { Button, Progress } from "@/components/ui"
import { cn } from "@/lib/utils"

type ContextNode = {
	id: string
	label: string
	detail: string
	tokens: number
	children?: ContextNode[]
	icon?: ComponentType<{ className?: string }>
}

const estimateTokens = (input?: string | null) => {
	if (!input) {
		return 0
	}
	return Math.max(1, Math.ceil(input.length / 4))
}

const sumTokens = (nodes: ContextNode[]): number =>
	nodes.reduce((total, node) => total + node.tokens + sumTokens(node.children ?? []), 0)

const flattenNodes = (nodes: ContextNode[]): ContextNode[] =>
	nodes.flatMap((node) => [node, ...flattenNodes(node.children ?? [])])

type ContextNodeTreeProps = {
	open: boolean
	onClose: () => void
}

export const ContextNodeTree = ({ open, onClose }: ContextNodeTreeProps) => {
	const {
		mode,
		customInstructions,
		skills,
		clineMessages,
		openedTabs,
		filePaths,
		vcpConfig,
		vcpBridgeLogEntries,
		vcpBridgeStatus,
	} = useExtensionState()

	const nodes = useMemo<ContextNode[]>(() => {
		const recentMessages = clineMessages.slice(-6)
		const conversationDetail =
			recentMessages.length > 0
				? recentMessages
						.map((message, index) => {
							const role = message.type === "ask" ? "Ask" : "Say"
							return `${index + 1}. ${role}: ${(message.text ?? "").slice(0, 120)}`
						})
						.join("\n\n")
				: "当前没有对话消息。"

		const memoryChildren: ContextNode[] = [
			{
				id: "memory-passive",
				label: "被动记忆",
				detail: `enabled=${vcpConfig?.memory.passive.enabled ? "true" : "false"}, maxItems=${vcpConfig?.memory.passive.maxItems ?? 0}`,
				tokens: estimateTokens(JSON.stringify(vcpConfig?.memory.passive ?? {})),
			},
			{
				id: "memory-writer",
				label: "写入记忆",
				detail: `enabled=${vcpConfig?.memory.writer.enabled ? "true" : "false"}, triggerTokens=${vcpConfig?.memory.writer.triggerTokens ?? 0}`,
				tokens: estimateTokens(JSON.stringify(vcpConfig?.memory.writer ?? {})),
			},
			{
				id: "memory-retrieval",
				label: "检索记忆",
				detail: `enabled=${vcpConfig?.memory.retrieval.enabled ? "true" : "false"}, topK=${vcpConfig?.memory.retrieval.topK ?? 0}`,
				tokens: estimateTokens(JSON.stringify(vcpConfig?.memory.retrieval ?? {})),
			},
			{
				id: "memory-refresh",
				label: "刷新调度",
				detail: `enabled=${vcpConfig?.memory.refresh.enabled ? "true" : "false"}, intervalMs=${vcpConfig?.memory.refresh.intervalMs ?? 0}`,
				tokens: estimateTokens(JSON.stringify(vcpConfig?.memory.refresh ?? {})),
			},
		]

		const workspaceChildren: ContextNode[] = openedTabs.slice(0, 6).map((tab, index) => ({
			id: `workspace-tab-${index}`,
			label: tab.label,
			detail: tab.path ?? "未提供路径",
			tokens: estimateTokens(tab.path ?? tab.label),
		}))

		const bridgeChildren: ContextNode[] = [
			...(vcpBridgeStatus?.distributedServers ?? []).map((server) => ({
				id: `server-${server.id}`,
				label: `节点 ${server.id}`,
				detail: `${server.host}:${server.port} · ${server.status} · load=${server.load}`,
				tokens: estimateTokens(`${server.host}:${server.port}:${server.status}:${server.load}`),
			})),
			...(vcpBridgeStatus?.activePlugins ?? []).map((plugin) => ({
				id: `plugin-${plugin.name}`,
				label: `插件 ${plugin.name}`,
				detail: `${plugin.version} · ${plugin.status}`,
				tokens: estimateTokens(`${plugin.name}:${plugin.version}:${plugin.status}`),
			})),
		]

		return [
			{
				id: "system",
				label: "System Prompt",
				detail: `mode=${mode}\nskills=${skills.length}\ncustomInstructions=${customInstructions ? "yes" : "no"}`,
				tokens: estimateTokens(
					`${mode}\n${customInstructions ?? ""}\n${skills.map((skill) => skill.name).join(",")}`,
				),
				icon: Settings2,
			},
			{
				id: "conversation",
				label: "Conversation History",
				detail: conversationDetail,
				tokens: estimateTokens(recentMessages.map((message) => message.text ?? "").join("\n")),
				icon: MessageSquareText,
				children: recentMessages.map((message, index) => ({
					id: `message-${message.ts}`,
					label: `消息 ${index + 1}`,
					detail: message.text ?? "(空)",
					tokens: estimateTokens(message.text),
				})),
			},
			{
				id: "memory",
				label: "Memory Pipeline",
				detail: "原始上下文 → 记忆系统注入 → 上下文压缩",
				tokens: sumTokens(memoryChildren),
				icon: HardDrive,
				children: memoryChildren,
			},
			{
				id: "workspace",
				label: "Workspace Context",
				detail: `openedTabs=${openedTabs.length}, filePaths=${filePaths.length}`,
				tokens: estimateTokens(
					`${openedTabs.length}:${filePaths.length}:${openedTabs.map((tab) => tab.path ?? tab.label).join(",")}`,
				),
				icon: FolderTree,
				children: workspaceChildren,
			},
			{
				id: "bridge",
				label: "VCP Runtime",
				detail: `logs=${vcpBridgeLogEntries.length}, distributed=${vcpBridgeStatus?.distributedServers.length ?? 0}`,
				tokens: estimateTokens(
					JSON.stringify(vcpBridgeStatus ?? {}) + JSON.stringify(vcpBridgeLogEntries.slice(-10)),
				),
				icon: Network,
				children: bridgeChildren,
			},
		]
	}, [
		clineMessages,
		customInstructions,
		filePaths,
		mode,
		openedTabs,
		skills,
		vcpBridgeLogEntries,
		vcpBridgeStatus,
		vcpConfig,
	])

	const allNodes = useMemo(() => flattenNodes(nodes), [nodes])
	const totalTokens = useMemo(() => sumTokens(nodes), [nodes])
	const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id ?? "system")
	const selectedNode = allNodes.find((node) => node.id === selectedNodeId) ?? nodes[0]

	useEffect(() => {
		if (!allNodes.some((node) => node.id === selectedNodeId) && nodes[0]) {
			setSelectedNodeId(nodes[0].id)
		}
	}, [allNodes, nodes, selectedNodeId])

	if (!open) {
		return null
	}

	const renderNode = (node: ContextNode, depth = 0): JSX.Element => {
		const Icon = node.icon ?? FileText
		const percent = totalTokens > 0 ? Math.max(1, Math.round((node.tokens / totalTokens) * 100)) : 0

		return (
			<div key={node.id} className="space-y-2">
				<button
					type="button"
					onClick={() => setSelectedNodeId(node.id)}
					className={cn(
						"w-full rounded-lg border px-3 py-2 text-left transition-colors",
						"border-vscode-panel-border bg-vscode-editor-background hover:bg-vscode-list-hoverBackground",
						selectedNodeId === node.id &&
							"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
					)}
					style={{ marginLeft: depth * 12 }}>
					<div className="flex items-center gap-2">
						<Icon className="h-4 w-4 shrink-0" />
						<div className="min-w-0 flex-1">
							<div className="truncate text-sm font-medium">{node.label}</div>
							<div className="text-xs text-vscode-descriptionForeground">
								{node.tokens} tokens · {percent}%
							</div>
						</div>
					</div>
					<Progress value={percent} className="mt-2 h-1.5 [&>div]:bg-vscode-button-background" />
				</button>
				{node.children?.map((child) => renderNode(child, depth + 1))}
			</div>
		)
	}

	return (
		<div className="absolute inset-y-20 right-3 z-30 w-[360px] overflow-hidden rounded-xl border border-vscode-panel-border bg-vscode-editor-background shadow-2xl">
			<div className="flex items-center justify-between border-b border-vscode-panel-border px-4 py-3">
				<div>
					<div className="text-sm font-semibold text-vscode-foreground">上下文节点树</div>
					<div className="text-xs text-vscode-descriptionForeground">当前估算总量 {totalTokens} tokens</div>
				</div>
				<Button variant="ghost" size="sm" onClick={onClose}>
					关闭
				</Button>
			</div>
			<div className="grid h-[calc(100%-57px)] grid-cols-[1.1fr_1fr]">
				<div className="overflow-y-auto border-r border-vscode-panel-border p-3">
					{nodes.map((node) => renderNode(node))}
				</div>
				<div className="overflow-y-auto p-4">
					<div className="text-sm font-semibold text-vscode-foreground">{selectedNode?.label}</div>
					<div className="mt-1 text-xs text-vscode-descriptionForeground">{selectedNode?.tokens} tokens</div>
					<pre className="mt-3 whitespace-pre-wrap rounded-lg border border-vscode-panel-border bg-vscode-textCodeBlock-background p-3 text-xs text-vscode-foreground">
						{selectedNode?.detail ?? "暂无详情"}
					</pre>
				</div>
			</div>
		</div>
	)
}
