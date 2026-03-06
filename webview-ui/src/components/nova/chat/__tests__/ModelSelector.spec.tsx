import { OPENROUTER_DEFAULT_PROVIDER_NAME, type ProviderSettings } from "@roo-code/types"

import { fireEvent, render, screen } from "@/utils/test-utils"
import { vscode } from "@/utils/vscode"
import { ModelSelector } from "../ModelSelector"

const mockUseProfileModelCatalog = vi.fn()

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

vi.mock("@/components/chat/useProfileModelCatalog", () => ({
	useProfileModelCatalog: (...args: unknown[]) => mockUseProfileModelCatalog(...args),
}))

vi.mock("@/components/nova/hooks/useSelectedModel", () => ({
	getSelectedModelId: () => "model-1",
}))

vi.mock("@/components/ui/hooks/useRooPortal", () => ({
	useRooPortal: () => undefined,
}))

const baseApiConfiguration: ProviderSettings = {
	apiProvider: "openrouter",
	openRouterModelId: "model-1",
	profileType: "chat",
}

const createModelItem = (overrides: Record<string, unknown> = {}) => ({
	key: "profile-1:model-1",
	profileId: "profile-1",
	profileName: "chat-profile",
	profileConfig: {
		apiProvider: "openrouter",
		openRouterModelId: "model-1",
	},
	provider: "openrouter",
	providerLabel: "OpenRouter",
	modelId: "model-1",
	modelLabel: "Model 1",
	isCurrentProfile: true,
	isCurrentModel: true,
	searchText: "openrouter chat-profile model 1",
	...overrides,
})

const createGroup = (overrides: Record<string, unknown> = {}) => ({
	key: "openrouter:profile-1",
	provider: "openrouter",
	providerLabel: "OpenRouter",
	items: [createModelItem()],
	isEmpty: false,
	profileName: "chat-profile",
	refresh: vi.fn().mockResolvedValue(undefined),
	...overrides,
})

describe("ModelSelector", () => {
	beforeEach(() => {
		mockUseProfileModelCatalog.mockReset()
		vi.mocked(vscode.postMessage).mockReset()
		mockUseProfileModelCatalog.mockReturnValue({
			groups: [createGroup()],
			isLoading: false,
			isError: false,
		})
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

	test("empty groups render fallback text", () => {
		mockUseProfileModelCatalog.mockReturnValue({
			groups: [],
			isLoading: false,
			isError: false,
		})

		render(
			<ModelSelector
				currentApiConfigName="chat-profile"
				apiConfiguration={baseApiConfiguration}
				fallbackText="暂无模型"
			/>,
		)

		expect(screen.getByText("暂无模型")).toBeInTheDocument()
		expect(screen.queryByTestId("dropdown-trigger")).not.toBeInTheDocument()
	})

	test("empty group shows refresh button after opening popover", () => {
		const refresh = vi.fn().mockResolvedValue(undefined)
		mockUseProfileModelCatalog.mockReturnValue({
			groups: [createGroup({ items: [], isEmpty: true, refresh })],
			isLoading: false,
			isError: false,
		})

		render(
			<ModelSelector
				currentApiConfigName="chat-profile"
				apiConfiguration={baseApiConfiguration}
				fallbackText="选择模型"
			/>,
		)

		fireEvent.click(screen.getByTestId("dropdown-trigger"))
		fireEvent.click(screen.getByRole("button", { name: "获取模型列表" }))

		expect(refresh).toHaveBeenCalledTimes(1)
	})

	test("selecting a model in the current profile posts only upsertApiConfiguration", () => {
		mockUseProfileModelCatalog.mockReturnValue({
			groups: [
				createGroup({
					items: [
						createModelItem({
							modelId: "model-2",
							modelLabel: "Model 2",
							isCurrentModel: false,
							profileConfig: {
								apiProvider: "openrouter",
								openRouterModelId: "model-2",
							},
						}),
					],
				}),
			],
			isLoading: false,
			isError: false,
		})

		render(
			<ModelSelector
				currentApiConfigName="chat-profile"
				apiConfiguration={baseApiConfiguration}
				fallbackText="选择模型"
			/>,
		)

		fireEvent.click(screen.getByTestId("dropdown-trigger"))
		fireEvent.click(screen.getByRole("button", { name: "Model 2 model-2" }))

		expect(vscode.postMessage).toHaveBeenCalledTimes(1)
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "upsertApiConfiguration",
			text: "chat-profile",
			apiConfiguration: expect.objectContaining({
				apiProvider: "openrouter",
				openRouterModelId: "model-2",
				openRouterSpecificProvider: OPENROUTER_DEFAULT_PROVIDER_NAME,
			}),
		})
	})

	test("selecting a model from another profile also loads that profile", () => {
		mockUseProfileModelCatalog.mockReturnValue({
			groups: [
				createGroup({
					profileName: "other-profile",
					items: [
						createModelItem({
							key: "profile-2:model-9",
							profileId: "profile-2",
							profileName: "other-profile",
							profileConfig: {
								apiProvider: "openai",
								openAiModelId: "model-9",
							},
							provider: "openai",
							providerLabel: "OpenAI Compatible",
							modelId: "model-9",
							modelLabel: "Model 9",
							isCurrentProfile: false,
							isCurrentModel: false,
							searchText: "openai other-profile model 9",
						}),
					],
				}),
			],
			isLoading: false,
			isError: false,
		})

		render(
			<ModelSelector
				currentApiConfigName="chat-profile"
				apiConfiguration={baseApiConfiguration}
				fallbackText="选择模型"
			/>,
		)

		fireEvent.click(screen.getByTestId("dropdown-trigger"))
		fireEvent.click(screen.getByRole("button", { name: "Model 9 model-9" }))

		expect(vscode.postMessage).toHaveBeenNthCalledWith(1, {
			type: "upsertApiConfiguration",
			text: "other-profile",
			apiConfiguration: expect.objectContaining({
				apiProvider: "openai",
				openAiModelId: "model-9",
			}),
		})
		expect(vscode.postMessage).toHaveBeenNthCalledWith(2, {
			type: "loadApiConfigurationById",
			text: "profile-2",
		})
	})
})
