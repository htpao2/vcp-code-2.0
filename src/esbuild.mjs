import * as esbuild from "esbuild"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import process from "node:process"
import * as console from "node:console"

import { copyPaths, copyWasms as copyWasmsFromBuild, copyLocales, setupLocaleWatcher } from "@roo-code/build"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function resolveDependencyPath(srcDir, packageName, relativePath = "") {
	const directCandidates = [
		path.join(srcDir, "node_modules", packageName, relativePath),
		path.join(srcDir, "..", "node_modules", packageName, relativePath),
	]

	for (const candidate of directCandidates) {
		if (fs.existsSync(candidate)) {
			return candidate
		}
	}

	const pnpmDir = path.join(srcDir, "..", "node_modules", ".pnpm")
	if (fs.existsSync(pnpmDir)) {
		const packagePrefix = `${packageName.replaceAll("/", "+")}@`
		const entries = fs
			.readdirSync(pnpmDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name.startsWith(packagePrefix))
			.map((entry) => entry.name)
			.sort()

		for (const entry of entries) {
			const candidate = path.join(pnpmDir, entry, "node_modules", packageName, relativePath)
			if (fs.existsSync(candidate)) {
				return candidate
			}
		}
	}

	throw new Error(`Unable to resolve ${packageName}/${relativePath}`)
}

function copyWasmsWithFallback(srcDir, distDir) {
	// Prefer @roo-code/build implementation; fallback to resilient resolver when hoisted layout is incomplete.
	try {
		copyWasmsFromBuild(srcDir, distDir)
		return
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.warn(`[copyWasmsWithFallback] Falling back to resilient WASM copy: ${message}`)
	}

	fs.mkdirSync(distDir, { recursive: true })

	const tiktokenWasmPath = resolveDependencyPath(srcDir, "tiktoken", path.join("lite", "tiktoken_bg.wasm"))
	fs.copyFileSync(tiktokenWasmPath, path.join(distDir, "tiktoken_bg.wasm"))

	const workersDir = path.join(distDir, "workers")
	fs.mkdirSync(workersDir, { recursive: true })
	fs.copyFileSync(tiktokenWasmPath, path.join(workersDir, "tiktoken_bg.wasm"))

	fs.copyFileSync(
		resolveDependencyPath(srcDir, "web-tree-sitter", "tree-sitter.wasm"),
		path.join(distDir, "tree-sitter.wasm"),
	)

	const languageWasmDir = resolveDependencyPath(srcDir, "tree-sitter-wasms", "out")
	const wasmFiles = fs.readdirSync(languageWasmDir).filter((file) => file.endsWith(".wasm"))
	for (const wasmFile of wasmFiles) {
		fs.copyFileSync(path.join(languageWasmDir, wasmFile), path.join(distDir, wasmFile))
	}

	const esbuildWasmDir = resolveDependencyPath(srcDir, "esbuild-wasm")
	const binDir = path.join(distDir, "bin")
	fs.mkdirSync(binDir, { recursive: true })

	const esbuildWasmFiles = [
		["bin/esbuild", path.join(binDir, "esbuild")],
		["esbuild.wasm", path.join(distDir, "esbuild.wasm")],
		["wasm_exec_node.js", path.join(distDir, "wasm_exec_node.js")],
		["wasm_exec.js", path.join(distDir, "wasm_exec.js")],
	]

	for (const [sourceRelativePath, targetPath] of esbuildWasmFiles) {
		const sourcePath = path.join(esbuildWasmDir, sourceRelativePath)
		fs.copyFileSync(sourcePath, targetPath)

		if (sourceRelativePath === "bin/esbuild") {
			try {
				fs.chmodSync(targetPath, 0o755)
			} catch {
				// Ignore chmod errors on Windows.
			}
		}
	}

	console.log(`[copyWasmsWithFallback] Copied WASM assets to ${distDir}`)
}

function copyDirectory(sourcePath, targetPath) {
	if (fs.existsSync(targetPath)) {
		fs.rmSync(targetPath, { recursive: true, force: true })
	}

	fs.mkdirSync(path.dirname(targetPath), { recursive: true })
	fs.cpSync(sourcePath, targetPath, { recursive: true })
	console.log(`[copyDirectory] Copied ${sourcePath} to ${targetPath}`)
}

async function main() {
	const name = "extension"
	const production = process.argv.includes("--production")
	const watch = process.argv.includes("--watch")
	const minify = production
	const sourcemap = true // Always generate source maps for error handling.

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const buildOptions = {
		bundle: true,
		minify,
		sourcemap,
		logLevel: "silent",
		format: "cjs",
		sourcesContent: false,
		platform: "node",
		// novacode_change start: for ps-list
		banner: {
			js: "const __importMetaUrl = typeof __filename !== 'undefined' ? require('url').pathToFileURL(__filename).href : undefined;",
		},
		// novacode_change end
	}

	const srcDir = __dirname
	const buildDir = __dirname
	const distDir = path.join(buildDir, "dist")

	if (fs.existsSync(distDir)) {
		console.log(`[${name}] Cleaning dist directory: ${distDir}`)
		fs.rmSync(distDir, { recursive: true, force: true })
	}

	/**
	 * @type {import('esbuild').Plugin[]}
	 */
	const plugins = [
		{
			name: "resolve-hoisted-deps",
			setup(build) {
				build.onResolve({ filter: /^pdf-parse\/lib\/pdf-parse$/ }, () => ({
					path: resolveDependencyPath(srcDir, "pdf-parse", "lib/pdf-parse.js"),
				}))
			},
		},
		// novacode_change start
		{
			name: "import-meta-url-plugin",
			setup(build) {
				build.onLoad({ filter: /\.js$/ }, async (args) => {
					const fs = await import("fs")
					let contents = await fs.promises.readFile(args.path, "utf8")

					// Replace import.meta.url with our polyfill
					if (contents.includes("import.meta.url")) {
						contents = contents.replace(/import\.meta\.url/g, "__importMetaUrl")
					}

					return { contents, loader: "js" }
				})
			},
		},
		// novacode_change end
		{
			name: "copyFiles",
			setup(build) {
				build.onEnd(() => {
					copyPaths(
						[
							["../README.md", "README.md"],
							["../CHANGELOG.md", "CHANGELOG.md"],
							["../LICENSE", "LICENSE"],
							["../.env", ".env", { optional: true }],
							["../webview-ui/audio", "webview-ui/audio"],
						],
						srcDir,
						buildDir,
					)
					copyDirectory(
						resolveDependencyPath(srcDir, "vscode-material-icons", "generated"),
						path.join(buildDir, "assets", "vscode-material-icons"),
					)

					// Copy walkthrough files to dist directory
					copyPaths([["walkthrough", "walkthrough"]], srcDir, distDir)

					// Copy tree-sitter files to dist directory
					copyPaths([["services/autocomplete/continuedev/tree-sitter", "tree-sitter"]], srcDir, distDir)

					// Copy JSDOM xhr-sync-worker.js to fix runtime resolution
					const jsdomWorkerDest = path.join(distDir, "xhr-sync-worker.js")

					try {
						const require = createRequire(import.meta.url)
						const jsdomModulePath = require.resolve("jsdom/package.json")
						const jsdomDir = path.dirname(jsdomModulePath)
						const jsdomWorkerSource = path.join(jsdomDir, "lib/jsdom/living/xhr/xhr-sync-worker.js")

						if (fs.existsSync(jsdomWorkerSource)) {
							fs.copyFileSync(jsdomWorkerSource, jsdomWorkerDest)
							console.log(`[${name}] Copied JSDOM xhr-sync-worker.js to dist from: ${jsdomWorkerSource}`)
						}
					} catch (error) {
						console.error(`[${name}] Failed to copy JSDOM xhr-sync-worker.js:`, error.message)
					}
				})
			},
		},
		{
			name: "copyWasms",
			setup(build) {
				build.onEnd(() => copyWasmsWithFallback(srcDir, distDir))
			},
		},
		{
			name: "copyLocales",
			setup(build) {
				build.onEnd(() => copyLocales(srcDir, distDir))
			},
		},
		{
			name: "esbuild-problem-matcher",
			setup(build) {
				build.onStart(() => console.log("[esbuild-problem-matcher#onStart]"))
				build.onEnd((result) => {
					result.errors.forEach(({ text, location }) => {
						console.error(`✘ [ERROR] ${text}`)
						if (location && location.file) {
							console.error(`    ${location.file}:${location.line}:${location.column}:`)
						}
					})

					console.log("[esbuild-problem-matcher#onEnd]")
				})
			},
		},
	]

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const extensionConfig = {
		...buildOptions,
		plugins,
		entryPoints: ["extension.ts"],
		outfile: "dist/extension.js",
		// global-agent must be external because it dynamically patches Node.js http/https modules
		// which breaks when bundled. It needs access to the actual Node.js module instances.
		// undici must be bundled because our VSIX is packaged with `--no-dependencies`.
		external: ["vscode", "esbuild", "global-agent", "@lancedb/lancedb"], // novacode_change: add @lancedb/lancedb
	}

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const workerConfig = {
		...buildOptions,
		entryPoints: ["workers/countTokens.ts"],
		outdir: "dist/workers",
	}

	// novacode_change start - agent-runtime process bundle
	/**
	 * Agent Runtime Process Bundle
	 *
	 * This bundles the agent-runtime process.ts into a standalone file that can be
	 * forked by the Agent Manager. fork() requires a physical .js file on disk,
	 * so we bundle it separately from the main extension.
	 *
	 * @type {import('esbuild').BuildOptions}
	 */
	const agentRuntimeDir = path.join(srcDir, "..", "packages/agent-runtime")
	const agentRuntimeProcessConfig = {
		...buildOptions,
		entryPoints: [path.join(agentRuntimeDir, "src/process.ts")],
		outfile: "dist/agent-runtime-process.js",
		// The agent-runtime process loads the main extension bundle dynamically,
		// so vscode APIs come from the extension, not from direct imports
		external: ["vscode"],
		// Use CJS format - works reliably with fork() and dynamic require() in dependencies
		format: "cjs",
		// Ensure we can resolve workspace packages
		plugins: [
			{
				name: "resolve-workspace-packages",
				setup(build) {
					// Resolve @roo-code/types and other workspace packages
					build.onResolve({ filter: /^@roo-code\// }, (args) => {
						const packageName = args.path
						const packagePath = path.join(srcDir, "..", "packages", packageName.replace("@roo-code/", ""))
						return { path: path.join(packagePath, "src/index.ts") }
					})
					build.onResolve({ filter: /^@novacode\// }, (args) => {
						const packageName = args.path
						const packagePath = path.join(srcDir, "..", "packages", packageName.replace("@novacode/", ""))
						return { path: path.join(packagePath, "src/index.ts") }
					})
				},
			},
		],
	}
	// novacode_change end

	const [extensionCtx, workerCtx, agentRuntimeCtx] = await Promise.all([ // novacode_change
		esbuild.context(extensionConfig),
		esbuild.context(workerConfig),
		esbuild.context(agentRuntimeProcessConfig), // novacode_change
	])

	if (watch) {
		await Promise.all([extensionCtx.watch(), workerCtx.watch(), agentRuntimeCtx.watch()]) // novacode_change
		copyLocales(srcDir, distDir)
		setupLocaleWatcher(srcDir, distDir)
	} else {
		await Promise.all([extensionCtx.rebuild(), workerCtx.rebuild(), agentRuntimeCtx.rebuild()]) // novacode_change
		await Promise.all([extensionCtx.dispose(), workerCtx.dispose(), agentRuntimeCtx.dispose()]) // novacode_change
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
