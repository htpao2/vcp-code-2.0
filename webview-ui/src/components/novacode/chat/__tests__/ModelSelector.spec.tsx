import { OPENROUTER_DEFAULT_PROVIDER_NAME, type ProviderSettings } from "@roo-code/types"

import { fireEvent, render, screen, waitFor } from "@/utils/test-utils"
import { vscode } from "@/utils/vscode"
import { ModelSelector } from "../ModelSelector"

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/ui/hooks/useRooPortal", () => ({
	useRooPortal: () => undefined,
}))

vi.mock("@/components/nova/hooks/useSelectedModel", () => ({
	getSelectedModelId: ({ provider, apiConfiguration }: any) => {
		if (provider === "openrouter") {
			return apiConfiguration.openRouterModelId ?? ""
		}
		if (provider === "openai") {
			return apiConfiguration.openAiModelId ?? ""
		}
		return ""
	},
	getModelIdKey: ({ provider }: any) => {
		if (provider === "openrouter") {
			return "openRouterModelId"
		}
		if (provider === "openai") {
			return "openAiModelId"
		}
		return "apiModelId"
	},
}))

const baseApiConfiguration: ProviderSettings = {
	apiProvider: "openrouter",
	openRouterModelId: "model-1",
	profileType: "chat",
}

const runtimeModels = [
	{
		id: "model-1",
		displayName: "Model 1",
		owned_by: "openrouter",
	},
	{
		id: "model-2",
		displayName: "Model 2",
		owned_by: "openrouter",
	},
]

describe("ModelSelector", () => {
	beforeEach(() => {
		vi.mocked(vscode.postMessage).mockReset()
	})

	test("chat profile renders dropdown trigger", () => {
		render(
			<ModelSelector
				currentApiConfigName="chat-profile"
				apiConfiguration={baseApiConfiguration}
				fallbackText="选择模型"
			/>,
		)

		expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument()
	})

	test("autocomplete profile renders fallback text", () => {
		render(
			<ModelSelector
				currentApiConfigName="chat-profile"
				apiConfiguration={{ ...baseApiConfiguration, profileType: "autocomplete" }}
				fallbackText="自动补全不可切换"
			/>,
		)

		expect(screen.getByText("自动补全不可切换")).toBeInTheDocument()
		expect(screen.queryByTestId("dropdown-trigger")).not.toBeInTheDocument()
	})

	test("virtual quota fallback renders active model label", () => {
		render(
			<ModelSelector
				currentApiConfigName="chat-profile"
				apiConfiguration={{ ...baseApiConfiguration, apiProvider: "virtual-quota-fallback" }}
				fallbackText="选择模型"
				virtualQuotaActiveModel={{ id: "gpt-4", name: "GPT-4", activeProfileNumber: 2 }}
			/>,
		)

		expect(screen.getByText(/Gpt 4/)).toBeInTheDocument()
		expect(screen.getByText(/2/)).toBeInTheDocument()
	})

	test("opening the dropdown requests current provider models", () => {
		render(
			<ModelSelector
				currentApiConfigName="chat-profile"
				apiConfiguration={baseApiConfiguration}
				fallbackText="选择模型"
			/>,
		)

		fireEvent.click(screen.getByTestId("dropdown-trigger"))

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "fetchRuntimeProviderModels" })
	})

	test("refresh button requests a forced provider refresh", async () => {
		render(
			<ModelSelector
				currentApiConfigName="chat-profile"
				apiConfiguration={baseApiConfiguration}
				fallbackText="选择模型"
			/>,
		)

		fireEvent.click(screen.getByTestId("dropdown-trigger"))
		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "runtimeProviderModels",
					runtimeProviderModels: runtimeModels,
				},
			}),
		)

		await waitFor(() => expect(screen.getByRole("button", { name: /刷新/i })).not.toBeDisabled())
		fireEvent.click(screen.getByRole("button", { name: /刷新/i }))

		expect(vscode.postMessage).toHaveBeenNthCalledWith(1, { type: "fetchRuntimeProviderModels" })
		expect(vscode.postMessage).toHaveBeenNthCalledWith(2, { type: "refreshRuntimeProviderModels" })
	})

	test("selecting a model updates only the current profile and runtime default model", async () => {
		render(
			<ModelSelector
				currentApiConfigName="chat-profile"
				apiConfiguration={baseApiConfiguration}
				fallbackText="选择模型"
			/>,
		)

		fireEvent.click(screen.getByTestId("dropdown-trigger"))
		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "runtimeProviderModels",
					runtimeProviderModels: runtimeModels,
				},
			}),
		)

		fireEvent.click(await screen.findByRole("button", { name: /Model 2/ }))

		expect(vscode.postMessage).toHaveBeenNthCalledWith(1, { type: "fetchRuntimeProviderModels" })
		expect(vscode.postMessage).toHaveBeenNthCalledWith(2, {
			type: "upsertApiConfiguration",
			text: "chat-profile",
			apiConfiguration: expect.objectContaining({
				apiProvider: "openrouter",
				openRouterModelId: "model-2",
				openRouterSpecificProvider: OPENROUTER_DEFAULT_PROVIDER_NAME,
			}),
		})
		expect(vscode.postMessage).toHaveBeenNthCalledWith(3, {
			type: "updateVcpRuntimeModelBindings",
			defaultModelId: "model-2",
		})
		expect(vscode.postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "loadApiConfigurationById" }),
		)
	})
})
