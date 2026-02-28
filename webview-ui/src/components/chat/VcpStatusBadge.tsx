import React, { useMemo } from "react"
import { Plug } from "lucide-react"

import { cn } from "@src/lib/utils"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { StandardTooltip } from "@src/components/ui"

interface VcpStatusBadgeProps {
	className?: string
}

export const VcpStatusBadge: React.FC<VcpStatusBadgeProps> = ({ className }) => {
	const { vcpConfig, vcpBridgeStatus } = useExtensionState()
	const enabled = vcpConfig?.enabled === true

	const statusText = useMemo(() => {
		if (!enabled) {
			return "VCP protocol disabled"
		}
		return vcpBridgeStatus?.connected ? "VCP bridge connected" : "VCP bridge disconnected"
	}, [enabled, vcpBridgeStatus?.connected])

	if (!enabled) {
		return null
	}

	return (
		<StandardTooltip content={statusText}>
			<div
				className={cn("inline-flex items-center gap-1.5 text-xs text-vscode-descriptionForeground", className)}>
				<Plug className="w-3.5 h-3.5" />
				<span>{statusText}</span>
				<span
					className={cn(
						"inline-block w-1.5 h-1.5 rounded-full",
						vcpBridgeStatus?.connected ? "bg-green-500" : "bg-red-500",
					)}
				/>
			</div>
		</StandardTooltip>
	)
}
