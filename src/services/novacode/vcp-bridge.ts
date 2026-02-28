// novacode_change - new file
// vcp_change: VCPToolBox WebSocket bridge service.

import * as vscode from "vscode"
import WebSocket from "ws"

import type {
	VcpBridgeDistributedServer,
	VcpBridgeLogEntry,
	VcpBridgeStatus,
	VcpToolboxConfig,
} from "../../shared/vcp/vcp-types"

type BridgeInfoPayload = {
	version?: string
	stats?: VcpBridgeStatus["stats"]
	activePlugins?: VcpBridgeStatus["activePlugins"]
	distributedServers?: VcpBridgeDistributedServer[]
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
	}

	private readonly _onStatusChanged = new vscode.EventEmitter<VcpBridgeStatus>()
	readonly onStatusChanged = this._onStatusChanged.event

	private readonly _onLogReceived = new vscode.EventEmitter<VcpBridgeLogEntry[]>()
	readonly onLogReceived = this._onLogReceived.event

	constructor(private config: VcpToolboxConfig) {}

	private emitStatus() {
		this._onStatusChanged.fire({ ...this._status })
	}

	private createSocket(channel: "log" | "info"): WebSocket {
		const baseUrl = this.config.url.trim()
		const url = new URL(baseUrl)
		url.searchParams.set("channel", channel)
		if (this.config.key) {
			url.searchParams.set("key", this.config.key)
		}
		return new WebSocket(url.toString())
	}

	private normalizeLogEntries(payload: unknown): VcpBridgeLogEntry[] {
		const rows = Array.isArray(payload) ? payload : [payload]
		const entries: VcpBridgeLogEntry[] = []

		for (const row of rows) {
			if (!row || typeof row !== "object") continue
			const item = row as Record<string, unknown>
			const levelRaw = String(item.level ?? "info").toLowerCase()
			const level = levelRaw === "warn" || levelRaw === "error" || levelRaw === "debug" ? levelRaw : "info"
			entries.push({
				timestamp: Number(item.timestamp ?? Date.now()),
				level,
				source: String(item.source ?? "vcp-bridge"),
				message: String(item.message ?? item.text ?? ""),
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
	}

	private scheduleReconnect() {
		if (!this.config.enabled || this.reconnectTimer) return

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			void this.connect()
		}, this.config.reconnectInterval)
	}

	private bindInfoSocket(ws: WebSocket) {
		ws.on("message", (data: WebSocket.RawData) => {
			try {
				const payload = JSON.parse(data.toString()) as BridgeInfoPayload
				this.applyInfoPayload(payload)
			} catch (error) {
				const entries = this.normalizeLogEntries({
					level: "warn",
					source: "vcp-bridge",
					message: `Invalid info payload: ${error instanceof Error ? error.message : String(error)}`,
				})
				this._onLogReceived.fire(entries)
			}
		})

		ws.on("close", () => {
			this._status.connected = false
			this.emitStatus()
			this.scheduleReconnect()
		})

		ws.on("error", (error) => {
			const entries = this.normalizeLogEntries({
				level: "error",
				source: "vcp-bridge",
				message: `Info socket error: ${error.message}`,
			})
			this._onLogReceived.fire(entries)
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
				const entries = this.normalizeLogEntries({
					level: "info",
					source: "vcp-bridge",
					message: data.toString(),
				})
				this._onLogReceived.fire(entries)
			}
		})

		ws.on("close", () => {
			this._status.connected = false
			this.emitStatus()
			this.scheduleReconnect()
		})

		ws.on("error", (error) => {
			const entries = this.normalizeLogEntries({
				level: "error",
				source: "vcp-bridge",
				message: `Log socket error: ${error.message}`,
			})
			this._onLogReceived.fire(entries)
		})
	}

	/** 建立双 WebSocket 连接 */
	async connect(): Promise<void> {
		if (!this.config.enabled || !this.config.url.trim() || this.isConnecting) return
		if (this._status.connected) return

		this.disconnect()
		this.isConnecting = true

		try {
			this.vcpLogWs = this.createSocket("log")
			this.vcpInfoWs = this.createSocket("info")

			this.bindLogSocket(this.vcpLogWs)
			this.bindInfoSocket(this.vcpInfoWs)

			await Promise.all([
				new Promise<void>((resolve, reject) => {
					this.vcpLogWs?.once("open", () => resolve())
					this.vcpLogWs?.once("error", reject)
				}),
				new Promise<void>((resolve, reject) => {
					this.vcpInfoWs?.once("open", () => resolve())
					this.vcpInfoWs?.once("error", reject)
				}),
			])

			this._status.connected = true
			this.emitStatus()
		} catch (error) {
			this._status.connected = false
			this.emitStatus()
			this.scheduleReconnect()
			throw error
		} finally {
			this.isConnecting = false
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

	/** 更新配置 (设置面板变更时调用) */
	updateConfig(config: VcpToolboxConfig): void {
		this.config = config
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
