package ai.novacode.jetbrains.core

import ai.novacode.jetbrains.actors.MainThreadBulkEdits
import ai.novacode.jetbrains.actors.MainThreadClipboard
import ai.novacode.jetbrains.actors.MainThreadCommands
import ai.novacode.jetbrains.actors.MainThreadConfiguration
import ai.novacode.jetbrains.actors.MainThreadConsole
import ai.novacode.jetbrains.actors.MainThreadDebugService
import ai.novacode.jetbrains.actors.MainThreadDiaglogs
import ai.novacode.jetbrains.actors.MainThreadDocumentContentProviders
import ai.novacode.jetbrains.actors.MainThreadDocuments
import ai.novacode.jetbrains.actors.MainThreadEditorTabs
import ai.novacode.jetbrains.actors.MainThreadErrors
import ai.novacode.jetbrains.actors.MainThreadExtensionService
import ai.novacode.jetbrains.actors.MainThreadFileSystem
import ai.novacode.jetbrains.actors.MainThreadFileSystemEventService
import ai.novacode.jetbrains.actors.MainThreadLanguageFeatures
import ai.novacode.jetbrains.actors.MainThreadLanguageModelTools
import ai.novacode.jetbrains.actors.MainThreadLogger
import ai.novacode.jetbrains.actors.MainThreadMessageService
import ai.novacode.jetbrains.actors.MainThreadOutputService
import ai.novacode.jetbrains.actors.MainThreadSearch
import ai.novacode.jetbrains.actors.MainThreadSecretState
import ai.novacode.jetbrains.actors.MainThreadStatusBar
import ai.novacode.jetbrains.actors.MainThreadStorage
import ai.novacode.jetbrains.actors.MainThreadTask
import ai.novacode.jetbrains.actors.MainThreadTelemetry
import ai.novacode.jetbrains.actors.MainThreadTerminalService
import ai.novacode.jetbrains.actors.MainThreadTerminalShellIntegration
import ai.novacode.jetbrains.actors.MainThreadTextEditors
import ai.novacode.jetbrains.actors.MainThreadUrls
import ai.novacode.jetbrains.actors.MainThreadWebviewViews
import ai.novacode.jetbrains.actors.MainThreadWebviews
import ai.novacode.jetbrains.actors.MainThreadWindow
import ai.novacode.jetbrains.ipc.IMessagePassingProtocol
import ai.novacode.jetbrains.ipc.proxy.IRPCProtocol
import ai.novacode.jetbrains.ipc.proxy.RPCProtocol
import ai.novacode.jetbrains.ipc.proxy.logger.FileRPCProtocolLogger
import ai.novacode.jetbrains.ipc.proxy.uri.IURITransformer
import ai.novacode.jetbrains.theme.ThemeManager
import ai.novacode.jetbrains.util.ProxyConfigUtil
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.runBlocking

/**
 * Responsible for managing RPC protocols, service registration and implementation, plugin lifecycle management
 * This class is based on VSCode's rpcManager.js implementation
 */
class RPCManager(
    private val protocol: IMessagePassingProtocol,
    private val extensionManager: ExtensionManager,
    private val uriTransformer: IURITransformer? = null,
    private val project: Project,
) {
    private val logger = Logger.getInstance(RPCManager::class.java)
    private val rpcProtocol: IRPCProtocol = RPCProtocol(protocol, FileRPCProtocolLogger(), uriTransformer)

    init {
        setupDefaultProtocols()
        setupExtensionRequiredProtocols()
        setupWeCodeRequiredProtocols()
        setupRooCodeFuncitonProtocols()
        setupWebviewProtocols()
    }

    /**
     * Start initializing plugin environment
     * Send configuration and workspace information to extension process
     */
    fun startInitialize() {
        try {
            logger.info("Starting to initialize plugin environment")
            runBlocking {
                // Get ExtHostConfiguration proxy
                val extHostConfiguration =
                    rpcProtocol.getProxy(ServiceProxyRegistry.ExtHostContext.ExtHostConfiguration)

                // Send empty configuration model
                logger.info("Sending configuration information to extension process")
                val themeName =
                    if (ThemeManager.getInstance().isDarkThemeForce()) "Default Dark Modern" else "Default Light Modern"

                // Create empty configuration model
                val emptyMap = mapOf(
                    "contents" to emptyMap<String, Any>(),
                    "keys" to emptyList<String>(),
                    "overrides" to emptyList<String>(),
                )
                // Get proxy configuration
                val httpProxyConfig = ProxyConfigUtil.getHttpProxyConfigForInitialization()

                // Build configuration contents
                val contentsBuilder = mutableMapOf<String, Any>(
                    "workbench" to mapOf("colorTheme" to themeName),
                )

                // Add proxy configuration if available
                httpProxyConfig?.let {
                    contentsBuilder["http"] = it
                    logger.info("Using proxy configuration for initialization: $it")
                }

                val emptyConfigModel = mapOf(
                    "defaults" to mapOf(
                        "contents" to contentsBuilder,
                        "keys" to emptyList<String>(),
                        "overrides" to emptyList<String>(),
                    ),
                    "policy" to emptyMap,
                    "application" to emptyMap,
                    "userLocal" to emptyMap,
                    "userRemote" to emptyMap,
                    "workspace" to emptyMap,
                    "folders" to emptyList<Any>(),
                    "configurationScopes" to emptyList<Any>(),
                )

                // Directly call the interface method
                extHostConfiguration.initializeConfiguration(emptyConfigModel)

                // Get ExtHostWorkspace proxy
                val extHostWorkspace = rpcProtocol.getProxy(ServiceProxyRegistry.ExtHostContext.ExtHostWorkspace)

                // Get current workspace data
                logger.info("Getting current workspace data")
                val workspaceData = project.getService(WorkspaceManager::class.java).getCurrentWorkspaceData()

                // If workspace data is obtained, send it to extension process, otherwise send null
                if (workspaceData != null) {
                    logger.info("Sending workspace data to extension process: ${workspaceData.name}, folders: ${workspaceData.folders.size}")
                    extHostWorkspace.initializeWorkspace(workspaceData, true)
                } else {
                    logger.info("No available workspace data, sending null to extension process")
                    extHostWorkspace.initializeWorkspace(null, true)
                }

                // Initialize workspace
                logger.info("Workspace initialization completed")
            }
        } catch (e: Exception) {
            logger.error("Failed to initialize plugin environment: ${e.message}", e)
        }
    }

    /**
     * Set up default protocol handlers
     * These protocols are required for extHost process startup and initialization
     */
    private fun setupDefaultProtocols() {
        logger.info("Setting up default protocol handlers")
        PluginContext.getInstance(project).setRPCProtocol(rpcProtocol)

        // MainThreadErrors
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadErrors, MainThreadErrors())

        // MainThreadConsole
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadConsole, MainThreadConsole())

        // MainThreadLogger
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadLogger, MainThreadLogger())

        // MainThreadCommands
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadCommands, MainThreadCommands(project))

        // MainThreadDebugService
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadDebugService, MainThreadDebugService())

        // MainThreadConfiguration
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadConfiguration, MainThreadConfiguration())

        // MainThreadStatusBar
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadStatusBar, MainThreadStatusBar(project))
    }

    /**
     * Set up protocol handlers required for plugin package general loading process
     */
    private fun setupExtensionRequiredProtocols() {
        logger.info("Setting up required protocol handlers for plugins")

        // MainThreadExtensionService
        val mainThreadExtensionService = MainThreadExtensionService(extensionManager, rpcProtocol)
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadExtensionService, mainThreadExtensionService)

        // MainThreadTelemetry
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadTelemetry, MainThreadTelemetry())

        // MainThreadTerminalShellIntegration - use new architecture, pass project parameter
        rpcProtocol.set(
            ServiceProxyRegistry.MainContext.MainThreadTerminalShellIntegration,
            MainThreadTerminalShellIntegration(project),
        )

        // MainThreadTerminalService - use new architecture, pass project parameter
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadTerminalService, MainThreadTerminalService(project))

        // MainThreadTask
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadTask, MainThreadTask())

        // MainThreadSearch
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadSearch, MainThreadSearch())

        // MainThreadWindow
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadWindow, MainThreadWindow(project))

        // MainThreadDiaglogs
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadDialogs, MainThreadDiaglogs())

        // MainThreadLanguageModelTools
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadLanguageModelTools, MainThreadLanguageModelTools())

        // MainThreadClipboard
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadClipboard, MainThreadClipboard())

        // MainThreadBulkEdits
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadBulkEdits, MainThreadBulkEdits(project))

        // MainThreadEditorTabs
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadEditorTabs, MainThreadEditorTabs(project))

        // MainThreadDocuments
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadDocuments, MainThreadDocuments(project))
    }

    /**
     * Set up protocol handlers required for WeCode plugin
     */
    private fun setupWeCodeRequiredProtocols() {
        logger.info("Setting up required protocol handlers for WeCode")

        // MainThreadTextEditors
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadTextEditors, MainThreadTextEditors(project))

        // MainThreadStorage
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadStorage, MainThreadStorage())

        // MainThreadOutputService
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadOutputService, MainThreadOutputService())

        // MainThreadWebviewViews
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadWebviewViews, MainThreadWebviewViews(project))

        // MainThreadDocumentContentProviders
        rpcProtocol.set(
            ServiceProxyRegistry.MainContext.MainThreadDocumentContentProviders,
            MainThreadDocumentContentProviders(),
        )

        // MainThreadUrls
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadUrls, MainThreadUrls())

        // MainThreadLanguageFeatures
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadLanguageFeatures, MainThreadLanguageFeatures(project))

        // MainThreadFileSystem
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadFileSystem, MainThreadFileSystem())

        // MainThreadMessageServiceShape
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadMessageService, MainThreadMessageService())
    }

    private fun setupRooCodeFuncitonProtocols() {
        logger.info("Setting up protocol handlers required for RooCode specific functionality")

        // MainThreadFileSystemEventService
        rpcProtocol.set(
            ServiceProxyRegistry.MainContext.MainThreadFileSystemEventService,
            MainThreadFileSystemEventService(),
        )

        // MainThreadSecretState
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadSecretState, MainThreadSecretState())
    }

    private fun setupWebviewProtocols() {
        logger.info("Setting up protocol handlers required for Webview")
        // MainThreadWebviews
        rpcProtocol.set(ServiceProxyRegistry.MainContext.MainThreadWebviews, MainThreadWebviews(project))
    }

    /**
     * Get RPC protocol instance
     */
    fun getRPCProtocol(): IRPCProtocol {
        return rpcProtocol
    }
}
