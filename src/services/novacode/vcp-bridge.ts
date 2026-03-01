// novacode_change - new file
// vcp_change: VCPToolBox WebSocket bridge service.

import * as vscode from "vscode"
import WebSocket from "ws"

import type {
	VcpBridgeDistributedServer,
	VcpBridgeLogEntry,
	VcpBridgeStatus,
	VcpBridgeTestResult,
	VcpToolboxConfig,
} from "../../shared/vcp/vcp-types"

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

export class VcpBridgeService implements vscode.Disposable {
	private vcpLogWs: WebSocket | null = null
	private vcpInfoWs: WebSocket | null = null
	private reconnectTimer: NodeJS.Timeout | null = null
	private isConnecting = false
	private _status: VcpBridgeStatus = {
		connected: false,
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

	private buildSocketCandidates(channel: "log" | "info"): string[] {
		const normalized = this.normalizeToolboxUrl(this.config.url || "ws://localhost:5800")
		const key = this.config.key?.trim()
		const keySegment = key ? `/VCP_Key=${encodeURIComponent(key)}` : ""

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
		channel: "log" | "info",
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

	private handleSocketClosed(reason?: string) {
		if (this._status.connected) {
			this._status.connected = false
		}
		if (reason) {
			this._status.lastError = reason
		}
		this.emitStatus()
		this.scheduleReconnect()
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
			this._onLogReceived.fire(
				this.normalizeLogEntries({
					level: "error",
					source: "vcp-bridge",
					message: this._status.lastError,
				}),
			)
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
			this._onLogReceived.fire(
				this.normalizeLogEntries({
					level: "error",
					source: "vcp-bridge",
					message: this._status.lastError,
				}),
			)
			this.emitStatus()
		})
	}

	/** 建立双通道 WebSocket 连接 */
	async connect(): Promise<void> {
		if (!this.config.enabled || !this.config.url.trim() || this.isConnecting) return
		if (this._status.connected) return

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
			this._status.lastConnected = Date.now()
			this._status.lastError = undefined
			this._status.reconnectAttempts = 0
			this._status.endpoint = infoSocket.endpoint
			this._status.lastLatencyMs = Math.max(logSocket.latencyMs, infoSocket.latencyMs)
			this.emitStatus()
		} catch (error) {
			this._status.connected = false
			this._status.lastError = error instanceof Error ? error.message : String(error)
			this.emitStatus()
			this.scheduleReconnect()
			throw error
		} finally {
			this.isConnecting = false
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

		this.vcpLogWs?.removeAllListeners()
		this.vcpInfoWs?.removeAllListeners()
		this.vcpLogWs?.close()
		this.vcpInfoWs?.close()
		this.vcpLogWs = null
		this.vcpInfoWs = null

		if (this._status.connected) {
			this._status.connected = false
			this.emitStatus()
		}
	}

	/** 更新配置并按需重连 */
	updateConfig(config: VcpToolboxConfig): void {
		this.config = config
		this._status.reconnectAttempts = 0
		this._status.lastError = undefined
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
