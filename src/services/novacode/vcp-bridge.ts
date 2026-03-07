// novacode_change - new file
// vcp_change: VCPToolBox WebSocket bridge service.

import * as fs from "fs/promises"
import * as os from "os"
import * as vscode from "vscode"
import matter from "gray-matter"
import WebSocket from "ws"

import type {
	VcpBridgeDistributedServer,
	VcpBridgeLogEntry,
	VcpBridgeStatus,
	VcpBridgeTestResult,
	VcpToolboxConfig,
} from "../../shared/vcp/vcp-types"
import { Package } from "../../shared/package"
import {
	buildVcpDistributedSkillPlaceholder,
	buildVcpDistributedToolManifest,
	type VcpDistributedSkillSource,
} from "../skills/vcpDistributedSkill"

type BridgeInfoPayload = {
	type?: string
	version?: string
	stats?: VcpBridgeStatus["stats"]
	activePlugins?: VcpBridgeStatus["activePlugins"]
	distributedServers?: VcpBridgeDistributedServer[]
	properties?: {
		content?: string
	}
	message?: string
}

type DistributedNodeMessage = {
	type?: string
	data?: Record<string, unknown>
}

type DistributedExecuteToolPayload = {
	requestId?: string
	toolName?: string
	toolArgs?: Record<string, unknown>
}

export interface VcpDistributedSkillSyncResult {
	distributedConnected: boolean
	error?: string
}

export class VcpBridgeService implements vscode.Disposable {
	private vcpLogWs: WebSocket | null = null
	private vcpInfoWs: WebSocket | null = null
	private distributedWs: WebSocket | null = null
	private reconnectTimer: NodeJS.Timeout | null = null
	private distributedReconnectTimer: NodeJS.Timeout | null = null
	private isConnecting = false
	private isConnectingDistributed = false
	private distributedReconnectAttempts = 0
	private distributedSkills: Record<string, VcpDistributedSkillSource> = {}
	private readonly distributedServerName = `${Package.name}-${os.hostname()}`
	private _status: VcpBridgeStatus = {
		connected: false,
		distributedConnected: false,
		activePlugins: [],
		distributedServers: [],
		reconnectAttempts: 0,
	}

	private readonly _onStatusChanged = new vscode.EventEmitter<VcpBridgeStatus>()
	readonly onStatusChanged = this._onStatusChanged.event

	private readonly _onLogReceived = new vscode.EventEmitter<VcpBridgeLogEntry[]>()
	readonly onLogReceived = this._onLogReceived.event

	constructor(private config: VcpToolboxConfig) {}

	private emitStatus() {
		this._onStatusChanged.fire({ ...this._status })
	}

	private emitLog(message: string, level: VcpBridgeLogEntry["level"] = "info", source = "vcp-bridge") {
		this._onLogReceived.fire(
			this.normalizeLogEntries({
				level,
				source,
				message,
			}),
		)
	}

	private normalizeToolboxUrl(rawUrl: string): string {
		let url = rawUrl.trim()
		if (url.startsWith("http://")) {
			url = `ws://${url.slice("http://".length)}`
		} else if (url.startsWith("https://")) {
			url = `wss://${url.slice("https://".length)}`
		} else if (!/^wss?:\/\//i.test(url)) {
			url = `ws://${url}`
		}
		return url.replace(/\/+$/, "")
	}

	private buildSocketCandidates(channel: "log" | "info" | "distributed"): string[] {
		const normalized = this.normalizeToolboxUrl(this.config.url || "ws://localhost:5800")
		const key = this.config.key?.trim()
		const keySegment = key ? `/VCP_Key=${encodeURIComponent(key)}` : ""

		if (channel === "distributed") {
			if (/\/vcp-distributed-server(?:\/VCP_Key=[^/?#]+)?$/i.test(normalized)) {
				return [normalized]
			}

			try {
				const parsed = new URL(normalized)
				const basePath = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "")
				const originWithPath = `${parsed.origin}${basePath}`
				return [`${originWithPath}/vcp-distributed-server${keySegment}`]
			} catch {
				return [`${normalized}/vcp-distributed-server${keySegment}`]
			}
		}

		// User already supplied a complete channel endpoint.
		if (/\/(?:vcpinfo|VCPlog)(?:\/VCP_Key=[^/?#]+)?$/i.test(normalized)) {
			return [normalized]
		}

		const candidates: string[] = []
		try {
			const parsed = new URL(normalized)
			const basePath = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "")
			const originWithPath = `${parsed.origin}${basePath}`

			const legacyPrimary =
				channel === "info" ? `${originWithPath}/vcpinfo${keySegment}` : `${originWithPath}/VCPlog${keySegment}`
			const legacyFallback =
				channel === "info" ? `${originWithPath}/VCPlog${keySegment}` : `${originWithPath}/vcpinfo${keySegment}`
			const queryMode = new URL(`${originWithPath || parsed.origin}`)
			queryMode.searchParams.set("channel", channel)
			if (key) {
				queryMode.searchParams.set("key", key)
			}

			candidates.push(legacyPrimary, legacyFallback, queryMode.toString())
		} catch {
			const base = normalized.replace(/\/+$/, "")
			const legacyPrimary = channel === "info" ? `${base}/vcpinfo${keySegment}` : `${base}/VCPlog${keySegment}`
			const legacyFallback = channel === "info" ? `${base}/VCPlog${keySegment}` : `${base}/vcpinfo${keySegment}`
			const queryMode = `${base}?channel=${channel}${key ? `&key=${encodeURIComponent(key)}` : ""}`
			candidates.push(legacyPrimary, legacyFallback, queryMode)
		}

		return Array.from(new Set(candidates.filter((url) => url.trim().length > 0)))
	}

	private async openSocketWithFallback(
		channel: "log" | "info" | "distributed",
	): Promise<{ socket: WebSocket; endpoint: string; latencyMs: number }> {
		const candidates = this.buildSocketCandidates(channel)
		let lastError = "Unknown connection error"

		for (const endpoint of candidates) {
			const latencyStart = Date.now()
			const socket = new WebSocket(endpoint)
			try {
				await new Promise<void>((resolve, reject) => {
					const cleanup = () => {
						socket.removeListener("open", onOpen)
						socket.removeListener("error", onError)
						socket.removeListener("close", onClose)
					}
					const onOpen = () => {
						cleanup()
						resolve()
					}
					const onError = (error: Error) => {
						cleanup()
						reject(error)
					}
					const onClose = (code: number, reason: Buffer) => {
						cleanup()
						reject(new Error(`closed before ready (${code} ${reason.toString()})`))
					}
					socket.once("open", onOpen)
					socket.once("error", onError)
					socket.once("close", onClose)
				})

				const latencyMs = Date.now() - latencyStart
				return { socket, endpoint, latencyMs }
			} catch (error) {
				lastError = error instanceof Error ? error.message : String(error)
				socket.removeAllListeners()
				socket.close()
			}
		}

		throw new Error(lastError)
	}

	private normalizeLogEntries(payload: unknown): VcpBridgeLogEntry[] {
		const rows = Array.isArray(payload) ? payload : [payload]
		const entries: VcpBridgeLogEntry[] = []

		for (const row of rows) {
			if (!row || typeof row !== "object") continue
			const item = row as Record<string, unknown>
			const levelRaw = String(item.level ?? "info").toLowerCase()
			const level = levelRaw === "warn" || levelRaw === "error" || levelRaw === "debug" ? levelRaw : "info"
			const properties = (item.properties ?? {}) as Record<string, unknown>
			entries.push({
				timestamp: Number(item.timestamp ?? Date.now()),
				level,
				source: String(item.source ?? item.type ?? "vcp-bridge"),
				message: String(item.message ?? properties.content ?? item.text ?? ""),
			})
		}

		return entries
	}

	private applyInfoPayload(payload: BridgeInfoPayload) {
		this._status = {
			...this._status,
			version: payload.version ?? this._status.version,
			stats: payload.stats ?? this._status.stats,
			activePlugins: payload.activePlugins ?? this._status.activePlugins,
			distributedServers: payload.distributedServers ?? this._status.distributedServers,
		}
		this.emitStatus()

		// Some servers send VCP info messages on the info channel.
		if (payload.type === "session.vcpinfo") {
			const message = payload.properties?.content || payload.message
			if (message) {
				this._onLogReceived.fire(
					this.normalizeLogEntries({
						level: "info",
						source: "vcpinfo",
						message,
					}),
				)
			}
		}
	}

	private scheduleReconnect() {
		if (!this.config.enabled || this.reconnectTimer || this.isConnecting) return

		const nextAttempt = (this._status.reconnectAttempts ?? 0) + 1
		this._status.reconnectAttempts = nextAttempt
		this.emitStatus()

		const base = Math.max(250, this.config.reconnectInterval || 5000)
		const delay = Math.min(base * Math.pow(2, Math.min(nextAttempt - 1, 5)), 60000)

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			void this.connect()
		}, delay)
	}

	private clearDistributedReconnectTimer() {
		if (this.distributedReconnectTimer) {
			clearTimeout(this.distributedReconnectTimer)
			this.distributedReconnectTimer = null
		}
	}

	private scheduleDistributedReconnect() {
		if (
			!this.config.enabled ||
			!this.config.url.trim() ||
			this.distributedReconnectTimer ||
			this.isConnectingDistributed ||
			!this._status.connected
		) {
			return
		}

		this.distributedReconnectAttempts += 1
		const base = Math.max(250, this.config.reconnectInterval || 5000)
		const delay = Math.min(base * Math.pow(2, Math.min(this.distributedReconnectAttempts - 1, 5)), 60000)

		this.distributedReconnectTimer = setTimeout(() => {
			this.distributedReconnectTimer = null
			void this.connectDistributedSocket()
		}, delay)
	}

	private handleSocketClosed(reason?: string) {
		if (this._status.connected) {
			this._status.connected = false
		}
		this._status.distributedConnected = false
		this._status.distributedEndpoint = undefined
		if (reason) {
			this._status.lastError = reason
		}
		this.emitStatus()
		this.scheduleReconnect()
	}

	private handleDistributedSocketClosed(reason?: string) {
		this.clearDistributedReconnectTimer()
		this.distributedWs = null
		if (this._status.distributedConnected || reason) {
			this._status.distributedConnected = false
			this._status.distributedEndpoint = undefined
			if (reason) {
				this._status.lastError = reason
				this.emitLog(reason, "warn", "vcp-distributed")
			}
			this.emitStatus()
		}
		this.scheduleDistributedReconnect()
	}

	private bindInfoSocket(ws: WebSocket) {
		ws.on("message", (data: WebSocket.RawData) => {
			try {
				const payload = JSON.parse(data.toString()) as BridgeInfoPayload
				this.applyInfoPayload(payload)
			} catch (error) {
				this._onLogReceived.fire(
					this.normalizeLogEntries({
						level: "warn",
						source: "vcp-bridge",
						message: `Invalid info payload: ${error instanceof Error ? error.message : String(error)}`,
					}),
				)
			}
		})

		ws.on("close", (code, reason) => {
			this.handleSocketClosed(`Info socket closed (${code} ${reason.toString()})`)
		})

		ws.on("error", (error) => {
			this._status.lastError = `Info socket error: ${error.message}`
			this.emitLog(this._status.lastError, "error")
			this.emitStatus()
		})
	}

	private bindLogSocket(ws: WebSocket) {
		ws.on("message", (data: WebSocket.RawData) => {
			try {
				const payload = JSON.parse(data.toString())
				const entries = this.normalizeLogEntries(payload)
				if (entries.length > 0) {
					this._onLogReceived.fire(entries)
				}
			} catch {
				this._onLogReceived.fire(
					this.normalizeLogEntries({
						level: "info",
						source: "vcp-bridge",
						message: data.toString(),
					}),
				)
			}
		})

		ws.on("close", (code, reason) => {
			this.handleSocketClosed(`Log socket closed (${code} ${reason.toString()})`)
		})

		ws.on("error", (error) => {
			this._status.lastError = `Log socket error: ${error.message}`
			this.emitLog(this._status.lastError, "error")
			this.emitStatus()
		})
	}

	private bindDistributedSocket(ws: WebSocket) {
		ws.on("message", (data: WebSocket.RawData) => {
			void this.handleDistributedMessage(data.toString())
		})

		ws.on("close", (code, reason) => {
			this.handleDistributedSocketClosed(`Distributed socket closed (${code} ${reason.toString()})`)
		})

		ws.on("error", (error) => {
			this._status.lastError = `Distributed socket error: ${error.message}`
			this.emitLog(this._status.lastError, "error", "vcp-distributed")
			this.emitStatus()
		})
	}

	private async handleDistributedMessage(rawMessage: string) {
		let payload: DistributedNodeMessage
		try {
			payload = JSON.parse(rawMessage) as DistributedNodeMessage
		} catch (error) {
			this.emitLog(
				`Invalid distributed payload: ${error instanceof Error ? error.message : String(error)}`,
				"warn",
				"vcp-distributed",
			)
			return
		}

		switch (payload.type) {
			case "execute_tool":
				await this.handleExecuteToolRequest(payload.data as DistributedExecuteToolPayload)
				break
			case "connection_ack":
			case "register_tools_ack":
			case "heartbeat":
				this.emitLog(`Distributed message received: ${payload.type}`, "debug", "vcp-distributed")
				break
			default:
				this.emitLog(`Distributed message received: ${payload.type ?? "unknown"}`, "debug", "vcp-distributed")
				break
		}
	}

	private async handleExecuteToolRequest(payload: DistributedExecuteToolPayload) {
		const requestId = typeof payload.requestId === "string" ? payload.requestId : ""
		const toolName = typeof payload.toolName === "string" ? payload.toolName : ""

		if (!requestId || !toolName) {
			await this.sendDistributedToolResult(requestId, "error", undefined, "Invalid execute_tool payload.")
			return
		}

		const skill =
			this.distributedSkills[toolName] ??
			Object.values(this.distributedSkills).find((candidate) => candidate.canonicalName === toolName)

		if (!skill) {
			await this.sendDistributedToolResult(
				requestId,
				"error",
				undefined,
				`Unknown distributed skill plugin: ${toolName}`,
			)
			return
		}

		try {
			const fileContent = await fs.readFile(skill.path, "utf8")
			const { data: frontmatter, content } = matter(fileContent)
			const toolArgs = payload.toolArgs ?? {}
			const format = typeof toolArgs.format === "string" ? toolArgs.format : "json"
			const includeFrontmatter = toolArgs.includeFrontmatter === true
			const instructions = content.trim()

			const result =
				format === "markdown"
					? instructions
					: {
							canonicalName: skill.canonicalName,
							remoteName: skill.remoteName,
							displayName: skill.displayName,
							description: skill.description,
							sourceScope: skill.sourceScope,
							version: skill.version,
							instructions,
							...(includeFrontmatter ? { frontmatter } : {}),
						}

			await this.sendDistributedToolResult(requestId, "success", result)
		} catch (error) {
			await this.sendDistributedToolResult(
				requestId,
				"error",
				undefined,
				error instanceof Error ? error.message : String(error),
			)
		}
	}

	private async sendDistributedToolResult(
		requestId: string,
		status: "success" | "error",
		result?: unknown,
		error?: string,
	) {
		if (!requestId) {
			return
		}

		await this.sendDistributedMessage({
			type: "tool_result",
			data: {
				requestId,
				status,
				...(status === "success" ? { result } : { error: error ?? "Unknown distributed tool error." }),
			},
		})
	}

	private async sendDistributedMessage(message: Record<string, unknown>) {
		if (!this.distributedWs || this.distributedWs.readyState !== WebSocket.OPEN) {
			throw new Error("Distributed socket is not connected.")
		}

		await new Promise<void>((resolve, reject) => {
			this.distributedWs!.send(JSON.stringify(message), (error) => {
				if (error) {
					reject(error)
					return
				}
				resolve()
			})
		})
	}

	private getLocalIps(): string[] {
		const interfaces = os.networkInterfaces()
		const ips = new Set<string>()

		for (const records of Object.values(interfaces)) {
			for (const record of records ?? []) {
				if (record.internal) continue
				ips.add(record.address)
			}
		}

		return Array.from(ips)
	}

	private async pushDistributedState() {
		const skills = Object.values(this.distributedSkills)
		await this.sendDistributedMessage({
			type: "register_tools",
			data: {
				serverName: this.distributedServerName,
				tools: skills.map((skill) => buildVcpDistributedToolManifest(skill)),
			},
		})
		await this.sendDistributedMessage({
			type: "report_ip",
			data: {
				serverName: this.distributedServerName,
				localIPs: this.getLocalIps(),
			},
		})
		await this.sendDistributedMessage({
			type: "update_static_placeholders",
			data: {
				serverName: this.distributedServerName,
				placeholders: buildVcpDistributedSkillPlaceholder(skills),
			},
		})
		this.emitLog(`Synced ${skills.length} distributed skill plugin(s) to VCPToolBox.`, "info", "vcp-distributed")
	}

	private async connectDistributedSocket(): Promise<boolean> {
		if (!this.config.enabled || !this.config.url.trim() || this.isConnectingDistributed) {
			return false
		}
		if (this.distributedWs && this.distributedWs.readyState === WebSocket.OPEN) {
			return true
		}

		this.clearDistributedReconnectTimer()
		this.isConnectingDistributed = true

		try {
			const distributedSocket = await this.openSocketWithFallback("distributed")
			this.distributedWs = distributedSocket.socket
			this.bindDistributedSocket(this.distributedWs)

			this.distributedReconnectAttempts = 0
			this._status.distributedConnected = true
			this._status.distributedEndpoint = distributedSocket.endpoint
			this._status.lastError = undefined
			this.emitStatus()

			await this.pushDistributedState()
			return true
		} catch (error) {
			this.distributedWs = null
			this._status.distributedConnected = false
			this._status.distributedEndpoint = undefined
			this._status.lastError = `Distributed socket error: ${error instanceof Error ? error.message : String(error)}`
			this.emitLog(this._status.lastError, "warn", "vcp-distributed")
			this.emitStatus()
			this.scheduleDistributedReconnect()
			return false
		} finally {
			this.isConnectingDistributed = false
		}
	}

	/** 建立双通道 WebSocket 连接 */
	async connect(): Promise<void> {
		if (!this.config.enabled || !this.config.url.trim() || this.isConnecting) return
		if (this._status.connected) {
			if (!this._status.distributedConnected) {
				await this.connectDistributedSocket()
			}
			return
		}

		this.disconnect()
		this.isConnecting = true

		try {
			const [logSocket, infoSocket] = await Promise.all([
				this.openSocketWithFallback("log"),
				this.openSocketWithFallback("info"),
			])

			this.vcpLogWs = logSocket.socket
			this.vcpInfoWs = infoSocket.socket
			this.bindLogSocket(this.vcpLogWs)
			this.bindInfoSocket(this.vcpInfoWs)

			this._status.connected = true
			this._status.distributedConnected = false
			this._status.lastConnected = Date.now()
			this._status.lastError = undefined
			this._status.reconnectAttempts = 0
			this._status.endpoint = infoSocket.endpoint
			this._status.lastLatencyMs = Math.max(logSocket.latencyMs, infoSocket.latencyMs)
			this.emitStatus()

			await this.connectDistributedSocket()
		} catch (error) {
			this._status.connected = false
			this._status.distributedConnected = false
			this._status.lastError = error instanceof Error ? error.message : String(error)
			this.emitStatus()
			this.scheduleReconnect()
			throw error
		} finally {
			this.isConnecting = false
		}
	}

	public async syncDistributedSkills(skills: VcpDistributedSkillSource[]): Promise<VcpDistributedSkillSyncResult> {
		this.distributedSkills = Object.fromEntries(skills.map((skill) => [skill.remoteName, skill]))

		if (!this.config.enabled || !this.config.url.trim()) {
			return {
				distributedConnected: false,
				error: "VCP bridge is disabled or URL is empty.",
			}
		}

		if (!this._status.connected) {
			try {
				await this.connect()
			} catch (error) {
				return {
					distributedConnected: false,
					error: error instanceof Error ? error.message : String(error),
				}
			}
		}

		if (!this._status.distributedConnected) {
			const connected = await this.connectDistributedSocket()
			if (!connected) {
				return {
					distributedConnected: false,
					error: this._status.lastError ?? "Distributed socket connection failed.",
				}
			}
		}

		try {
			await this.pushDistributedState()
			return {
				distributedConnected: true,
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this._status.lastError = `Distributed skill sync failed: ${message}`
			this.emitLog(this._status.lastError, "error", "vcp-distributed")
			this.emitStatus()
			return {
				distributedConnected: false,
				error: message,
			}
		}
	}

	public async testConnection(timeoutMs = 5000): Promise<VcpBridgeTestResult> {
		if (!this.config.enabled || !this.config.url.trim()) {
			return { success: false, error: "VCP bridge is disabled or URL is empty." }
		}

		let timeoutHandle: NodeJS.Timeout | null = null
		try {
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(() => reject(new Error("Connection timeout.")), timeoutMs)
			})
			const connectionPromise = this.openSocketWithFallback("info")
			const result = await Promise.race([connectionPromise, timeoutPromise])
			result.socket.removeAllListeners()
			result.socket.close()
			return {
				success: true,
				endpoint: result.endpoint,
				latencyMs: result.latencyMs,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		} finally {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle)
			}
		}
	}

	/** 断开连接 */
	disconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.clearDistributedReconnectTimer()

		this.vcpLogWs?.removeAllListeners()
		this.vcpInfoWs?.removeAllListeners()
		this.distributedWs?.removeAllListeners()
		this.vcpLogWs?.close()
		this.vcpInfoWs?.close()
		this.distributedWs?.close()
		this.vcpLogWs = null
		this.vcpInfoWs = null
		this.distributedWs = null

		if (this._status.connected || this._status.distributedConnected) {
			this._status.connected = false
			this._status.distributedConnected = false
			this._status.distributedEndpoint = undefined
			this.emitStatus()
		}
	}

	/** 更新配置并按需重连 */
	updateConfig(config: VcpToolboxConfig): void {
		this.config = config
		this._status.reconnectAttempts = 0
		this._status.lastError = undefined
		this.distributedReconnectAttempts = 0
		this.disconnect()
		if (config.enabled) {
			void this.connect()
		}
	}

	get status(): VcpBridgeStatus {
		return { ...this._status }
	}

	dispose(): void {
		this.disconnect()
		this._onStatusChanged.dispose()
		this._onLogReceived.dispose()
	}
}
