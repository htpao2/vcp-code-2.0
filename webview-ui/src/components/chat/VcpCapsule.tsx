import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, BellRing, Info, PlugZap, Server, Wifi, WifiOff } from "lucide-react"

import { useExtensionState } from "@/context/ExtensionStateContext"
import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Progress,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui"
import { cn } from "@/lib/utils"

type VcpCapsuleProps = {
	className?: string
}

const formatTime = (value?: number) => {
	if (!value) {
		return "未记录"
	}
	try {
		return new Date(value).toLocaleTimeString()
	} catch {
		return "未记录"
	}
}

const getLevelIcon = (level: string) => {
	if (level === "error") {
		return <AlertTriangle className="h-3.5 w-3.5 text-vscode-errorForeground" />
	}
	if (level === "warn") {
		return <AlertTriangle className="h-3.5 w-3.5 text-vscode-editorWarning-foreground" />
	}
	return <Info className="h-3.5 w-3.5 text-vscode-descriptionForeground" />
}

export const VcpCapsule = ({ className }: VcpCapsuleProps) => {
	const { vcpConfig, vcpBridgeStatus, vcpBridgeLogEntries } = useExtensionState()
	const [open, setOpen] = useState(false)
	const [lastReadTimestamp, setLastReadTimestamp] = useState(0)
	const [pulse, setPulse] = useState(false)

	const relevantEntries = useMemo(() => vcpBridgeLogEntries.slice(-50).reverse(), [vcpBridgeLogEntries])
	const latestTimestamp = relevantEntries[0]?.timestamp ?? 0
	const unreadCount = relevantEntries.filter((entry) => entry.timestamp > lastReadTimestamp).length

	useEffect(() => {
		if (!open || !latestTimestamp) {
			return
		}
		setLastReadTimestamp((current) => Math.max(current, latestTimestamp))
	}, [latestTimestamp, open])

	useEffect(() => {
		if (unreadCount <= 0) {
			return
		}
		setPulse(true)
		const timer = window.setTimeout(() => setPulse(false), 900)
		return () => window.clearTimeout(timer)
	}, [unreadCount])

	if (vcpConfig?.enabled !== true) {
		return null
	}

	const isConnected = vcpBridgeStatus?.connected === true
	const hasWarnings = !!vcpBridgeStatus?.lastError || !isConnected
	const statusColor = isConnected ? "bg-emerald-500" : hasWarnings ? "bg-amber-500" : "bg-red-500"
	const serverCount = vcpBridgeStatus?.distributedServers.length ?? 0
	const pluginCount = vcpBridgeStatus?.activePlugins.length ?? 0

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg backdrop-blur-sm",
						"border-vscode-panel-border bg-[color-mix(in_srgb,var(--vscode-editor-background)_88%,transparent)]",
						"transition-transform hover:-translate-y-0.5",
						pulse && "animate-pulse",
						className,
					)}>
					<span className={cn("h-2.5 w-2.5 rounded-full", statusColor)} />
					<PlugZap className="h-4 w-4 text-vscode-foreground" />
					<div className="text-left">
						<div className="text-xs font-semibold leading-none text-vscode-foreground">
							{isConnected ? "VCP 已连接" : "VCP 断线"}
						</div>
						<div className="mt-1 flex items-center gap-2 text-[11px] leading-none text-vscode-descriptionForeground">
							<span>{serverCount} 节点</span>
							<span>{pluginCount} 插件</span>
						</div>
					</div>
					{unreadCount > 0 && (
						<span className="inline-flex min-w-5 items-center justify-center rounded-full bg-vscode-badge-background px-1.5 py-0.5 text-[10px] font-semibold text-vscode-badge-foreground">
							{unreadCount > 99 ? "99+" : unreadCount}
						</span>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" sideOffset={10} className="w-[440px] p-0 overflow-hidden">
				<div className="border-b border-vscode-panel-border px-4 py-3">
					<div className="text-sm font-semibold text-vscode-foreground">VCP Bridge 胶囊</div>
					<div className="text-xs text-vscode-descriptionForeground">
						查看通道状态、分布式节点和最近消息。
					</div>
				</div>
				<Tabs defaultValue="status" className="w-full">
					<div className="border-b border-vscode-panel-border px-3 py-2">
						<TabsList className="w-full">
							<TabsTrigger value="status" className="flex-1">
								连接状态
							</TabsTrigger>
							<TabsTrigger value="logs" className="flex-1">
								消息日志
							</TabsTrigger>
						</TabsList>
					</div>
					<TabsContent value="status" className="m-0 max-h-[420px] overflow-y-auto p-4">
						<div className="grid grid-cols-2 gap-3">
							<div className="rounded-lg border border-vscode-panel-border p-3">
								<div className="flex items-center gap-2 text-sm font-medium">
									{isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
									Bridge
								</div>
								<div className="mt-2 text-xs text-vscode-descriptionForeground">
									<div>状态: {isConnected ? "在线" : "离线"}</div>
									<div>地址: {vcpBridgeStatus?.endpoint ?? "未设置"}</div>
									<div>最近连接: {formatTime(vcpBridgeStatus?.lastConnected)}</div>
									<div>重连次数: {vcpBridgeStatus?.reconnectAttempts ?? 0}</div>
									<div>最近延迟: {vcpBridgeStatus?.lastLatencyMs ?? "-"} ms</div>
								</div>
							</div>
							<div className="rounded-lg border border-vscode-panel-border p-3">
								<div className="flex items-center gap-2 text-sm font-medium">
									<BellRing className="h-4 w-4" />
									通道摘要
								</div>
								<div className="mt-2 text-xs text-vscode-descriptionForeground">
									<div>vcpInfo: {vcpConfig?.vcpInfo.enabled ? "启用" : "关闭"}</div>
									<div>VCPLog: {vcpConfig?.toolbox.enabled ? "启用" : "关闭"}</div>
									<div>未读消息: {unreadCount}</div>
									<div>活跃插件: {pluginCount}</div>
									<div>分布式节点: {serverCount}</div>
								</div>
							</div>
						</div>

						{vcpBridgeStatus?.stats && (
							<div className="mt-4 rounded-lg border border-vscode-panel-border p-3">
								<div className="text-sm font-medium">运行时负载</div>
								<div className="mt-3 space-y-3 text-xs text-vscode-descriptionForeground">
									<div>
										<div className="mb-1 flex items-center justify-between">
											<span>CPU</span>
											<span>{vcpBridgeStatus.stats.cpuPercent}%</span>
										</div>
										<Progress
											value={vcpBridgeStatus.stats.cpuPercent}
											className="h-1.5 [&>div]:bg-vscode-button-background"
										/>
									</div>
									<div>
										<div className="mb-1 flex items-center justify-between">
											<span>内存</span>
											<span>{vcpBridgeStatus.stats.memoryMB} MB</span>
										</div>
										<Progress
											value={Math.min(100, Math.round(vcpBridgeStatus.stats.memoryMB / 10))}
											className="h-1.5 [&>div]:bg-vscode-button-secondaryBackground"
										/>
									</div>
									<div>连接数: {vcpBridgeStatus.stats.connections}</div>
									<div>运行时长: {Math.round(vcpBridgeStatus.stats.uptime)} s</div>
								</div>
							</div>
						)}

						<div className="mt-4 rounded-lg border border-vscode-panel-border p-3">
							<div className="flex items-center gap-2 text-sm font-medium">
								<Server className="h-4 w-4" />
								分布式服务
							</div>
							{serverCount === 0 ? (
								<div className="mt-2 text-xs text-vscode-descriptionForeground">
									暂无分布式节点注册。
								</div>
							) : (
								<div className="mt-2 space-y-2">
									{(vcpBridgeStatus?.distributedServers ?? []).map((server) => (
										<div
											key={server.id}
											className="rounded border border-vscode-panel-border px-3 py-2 text-xs">
											<div className="font-medium text-vscode-foreground">{server.id}</div>
											<div className="mt-1 text-vscode-descriptionForeground">
												{server.host}:{server.port} · {server.status} · load={server.load}
											</div>
										</div>
									))}
								</div>
							)}
							<div className="mt-3 rounded border border-dashed border-vscode-panel-border px-3 py-2 text-xs text-vscode-descriptionForeground">
								Skill → Plugin 转换接口已预留，当前以 activePlugins 列表展示已接入插件状态。
							</div>
						</div>

						{vcpBridgeStatus?.lastError && (
							<div className="mt-4 rounded-lg border border-vscode-errorForeground/40 bg-vscode-inputValidation-errorBackground px-3 py-2 text-xs text-vscode-foreground">
								最近错误: {vcpBridgeStatus.lastError}
							</div>
						)}
					</TabsContent>
					<TabsContent value="logs" className="m-0 max-h-[420px] overflow-y-auto">
						{relevantEntries.length === 0 ? (
							<div className="px-4 py-6 text-sm text-vscode-descriptionForeground">暂无 VCP 日志。</div>
						) : (
							<div className="divide-y divide-vscode-panel-border">
								{relevantEntries.map((entry, index) => (
									<div key={`${entry.timestamp}-${index}`} className="px-4 py-3">
										<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground">
											{getLevelIcon(String(entry.level ?? "info"))}
											<span>{entry.source}</span>
											<span>{formatTime(entry.timestamp)}</span>
										</div>
										<div className="mt-1 whitespace-pre-wrap break-words text-sm text-vscode-foreground">
											{entry.message}
										</div>
									</div>
								))}
							</div>
						)}
					</TabsContent>
				</Tabs>
				<div className="flex items-center justify-between border-t border-vscode-panel-border px-4 py-2">
					<div className="text-xs text-vscode-descriptionForeground">
						最近消息 {relevantEntries.length} 条
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							if (latestTimestamp) {
								setLastReadTimestamp(latestTimestamp)
							}
						}}>
						标记已读
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}
