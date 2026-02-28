import { defineConfig } from "vitest/config"
import { fileURLToPath } from "url"

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		watch: false,
	},
	resolve: {
		alias: {
			vscode: fileURLToPath(new URL("./src/__mocks__/vscode.ts", import.meta.url)),
		},
	},
})
