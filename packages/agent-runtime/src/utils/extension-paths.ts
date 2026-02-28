import * as path from "path"
import { fileURLToPath } from "url"
import { existsSync } from "fs"

export interface ExtensionPaths {
	extensionBundlePath: string // Path to extension.js
	extensionRootPath: string // Path to extension root
}

/**
 * Resolves extension paths for the agent runtime.
 *
 * Resolution order:
 * 1. Explicit customPath parameter (for Agent Manager)
 * 2. NOVACODE_EXTENSION_PATH / NOVACODE_EXTENSION_PATH environment variable
 * 3. NOVACODE_DEV_CLI_PATH / NOVACODE_DEV_CLI_PATH environment variable (development mode)
 * 4. Relative to CLI dist folder (production CLI)
 *
 * @param customPath - Optional custom path to the extension root
 * @throws Error if extension cannot be found
 */
export function resolveExtensionPaths(customPath?: string): ExtensionPaths {
	// 1. Explicit custom path (Agent Manager always provides this)
	if (customPath) {
		return {
			extensionRootPath: customPath,
			extensionBundlePath: path.join(customPath, "dist", "extension.js"),
		}
	}

	// 2. Explicit environment variable
	const explicitPath = process.env.NOVACODE_EXTENSION_PATH ?? process.env.NOVACODE_EXTENSION_PATH
	if (explicitPath) {
		const extensionBundlePath = path.join(explicitPath, "dist", "extension.js")
		if (!existsSync(extensionBundlePath)) {
			throw new Error(
				`NOVACODE_EXTENSION_PATH/NOVACODE_EXTENSION_PATH is set to "${explicitPath}" but extension.js not found at ${extensionBundlePath}`,
			)
		}
		return {
			extensionRootPath: explicitPath,
			extensionBundlePath,
		}
	}

	// 3. Development mode via launch.json
	const devCliPath = process.env.NOVACODE_DEV_CLI_PATH ?? process.env.NOVACODE_DEV_CLI_PATH
	if (devCliPath) {
		const workspaceRoot = path.resolve(path.dirname(devCliPath), "..", "..")
		const extensionRootPath = path.join(workspaceRoot, "src")
		const extensionBundlePath = path.join(extensionRootPath, "dist", "extension.js")

		if (!existsSync(extensionBundlePath)) {
			throw new Error(
				`NOVACODE_DEV_CLI_PATH/NOVACODE_DEV_CLI_PATH is set but extension.js not found at ${extensionBundlePath}. ` +
					`Run 'pnpm build' in the src directory first.`,
			)
		}
		return { extensionRootPath, extensionBundlePath }
	}

	// 4. Production CLI: extension bundled at dist/nova/ (fallback to dist/novacode/)
	const currentDir = path.dirname(fileURLToPath(import.meta.url))
	const distDir = currentDir.endsWith("utils") ? path.resolve(currentDir, "..") : currentDir
	const candidateRoots = [path.join(distDir, "nova"), path.join(distDir, "novacode")]

	for (const extensionRootPath of candidateRoots) {
		const extensionBundlePath = path.join(extensionRootPath, "dist", "extension.js")
		if (existsSync(extensionBundlePath)) {
			return { extensionRootPath, extensionBundlePath }
		}
	}

	throw new Error(
		`Extension not found under ${candidateRoots.join(" or ")}. ` +
			`Either pass explicit paths, set NOVACODE_EXTENSION_PATH/NOVACODE_EXTENSION_PATH, or ensure the CLI is properly built.`,
	)
}
