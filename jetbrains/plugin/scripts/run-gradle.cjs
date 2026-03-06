/* global process */
const { spawnSync } = require("child_process")
const path = require("path")

const gradleCommand = process.platform === "win32" ? "gradlew.bat" : "./gradlew"
const gradlePath = path.join(__dirname, "..", gradleCommand)
const args = process.argv.slice(2)

const result = spawnSync(gradlePath, args, {
	cwd: path.join(__dirname, ".."),
	stdio: "inherit",
	shell: process.platform === "win32",
})

if (result.error) {
	console.error(result.error.message)
	process.exit(typeof result.status === "number" ? result.status : 1)
}

process.exit(typeof result.status === "number" ? result.status : 0)
