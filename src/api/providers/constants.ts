import { X_NOVACODE_VERSION } from "../../shared/nova/headers"
import { Package } from "../../shared/package"

export const DEFAULT_HEADERS = {
	// DO NOT ADJUST HTTP-Referer, OpenRouter uses this as an identifier
	// This needs coordination with them if adjustment is needed
	"HTTP-Referer": "https://novacode.ai",
	"X-Title": "Nova Code",
	[X_NOVACODE_VERSION]: Package.version,
	"User-Agent": `Nova-Code/${Package.version}`,
}
