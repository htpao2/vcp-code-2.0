import nock from "nock"
import { TelemetryService } from "@roo-code/telemetry"

import "./utils/path" // Import to enable String.prototype.toPosix().

// Disable network requests by default for all tests.
nock.disableNetConnect()

// Many modules call TelemetryService.instance directly.
// Ensure tests always have a no-op instance available.
if (!TelemetryService.hasInstance()) {
	TelemetryService.createInstance([])
}

export function allowNetConnect(host?: string | RegExp) {
	if (host) {
		nock.enableNetConnect(host)
	} else {
		nock.enableNetConnect()
	}
}

// Global mocks that many tests expect.
global.structuredClone = global.structuredClone || ((obj: any) => JSON.parse(JSON.stringify(obj)))
