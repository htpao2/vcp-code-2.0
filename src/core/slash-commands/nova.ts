// novacode_change whole file

import { ClineRulesToggles } from "../../shared/cline-rules"
import fs from "fs/promises"
import path from "path"
import {
	newTaskToolResponse,
	newRuleToolResponse,
	reportBugToolResponse,
	condenseToolResponse,
} from "../prompts/commands"
import type { McpServer, SkillSettings } from "@roo-code/types"

type SkillContextItem = {
	name: string
	description: string
	source: "global" | "project"
	mode?: string
}

export interface NovaSlashCommandContext {
	mcpServers?: McpServer[]
	skills?: SkillContextItem[]
	skillSettings?: SkillSettings
}

function enabledWorkflowToggles(workflowToggles: ClineRulesToggles) {
	return Object.entries(workflowToggles)
		.filter(([_, enabled]) => enabled)
		.map(([filePath, _]) => ({
			fullPath: filePath,
			fileName: path.basename(filePath),
		}))
}

function parseCommandArgs(raw: string | undefined): string[] {
	return (raw ?? "")
		.trim()
		.split(/\s+/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0)
}

function normalizeName(value: string): string {
	return value.trim().toLowerCase()
}

function buildMcpInstruction(
	commandName: string,
	argsRaw: string | undefined,
	context: NovaSlashCommandContext,
): string {
	const servers = context.mcpServers ?? []
	const args = parseCommandArgs(argsRaw)
	const commandSuffix = commandName.startsWith("mcp.") ? commandName.slice("mcp.".length) : ""

	let serverName = ""
	let toolName = ""

	if (commandSuffix) {
		const parts = commandSuffix.split(".").filter(Boolean)
		serverName = parts[0] ?? ""
		toolName = parts.slice(1).join(".")
	}

	if (!serverName && args.length > 0) {
		serverName = args[0]
	}
	if (!toolName && args.length > 1) {
		toolName = args[1]
	}

	if (!serverName) {
		const available = servers.slice(0, 12).map((server) => server.name)
		const summary = available.length > 0 ? available.join(", ") : "(no MCP servers detected)"
		return [
			`<explicit_instructions type="mcp">`,
			`User requested MCP usage.`,
			`Use MCP tools whenever they are relevant.`,
			`Available MCP servers: ${summary}.`,
			`If no MCP server is suitable, explain why and proceed with built-in tools.`,
			`</explicit_instructions>`,
		].join("\n")
	}

	const server = servers.find((item) => normalizeName(item.name) === normalizeName(serverName))
	const availableTools = server?.tools?.map((tool) => tool.name) ?? []
	const toolSummary = availableTools.length > 0 ? availableTools.slice(0, 20).join(", ") : "(no tools discovered)"

	const selectedTool = toolName || args[2] || ""
	return [
		`<explicit_instructions type="mcp">`,
		`User requested MCP server "${serverName}"${selectedTool ? ` and tool "${selectedTool}"` : ""}.`,
		`Prioritize this MCP server before alternative approaches.`,
		selectedTool
			? `Try "${selectedTool}" first; if unavailable, use the nearest equivalent MCP tool and explain the fallback.`
			: `Available tools on this server: ${toolSummary}.`,
		`If MCP execution is not possible, clearly state the limitation and continue safely.`,
		`</explicit_instructions>`,
	].join("\n")
}

function buildSkillInstruction(
	commandName: string,
	argsRaw: string | undefined,
	context: NovaSlashCommandContext,
): string {
	const settings = context.skillSettings
	if (settings?.enabled === false) {
		return [
			`<explicit_instructions type="skill">`,
			`Skills are currently disabled in settings.`,
			`Proceed without activating a skill and explain this constraint briefly.`,
			`</explicit_instructions>`,
		].join("\n")
	}

	const allSkills = context.skills ?? []
	const disabledSkills = new Set((settings?.disabledSkills ?? []).map((name) => normalizeName(name)))
	const skills = allSkills.filter((skill) => !disabledSkills.has(normalizeName(skill.name)))
	const args = parseCommandArgs(argsRaw)
	const commandSuffix = commandName.startsWith("skill.") ? commandName.slice("skill.".length) : ""
	const selectedSkillName = commandSuffix || args[0] || ""

	if (!selectedSkillName) {
		const skillSummary =
			skills.length > 0
				? skills
						.slice(0, 15)
						.map((skill) => `${skill.name}${skill.mode ? `(${skill.mode})` : ""}`)
						.join(", ")
				: "(no enabled skills detected)"
		return [
			`<explicit_instructions type="skill">`,
			`User requested skill-guided execution.`,
			`Choose the most relevant enabled skill before writing code.`,
			`Enabled skills: ${skillSummary}.`,
			`If no skill matches, explain that and proceed without forcing a skill.`,
			`</explicit_instructions>`,
		].join("\n")
	}

	const selectedSkill = skills.find((skill) => normalizeName(skill.name) === normalizeName(selectedSkillName))
	if (!selectedSkill) {
		return [
			`<explicit_instructions type="skill">`,
			`User requested skill "${selectedSkillName}", but it is unavailable or disabled.`,
			`Do not fabricate missing skills. Continue with normal reasoning and mention this limitation.`,
			`</explicit_instructions>`,
		].join("\n")
	}

	return [
		`<explicit_instructions type="skill">`,
		`User requested skill "${selectedSkill.name}".`,
		`Skill description: ${selectedSkill.description}.`,
		`Source: ${selectedSkill.source}${selectedSkill.mode ? `, mode: ${selectedSkill.mode}` : ""}.`,
		`Apply this skill's process when relevant; if it conflicts with task reality, explain and adapt safely.`,
		`</explicit_instructions>`,
	].join("\n")
}

/**
 * This file is a duplicate of parseSlashCommands, but it adds a check for the newrule command
 * and processes Nova-specific slash commands. It should be merged with parseSlashCommands in the future.
 */
export async function parseNovaSlashCommands(
	text: string,
	localWorkflowToggles: ClineRulesToggles,
	globalWorkflowToggles: ClineRulesToggles,
	commandContext: NovaSlashCommandContext = {},
): Promise<{ processedText: string; needsRulesFileCheck: boolean }> {
	const condenseAliases = condenseToolResponse

	const commandReplacements: Record<string, ((userInput: string) => string) | undefined> = {
		newtask: newTaskToolResponse,
		newrule: newRuleToolResponse,
		reportbug: reportBugToolResponse,
		smol: condenseAliases,
		condense: condenseAliases,
		compact: condenseAliases,
	}

	// this currently allows matching prepended whitespace prior to /slash-command
	const tagPattern = /<(task|feedback|answer|user_message)>(\s*\/([a-zA-Z0-9_.-]+))(\s+.+?)?\s*<\/\1>/dis

	const match = tagPattern.exec(text)

	if (match?.indices) {
		// remove the slash command
		const commandName = match[3]
		const [slashCommandStartIndex, slashCommandEndIndex] = match.indices[2]
		const textWithoutSlashCommand = text.slice(0, slashCommandStartIndex) + text.slice(slashCommandEndIndex)
		const commandArgs = match[4]

		const command = commandReplacements[commandName]
		if (command) {
			const processedText = command(textWithoutSlashCommand)
			return { processedText, needsRulesFileCheck: commandName === "newrule" }
		}

		if (commandName === "mcp" || commandName.startsWith("mcp.")) {
			const explicitInstruction = buildMcpInstruction(commandName, commandArgs, commandContext)
			return {
				processedText: `${explicitInstruction}\n${textWithoutSlashCommand}`,
				needsRulesFileCheck: false,
			}
		}

		if (commandName === "skill" || commandName.startsWith("skill.")) {
			const explicitInstruction = buildSkillInstruction(commandName, commandArgs, commandContext)
			return {
				processedText: `${explicitInstruction}\n${textWithoutSlashCommand}`,
				needsRulesFileCheck: false,
			}
		}

		const matchingWorkflow = [
			...enabledWorkflowToggles(localWorkflowToggles),
			...enabledWorkflowToggles(globalWorkflowToggles),
		].find((workflow) => workflow.fileName === commandName)

		if (matchingWorkflow) {
			try {
				// Read workflow file content from the full path
				const workflowContent = (await fs.readFile(matchingWorkflow.fullPath, "utf8")).trim()

				const processedText =
					`<explicit_instructions type="${matchingWorkflow.fileName}">\n${workflowContent}\n</explicit_instructions>\n` +
					textWithoutSlashCommand

				return { processedText, needsRulesFileCheck: false }
			} catch (error) {
				console.error(`Error reading workflow file ${matchingWorkflow.fullPath}: ${error}`)
			}
		}
	}

	// if no supported commands are found, return the original text
	return { processedText: text, needsRulesFileCheck: false }
}
