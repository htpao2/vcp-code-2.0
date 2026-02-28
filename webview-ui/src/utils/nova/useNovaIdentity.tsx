import { useEffect, useState } from "react"
import { ProfileDataResponsePayload } from "@roo/WebviewMessage"
import { vscode } from "@/utils/vscode"

export function useNovaIdentity(novacodeToken: string, machineId: string) {
	const [novaIdentity, setNovaIdentity] = useState("")
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "profileDataResponse") {
				const payload = event.data.payload as ProfileDataResponsePayload | undefined
				const success = payload?.success || false
				const tokenFromMessage = payload?.data?.novacodeToken || ""
				const email = payload?.data?.user?.email || ""
				if (!success) {
					console.error("NOVATEL: Failed to identify Nova user, message doesn't indicate success:", payload)
				} else if (tokenFromMessage !== novacodeToken) {
					console.error("NOVATEL: Failed to identify Nova user, token mismatch:", payload)
				} else if (!email) {
					console.error("NOVATEL: Failed to identify Nova user, email missing:", payload)
				} else {
					console.debug("NOVATEL: Nova user identified:", email)
					setNovaIdentity(email)
					window.removeEventListener("message", handleMessage)
				}
			}
		}

		if (novacodeToken) {
			console.debug("NOVATEL: fetching profile...")
			window.addEventListener("message", handleMessage)
			vscode.postMessage({
				type: "fetchProfileDataRequest",
			})
		} else {
			console.debug("NOVATEL: no Nova user")
			setNovaIdentity("")
		}

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [novacodeToken])
	return novaIdentity || machineId
}
