import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import nock from "nock"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WebSocketServer } from "ws"

import { allowNetConnect } from "../../../vitest.setup"

vi.mock("vscode", () => {
	class MockEventEmitter<T> {
		private listeners: Array<(value: T) => void> = []

		event = (listener: (value: T) => void) => {
			this.listeners.push(listener)
			return {
				dispose: () => {
					this.listeners = this.listeners.filter((item) => item !== listener)
				},
			}
		}

		fire(value: T) {
			for (const listener of this.listeners) {
				listener(value)
			}
		}

		dispose() {
			this.listeners = []
		}
	}

	return {
		EventEmitter: MockEventEmitter,
	}
})

import { buildVcpDistributedSkillRemoteName } from "../../skills/vcpDistributedSkill"
import { VcpBridgeService } from "../vcp-bridge"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("VcpBridgeService", () => {
	beforeEach(() => {
		allowNetConnect(/127\.0\.0\.1/)
	})

	afterEach(() => {
		nock.cleanAll()
		nock.disableNetConnect()
		vi.restoreAllMocks()
	})

	it("connects to log/info/distributed channels and updates status", async () => {
		const wss = new WebSocketServer({ port: 0 })
		const address = wss.address()
		const port = typeof address === "object" && address ? address.port : 0
		const seenChannels: string[] = []

		wss.on("connection", (socket, request) => {
			const targetUrl = new URL(request.url ?? "/", `ws://127.0.0.1:${port}`)
			const pathname = targetUrl.pathname.toLowerCase()
			const channel =
				targetUrl.searchParams.get("channel") ??
				(pathname.includes("vcpinfo")
					? "info"
					: pathname.includes("vcplog")
						? "log"
						: pathname.includes("vcp-distributed-server")
							? "distributed"
							: "")
			seenChannels.push(channel)

			if (channel === "info") {
				socket.send(
					JSON.stringify({
						version: "1.2.3",
						activePlugins: [{ name: "bridge", version: "1.0.0", status: "active" }],
						distributedServers: [],
					}),
				)
			}
		})

		const service = new VcpBridgeService({
			enabled: true,
			url: `ws://127.0.0.1:${port}`,
			key: "",
			reconnectInterval: 500,
		})

		await service.connect()
		await sleep(50)

		expect(service.status.connected).toBe(true)
		expect(service.status.distributedConnected).toBe(true)
		expect(service.status.version).toBe("1.2.3")
		expect(seenChannels).toEqual(expect.arrayContaining(["log", "info", "distributed"]))

		service.disconnect()
		expect(service.status.connected).toBe(false)

		service.dispose()
		await new Promise<void>((resolve) => wss.close(() => resolve()))
	})

	it("registers distributed skill plugins and returns tool_result for execute_tool", async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vcp-bridge-skill-"))
		const skillPath = path.join(tempDir, "SKILL.md")
		await fs.writeFile(
			skillPath,
			`---
name: sample-skill
description: Sample distributed skill
---

# Sample Skill

Return this markdown body.
`,
			"utf8",
		)

		const remoteName = buildVcpDistributedSkillRemoteName("sample-skill")
		const seenDistributedMessages: string[] = []
		let registeredToolNames: string[] = []
		let registeredTools: any[] = []
		let toolResultPayload: any

		const wss = new WebSocketServer({ port: 0 })
		const address = wss.address()
		const port = typeof address === "object" && address ? address.port : 0

		wss.on("connection", (socket, request) => {
			const targetUrl = new URL(request.url ?? "/", `ws://127.0.0.1:${port}`)
			const pathname = targetUrl.pathname.toLowerCase()
			const channel =
				targetUrl.searchParams.get("channel") ??
				(pathname.includes("vcpinfo")
					? "info"
					: pathname.includes("vcplog")
						? "log"
						: pathname.includes("vcp-distributed-server")
							? "distributed"
							: "")

			if (channel === "info") {
				socket.send(
					JSON.stringify({
						version: "1.2.3",
						activePlugins: [{ name: remoteName, version: "0.0.0", status: "active" }],
						distributedServers: [],
					}),
				)
				return
			}

			if (channel !== "distributed") {
				return
			}

			socket.on("message", (data) => {
				const payload = JSON.parse(data.toString())
				seenDistributedMessages.push(payload.type)

				if (payload.type === "register_tools") {
					registeredTools = payload.data?.tools ?? []
					registeredToolNames = (payload.data?.tools ?? []).map((tool: any) => tool.name)
					socket.send(
						JSON.stringify({
							type: "execute_tool",
							data: {
								requestId: "req-1",
								toolName: remoteName,
								toolArgs: { format: "json" },
							},
						}),
					)
				}

				if (payload.type === "tool_result") {
					toolResultPayload = payload
				}
			})
		})

		const service = new VcpBridgeService({
			enabled: true,
			url: `ws://127.0.0.1:${port}`,
			key: "",
			reconnectInterval: 500,
		})

		await service.connect()
		await service.syncDistributedSkills([
			{
				canonicalName: "sample-skill",
				remoteName,
				displayName: "sample-skill",
				description: "Sample distributed skill",
				version: "0.0.0",
				sourceScope: "global",
				path: skillPath,
			},
		])
		await sleep(100)

		expect(registeredToolNames).toContain(remoteName)
		expect(registeredTools).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: remoteName,
					manifestVersion: "1.0.0",
					pluginType: "synchronous",
					entryPoint: expect.objectContaining({
						type: "nodejs",
						command: expect.any(String),
					}),
					communication: expect.objectContaining({
						protocol: "stdio",
						timeout: 15_000,
					}),
					capabilities: expect.objectContaining({
						invocationCommands: expect.arrayContaining([
							expect.objectContaining({
								commandIdentifier: remoteName,
								description: expect.stringContaining("Sample distributed skill"),
							}),
						]),
					}),
				}),
			]),
		)
		expect(seenDistributedMessages).toEqual(
			expect.arrayContaining(["register_tools", "report_ip", "update_static_placeholders", "tool_result"]),
		)
		expect(toolResultPayload?.data?.status).toBe("success")
		expect(toolResultPayload?.data?.result?.instructions).toContain("Return this markdown body.")

		service.dispose()
		await fs.rm(tempDir, { recursive: true, force: true })
		await new Promise<void>((resolve) => wss.close(() => resolve()))
	})
})
