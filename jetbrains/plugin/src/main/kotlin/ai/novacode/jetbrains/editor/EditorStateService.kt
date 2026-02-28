// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

package ai.novacode.jetbrains.editor

import ai.novacode.jetbrains.core.ExtensionHostManager
import ai.novacode.jetbrains.core.PluginContext
import ai.novacode.jetbrains.core.ServiceProxyRegistry
import ai.novacode.jetbrains.ipc.proxy.interfaces.ExtHostDocumentsAndEditorsProxy
import ai.novacode.jetbrains.ipc.proxy.interfaces.ExtHostDocumentsProxy
import ai.novacode.jetbrains.ipc.proxy.interfaces.ExtHostEditorTabsProxy
import ai.novacode.jetbrains.ipc.proxy.interfaces.ExtHostEditorsProxy
import ai.novacode.jetbrains.util.URI
import com.intellij.openapi.project.Project

class EditorStateService(val project: Project) {
    var extHostDocumentsAndEditorsProxy: ExtHostDocumentsAndEditorsProxy? = null
    var extHostEditorsProxy: ExtHostEditorsProxy? = null
    var extHostDocumentsProxy: ExtHostDocumentsProxy? = null
    
    private fun getExtensionHostManager(): ExtensionHostManager? {
        return PluginContext.getInstance(project).getExtensionHostManager()
    }

    fun acceptDocumentsAndEditorsDelta(detail: DocumentsAndEditorsDelta) {
        getExtensionHostManager()?.queueMessage {
            val protocol = PluginContext.getInstance(project).getRPCProtocol()
            if (extHostDocumentsAndEditorsProxy == null) {
                extHostDocumentsAndEditorsProxy = protocol?.getProxy(ServiceProxyRegistry.ExtHostContext.ExtHostDocumentsAndEditors)
            }
            extHostDocumentsAndEditorsProxy?.acceptDocumentsAndEditorsDelta(detail)
        }
    }

    fun acceptEditorPropertiesChanged(detail: Map<String, EditorPropertiesChangeData>) {
        getExtensionHostManager()?.queueMessage {
            val protocol = PluginContext.getInstance(project).getRPCProtocol()
            if (extHostEditorsProxy == null) {
                extHostEditorsProxy = protocol?.getProxy(ServiceProxyRegistry.ExtHostContext.ExtHostEditors)
            }
            extHostEditorsProxy?.let {
                for ((id, data) in detail) {
                    it.acceptEditorPropertiesChanged(id, data)
                }
            }
        }
    }

    fun acceptModelChanged(detail: Map<URI, ModelChangedEvent>) {
        getExtensionHostManager()?.queueMessage {
            val protocol = PluginContext.getInstance(project).getRPCProtocol()
            if (extHostDocumentsProxy == null) {
                extHostDocumentsProxy = protocol?.getProxy(ServiceProxyRegistry.ExtHostContext.ExtHostDocuments)
            }
            extHostDocumentsProxy?.let {
                for ((uri, data) in detail) {
                    it.acceptModelChanged(uri, data, data.isDirty)
                }
            }
        }
    }
}

class TabStateService(val project: Project) {
    var extHostEditorTabsProxy: ExtHostEditorTabsProxy? = null
    
    private fun getExtensionHostManager(): ExtensionHostManager? {
        return PluginContext.getInstance(project).getExtensionHostManager()
    }

    fun acceptEditorTabModel(detail: List<EditorTabGroupDto>) {
        getExtensionHostManager()?.queueMessage {
            val protocol = PluginContext.getInstance(project).getRPCProtocol()
            if (extHostEditorTabsProxy == null) {
                extHostEditorTabsProxy = protocol?.getProxy(ServiceProxyRegistry.ExtHostContext.ExtHostEditorTabs)
            }
            extHostEditorTabsProxy?.acceptEditorTabModel(detail)
        }
    }

    fun acceptTabOperation(detail: TabOperation) {
        getExtensionHostManager()?.queueMessage {
            val protocol = PluginContext.getInstance(project).getRPCProtocol()
            if (extHostEditorTabsProxy == null) {
                extHostEditorTabsProxy = protocol?.getProxy(ServiceProxyRegistry.ExtHostContext.ExtHostEditorTabs)
            }
            extHostEditorTabsProxy?.acceptTabOperation(detail)
        }
    }

    fun acceptTabGroupUpdate(detail: EditorTabGroupDto) {
        getExtensionHostManager()?.queueMessage {
            val protocol = PluginContext.getInstance(project).getRPCProtocol()
            if (extHostEditorTabsProxy == null) {
                extHostEditorTabsProxy = protocol?.getProxy(ServiceProxyRegistry.ExtHostContext.ExtHostEditorTabs)
            }
            extHostEditorTabsProxy?.acceptTabGroupUpdate(detail)
        }
    }
}
