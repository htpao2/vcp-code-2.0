import React, { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { useEvent } from "react-use"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { type ExtensionMessage, TelemetryEventName } from "@roo-code/types"

import TranslationProvider from "./i18n/TranslationContext"
import { MarketplaceViewStateManager } from "./components/marketplace/MarketplaceViewStateManager"

import { vscode } from "./utils/vscode"
import { telemetryClient } from "./utils/TelemetryClient"
import { initializeSourceMaps, exposeSourceMapsForDebugging } from "./utils/sourceMapInitializer"
import { ExtensionStateContextProvider, useExtensionState } from "./context/ExtensionStateContext"
import ChatView, { ChatViewRef } from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import SettingsView, { SettingsViewRef } from "./components/settings/SettingsView"
import OnboardingView from "./components/nova/welcome/OnboardingView" // novacode_change
import ProfileView from "./components/nova/profile/ProfileView" // novacode_change
import McpView from "./components/mcp/McpView" // novacode_change
import AuthView from "./components/nova/auth/AuthView" // novacode_change
import { MarketplaceView } from "./components/marketplace/MarketplaceView"
import BottomControls from "./components/nova/BottomControls" // novacode_change
import { MemoryService } from "./services/MemoryService" // novacode_change
import { HumanRelayDialog } from "./components/human-relay/HumanRelayDialog"
import { CheckpointRestoreDialog } from "./components/chat/CheckpointRestoreDialog"
import { DeleteMessageDialog, EditMessageDialog } from "./components/chat/MessageModificationConfirmationDialog"
import ErrorBoundary from "./components/ErrorBoundary"
// import { AccountView } from "./components/account/AccountView" // novacode_change: we have our own profile view
// import { CloudView } from "./components/cloud/CloudView" // novacode_change: not rendering this
import { useAddNonInteractiveClickListener } from "./components/ui/hooks/useNonInteractiveClick"
import { TooltipProvider } from "./components/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "./components/ui/standard-tooltip"
import { useNovaIdentity } from "./utils/nova/useNovaIdentity"
import { MemoryWarningBanner } from "./nova/MemoryWarningBanner"

type Tab = "settings" | "history" | "mcp" | "modes" | "chat" | "marketplace" | "account" | "cloud" | "profile" | "auth" // novacode_change: add "profile" and "auth"

interface HumanRelayDialogState {
	isOpen: boolean
	requestId: string
	promptText: string
}

interface DeleteMessageDialogState {
	isOpen: boolean
	messageTs: number
	hasCheckpoint: boolean
}

interface EditMessageDialogState {
	isOpen: boolean
	messageTs: number
	text: string
	hasCheckpoint: boolean
	images?: string[]
}

// Memoize dialog components to prevent unnecessary re-renders
const MemoizedDeleteMessageDialog = React.memo(DeleteMessageDialog)
const MemoizedEditMessageDialog = React.memo(EditMessageDialog)
const MemoizedCheckpointRestoreDialog = React.memo(CheckpointRestoreDialog)
const MemoizedHumanRelayDialog = React.memo(HumanRelayDialog)

const tabsByMessageAction: Partial<Record<NonNullable<ExtensionMessage["action"]>, Tab>> = {
	chatButtonClicked: "chat",
	settingsButtonClicked: "settings",
	historyButtonClicked: "history",
	profileButtonClicked: "profile",
	marketplaceButtonClicked: "marketplace",
	promptsButtonClicked: "settings", // novacode_change: Navigate to settings with modes section
	// cloudButtonClicked: "cloud", // novacode_change: no cloud
}

// novacode_change start: Map certain actions to a default section when navigating to settings
const defaultSectionByAction: Partial<Record<NonNullable<ExtensionMessage["action"]>, string>> = {
	promptsButtonClicked: "prompts",
}
// novacode_change end

const App = () => {
	const {
		didHydrateState,
		shouldShowAnnouncement,
		telemetrySetting,
		telemetryKey,
		machineId,
		// novacode_change start: unused
		// cloudUserInfo,
		// cloudIsAuthenticated,
		// cloudApiUrl,
		// cloudOrganizations,
		// novacode_change end
		renderContext,
		mdmCompliant,
		apiConfiguration, // novacode_change
		hasCompletedOnboarding, // novacode_change: Track onboarding state
		taskHistoryFullLength, // novacode_change: Used to detect existing users
	} = useExtensionState()

	// Create a persistent state manager
	const marketplaceStateManager = useMemo(() => new MarketplaceViewStateManager(), [])

	const [showAnnouncement, setShowAnnouncement] = useState(false)
	const [tab, setTab] = useState<Tab>("chat")
	const [authReturnTo, setAuthReturnTo] = useState<"chat" | "settings">("chat")
	const [authProfileName, setAuthProfileName] = useState<string | undefined>(undefined)
	const [settingsEditingProfile, setSettingsEditingProfile] = useState<string | undefined>(undefined)

	const [humanRelayDialogState, setHumanRelayDialogState] = useState<HumanRelayDialogState>({
		isOpen: false,
		requestId: "",
		promptText: "",
	})

	const [deleteMessageDialogState, setDeleteMessageDialogState] = useState<DeleteMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		hasCheckpoint: false,
	})

	const [editMessageDialogState, setEditMessageDialogState] = useState<EditMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		text: "",
		hasCheckpoint: false,
		images: [],
	})

	const settingsRef = useRef<SettingsViewRef>(null)
	const chatViewRef = useRef<ChatViewRef & { focusInput: () => void }>(null) // novacode_change

	const switchTab = useCallback(
		(newTab: Tab) => {
			// Only check MDM compliance if mdmCompliant is explicitly false (meaning there's an MDM policy and user is non-compliant)
			// If mdmCompliant is undefined or true, allow tab switching
			if (mdmCompliant === false && newTab !== "cloud") {
				// Notify the user that authentication is required by their organization
				vscode.postMessage({ type: "showMdmAuthRequiredNotification" })
				return
			}

			setCurrentSection(undefined)
			setCurrentMarketplaceTab(undefined)

			// novacode_change: start - Bypass unsaved changes check when navigating to auth tab
			if (newTab === "auth") {
				setTab(newTab)
			} else if (settingsRef.current?.checkUnsaveChanges) {
				// novacode_change: end
				settingsRef.current.checkUnsaveChanges(() => setTab(newTab))
			} else {
				setTab(newTab)
			}
		},
		[mdmCompliant],
	)

	const [currentSection, setCurrentSection] = useState<string | undefined>(undefined)
	const [_currentMarketplaceTab, setCurrentMarketplaceTab] = useState<string | undefined>(undefined)

	const onMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data

			if (message.type === "action" && message.action) {
				// novacode_change begin
				if (message.action === "focusChatInput") {
					if (tab !== "chat") {
						switchTab("chat")
					}
					chatViewRef.current?.focusInput()
					return
				}
				// novacode_change end

				// Handle switchTab action with tab parameter
				if (message.action === "switchTab" && message.tab) {
					const targetTab = message.tab as Tab
					// novacode_change start - Handle auth tab with returnTo and profileName parameters
					if (targetTab === "auth") {
						if (message.values?.returnTo) {
							const returnTo = message.values.returnTo as "chat" | "settings"
							setAuthReturnTo(returnTo)
						}
						if (message.values?.profileName) {
							const profileName = message.values.profileName as string
							setAuthProfileName(profileName)
							setSettingsEditingProfile(profileName)
						}
					}
					// novacode_change end
					switchTab(targetTab)
					// Extract targetSection from values if provided
					const targetSection = message.values?.section as string | undefined
					setCurrentSection(targetSection)
					setCurrentMarketplaceTab(undefined)
				} else {
					// Handle other actions using the mapping
					const newTab = tabsByMessageAction[message.action]
					// novacode_change start
					const section =
						(message.values?.section as string | undefined) ?? defaultSectionByAction[message.action]
					// novacode_change end
					const marketplaceTab = message.values?.marketplaceTab as string | undefined
					const editingProfile = message.values?.editingProfile as string | undefined // novacode_change

					if (newTab) {
						switchTab(newTab)
						setCurrentSection(section)
						setCurrentMarketplaceTab(marketplaceTab)
						// novacode_change start - If navigating to settings with editingProfile, forward it
						if (newTab === "settings" && editingProfile) {
							// Re-send the message to SettingsView with the editingProfile
							setTimeout(() => {
								window.postMessage(
									{
										type: "action",
										action: "settingsButtonClicked",
										values: { editingProfile },
									},
									"*",
								)
							}, 100)
						}
						// novacode_change end
					}
				}
			}

			if (message.type === "showHumanRelayDialog" && message.requestId && message.promptText) {
				const { requestId, promptText } = message
				setHumanRelayDialogState({ isOpen: true, requestId, promptText })
			}

			if (message.type === "showDeleteMessageDialog" && message.messageTs) {
				setDeleteMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					hasCheckpoint: message.hasCheckpoint || false,
				})
			}

			if (message.type === "showEditMessageDialog" && message.messageTs && message.text) {
				setEditMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					text: message.text,
					hasCheckpoint: message.hasCheckpoint || false,
					images: message.images || [],
				})
			}

			if (message.type === "acceptInput") {
				chatViewRef.current?.acceptInput()
			}
		},
		// novacode_change: add tab
		[tab, switchTab],
	)

	useEvent("message", onMessage)

	useEffect(() => {
		if (shouldShowAnnouncement && tab === "chat") {
			setShowAnnouncement(true)
			vscode.postMessage({ type: "didShowAnnouncement" })
		}
	}, [shouldShowAnnouncement, tab])

	// novacode_change start
	const telemetryDistinctId = useNovaIdentity(apiConfiguration?.novacodeToken ?? "", machineId ?? "")
	useEffect(() => {
		if (didHydrateState) {
			telemetryClient.updateTelemetryState(telemetrySetting, telemetryKey, telemetryDistinctId)

			// novacode_change start
			const memoryService = new MemoryService()
			memoryService.start()
			return () => memoryService.stop()
			// novacode_change end
		}
	}, [telemetrySetting, telemetryKey, telemetryDistinctId, didHydrateState])
	// novacode_change end

	// Tell the extension that we are ready to receive messages.
	useEffect(() => vscode.postMessage({ type: "webviewDidLaunch" }), [])

	// Initialize source map support for better error reporting
	useEffect(() => {
		// Initialize source maps for better error reporting in production
		initializeSourceMaps()

		// Expose source map debugging utilities in production
		if (process.env.NODE_ENV === "production") {
			exposeSourceMapsForDebugging()
		}

		// Log initialization for debugging
		console.debug("App initialized with source map support")
	}, [])

	// Focus the WebView when non-interactive content is clicked (only in editor/tab mode)
	useAddNonInteractiveClickListener(
		useCallback(() => {
			// Only send focus request if we're in editor (tab) mode, not sidebar
			if (renderContext === "editor") {
				vscode.postMessage({ type: "focusPanelRequest" })
			}
		}, [renderContext]),
	)
	// Track marketplace tab views
	useEffect(() => {
		if (tab === "marketplace") {
			telemetryClient.capture(TelemetryEventName.MARKETPLACE_TAB_VIEWED)
		}
	}, [tab])

	// novacode_change start: Onboarding handlers
	const handleSelectFreeModels = useCallback(() => {
		// Mark onboarding as complete - the default profile is already set up with a free model
		vscode.postMessage({ type: "hasCompletedOnboarding", bool: true })
	}, [])

	const handleSelectPremiumModels = useCallback(() => {
		// Mark onboarding as complete
		vscode.postMessage({ type: "hasCompletedOnboarding", bool: true })
		// Navigate to auth view which will show the device code and handle the OAuth flow
		// The AuthView auto-starts device auth on mount
		switchTab("auth")
		setAuthReturnTo("chat")
	}, [switchTab])

	const handleSelectBYOK = useCallback(() => {
		// Mark onboarding as complete
		vscode.postMessage({ type: "hasCompletedOnboarding", bool: true })
		// Navigate to settings with providers section
		switchTab("settings")
		setCurrentSection("providers")
	}, [switchTab])

	// One-time migration: mark existing users as having completed onboarding
	useEffect(() => {
		if (hasCompletedOnboarding !== true && (taskHistoryFullLength ?? 0) > 0) {
			vscode.postMessage({ type: "hasCompletedOnboarding", bool: true })
		}
	}, [hasCompletedOnboarding, taskHistoryFullLength])
	// novacode_change end

	if (!didHydrateState) {
		return null
	}

	// novacode_change start: Show OnboardingView for new users who haven't completed onboarding
	const showOnboarding = hasCompletedOnboarding !== true

	// Do not conditionally load ChatView, it's expensive and there's state we
	// don't want to lose (user input, disableInput, askResponse promise, etc.)
	return showOnboarding ? (
		<OnboardingView
			onSelectFreeModels={handleSelectFreeModels}
			onSelectPremiumModels={handleSelectPremiumModels}
			onSelectBYOK={handleSelectBYOK}
		/>
	) : (
		// novacode_change end
		<>
			{/* novacode_change start */}
			<MemoryWarningBanner />
			{tab === "mcp" && <McpView onDone={() => switchTab("chat")} />}
			{/* novacode_change end */}
			{tab === "history" && <HistoryView onDone={() => switchTab("chat")} />}
			{/* novacode_change: auth redirect / editingProfile */}
			{tab === "settings" && (
				<SettingsView
					ref={settingsRef}
					onDone={() => switchTab("chat")}
					targetSection={currentSection}
					editingProfile={settingsEditingProfile}
				/>
			)}
			{/* novacode_change: add profileview and authview */}
			{tab === "profile" && <ProfileView onDone={() => switchTab("chat")} />}
			{tab === "auth" && <AuthView returnTo={authReturnTo} profileName={authProfileName} />}
			{tab === "marketplace" && (
				<MarketplaceView
					stateManager={marketplaceStateManager}
					onDone={() => switchTab("chat")}
					// novacode_change: targetTab="mode"
					targetTab="mode"
				/>
			)}
			{/* novacode_change: no cloud view */}
			{/* {tab === "cloud" && (
				<CloudView
					userInfo={cloudUserInfo}
					isAuthenticated={cloudIsAuthenticated}
					cloudApiUrl={cloudApiUrl}
					organizations={cloudOrganizations}
				/>
			)} */}
			{/* novacode_change: we have our own profile view */}
			{/* {tab === "account" && (
				<AccountView userInfo={cloudUserInfo} isAuthenticated={false} onDone={() => switchTab("chat")} />
			)} */}
			<ChatView
				ref={chatViewRef}
				isHidden={tab !== "chat"}
				showAnnouncement={showAnnouncement}
				hideAnnouncement={() => setShowAnnouncement(false)}
			/>
			<MemoizedHumanRelayDialog
				isOpen={humanRelayDialogState.isOpen}
				requestId={humanRelayDialogState.requestId}
				promptText={humanRelayDialogState.promptText}
				onClose={() => setHumanRelayDialogState((prev) => ({ ...prev, isOpen: false }))}
				onSubmit={(requestId, text) => vscode.postMessage({ type: "humanRelayResponse", requestId, text })}
				onCancel={(requestId) => vscode.postMessage({ type: "humanRelayCancel", requestId })}
			/>
			{deleteMessageDialogState.hasCheckpoint ? (
				<MemoizedCheckpointRestoreDialog
					open={deleteMessageDialogState.isOpen}
					type="delete"
					hasCheckpoint={deleteMessageDialogState.hasCheckpoint}
					onOpenChange={(open: boolean) => setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={(restoreCheckpoint: boolean) => {
						vscode.postMessage({
							type: "deleteMessageConfirm",
							messageTs: deleteMessageDialogState.messageTs,
							restoreCheckpoint,
						})
						setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			) : (
				<MemoizedDeleteMessageDialog
					open={deleteMessageDialogState.isOpen}
					onOpenChange={(open: boolean) => setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={() => {
						vscode.postMessage({
							type: "deleteMessageConfirm",
							messageTs: deleteMessageDialogState.messageTs,
						})
						setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			)}
			{editMessageDialogState.hasCheckpoint ? (
				<MemoizedCheckpointRestoreDialog
					open={editMessageDialogState.isOpen}
					type="edit"
					hasCheckpoint={editMessageDialogState.hasCheckpoint}
					onOpenChange={(open: boolean) => setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={(restoreCheckpoint: boolean) => {
						vscode.postMessage({
							type: "editMessageConfirm",
							messageTs: editMessageDialogState.messageTs,
							text: editMessageDialogState.text,
							restoreCheckpoint,
							images: editMessageDialogState.images,
						})
						setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			) : (
				<MemoizedEditMessageDialog
					open={editMessageDialogState.isOpen}
					onOpenChange={(open: boolean) => setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={() => {
						vscode.postMessage({
							type: "editMessageConfirm",
							messageTs: editMessageDialogState.messageTs,
							text: editMessageDialogState.text,
							images: editMessageDialogState.images,
						})
						setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			)}
			{/* novacode_change */}
			{/* Chat, and history view contain their own bottom controls, settings doesn't need it */}
			{!["chat", "settings", "history"].includes(tab) && (
				<div className="fixed inset-0 top-auto">
					<BottomControls />
				</div>
			)}
		</>
	)
}

const queryClient = new QueryClient()

const AppWithProviders = () => (
	<ErrorBoundary>
		<ExtensionStateContextProvider>
			<TranslationProvider>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>
						<App />
					</TooltipProvider>
				</QueryClientProvider>
			</TranslationProvider>
		</ExtensionStateContextProvider>
	</ErrorBoundary>
)

export default AppWithProviders
