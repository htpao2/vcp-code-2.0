const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const rootDir = path.resolve(__dirname, "..", "..")
const binDir = path.join(rootDir, "bin")
const outputDir = path.join(rootDir, "bin-unpacked")

const vsixFile = fs
	.readdirSync(binDir)
	.filter((name) => name.startsWith("vcp-code-") && name.endsWith(".vsix"))
	.map((name) => path.join(binDir, name))
	.sort()
	.at(-1)

if (!vsixFile) {
	console.error("No VSIX file found in ../bin")
	process.exit(1)
}

fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir, { recursive: true })

if (process.platform === "win32") {
	const tempZipFile = path.join(outputDir, path.basename(vsixFile, ".vsix") + ".zip")
	fs.copyFileSync(vsixFile, tempZipFile)
	const command = [
		"$ErrorActionPreference = 'Stop'",
		`Expand-Archive -LiteralPath '${tempZipFile.replace(/'/g, "''")}' -DestinationPath '${outputDir.replace(/'/g, "''")}' -Force`,
	].join("; ")

	const result = spawnSync("powershell", ["-Command", command], {
		stdio: "inherit",
	})

	fs.rmSync(tempZipFile, { force: true })

	if (result.status !== 0) {
		process.exit(result.status ?? 1)
	}
	process.exit(0)
}

const result = spawnSync("unzip", ["-q", "-o", vsixFile, "-d", outputDir], {
	stdio: "inherit",
})

if (result.status !== 0) {
	process.exit(result.status ?? 1)
}
