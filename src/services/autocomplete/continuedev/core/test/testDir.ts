import fs from "fs"
import os from "os"
import path from "path"
import { localPathOrUriToPath, localPathToUri } from "../util/pathToUri"

// Want this outside of the git repository so we can change branches in tests
const TEST_DIR_WORKER_SUFFIX = process.env.VITEST_WORKER_ID ?? process.pid.toString()
const TEST_DIR_PATH = path.join(os.tmpdir(), `testWorkspaceDir-${TEST_DIR_WORKER_SUFFIX}`)
export const TEST_DIR = localPathToUri(TEST_DIR_PATH) // URI

const RETRYABLE_DELETE_ERRORS = new Set(["ENOTEMPTY", "EBUSY", "EPERM"])

const sleepSync = (ms: number) => {
	const start = Date.now()
	while (Date.now() - start < ms) {
		// 仅用于测试清理路径，短时阻塞可接受。
	}
}

const removeTestDir = () => {
	if (!fs.existsSync(TEST_DIR_PATH)) {
		return
	}

	for (let attempt = 0; attempt < 10; attempt++) {
		try {
			fs.rmSync(TEST_DIR_PATH, {
				recursive: true,
				force: true,
				maxRetries: 10,
				retryDelay: 100,
			})
			return
		} catch (error) {
			const errno = error as NodeJS.ErrnoException
			if (!errno?.code || !RETRYABLE_DELETE_ERRORS.has(errno.code) || attempt === 9) {
				throw error
			}
			sleepSync(100 * (attempt + 1))
		}
	}
}

export function setUpTestDir() {
	removeTestDir()
	fs.mkdirSync(TEST_DIR_PATH)
}

export function tearDownTestDir() {
	removeTestDir()
}

/*
  accepts array of items in 3 formats, e.g.
  "index/" creates index directory
  "index/index.ts" creates an empty index/index.ts
  ["index/index.ts", "hello"] creates index/index.ts with contents "hello"
*/
export function addToTestDir(pathsOrUris: (string | [string, string])[]) {
	// Allow tests to use URIs or local paths
	const paths = pathsOrUris.map((val) => {
		if (Array.isArray(val)) {
			return [localPathOrUriToPath(val[0]), val[1]]
		} else {
			return localPathOrUriToPath(val)
		}
	})

	for (const p of paths) {
		const filepath = path.join(TEST_DIR_PATH, Array.isArray(p) ? p[0] : p)
		fs.mkdirSync(path.dirname(filepath), { recursive: true })

		if (Array.isArray(p)) {
			fs.writeFileSync(filepath, p[1])
		} else if (p.endsWith("/")) {
			fs.mkdirSync(filepath, { recursive: true })
		} else {
			fs.writeFileSync(filepath, "")
		}
	}
}
