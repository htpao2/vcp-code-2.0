import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { buildProviderEnvOverrides } from "../providerEnvMapper"
import type { ProviderSettings } from "@roo-code/types"

const log = (_msg: string) => {}
const debugLog = (_msg: string) => {}

describe("providerEnvMapper", () => {
	let tempHome: string

	beforeEach(() => {
		tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "provider-env-mapper-"))
	})

	afterEach(() => {
		fs.rmSync(tempHome, { recursive: true, force: true })
	})

	it("returns empty overrides when apiConfiguration is missing", () => {
		const overrides = buildProviderEnvOverrides(undefined, {}, log, debugLog)
		expect(overrides).toEqual({})
	})

	it("injects novacode auth by switching to an existing CLI novacode provider entry", () => {
		const configPath = path.join(tempHome, ".novacode", "cli", "config.json")
		fs.mkdirSync(path.dirname(configPath), { recursive: true })
		fs.writeFileSync(
			configPath,
			JSON.stringify({
				version: "1.0.0",
				provider: "anthropic",
				providers: [
					{ id: "anthropic", provider: "anthropic", apiKey: "x", apiModelId: "y" },
					{
						id: "nova-1",
						provider: "novacode",
						novacodeToken: "",
						novacodeModel: "claude-sonnet-4-20250514",
					},
				],
			}),
		)

		const baseEnv = { KEEP_ME: "1", NOVACODE_TOKEN: "user-token" }
		const overrides = buildProviderEnvOverrides(
			{
				apiProvider: "novacode",
				novacodeToken: "ext-token",
			} as ProviderSettings,
			{ ...baseEnv, HOME: tempHome },
			log,
			debugLog,
		)

		expect(overrides.NOVA_PROVIDER).toBe("nova-1")
		expect(overrides.NOVA_PROVIDER_TYPE).toBeUndefined()
		expect(overrides.NOVACODE_MODEL).toBeUndefined()
		expect(overrides.NOVACODE_TOKEN).toBe("ext-token")
		expect(overrides.HOME).toBeUndefined()
		expect(overrides.KEEP_ME).toBeUndefined()
	})

	it("skips injection for non-novacode providers", () => {
		const overrides = buildProviderEnvOverrides(
			{
				apiProvider: "openrouter",
				openRouterApiKey: "or-key",
				openRouterModelId: "openai/gpt-4",
			} as ProviderSettings,
			{},
			log,
			debugLog,
		)

		expect(overrides).toEqual({})
	})

	it("falls back to env-config mode when CLI config has no novacode provider (overrides HOME)", () => {
		const configPath = path.join(tempHome, ".novacode", "cli", "config.json")
		fs.mkdirSync(path.dirname(configPath), { recursive: true })
		fs.writeFileSync(
			configPath,
			JSON.stringify({
				version: "1.0.0",
				provider: "default",
				providers: [{ id: "default", provider: "anthropic", apiKey: "x", apiModelId: "y" }],
			}),
		)

		const overrides = buildProviderEnvOverrides(
			{
				apiProvider: "novacode",
				novacodeToken: "ext-token",
				novacodeModel: "claude-sonnet-4-20250514",
			} as ProviderSettings,
			{ HOME: tempHome, TMPDIR: tempHome },
			log,
			debugLog,
		)

		expect(overrides.HOME).toBe(path.join(tempHome, "novacode-agent-manager-home"))
		expect(overrides.USERPROFILE).toBe(path.join(tempHome, "novacode-agent-manager-home"))
		expect(overrides.NOVA_PROVIDER_TYPE).toBe("novacode")
		expect(overrides.NOVACODE_MODEL).toBe("claude-sonnet-4-20250514")
		expect(overrides.NOVACODE_TOKEN).toBe("ext-token")
	})

	it("uses env-config mode without HOME override when no CLI config exists", () => {
		const overrides = buildProviderEnvOverrides(
			{
				apiProvider: "novacode",
				novacodeToken: "ext-token",
				novacodeModel: "claude-sonnet-4-20250514",
			} as ProviderSettings,
			{ HOME: tempHome },
			log,
			debugLog,
		)

		expect(overrides.HOME).toBeUndefined()
		expect(overrides.NOVA_PROVIDER_TYPE).toBe("novacode")
		expect(overrides.NOVACODE_MODEL).toBe("claude-sonnet-4-20250514")
		expect(overrides.NOVACODE_TOKEN).toBe("ext-token")
	})

	it("skips injection when novacode token is missing", () => {
		const overrides = buildProviderEnvOverrides(
			{
				apiProvider: "novacode",
				novacodeToken: "",
			} as ProviderSettings,
			{},
			log,
			debugLog,
		)

		expect(overrides).toEqual({})
	})

	it("includes org id when present", () => {
		const overrides = buildProviderEnvOverrides(
			{
				apiProvider: "novacode",
				novacodeToken: "ext-token",
				novacodeModel: "claude-sonnet-4-20250514",
				novacodeOrganizationId: "org-123",
			} as ProviderSettings,
			{ HOME: tempHome },
			log,
			debugLog,
		)

		expect(overrides.NOVACODE_TOKEN).toBe("ext-token")
		expect(overrides.NOVACODE_ORGANIZATION_ID).toBe("org-123")
	})
})
