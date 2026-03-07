import type { VcpDistributedSkillRegistration } from "@roo-code/types"

import type { SkillMetadata } from "../../shared/skills"

export const VCP_DISTRIBUTED_SKILL_REMOTE_PREFIX = "novacode-skill"
export const VCP_DISTRIBUTED_SKILL_PLACEHOLDER = "{{NovaCodeSkillCatalog}}"
export const VCP_DISTRIBUTED_SKILL_TIMEOUT_MS = 15_000

export interface VcpDistributedSkillSource {
	canonicalName: string
	remoteName: string
	displayName: string
	description?: string
	version?: string
	sourceScope?: "global" | "project"
	path: string
}

export interface VcpDistributedToolManifest {
	manifestVersion: string
	name: string
	displayName: string
	version: string
	description: string
	pluginType: "synchronous"
	entryPoint: {
		type: "nodejs"
		command: string
	}
	communication: {
		protocol: "stdio"
		timeout: number
	}
	capabilities: {
		invocationCommands: Array<{
			commandIdentifier: string
			description: string
			example: string
		}>
	}
	metadata: {
		source: "novacode-skill"
		canonicalName: string
		sourceScope?: "global" | "project"
		version?: string
	}
}

export function buildVcpDistributedSkillRemoteName(canonicalName: string): string {
	return `${VCP_DISTRIBUTED_SKILL_REMOTE_PREFIX}-${canonicalName}`
}

export function toVcpDistributedSkillSource(skill: SkillMetadata): VcpDistributedSkillSource {
	return {
		canonicalName: skill.name,
		remoteName: buildVcpDistributedSkillRemoteName(skill.name),
		displayName: skill.name,
		description: skill.description,
		version: "0.0.0",
		sourceScope: skill.source,
		path: skill.path,
	}
}

export function toVcpDistributedSkillRegistration(skill: VcpDistributedSkillSource): VcpDistributedSkillRegistration {
	return {
		canonicalName: skill.canonicalName,
		remoteName: skill.remoteName,
		displayName: skill.displayName,
		version: skill.version,
		description: skill.description,
		sourceScope: skill.sourceScope,
		status: "registered",
		registeredAt: Date.now(),
	}
}

export function buildVcpDistributedToolManifest(skill: VcpDistributedSkillSource): VcpDistributedToolManifest {
	const description = skill.description?.trim()
	const invocationDescription =
		description && description.length > 0
			? `${description} Returns the installed NovaCode skill instructions and metadata.`
			: `Returns the installed NovaCode skill instructions for ${skill.displayName}.`

	return {
		manifestVersion: "1.0.0",
		name: skill.remoteName,
		displayName: `Nova Skill · ${skill.displayName}`,
		version: skill.version ?? "0.0.0",
		description: invocationDescription,
		pluginType: "synchronous",
		entryPoint: {
			type: "nodejs",
			command: "node novacode-distributed-skill.js",
		},
		communication: {
			protocol: "stdio",
			timeout: VCP_DISTRIBUTED_SKILL_TIMEOUT_MS,
		},
		capabilities: {
			invocationCommands: [
				{
					commandIdentifier: skill.remoteName,
					description: invocationDescription,
					example: `<<<[TOOL_REQUEST]>>>\ntool_name:「始」${skill.remoteName}「末」\n<<<[END_TOOL_REQUEST]>>>`,
				},
			],
		},
		metadata: {
			source: "novacode-skill",
			canonicalName: skill.canonicalName,
			sourceScope: skill.sourceScope,
			version: skill.version,
		},
	}
}

export function buildVcpDistributedSkillPlaceholder(skills: VcpDistributedSkillSource[]): Record<string, string> {
	const summary = skills
		.map(
			(skill) =>
				`- ${skill.canonicalName}${skill.sourceScope ? ` [${skill.sourceScope}]` : ""}: ${skill.description ?? ""}`,
		)
		.join("\n")

	return {
		[VCP_DISTRIBUTED_SKILL_PLACEHOLDER]: JSON.stringify({
			vcp_dynamic_fold: true,
			plugin_description: "Installed NovaCode skills exported to VCPToolBox.",
			fold_blocks: [
				{
					threshold: 0.6,
					content: `Installed NovaCode skills (${skills.length}): ${skills.map((skill) => skill.canonicalName).join(", ") || "none"}`,
				},
				{
					threshold: 0.0,
					content: summary || "No installed NovaCode skills were discovered.",
				},
			],
		}),
	}
}
