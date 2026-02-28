import { z } from "zod"

import type { GlobalSettings, RooCodeSettings, GlobalState } from "./global-settings.js"
import type { ProviderSettings, ProviderSettingsEntry } from "./provider-settings.js"
import type { HistoryItem } from "./history.js"
import type { ModeConfig, PromptComponent } from "./mode.js"
import type { TelemetrySetting } from "./telemetry.js"
import type { Experiments } from "./experiment.js"
import type { ClineMessage, QueuedMessage } from "./message.js"
import {
	type MarketplaceItem,
	type InstallMarketplaceItemOptions,
	type McpMarketplaceItem,
	type MarketplaceInstalledMetadata,
	marketplaceItemSchema,
} from "./marketplace.js"
import type { TodoItem } from "./todo.js"
import type { CloudUserInfo, CloudOrganizationMembership, OrganizationAllowList, ShareVisibility } from "./cloud.js"
import type { SerializedCustomToolDefinition } from "./custom-tool.js"
import type { GitCommit } from "./git.js"
import type { McpServer } from "./mcp.js"
import type { ModelRecord, RouterModels, ModelInfo } from "./model.js"
import type { CommitRange } from "./nova/novacode.js"
import type { OpenAiCodexRateLimitInfo } from "./providers/openai-codex-rate-limits.js"

// novacode_change start: Type definitions for Nova Code-specific features
// SAP AI Core deployment types
export type DeploymentRecord = Record<
	string,
	{
		id: string
		configurationId: string
		configurationName: string
		scenarioId: string
		status: string
		statusMessage?: string
		deploymentUrl?: string
		submissionTime: string
		modifiedTime?: string
		targetStatus?: string
	}
>

// Speech-to-text types
export interface STTSegment {
	text: string
	start: number
	end: number
	isFinal: boolean
}

export interface MicrophoneDevice {
	id: string
	name: string
	isDefault?: boolean
}

// MCP Marketplace types
export interface McpMarketplaceCatalog {
	items: McpMarketplaceItem[]
	lastUpdated?: string
}

export interface McpDownloadResponse {
	// novacode_change: This payload is used both for the marketplace download details
	// modal and for older install flows. Keep it permissive for backwards compatibility.
	mcpId: string
	// Marketplace download details (preferred)
	githubUrl?: string
	name?: string
	author?: string
	description?: string
	readmeContent?: string
	llmsInstallationContent?: string
	requiresApiKey?: boolean
	// Legacy install response
	success?: boolean
	error?: string
	installPath?: string
}

// Rules and workflows types
export type ClineRulesToggles = Record<string, boolean>

// Wrapper properties
export interface NovaCodeWrapperProperties {
	novaCodeWrapped: boolean
	wrapperName?: string
	wrapperVersion?: string
	wrapperTitle?: string
}
// novacode_change end

// Command interface for frontend/backend communication
export interface Command {
	name: string
	source: "global" | "project" | "built-in"
	filePath?: string
	description?: string
	argumentHint?: string
}

// Indexing status types
export interface IndexingStatus {
	systemStatus: string
	message?: string
	processedItems: number
	totalItems: number
	currentItemUnit?: string
	workspacePath?: string
	gitBranch?: string // Current git branch being indexed
	manifest?: {
		totalFiles: number
		totalChunks: number
		lastUpdated: string
	}
}

export interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: IndexingStatus
}

export interface LanguageModelChatSelector {
	vendor?: string
	family?: string
	version?: string
	id?: string
}

// Represents JSON data that is sent from extension to webview, called
// ExtensionMessage and has 'type' enum which can be 'plusButtonClicked' or
// 'settingsButtonClicked' or 'hello'. Webview will hold state.
/**
 * ExtensionMessage
 * Extension -> Webview | CLI
 */
export interface ExtensionMessage {
	type:
		| "action"
		| "state"
		| "selectedImages"
		| "theme"
		| "workspaceUpdated"
		| "invoke"
		| "messageUpdated"
		| "mcpServers"
		| "enhancedPrompt"
		| "commitSearchResults"
		| "listApiConfig"
		| "routerModels"
		| "openAiModels"
		| "ollamaModels"
		| "lmStudioModels"
		| "vsCodeLmModels"
		| "huggingFaceModels"
		| "sapAiCoreModels" // novacode_change
		| "sapAiCoreDeployments" // novacode_change
		| "vsCodeLmApiAvailable"
		| "updatePrompt"
		| "systemPrompt"
		| "autoApprovalEnabled"
		| "yoloMode" // novacode_change
		| "updateCustomMode"
		| "deleteCustomMode"
		| "exportModeResult"
		| "importModeResult"
		| "checkRulesDirectoryResult"
		| "deleteCustomModeCheck"
		| "currentCheckpointUpdated"
		| "checkpointInitWarning"
		| "insertTextToChatArea" // novacode_change
		| "showHumanRelayDialog"
		| "humanRelayResponse"
		| "humanRelayCancel"
		| "browserToolEnabled"
		| "browserConnectionResult"
		| "remoteBrowserEnabled"
		| "ttsStart"
		| "ttsStop"
		| "maxReadFileLine"
		| "fileSearchResults"
		| "toggleApiConfigPin"
		| "mcpMarketplaceCatalog" // novacode_change
		| "mcpDownloadDetails" // novacode_change
		| "showSystemNotification" // novacode_change
		| "openInBrowser" // novacode_change
		| "acceptInput"
		| "focusChatInput" // novacode_change
		| "stt:started" // novacode_change: STT session started
		| "stt:transcript" // novacode_change: STT transcript update
		| "stt:volume" // novacode_change: STT volume level
		| "stt:stopped" // novacode_change: STT session stopped
		| "stt:statusResponse" // novacode_change: Response to stt:checkAvailability request
		| "stt:devices" // novacode_change: Microphone devices list
		| "stt:deviceSelected" // novacode_change: Device selection confirmation
		| "settingsImported" // novacode_change
		| "setHistoryPreviewCollapsed"
		| "commandExecutionStatus"
		| "mcpExecutionStatus"
		| "vsCodeSetting"
		| "profileDataResponse" // novacode_change
		| "balanceDataResponse" // novacode_change
		| "updateProfileData" // novacode_change
		| "profileConfigurationForEditing" // novacode_change: Response with profile config for editing
		| "authenticatedUser"
		| "condenseTaskContextStarted"
		| "condenseTaskContextResponse"
		| "singleRouterModelFetchResponse"
		| "rooCreditBalance"
		| "indexingStatusUpdate"
		| "indexCleared"
		| "codebaseIndexConfig"
		| "rulesData" // novacode_change
		| "marketplaceInstallResult"
		| "marketplaceRemoveResult"
		| "marketplaceData"
		| "mermaidFixResponse" // novacode_change
		| "tasksByIdResponse" // novacode_change
		| "taskHistoryResponse" // novacode_change
		| "shareTaskSuccess"
		| "codeIndexSettingsSaved"
		| "codeIndexSecretStatus"
		| "showDeleteMessageDialog"
		| "showEditMessageDialog"
		| "novacodeNotificationsResponse" // novacode_change
		| "usageDataResponse" // novacode_change
		| "keybindingsResponse" // novacode_change
		| "autoPurgeEnabled" // novacode_change
		| "autoPurgeDefaultRetentionDays" // novacode_change
		| "autoPurgeFavoritedTaskRetentionDays" // novacode_change
		| "autoPurgeCompletedTaskRetentionDays" // novacode_change
		| "autoPurgeIncompleteTaskRetentionDays" // novacode_change
		| "manualPurge" // novacode_change
		| "commands"
		| "insertTextIntoTextarea"
		| "dismissedUpsells"
		| "interactionRequired"
		| "managedIndexerState" // novacode_change
		| "managedIndexerEnabled" // novacode_change
		| "browserSessionUpdate"
		| "browserSessionNavigate"
		| "organizationSwitchResult"
		| "showTimestamps" // novacode_change
		| "showDiffStats" // novacode_change
		| "apiMessagesSaved" // novacode_change: File save event for API messages
		| "taskMessagesSaved" // novacode_change: File save event for task messages
		| "taskMetadataSaved" // novacode_change: File save event for task metadata
		| "managedIndexerState" // novacode_change
		| "singleCompletionResult" // novacode_change
		| "deviceAuthStarted" // novacode_change: Device auth initiated
		| "deviceAuthPolling" // novacode_change: Device auth polling update
		| "deviceAuthComplete" // novacode_change: Device auth successful
		| "deviceAuthFailed" // novacode_change: Device auth failed
		| "deviceAuthCancelled" // novacode_change: Device auth cancelled
		| "chatCompletionResult" // novacode_change: FIM completion result for chat text area
		| "claudeCodeRateLimits"
		| "customToolsResult"
		| "modes"
		| "taskWithAggregatedCosts"
		| "skillsData"
		| "askReviewScope" // novacode_change: Review mode scope selection
		| "openAiCodexRateLimits"
	text?: string
	// novacode_change start
	completionRequestId?: string // Correlation ID from request
	completionText?: string // The completed text
	completionError?: string // Error message if failed
	payload?:
		| ProfileDataResponsePayload
		| BalanceDataResponsePayload
		| TasksByIdResponsePayload
		| TaskHistoryResponsePayload
		| [string, string] // For file save events [taskId, filePath]
	// novacode_change end
	// Checkpoint warning message
	checkpointWarning?: {
		type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"
		timeout: number
	}
	action?:
		| "chatButtonClicked"
		| "settingsButtonClicked"
		| "historyButtonClicked"
		| "promptsButtonClicked" // novacode_change
		| "profileButtonClicked" // novacode_change
		| "marketplaceButtonClicked"
		| "cloudButtonClicked"
		| "didBecomeVisible"
		| "focusInput"
		| "switchTab"
		| "focusChatInput" // novacode_change
		| "toggleAutoApprove"
	invoke?: "newChat" | "sendMessage" | "primaryButtonClick" | "secondaryButtonClick" | "setChatBoxMessage"
	state?: ExtensionState
	images?: string[]
	filePaths?: string[]
	openedTabs?: Array<{
		label: string
		isActive: boolean
		path?: string
	}>
	clineMessage?: ClineMessage
	routerModels?: RouterModels
	openAiModels?: string[]
	ollamaModels?: ModelRecord
	lmStudioModels?: ModelRecord
	vsCodeLmModels?: { vendor?: string; family?: string; version?: string; id?: string }[]
	huggingFaceModels?: Array<{
		id: string
		object: string
		created: number
		owned_by: string
		providers: Array<{
			provider: string
			status: "live" | "staging" | "error"
			supports_tools?: boolean
			supports_structured_output?: boolean
			context_length?: number
			pricing?: {
				input: number
				output: number
			}
		}>
	}>
	sapAiCoreModels?: ModelRecord // novacode_change
	sapAiCoreDeployments?: DeploymentRecord // novacode_change
	mcpServers?: McpServer[]
	commits?: GitCommit[]
	listApiConfig?: ProviderSettingsEntry[]
	apiConfiguration?: ProviderSettings // novacode_change: For profileConfigurationForEditing response
	sessionId?: string // novacode_change: STT session ID
	segments?: STTSegment[] // novacode_change: STT transcript segments (complete state)
	isFinal?: boolean // novacode_change: STT transcript is final
	level?: number // novacode_change: STT volume level (0-1)
	reason?: "completed" | "cancelled" | "error" // novacode_change: STT stop reason
	speechToTextStatus?: { available: boolean; reason?: "openaiKeyMissing" | "ffmpegNotInstalled" } // novacode_change: Speech-to-text availability status response
	devices?: MicrophoneDevice[] // novacode_change: Microphone devices list
	device?: MicrophoneDevice | null // novacode_change: Selected microphone device
	mode?: string
	customMode?: ModeConfig
	slug?: string
	success?: boolean
	/** Generic payload for extension messages that use `values` */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	values?: Record<string, any>
	requestId?: string
	promptText?: string
	results?:
		| { path: string; type: "file" | "folder"; label?: string }[]
		| { name: string; description?: string; argumentHint?: string; source: "global" | "project" | "built-in" }[]
	error?: string
	mcpMarketplaceCatalog?: McpMarketplaceCatalog // novacode_change
	mcpDownloadDetails?: McpDownloadResponse // novacode_change
	notificationOptions?: {
		title?: string
		subtitle?: string
		message: string
	} // novacode_change
	url?: string // novacode_change
	keybindings?: Record<string, string> // novacode_change
	setting?: string
	value?: any // eslint-disable-line @typescript-eslint/no-explicit-any
	hasContent?: boolean
	items?: MarketplaceItem[]
	userInfo?: CloudUserInfo
	organizationAllowList?: OrganizationAllowList
	tab?: string
	// novacode_change: Rules data
	globalRules?: ClineRulesToggles
	localRules?: ClineRulesToggles
	globalWorkflows?: ClineRulesToggles
	localWorkflows?: ClineRulesToggles
	marketplaceItems?: MarketplaceItem[]
	organizationMcps?: MarketplaceItem[]
	marketplaceInstalledMetadata?: MarketplaceInstalledMetadata
	fixedCode?: string | null // For mermaidFixResponse // novacode_change
	errors?: string[]
	visibility?: ShareVisibility
	rulesFolderPath?: string
	settings?: any // eslint-disable-line @typescript-eslint/no-explicit-any
	messageTs?: number
	hasCheckpoint?: boolean
	context?: string
	// novacode_change start: Notifications
	notifications?: Array<{
		id: string
		title: string
		message: string
		action?: {
			actionText: string
			actionURL: string
		}
	}>
	// novacode_change end
	commands?: Command[]
	skills?: Array<{
		// novacode_change: Skills data
		name: string
		description: string
		path: string
		source: "global" | "project"
		mode?: string
	}>
	queuedMessages?: QueuedMessage[]
	list?: string[] // For dismissedUpsells
	organizationId?: string | null // For organizationSwitchResult
	// novacode_change start: Managed Indexer
	managedIndexerEnabled?: boolean
	managedIndexerState?: Array<{
		workspaceFolderPath: string
		workspaceFolderName: string
		gitBranch: string | null
		projectId: string | null
		isIndexing: boolean
		hasManifest: boolean
		manifestFileCount: number
		hasWatcher: boolean
		error?: {
			type: string
			message: string
			timestamp: string
			context?: {
				filePath?: string
				branch?: string
				operation?: string
			}
		}
	}> // novacode_change end: Managed Indexer
	browserSessionMessages?: ClineMessage[] // For browser session panel updates
	isBrowserSessionActive?: boolean // For browser session panel updates
	stepIndex?: number // For browserSessionNavigate: the target step index to display
	// novacode_change start: Device auth data
	deviceAuthCode?: string
	deviceAuthVerificationUrl?: string
	deviceAuthExpiresIn?: number
	deviceAuthTimeRemaining?: number
	deviceAuthToken?: string
	deviceAuthUserEmail?: string
	deviceAuthError?: string
	// novacode_change end: Device auth data
	tools?: SerializedCustomToolDefinition[] // For customToolsResult
	modes?: { slug: string; name: string }[] // For modes response
	aggregatedCosts?: {
		// For taskWithAggregatedCosts response
		totalCost: number
		ownCost: number
		childrenCost: number
	}
	historyItem?: HistoryItem
	// novacode_change start: Review mode
	reviewScopeInfo?: {
		uncommitted: {
			available: boolean
			fileCount: number
			filePreview?: string[]
		}
		branch: {
			available: boolean
			currentBranch: string
			baseBranch: string
			fileCount: number
			filePreview?: string[]
		}
		error?: string
	}
	// novacode_change end: Review mode
}

export interface OpenAiCodexRateLimitsMessage {
	type: "openAiCodexRateLimits"
	values?: OpenAiCodexRateLimitInfo
	error?: string
}

export type ExtensionState = Pick<
	GlobalSettings,
	| "currentApiConfigName"
	| "listApiConfigMeta"
	| "pinnedApiConfigs"
	| "customInstructions"
	| "dismissedUpsells"
	| "autoApprovalEnabled"
	| "yoloMode" // novacode_change
	| "alwaysAllowReadOnly"
	| "alwaysAllowReadOnlyOutsideWorkspace"
	| "alwaysAllowWrite"
	| "alwaysAllowWriteOutsideWorkspace"
	| "alwaysAllowWriteProtected"
	| "alwaysAllowDelete" // novacode_change
	| "alwaysAllowBrowser"
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "alwaysAllowSubtasks"
	| "alwaysAllowFollowupQuestions"
	| "alwaysAllowExecute"
	| "followupAutoApproveTimeoutMs"
	| "allowedCommands"
	| "deniedCommands"
	| "allowedMaxRequests"
	| "allowedMaxCost"
	| "browserToolEnabled"
	| "browserViewportSize"
	| "showAutoApproveMenu" // novacode_change
	| "hideCostBelowThreshold" // novacode_change
	| "screenshotQuality"
	| "remoteBrowserEnabled"
	| "cachedChromeHostUrl"
	| "remoteBrowserHost"
	| "ttsEnabled"
	| "ttsSpeed"
	| "soundEnabled"
	| "soundVolume"
	| "maxConcurrentFileReads"
	| "allowVeryLargeReads" // novacode_change
	| "terminalOutputLineLimit"
	| "terminalOutputCharacterLimit"
	| "terminalShellIntegrationTimeout"
	| "terminalShellIntegrationDisabled"
	| "terminalCommandDelay"
	| "terminalPowershellCounter"
	| "terminalZshClearEolMark"
	| "terminalZshOhMy"
	| "terminalZshP10k"
	| "terminalZdotdir"
	| "terminalCompressProgressBar"
	| "diagnosticsEnabled"
	| "diffEnabled"
	| "fuzzyMatchThreshold"
	| "morphApiKey" // novacode_change: Morph fast apply - global setting
	| "fastApplyModel" // novacode_change: Fast Apply model selection
	| "fastApplyApiProvider" // novacode_change: Fast Apply model api base url
	// | "experiments" // Optional in GlobalSettings, required here.
	| "language"
	| "modeApiConfigs"
	| "customModePrompts"
	| "customSupportPrompts"
	| "enhancementApiConfigId"
	| "localWorkflowToggles" // novacode_change
	| "globalRulesToggles" // novacode_change
	| "localRulesToggles" // novacode_change
	| "globalWorkflowToggles" // novacode_change
	| "commitMessageApiConfigId" // novacode_change
	| "terminalCommandApiConfigId" // novacode_change
	| "dismissedNotificationIds" // novacode_change
	| "ghostServiceSettings" // novacode_change
	| "autoPurgeEnabled" // novacode_change
	| "autoPurgeDefaultRetentionDays" // novacode_change
	| "autoPurgeFavoritedTaskRetentionDays" // novacode_change
	| "autoPurgeCompletedTaskRetentionDays" // novacode_change
	| "autoPurgeIncompleteTaskRetentionDays" // novacode_change
	| "autoPurgeLastRunTimestamp" // novacode_change
	| "condensingApiConfigId"
	| "customCondensingPrompt"
	| "yoloGatekeeperApiConfigId" // novacode_change: AI gatekeeper for YOLO mode
	| "codebaseIndexConfig"
	| "codebaseIndexModels"
	| "profileThresholds"
	| "systemNotificationsEnabled" // novacode_change
	| "includeDiagnosticMessages"
	| "maxDiagnosticMessages"
	| "imageGenerationProvider"
	| "openRouterImageGenerationSelectedModel"
	| "includeTaskHistoryInEnhance"
	| "reasoningBlockCollapsed"
	| "enterBehavior"
	| "includeCurrentTime"
	| "includeCurrentCost"
	| "maxGitStatusFiles"
	| "requestDelaySeconds"
	| "selectedMicrophoneDevice" // novacode_change: Selected microphone device for STT
> & {
	version: string
	clineMessages: ClineMessage[]
	currentTaskItem?: HistoryItem
	currentTaskTodos?: TodoItem[] // Initial todos for the current task
	currentTaskCumulativeCost?: number // novacode_change: cumulative cost including deleted messages
	apiConfiguration: ProviderSettings
	uriScheme?: string
	uiKind?: string // novacode_change

	novaCodeWrapperProperties?: NovaCodeWrapperProperties // novacode_change: Wrapper information

	novacodeDefaultModel: string
	shouldShowAnnouncement: boolean

	taskHistory?: HistoryItem[] // novacode_change: Task history items
	taskHistoryFullLength: number // novacode_change
	taskHistoryVersion: number // novacode_change

	writeDelayMs: number

	enableCheckpoints: boolean
	checkpointTimeout: number // Timeout for checkpoint initialization in seconds (default: 15)
	maxOpenTabsContext: number // Maximum number of VSCode open tabs to include in context (0-500)
	maxWorkspaceFiles: number // Maximum number of files to include in current working directory details (0-500)
	showRooIgnoredFiles: boolean // Whether to show .novacodeignore'd files in listings
	enableSubfolderRules: boolean // Whether to load rules from subdirectories
	maxReadFileLine: number // Maximum number of lines to read from a file before truncating
	showAutoApproveMenu: boolean // novacode_change: Whether to show the auto-approve menu in the chat view
	maxImageFileSize: number // Maximum size of image files to process in MB
	maxTotalImageSize: number // Maximum total size for all images in a single read operation in MB

	experiments: Experiments // Map of experiment IDs to their enabled state

	mcpEnabled: boolean
	enableMcpServerCreation: boolean

	mode: string
	customModes: ModeConfig[]
	toolRequirements?: Record<string, boolean> // Map of tool names to their requirements (e.g. {"apply_diff": true} if diffEnabled)

	cwd?: string // Current working directory
	telemetrySetting: TelemetrySetting
	telemetryKey?: string
	machineId?: string

	renderContext: "sidebar" | "editor"
	settingsImportedAt?: number
	historyPreviewCollapsed?: boolean
	showTaskTimeline?: boolean // novacode_change
	sendMessageOnEnter?: boolean // novacode_change
	hideCostBelowThreshold?: number // novacode_change

	cloudUserInfo: CloudUserInfo | null
	cloudIsAuthenticated: boolean
	cloudAuthSkipModel?: boolean // Flag indicating auth completed without model selection (user should pick 3rd-party provider)
	cloudApiUrl?: string
	cloudOrganizations?: CloudOrganizationMembership[]
	sharingEnabled: boolean
	publicSharingEnabled: boolean
	organizationAllowList: OrganizationAllowList
	organizationSettingsVersion?: number

	isBrowserSessionActive: boolean // Actual browser session state

	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	marketplaceItems?: MarketplaceItem[]
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	marketplaceInstalledMetadata?: { project: Record<string, any>; global: Record<string, any> }
	profileThresholds: Record<string, number>
	hasOpenedModeSelector: boolean
	hasCompletedOnboarding?: boolean // novacode_change: Track if user has completed onboarding flow
	openRouterImageApiKey?: string
	novaCodeImageApiKey?: string
	openRouterUseMiddleOutTransform?: boolean
	messageQueue?: QueuedMessage[]
	lastShownAnnouncementId?: string
	apiModelId?: string
	mcpServers?: McpServer[]
	hasSystemPromptOverride?: boolean
	mdmCompliant?: boolean
	remoteControlEnabled: boolean
	taskSyncEnabled: boolean
	featureRoomoteControlEnabled: boolean
	virtualQuotaActiveModel?: { id: string; info: ModelInfo; activeProfileNumber?: number } // novacode_change: Add virtual quota active model for UI display with profile number
	showTimestamps?: boolean // novacode_change: Show timestamps in chat messages
	showDiffStats?: boolean // novacode_change: Show diff stats in task header
	claudeCodeIsAuthenticated?: boolean
	openAiCodexIsAuthenticated?: boolean
	debug?: boolean
	speechToTextStatus?: { available: boolean; reason?: "openaiKeyMissing" | "ffmpegNotInstalled" } // novacode_change: Speech-to-text availability status with failure reason
	appendSystemPrompt?: string // novacode_change: Custom text to append to system prompt (CLI only)
}

export interface Command {
	name: string
	source: "global" | "project" | "built-in"
	filePath?: string
	description?: string
	argumentHint?: string
}

/**
 * WebviewMessage
 * Webview | CLI -> Extension
 */

export type ClineAskResponse =
	| "yesButtonClicked"
	| "noButtonClicked"
	| "messageResponse"
	| "objectResponse"
	| "retry_clicked" // novacode_change: Added retry_clicked for payment required dialog

export type AudioType = "notification" | "celebration" | "progress_loop"

export interface UpdateTodoListPayload {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	todos: any[]
}

export type EditQueuedMessagePayload = Pick<QueuedMessage, "id" | "text" | "images">

// novacode_change start: Type-safe global state update message
export type GlobalStateValue<K extends keyof GlobalState> = GlobalState[K]
export type UpdateGlobalStateMessage<K extends keyof GlobalState = keyof GlobalState> = {
	type: "updateGlobalState"
	stateKey: K
	stateValue: GlobalStateValue<K>
}
// novacode_change end: Type-safe global state update message

export interface WebviewMessage {
	type:
		| "updateTodoList"
		| "deleteMultipleTasksWithIds"
		| "currentApiConfigName"
		| "saveApiConfiguration"
		| "upsertApiConfiguration"
		| "deleteApiConfiguration"
		| "loadApiConfiguration"
		| "loadApiConfigurationById"
		| "getProfileConfigurationForEditing" // novacode_change: Request to get profile config without activating
		| "renameApiConfiguration"
		| "getListApiConfiguration"
		| "customInstructions"
		| "webviewDidLaunch"
		| "newTask"
		| "askResponse"
		| "terminalOperation"
		| "clearTask"
		| "didShowAnnouncement"
		| "selectImages"
		| "exportCurrentTask"
		| "shareCurrentTask"
		| "showTaskWithId"
		| "deleteTaskWithId"
		| "exportTaskWithId"
		| "importSettings"
		| "exportSettings"
		| "resetState"
		| "flushRouterModels"
		| "requestRouterModels"
		| "requestOpenAiModels"
		| "requestOllamaModels"
		| "requestLmStudioModels"
		| "requestRooModels"
		| "requestRooCreditBalance"
		| "requestVsCodeLmModels"
		| "requestHuggingFaceModels"
		| "requestSapAiCoreModels" // novacode_change
		| "requestSapAiCoreDeployments" // novacode_change
		| "openImage"
		| "saveImage"
		| "openFile"
		| "openMention"
		| "cancelTask"
		| "cancelAutoApproval"
		| "updateVSCodeSetting"
		| "getVSCodeSetting"
		| "vsCodeSetting"
		| "updateCondensingPrompt"
		| "yoloGatekeeperApiConfigId" // novacode_change: AI gatekeeper for YOLO mode
		| "playSound"
		| "playTts"
		| "stopTts"
		| "ttsEnabled"
		| "ttsSpeed"
		| "openKeyboardShortcuts"
		| "openMcpSettings"
		| "openProjectMcpSettings"
		| "restartMcpServer"
		| "refreshAllMcpServers"
		| "toggleToolAlwaysAllow"
		| "toggleToolEnabledForPrompt"
		| "toggleMcpServer"
		| "updateMcpTimeout"
		| "fuzzyMatchThreshold" // novacode_change
		| "morphApiKey" // novacode_change: Morph fast apply - global setting
		| "fastApplyModel" // novacode_change: Fast Apply model selection
		| "fastApplyApiProvider" // novacode_change: Fast Apply model api base url
		| "writeDelayMs" // novacode_change
		| "diagnosticsEnabled" // novacode_change
		| "enhancePrompt"
		| "enhancedPrompt"
		| "draggedImages"
		| "deleteMessage"
		| "deleteMessageConfirm"
		| "submitEditedMessage"
		| "editMessageConfirm"
		| "enableMcpServerCreation"
		| "remoteControlEnabled"
		| "taskSyncEnabled"
		| "searchCommits"
		| "setApiConfigPassword"
		| "mode"
		| "updatePrompt"
		| "getSystemPrompt"
		| "copySystemPrompt"
		| "systemPrompt"
		| "enhancementApiConfigId"
		| "commitMessageApiConfigId" // novacode_change
		| "terminalCommandApiConfigId" // novacode_change
		| "ghostServiceSettings" // novacode_change
		| "stt:start" // novacode_change: Start STT recording
		| "stt:stop" // novacode_change: Stop STT recording
		| "stt:cancel" // novacode_change: Cancel STT recording
		| "stt:checkAvailability" // novacode_change: Check STT availability on demand
		| "stt:listDevices" // novacode_change: List microphone devices
		| "stt:selectDevice" // novacode_change: Select microphone device
		| "includeTaskHistoryInEnhance" // novacode_change
		| "snoozeAutocomplete" // novacode_change
		| "autoApprovalEnabled"
		| "yoloMode" // novacode_change
		| "updateCustomMode"
		| "deleteCustomMode"
		| "setopenAiCustomModelInfo"
		| "openCustomModesSettings"
		| "checkpointDiff"
		| "checkpointRestore"
		| "requestCheckpointRestoreApproval" // novacode_change: Request approval for checkpoint restore
		| "seeNewChanges" // novacode_change
		| "deleteMcpServer"
		| "mcpServerOAuthSignIn" // novacode_change: Initiate OAuth sign-in for an MCP server
		| "insertTextToChatArea" // novacode_change
		| "humanRelayResponse" // novacode_change
		| "humanRelayCancel" // novacode_change
		| "codebaseIndexEnabled"
		| "telemetrySetting"
		| "testBrowserConnection"
		| "browserConnectionResult"
		| "allowVeryLargeReads" // novacode_change
		| "showFeedbackOptions" // novacode_change
		| "fetchMcpMarketplace" // novacode_change
		| "silentlyRefreshMcpMarketplace" // novacode_change
		| "fetchLatestMcpServersFromHub" // novacode_change
		| "downloadMcp" // novacode_change
		| "showSystemNotification" // novacode_change
		| "showAutoApproveMenu" // novacode_change
		| "reportBug" // novacode_change
		| "profileButtonClicked" // novacode_change
		| "fetchProfileDataRequest" // novacode_change
		| "profileDataResponse" // novacode_change
		| "fetchBalanceDataRequest" // novacode_change
		| "shopBuyCredits" // novacode_change
		| "balanceDataResponse" // novacode_change
		| "updateProfileData" // novacode_change
		| "condense" // novacode_change
		| "toggleWorkflow" // novacode_change
		| "refreshRules" // novacode_change
		| "toggleRule" // novacode_change
		| "createRuleFile" // novacode_change
		| "deleteRuleFile" // novacode_change
		| "searchFiles"
		| "toggleApiConfigPin"
		| "hasOpenedModeSelector"
		| "hasCompletedOnboarding" // novacode_change: Mark onboarding as completed
		| "clearCloudAuthSkipModel"
		| "cloudButtonClicked"
		| "rooCloudSignIn"
		| "cloudLandingPageSignIn"
		| "rooCloudSignOut"
		| "rooCloudManualUrl"
		| "claudeCodeSignIn"
		| "claudeCodeSignOut"
		| "openAiCodexSignIn"
		| "openAiCodexSignOut"
		| "switchOrganization"
		| "condenseTaskContextRequest"
		| "requestIndexingStatus"
		| "startIndexing"
		| "cancelIndexing" // novacode_change
		| "clearIndexData"
		| "indexingStatusUpdate"
		| "indexCleared"
		| "focusPanelRequest"
		| "clearUsageData" // novacode_change
		| "getUsageData" // novacode_change
		| "usageDataResponse" // novacode_change
		| "showTaskTimeline" // novacode_change
		| "sendMessageOnEnter" // novacode_change
		| "showTimestamps" // novacode_change
		| "showDiffStats" // novacode_change
		| "hideCostBelowThreshold" // novacode_change
		| "toggleTaskFavorite" // novacode_change
		| "fixMermaidSyntax" // novacode_change
		| "mermaidFixResponse" // novacode_change
		| "openGlobalKeybindings" // novacode_change
		| "getKeybindings" // novacode_change
		| "setHistoryPreviewCollapsed" // novacode_change
		| "setReasoningBlockCollapsed" // novacode_change
		| "openExternal"
		| "openInBrowser" // novacode_change
		| "filterMarketplaceItems"
		| "marketplaceButtonClicked"
		| "installMarketplaceItem"
		| "installMarketplaceItemWithParameters"
		| "cancelMarketplaceInstall"
		| "removeInstalledMarketplaceItem"
		| "marketplaceInstallResult"
		| "fetchMarketplaceData"
		| "switchTab"
		| "profileThresholds" // novacode_change
		| "editMessage" // novacode_change
		| "systemNotificationsEnabled" // novacode_change
		| "dismissNotificationId" // novacode_change
		| "fetchNovacodeNotifications" // novacode_change
		| "tasksByIdRequest" // novacode_change
		| "taskHistoryRequest" // novacode_change
		| "updateGlobalState" // novacode_change
		| "autoPurgeEnabled" // novacode_change
		| "autoPurgeDefaultRetentionDays" // novacode_change
		| "autoPurgeFavoritedTaskRetentionDays" // novacode_change
		| "autoPurgeCompletedTaskRetentionDays" // novacode_change
		| "autoPurgeIncompleteTaskRetentionDays" // novacode_change
		| "manualPurge" // novacode_change
		| "shareTaskSuccess" // novacode_change
		| "shareTaskSuccess"
		| "exportMode"
		| "exportModeResult"
		| "importMode"
		| "importModeResult"
		| "checkRulesDirectory"
		| "checkRulesDirectoryResult"
		| "saveCodeIndexSettingsAtomic"
		| "requestCodeIndexSecretStatus"
		| "requestCommands"
		| "openCommandFile"
		| "deleteCommand"
		| "createCommand"
		| "insertTextIntoTextarea"
		| "showMdmAuthRequiredNotification"
		| "imageGenerationSettings"
		| "novaCodeImageApiKey" // novacode_change
		| "queueMessage"
		| "removeQueuedMessage"
		| "editQueuedMessage"
		| "dismissUpsell"
		| "getDismissedUpsells"
		| "openMarkdownPreview"
		| "updateSettings"
		| "requestManagedIndexerState" // novacode_change
		| "allowedCommands"
		| "getTaskWithAggregatedCosts"
		| "deniedCommands"
		| "killBrowserSession"
		| "openBrowserSessionPanel"
		| "showBrowserSessionPanelAtStep"
		| "refreshBrowserSessionPanel"
		| "browserPanelDidLaunch"
		| "addTaskToHistory" // novacode_change
		| "sessionShare" // novacode_change
		| "shareTaskSession" // novacode_change
		| "sessionFork" // novacode_change
		| "sessionShow" // novacode_change
		| "sessionSelect" // novacode_change
		| "singleCompletion" // novacode_change
		| "openExtensionSettings" // novacode_change: Open extension settings from CLI
		| "openDebugApiHistory"
		| "openDebugUiHistory"
		| "startDeviceAuth" // novacode_change: Start device auth flow
		| "cancelDeviceAuth" // novacode_change: Cancel device auth flow
		| "deviceAuthCompleteWithProfile" // novacode_change: Device auth complete with specific profile
		| "requestChatCompletion" // novacode_change: Request FIM completion for chat text area
		| "chatCompletionAccepted" // novacode_change: User accepted a chat completion suggestion
		| "downloadErrorDiagnostics"
		| "requestClaudeCodeRateLimits"
		| "requestOpenAiCodexRateLimits"
		| "refreshCustomTools"
		| "requestModes"
		| "switchMode"
		| "debugSetting"
		| "refreshSkills"
		| "reviewScopeSelected" // novacode_change: Review mode scope selection
	text?: string
	suggestionLength?: number // novacode_change: Length of accepted suggestion for telemetry
	completionRequestId?: string // novacode_change
	shareId?: string // novacode_change - for sessionFork
	sessionId?: string // novacode_change - for sessionSelect
	editedMessageContent?: string
	tab?: "settings" | "history" | "mcp" | "modes" | "chat" | "marketplace" | "cloud" | "auth" // novacode_change
	disabled?: boolean
	context?: string
	dataUri?: string
	askResponse?: ClineAskResponse
	apiConfiguration?: ProviderSettings
	images?: string[]
	bool?: boolean
	value?: number
	stepIndex?: number
	isLaunchAction?: boolean
	forceShow?: boolean
	commands?: string[]
	audioType?: AudioType
	// novacode_change begin
	notificationOptions?: {
		title?: string
		subtitle?: string
		message: string
	}
	mcpId?: string
	toolNames?: string[]
	autoApprove?: boolean
	workflowPath?: string // novacode_change
	enabled?: boolean // novacode_change
	rulePath?: string // novacode_change
	isGlobal?: boolean // novacode_change
	filename?: string // novacode_change
	ruleType?: string // novacode_change
	notificationId?: string // novacode_change
	commandIds?: string[] // novacode_change: For getKeybindings
	// novacode_change end
	serverName?: string
	toolName?: string
	alwaysAllow?: boolean
	isEnabled?: boolean
	mode?: string
	promptMode?: string | "enhance"
	customPrompt?: PromptComponent
	dataUrls?: string[]
	/** Generic payload for webview messages that use `values` */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	values?: Record<string, any>
	query?: string
	setting?: string
	slug?: string
	device?: MicrophoneDevice | null // novacode_change: Microphone device for stt:selectDevice
	language?: string // novacode_change: Optional language hint for stt:start
	modeConfig?: ModeConfig
	timeout?: number
	payload?: WebViewMessagePayload
	source?: "global" | "project"
	requestId?: string
	ids?: string[]
	excludeFavorites?: boolean // novacode_change: For batch delete to exclude favorited tasks
	hasSystemPromptOverride?: boolean
	terminalOperation?: "continue" | "abort"
	messageTs?: number
	restoreCheckpoint?: boolean
	historyPreviewCollapsed?: boolean
	filters?: { type?: string; search?: string; tags?: string[] }
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	settings?: any
	url?: string // For openExternal
	mpItem?: MarketplaceItem
	mpInstallOptions?: InstallMarketplaceItemOptions
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	config?: Record<string, any> // Add config to the payload
	visibility?: ShareVisibility // For share visibility
	hasContent?: boolean // For checkRulesDirectoryResult
	checkOnly?: boolean // For deleteCustomMode check
	upsellId?: string // For dismissUpsell
	list?: string[] // For dismissedUpsells response
	organizationId?: string | null // For organization switching
	useProviderSignup?: boolean // For rooCloudSignIn to use provider signup flow
	historyItem?: HistoryItem // novacode_change For addTaskToHistory
	codeIndexSettings?: {
		// Global state settings
		codebaseIndexEnabled: boolean
		codebaseIndexQdrantUrl: string
		codebaseIndexEmbedderProvider:
			| "openai"
			| "ollama"
			| "openai-compatible"
			| "gemini"
			| "mistral"
			| "vercel-ai-gateway"
			| "bedrock"
			| "openrouter"
			| "voyage" // novacode_change
		codebaseIndexVectorStoreProvider?: "lancedb" | "qdrant" // novacode_change
		codebaseIndexLancedbVectorStoreDirectory?: string // novacode_change
		codebaseIndexEmbedderBaseUrl?: string
		codebaseIndexEmbedderModelId: string
		codebaseIndexEmbedderModelDimension?: number // Generic dimension for all providers
		codebaseIndexOpenAiCompatibleBaseUrl?: string
		codebaseIndexBedrockRegion?: string
		codebaseIndexBedrockProfile?: string
		codebaseIndexSearchMaxResults?: number
		codebaseIndexSearchMinScore?: number
		// novacode_change start
		codebaseIndexEmbeddingBatchSize?: number
		codebaseIndexScannerMaxBatchRetries?: number
		// novacode_change end
		codebaseIndexOpenRouterSpecificProvider?: string // OpenRouter provider routing

		// Secret settings
		codeIndexOpenAiKey?: string
		codeIndexQdrantApiKey?: string
		codebaseIndexOpenAiCompatibleApiKey?: string
		codebaseIndexGeminiApiKey?: string
		codebaseIndexMistralApiKey?: string
		codebaseIndexVercelAiGatewayApiKey?: string
		codebaseIndexOpenRouterApiKey?: string
		codebaseIndexVoyageApiKey?: string // novacode_change
	}
	updatedSettings?: RooCodeSettings
	// novacode_change start: Review mode
	reviewScope?: "uncommitted" | "branch"
	// novacode_change end: Review mode
}

// novacode_change: Create discriminated union for type-safe messages
export type MaybeTypedWebviewMessage = WebviewMessage | UpdateGlobalStateMessage

// novacode_change begin
export type OrganizationRole = "owner" | "admin" | "member"

export type UserOrganizationWithApiKey = {
	id: string
	name: string
	balance: number
	role: OrganizationRole
	apiKey: string
}

export type ProfileData = {
	novacodeToken: string
	user: {
		id: string
		name: string
		email: string
		image: string
	}
	organizations?: UserOrganizationWithApiKey[]
}

export interface ProfileDataResponsePayload {
	success: boolean
	data?: ProfileData
	error?: string
}

export interface BalanceDataResponsePayload {
	// New: Payload for balance data
	success: boolean
	data?: unknown
	error?: string
}

export interface SeeNewChangesPayload {
	commitRange: CommitRange
}

export interface TasksByIdRequestPayload {
	requestId: string
	taskIds: string[]
}

export interface TaskHistoryRequestPayload {
	requestId: string
	workspace: "current" | "all"
	sort: "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"
	favoritesOnly: boolean
	pageIndex: number
	search?: string
}

export interface TasksByIdResponsePayload {
	requestId: string
	tasks: HistoryItem[]
}

export interface TaskHistoryResponsePayload {
	requestId: string
	historyItems: HistoryItem[]
	pageIndex: number
	pageCount: number
	totalItems: number
}
// novacode_change end

export interface RequestOpenAiCodexRateLimitsMessage {
	type: "requestOpenAiCodexRateLimits"
}

export const checkoutDiffPayloadSchema = z.object({
	ts: z.number().optional(),
	previousCommitHash: z.string().optional(),
	commitHash: z.string(),
	mode: z.enum(["full", "checkpoint", "from-init", "to-current"]),
})

export type CheckpointDiffPayload = z.infer<typeof checkoutDiffPayloadSchema>

export const checkoutRestorePayloadSchema = z.object({
	ts: z.number(),
	commitHash: z.string(),
	mode: z.enum(["preview", "restore"]),
})

export type CheckpointRestorePayload = z.infer<typeof checkoutRestorePayloadSchema>

// novacode_change start
export const requestCheckpointRestoreApprovalPayloadSchema = z.object({
	commitHash: z.string(),
	checkpointTs: z.number(),
	messagesToRemove: z.number(),
	confirmationText: z.string(),
})

export type RequestCheckpointRestoreApprovalPayload = z.infer<typeof requestCheckpointRestoreApprovalPayloadSchema>
// novacode_change end

export interface IndexingStatusPayload {
	state: "Standby" | "Indexing" | "Indexed" | "Error"
	message: string
}

export interface IndexClearedPayload {
	success: boolean
	error?: string
}

export const installMarketplaceItemWithParametersPayloadSchema = z.object({
	item: marketplaceItemSchema,
	parameters: z.record(z.string(), z.any()),
})

export type InstallMarketplaceItemWithParametersPayload = z.infer<
	typeof installMarketplaceItemWithParametersPayloadSchema
>

export type WebViewMessagePayload =
	// novacode_change start
	| ProfileDataResponsePayload
	| BalanceDataResponsePayload
	| SeeNewChangesPayload
	| TasksByIdRequestPayload
	| TaskHistoryRequestPayload
	| RequestCheckpointRestoreApprovalPayload
	// novacode_change end
	| CheckpointDiffPayload
	| CheckpointRestorePayload
	| IndexingStatusPayload
	| IndexClearedPayload
	| InstallMarketplaceItemWithParametersPayload
	| UpdateTodoListPayload
	| EditQueuedMessagePayload

export interface IndexingStatus {
	systemStatus: string
	message?: string
	processedItems: number
	totalItems: number
	currentItemUnit?: string
	workspacePath?: string
}

export interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: IndexingStatus
}

export interface LanguageModelChatSelector {
	vendor?: string
	family?: string
	version?: string
	id?: string
}

export interface ClineSayTool {
	tool:
		| "editedExistingFile"
		| "appliedDiff"
		| "newFileCreated"
		| "codebaseSearch"
		| "readFile"
		| "fetchInstructions"
		| "listFilesTopLevel"
		| "listFilesRecursive"
		| "searchFiles"
		| "switchMode"
		| "newTask"
		| "finishTask"
		| "generateImage"
		| "imageGenerated"
		| "runSlashCommand"
		| "updateTodoList"
		| "deleteFile" // novacode_change: Handles both files and directories
	path?: string
	diff?: string
	content?: string
	// Unified diff statistics computed by the extension
	diffStats?: { added: number; removed: number }
	regex?: string
	filePattern?: string
	mode?: string
	reason?: string
	isOutsideWorkspace?: boolean
	isProtected?: boolean
	additionalFileCount?: number // Number of additional files in the same read_file request
	lineNumber?: number
	query?: string
	// novacode_change start: Directory stats - only present when deleting directories
	stats?: {
		files: number
		directories: number
		size: number
		isComplete: boolean
	}
	// novacode_change end
	batchFiles?: Array<{
		path: string
		lineSnippet: string
		isOutsideWorkspace?: boolean
		key: string
		content?: string
	}>
	batchDiffs?: Array<{
		path: string
		changeCount: number
		key: string
		content: string
		// Per-file unified diff statistics computed by the extension
		diffStats?: { added: number; removed: number }
		diffs?: Array<{
			content: string
			startLine?: number
		}>
	}>
	question?: string
	// novacode_change start
	fastApplyResult?: {
		description?: string
		tokensIn?: number
		tokensOut?: number
		cost?: number
	}
	// novacode_change end
	imageData?: string // Base64 encoded image data for generated images
	// Properties for runSlashCommand tool
	command?: string
	args?: string
	source?: string
	description?: string
}

// Must keep in sync with system prompt.
export const browserActions = [
	"launch",
	"click",
	"hover",
	"type",
	"press",
	"scroll_down",
	"scroll_up",
	"resize",
	"close",
	"screenshot",
] as const

export type BrowserAction = (typeof browserActions)[number]

export interface ClineSayBrowserAction {
	action: BrowserAction
	coordinate?: string
	size?: string
	text?: string
	executedCoordinate?: string
}

export type BrowserActionResult = {
	screenshot?: string
	logs?: string
	currentUrl?: string
	currentMousePosition?: string
	viewportWidth?: number
	viewportHeight?: number
}

export interface ClineAskUseMcpServer {
	serverName: string
	type: "use_mcp_tool" | "access_mcp_resource"
	toolName?: string
	arguments?: string
	uri?: string
	response?: string
}

export interface ClineApiReqInfo {
	request?: string
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	cost?: number
	// novacode_change
	usageMissing?: boolean
	inferenceProvider?: string
	// novacode_change end
	cancelReason?: ClineApiReqCancelReason
	streamingFailedMessage?: string
	apiProtocol?: "anthropic" | "openai"
}

export type ClineApiReqCancelReason = "streaming_failed" | "user_cancelled"
