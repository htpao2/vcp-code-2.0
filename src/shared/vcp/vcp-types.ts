// novacode_change - new file
// vcp_change: Shared VCP type re-exports for extension runtime code.

export type {
	AtomicMemoryItem,
	VcpAgentTeamConfig,
	VcpAgentTeamMember,
	VcpBridgeActivePlugin,
	VcpBridgeDistributedServer,
	VcpBridgeLogEntry,
	VcpBridgeRuntimeStats,
	VcpBridgeStatus,
	VcpConfig,
	VcpContextFoldConfig,
	VcpHtmlConfig,
	VcpInfoConfig,
	VcpMemoryConfig,
	VcpToolboxConfig,
	VcpToolRequestConfig,
} from "@roo-code/types"

export { getDefaultVcpConfig, vcpConfigSchema } from "@roo-code/types"
