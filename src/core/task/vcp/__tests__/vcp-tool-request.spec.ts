// novacode_change - new file

import {
	buildToolCandidates,
	deriveSkillDispatchName,
	isToolAllowed,
	limitToolRequests,
	normalizeToolName,
	resolveBridgeMode,
} from "../vcp-tool-request"
import { getDefaultVcpConfig } from "../../../../shared/vcp/vcp-types"

describe("vcp-tool-request", () => {
	test("normalizeToolName strips prefixes and normalizes delimiters", () => {
		expect(normalizeToolName("tool_request:Read-File")).toBe("read_file")
		expect(normalizeToolName("VCP.tool.execute_command")).toBe("execute_command")
	})

	test("buildToolCandidates returns normalized variants", () => {
		const candidates = buildToolCandidates("tool.request.Read-File")
		expect(candidates).toContain("tool.request.Read-File")
		expect(candidates).toContain("read_file")
		expect(candidates).toContain("read-file")
		expect(candidates).toContain("readfile")
	})

	test("isToolAllowed respects allow and deny lists", () => {
		const config = {
			...getDefaultVcpConfig().toolRequest,
			allowTools: ["read_file", "execute_command"],
			denyTools: ["execute_command"],
		}
		expect(isToolAllowed("read-file", config)).toBe(true)
		expect(isToolAllowed("execute_command", config)).toBe(false)
		expect(isToolAllowed("write_file", config)).toBe(false)
	})

	test("limitToolRequests enforces max length", () => {
		expect(limitToolRequests([1, 2, 3, 4], 2)).toEqual([1, 2])
		expect(limitToolRequests([1, 2], 0)).toEqual([1, 2])
	})

	test("resolveBridgeMode returns safe default", () => {
		const config = getDefaultVcpConfig().toolRequest
		expect(resolveBridgeMode(config)).toBe("execute")
		expect(resolveBridgeMode({ ...config, bridgeMode: "event" })).toBe("event")
	})

	test("deriveSkillDispatchName extracts skill name", () => {
		expect(deriveSkillDispatchName("skill:agent-manager")).toBe("agent-manager")
		expect(deriveSkillDispatchName("skill.my_skill")).toBe("my_skill")
		expect(deriveSkillDispatchName("read_file")).toBeNull()
	})
})
