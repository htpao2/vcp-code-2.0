import { Anthropic } from "@anthropic-ai/sdk"
import { parseMentions } from "./index"
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { FileContextTracker } from "../context-tracking/FileContextTracker"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { ensureLocalNovarulesDirExists } from "../context/instructions/nova-rules"
import { parseNovaSlashCommands } from "../slash-commands/nova"
import { refreshWorkflowToggles } from "../context/instructions/workflows" // novacode_change

import * as vscode from "vscode" // novacode_change
import { ClineRulesToggles } from "../../shared/cline-rules"

// This function is a duplicate of processUserContentMentions, but it adds a check for the newrules command
// and processes Nova-specific slash commands. It should be merged with processUserContentMentions in the future.
export async function processNovaUserContentMentions({
	context, // novacode_change
	userContent,
	cwd,
	urlContentFetcher,
	fileContextTracker,
	rooIgnoreController,
	showRooIgnoredFiles = true,
	includeDiagnosticMessages = true,
	maxDiagnosticMessages = 50,
	maxReadFileLine,
}: {
	context: vscode.ExtensionContext // novacode_change
	userContent: Anthropic.Messages.ContentBlockParam[]
	cwd: string
	urlContentFetcher: UrlContentFetcher
	fileContextTracker: FileContextTracker
	rooIgnoreController?: any
	showRooIgnoredFiles: boolean
	includeDiagnosticMessages?: boolean
	maxDiagnosticMessages?: number
	maxReadFileLine?: number
}): Promise<[Anthropic.Messages.ContentBlockParam[], boolean]> {
	// Track if we need to check novarules file
	let needsRulesFileCheck = false

	// novacode_change
	const mentionTagRegex = /<(?:task|feedback|answer|user_message)>/

	// Helper function to process text through parseMentions and parseNovaSlashCommands
	// Returns the processed text and whether a novarules check is needed
	const processTextContent = async (
		text: string,
		localWorkflowToggles: ClineRulesToggles,
		globalWorkflowToggles: ClineRulesToggles,
	): Promise<{ processedText: string; needsRulesFileCheck: boolean }> => {
		const parsedText = await parseMentions(
			text,
			cwd,
			urlContentFetcher,
			fileContextTracker,
			rooIgnoreController,
			showRooIgnoredFiles,
			includeDiagnosticMessages,
			maxDiagnosticMessages,
			maxReadFileLine,
		)

		// when parsing slash commands, we still want to allow the user to provide their desired context
		const { processedText, needsRulesFileCheck: needsCheck } = await parseNovaSlashCommands(
			parsedText.text,
			localWorkflowToggles,
			globalWorkflowToggles,
		)

		return { processedText, needsRulesFileCheck: needsCheck }
	}

	const processUserContentMentions = async () => {
		// Process userContent array, which contains various block types:
		// TextBlockParam, ImageBlockParam, ToolUseBlockParam, and ToolResultBlockParam.
		// We need to apply parseMentions() to:
		// 1. All TextBlockParam's text (first user message with task)
		// 2. ToolResultBlockParam's content/context text arrays if it contains
		// "<feedback>" (see formatToolDeniedFeedback, attemptCompletion,
		// executeCommand, and consecutiveMistakeCount >= 3) or "<answer>"
		// (see askFollowupQuestion), we place all user generated content in
		// these tags so they can effectively be used as markers for when we
		// should parse mentions).

		const { localWorkflowToggles, globalWorkflowToggles } = await refreshWorkflowToggles(context, cwd) // novacode_change

		return await Promise.all(
			userContent.map(async (block) => {
				// novacode_change
				const shouldProcessMentions = (text: string) => mentionTagRegex.test(text)

				if (block.type === "text") {
					if (shouldProcessMentions(block.text)) {
						const { processedText, needsRulesFileCheck: needsCheck } = await processTextContent(
							block.text,
							localWorkflowToggles,
							globalWorkflowToggles,
						)

						if (needsCheck) {
							needsRulesFileCheck = true
						}

						return {
							...block,
							text: processedText,
						}
					}

					return block
				} else if (block.type === "tool_result") {
					if (typeof block.content === "string") {
						if (shouldProcessMentions(block.content)) {
							const { processedText, needsRulesFileCheck: needsCheck } = await processTextContent(
								block.content,
								localWorkflowToggles,
								globalWorkflowToggles,
							)

							if (needsCheck) {
								needsRulesFileCheck = true
							}

							return {
								...block,
								content: processedText,
							}
						}

						return block
					} else if (Array.isArray(block.content)) {
						const parsedContent = await Promise.all(
							block.content.map(async (contentBlock) => {
								if (contentBlock.type === "text" && shouldProcessMentions(contentBlock.text)) {
									const { processedText, needsRulesFileCheck: needsCheck } = await processTextContent(
										contentBlock.text,
										localWorkflowToggles,
										globalWorkflowToggles,
									)

									if (needsCheck) {
										needsRulesFileCheck = true
									}

									return {
										...contentBlock,
										text: processedText,
									}
								}

								return contentBlock
							}),
						)

						return { ...block, content: parsedContent }
					}

					return block
				}

				return block
			}),
		)
	}

	const processedUserContent = await processUserContentMentions()

	let novarulesError = false
	if (needsRulesFileCheck) {
		novarulesError = await ensureLocalNovarulesDirExists(cwd, GlobalFileNames.novaRules)
	}
	return [processedUserContent, novarulesError]
}
