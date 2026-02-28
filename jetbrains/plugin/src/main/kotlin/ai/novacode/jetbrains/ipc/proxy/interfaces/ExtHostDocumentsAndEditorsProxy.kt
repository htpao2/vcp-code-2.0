// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

package ai.novacode.jetbrains.ipc.proxy.interfaces

import ai.novacode.jetbrains.editor.DocumentsAndEditorsDelta

interface ExtHostDocumentsAndEditorsProxy {
    fun acceptDocumentsAndEditorsDelta(d: DocumentsAndEditorsDelta)
}
