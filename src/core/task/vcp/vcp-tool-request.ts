// novacode_change - new file
// vcp_change: VCP tool request normalization helpers.

import type { VcpToolRequestConfig } from "../../../shared/vcp/vcp-types"

const TOOL_PREFIX = /^(tool_request|toolrequest|tool|request|vcp)[\s:._-]*/i

function compactUnderscores(value: string): string {
	return value.replace(/_+/g, "_").replace(/^_+|_+$/g, "")
}

/** 工具名规范化: 去前缀、转下划线、统一小写 */
export function normalizeToolName(raw: string): string {
	let stripped = raw.trim()

	while (true) {
		const next = stripped.replace(TOOL_PREFIX, "")
		if (next === stripped) break
		stripped = next
	}

	const normalized = stripped
		.toLowerCase()
		.replace(/[./\\\s-]+/g, "_")
		.replace(/[^a-z0-9_]/g, "_")

	return compactUnderscores(normalized)
}

/** 生成模糊匹配候选名 */
export function buildToolCandidates(name: string): string[] {
	const raw = name.trim()
	if (!raw) return []

	const normalized = normalizeToolName(raw)
	const variants = new Set<string>()
	variants.add(raw)

	if (normalized) {
		variants.add(normalized)
		variants.add(normalized.replace(/_/g, "-"))
		variants.add(normalized.replace(/_/g, ""))
	}

	const dotted = raw.split(".").at(-1)?.trim()
	if (dotted && dotted !== raw) {
		const dottedNormalized = normalizeToolName(dotted)
		if (dottedNormalized) variants.add(dottedNormalized)
	}

	return Array.from(variants).filter(Boolean)
}

function normalizeSet(value?: string[]): Set<string> {
	const entries = new Set<string>()
	for (const item of value ?? []) {
		const normalized = normalizeToolName(item)
		if (normalized) entries.add(normalized)
	}
	return entries
}

/** 基于 allow/deny 列表检查工具权限 */
export function isToolAllowed(name: string, config: VcpToolRequestConfig): boolean {
	const normalized = normalizeToolName(name)
	if (!normalized) return false

	const deny = normalizeSet(config.denyTools)
	if (deny.has(normalized)) return false

	const allow = normalizeSet(config.allowTools)
	if (allow.size > 0 && !allow.has(normalized)) return false

	return true
}

/** 限制每条消息的工具请求数 */
export function limitToolRequests<T>(requests: T[], max: number): T[] {
	if (!Array.isArray(requests) || requests.length === 0) return []
	const safeMax = Number.isFinite(max) && max > 0 ? Math.floor(max) : requests.length
	return requests.slice(0, safeMax)
}

/** 解析桥接模式 */
export function resolveBridgeMode(config: VcpToolRequestConfig): "execute" | "event" {
	return config.bridgeMode === "event" ? "event" : "execute"
}

/** 解析 skill dispatch 名称 */
export function deriveSkillDispatchName(toolName: string): string | null {
	const value = toolName.trim()
	if (!value) return null

	const match = value.match(/^skill[:._-](.+)$/i)
	if (!match) return null

	const name = match[1]?.trim()
	return name || null
}
