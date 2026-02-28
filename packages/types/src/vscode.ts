import { z } from "zod"
import { novaLanguages } from "./nova/novaLanguages.js"

/**
 * CodeAction
 */

export const codeActionIds = ["explainCode", "fixCode", "improveCode", "addToContext", "newTask"] as const

export type CodeActionId = (typeof codeActionIds)[number]

export type CodeActionName = "EXPLAIN" | "FIX" | "IMPROVE" | "ADD_TO_CONTEXT" | "NEW_TASK"

/**
 * TerminalAction
 */

export const terminalActionIds = ["terminalAddToContext", "terminalFixCommand", "terminalExplainCommand"] as const

export type TerminalActionId = (typeof terminalActionIds)[number]

export type TerminalActionName = "ADD_TO_CONTEXT" | "FIX" | "EXPLAIN"

export type TerminalActionPromptType = `TERMINAL_${TerminalActionName}`

/**
 * Command
 */

export const commandIds = [
	"activationCompleted",

	"plusButtonClicked",
	"promptsButtonClicked",

	"historyButtonClicked",
	"marketplaceButtonClicked",
	"popoutButtonClicked",
	"cloudButtonClicked",
	"settingsButtonClicked",

	"openInNewTab",
	"open", // novacode_change
	"agentManagerOpen", // novacode_change

	"showHumanRelayDialog",
	"registerHumanRelayCallback",
	"unregisterHumanRelayCallback",
	"handleHumanRelayResponse",

	"newTask",

	"setCustomStoragePath",
	"importSettings",

	// "focusInput", // novacode_change
	"acceptInput",
	"profileButtonClicked", // novacode_change
	"helpButtonClicked", // novacode_change
	"focusChatInput", // novacode_change
	"importSettings", // novacode_change
	"exportSettings", // novacode_change
	"generateTerminalCommand", // novacode_change
	"handleExternalUri", // novacode_change - for JetBrains plugin URL forwarding
	"focusPanel",
	"toggleAutoApprove",
] as const

export type CommandId = (typeof commandIds)[number]

/**
 * Language
 */

export const languages = [
	...novaLanguages,
	"ca",
	"de",
	"en",
	"es",
	"fr",
	"hi",
	"id",
	"it",
	"ja",
	"ko",
	"nl",
	"pl",
	"pt-BR",
	"ru",
	"sk",
	"tr",
	"vi",
	"zh-CN",
	"zh-TW",
] as const

export const languagesSchema = z.enum(languages)

export type Language = z.infer<typeof languagesSchema>

export const isLanguage = (value: string): value is Language => languages.includes(value as Language)
