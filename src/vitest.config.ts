import { defineConfig } from "vitest/config"
import path from "path"
import fs from "fs"
import { resolveVerbosity } from "./utils/vitest-verbosity"

const { silent, reporters, onConsoleLog } = resolveVerbosity()
const isWindows = process.platform === "win32"

function resolvePdfParseEntry() {
	const repoRoot = path.resolve(__dirname, "..")
	const directCandidates = [
		path.resolve(repoRoot, "node_modules", "pdf-parse", "lib", "pdf-parse.js"),
		path.resolve(repoRoot, "node_modules", "pdf-parse", "lib", "pdf-parse"),
	]

	for (const candidate of directCandidates) {
		if (fs.existsSync(candidate)) {
			return candidate
		}
	}

	const pnpmDir = path.resolve(repoRoot, "node_modules", ".pnpm")
	if (fs.existsSync(pnpmDir)) {
		const entries = fs
			.readdirSync(pnpmDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name.startsWith("pdf-parse@"))
			.map((entry) => entry.name)

		for (const entry of entries) {
			const candidate = path.resolve(pnpmDir, entry, "node_modules", "pdf-parse", "lib", "pdf-parse.js")
			if (fs.existsSync(candidate)) {
				return candidate
			}
		}
	}

	// Fall back to package subpath for environments with a normal node_modules layout.
	return "pdf-parse/lib/pdf-parse"
}

export default defineConfig({
	test: {
		globals: true,
		setupFiles: ["./vitest.setup.ts", "./services/autocomplete/continuedev/core/test/vitest.setup.ts"],
		globalSetup: "./services/autocomplete/continuedev/core/test/vitest.global-setup.ts",
		watch: false,
		reporters,
		silent,
		testTimeout: isWindows ? 60_000 : 20_000,
		hookTimeout: isWindows ? 60_000 : 20_000,
		minWorkers: 1,
		maxWorkers: isWindows ? 4 : undefined,
		onConsoleLog,
	},
	resolve: {
		alias: {
			vscode: path.resolve(__dirname, "./__mocks__/vscode.js"),
			"pdf-parse/lib/pdf-parse": resolvePdfParseEntry(),
		},
	},
})
