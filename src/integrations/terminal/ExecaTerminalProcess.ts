import psList from "ps-list"
import process from "process"

import type { RooTerminal } from "./types"
import { BaseTerminalProcess } from "./BaseTerminalProcess"

type ExecaSubprocess = {
	pid?: number
	kill: (signal?: number | NodeJS.Signals) => boolean
	iterable: (options: { from: "all"; preserveNewlines: true }) => AsyncIterable<string | Uint8Array<ArrayBufferLike>>
} & PromiseLike<unknown>

// novacode_change start
/**
 * Get child process IDs for a given parent PID
 */
async function getChildPids(parentPid: number): Promise<number[]> {
	try {
		const processes = await psList()
		return processes.filter((p) => p.ppid === parentPid).map((p) => p.pid)
	} catch (error) {
		console.error(`Failed to get child processes for PID ${parentPid}:`, error)
		return []
	}
}
// novacode_change end

export class ExecaTerminalProcess extends BaseTerminalProcess {
	private terminalRef: WeakRef<RooTerminal>
	private aborted = false
	private pid?: number
	private subprocess?: ExecaSubprocess
	private pidUpdatePromise?: Promise<void>

	constructor(terminal: RooTerminal) {
		super()

		this.terminalRef = new WeakRef(terminal)

		this.once("completed", () => {
			this.terminal.busy = false
		})
	}

	public get terminal(): RooTerminal {
		const terminal = this.terminalRef.deref()

		if (!terminal) {
			throw new Error("Unable to dereference terminal")
		}

		return terminal
	}

	public override async run(command: string) {
		this.command = command

		try {
			this.isHot = true

			const { execa } = await import("execa")
			const subprocess = execa({
				shell: true,
				cwd: this.terminal.getCurrentWorkingDirectory(),
				all: true,
				// Ignore stdin to ensure non-interactive mode and prevent hanging
				stdin: "ignore",
				env: {
					...process.env,
					// Ensure UTF-8 encoding for Ruby, CocoaPods, etc.
					LANG: "en_US.UTF-8",
					LC_ALL: "en_US.UTF-8",
				},
			})`${command}` as ExecaSubprocess
			this.subprocess = subprocess

			this.pid = subprocess.pid

			// When using shell: true, the PID is for the shell, not the actual command
			// Find the actual command PID after a small delay
			if (this.pid) {
				this.pidUpdatePromise = new Promise<void>((resolve) => {
					// novacode_change start
					setTimeout(async () => {
						try {
							const childPids = await getChildPids(this.pid!)
							if (childPids.length > 0) {
								// Update PID to the first child (the actual command)
								this.pid = childPids[0]
							}
						} catch (error) {
							console.error(`Failed to update PID:`, error)
						}
						resolve()
					}, 100)
					// novacode_change end
				})
			}

			const rawStream = subprocess.iterable({ from: "all", preserveNewlines: true })

			// Wrap the stream to ensure all chunks are strings (execa can return Uint8Array)
			const stream = (async function* () {
				for await (const chunk of rawStream) {
					yield typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
				}
			})()

			this.terminal.setActiveStream(stream, this.pid)

			for await (const line of stream) {
				if (this.aborted) {
					break
				}

				this.fullOutput += line

				const now = Date.now()

				if (this.isListening && (now - this.lastEmitTime_ms > 500 || this.lastEmitTime_ms === 0)) {
					this.emitRemainingBufferIfListening()
					this.lastEmitTime_ms = now
				}

				this.startHotTimer(line)
			}

			if (this.aborted) {
				let timeoutId: NodeJS.Timeout | undefined

				const kill = new Promise<void>((resolve) => {
					console.log(`[ExecaTerminalProcess#run] SIGKILL -> ${this.pid}`)

					timeoutId = setTimeout(() => {
						try {
							this.subprocess?.kill("SIGKILL")
						} catch (e) {}

						resolve()
					}, 5_000)
				})

				try {
					await Promise.race([subprocess, kill])
				} catch (error) {
					console.log(
						`[ExecaTerminalProcess#run] subprocess termination error: ${error instanceof Error ? error.message : String(error)}`,
					)
				}

				if (timeoutId) {
					clearTimeout(timeoutId)
				}
			}

			this.emit("shell_execution_complete", { exitCode: 0 })
		} catch (error) {
			const execaLikeError = error as { message?: string; exitCode?: number; signal?: string }
			if (typeof execaLikeError.exitCode === "number" || typeof execaLikeError.signal === "string") {
				console.error(
					`[ExecaTerminalProcess#run] shell execution error: ${execaLikeError.message ?? String(error)}`,
				)
				this.emit("shell_execution_complete", {
					exitCode: execaLikeError.exitCode ?? 0,
					signalName: execaLikeError.signal,
				})
			} else {
				console.error(
					`[ExecaTerminalProcess#run] shell execution error: ${error instanceof Error ? error.message : String(error)}`,
				)

				this.emit("shell_execution_complete", { exitCode: 1 })
			}
			this.subprocess = undefined
		}

		this.terminal.setActiveStream(undefined)
		this.emitRemainingBufferIfListening()
		this.stopHotTimer()
		this.emit("completed", this.fullOutput)
		this.emit("continue")
		this.subprocess = undefined
	}

	public override continue() {
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}

	public override abort() {
		this.aborted = true

		// Function to perform the kill operations
		const performKill = () => {
			// Try to kill using the subprocess object
			if (this.subprocess) {
				try {
					this.subprocess.kill("SIGKILL")
				} catch (e) {
					console.warn(
						`[ExecaTerminalProcess#abort] Failed to kill subprocess: ${e instanceof Error ? e.message : String(e)}`,
					)
				}
			}

			// Kill the stored PID (which should be the actual command after our update)
			if (this.pid) {
				try {
					process.kill(this.pid, "SIGKILL")
				} catch (e) {
					console.warn(
						`[ExecaTerminalProcess#abort] Failed to kill process ${this.pid}: ${e instanceof Error ? e.message : String(e)}`,
					)
				}
			}
		}

		// If PID update is in progress, wait for it before killing
		if (this.pidUpdatePromise) {
			this.pidUpdatePromise.then(performKill).catch(() => performKill())
		} else {
			performKill()
		}

		// Continue with the rest of the abort logic
		if (this.pid) {
			// Also check for any child processes
			// novacode_change start
			;(async () => {
				try {
					const childPids = await getChildPids(this.pid!)
					if (childPids.length > 0) {
						console.error(`[ExecaTerminalProcess#abort] SIGKILL children -> ${childPids.join(", ")}`)

						for (const pid of childPids) {
							try {
								process.kill(pid, "SIGKILL")
							} catch (e) {
								console.warn(
									`[ExecaTerminalProcess#abort] Failed to send SIGKILL to child PID ${pid}: ${e instanceof Error ? e.message : String(e)}`,
								)
							}
						}
					}
				} catch (error) {
					console.error(
						`[ExecaTerminalProcess#abort] Failed to get child processes for PID ${this.pid}: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			})()
			// novacode_change end
		}
	}

	public override hasUnretrievedOutput() {
		return this.lastRetrievedIndex < this.fullOutput.length
	}

	public override getUnretrievedOutput() {
		let output = this.fullOutput.slice(this.lastRetrievedIndex)
		let index = output.lastIndexOf("\n")

		if (index === -1) {
			return ""
		}

		index++
		this.lastRetrievedIndex += index

		// console.log(
		// 	`[ExecaTerminalProcess#getUnretrievedOutput] fullOutput.length=${this.fullOutput.length} lastRetrievedIndex=${this.lastRetrievedIndex}`,
		// 	output.slice(0, index),
		// )

		return output.slice(0, index)
	}

	private emitRemainingBufferIfListening() {
		if (!this.isListening) {
			return
		}

		const output = this.getUnretrievedOutput()

		if (output !== "") {
			this.emit("line", output)
		}
	}
}
