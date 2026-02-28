// novacode_change - new file
// npx vitest src/components/nova/welcome/__tests__/OnboardingView.spec.tsx

import { render, screen, fireEvent } from "@/utils/test-utils"
import OnboardingView from "../OnboardingView"

// Mock Logo component
vi.mock("../../common/Logo", () => ({
	default: () => <div data-testid="nova-logo">Nova Logo</div>,
}))

describe("OnboardingView", () => {
	const mockOnSelectFreeModels = vi.fn()
	const mockOnSelectPremiumModels = vi.fn()
	const mockOnSelectBYOK = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the Nova logo", () => {
		render(
			<OnboardingView
				onSelectFreeModels={mockOnSelectFreeModels}
				onSelectPremiumModels={mockOnSelectPremiumModels}
				onSelectBYOK={mockOnSelectBYOK}
			/>,
		)

		expect(screen.getByTestId("nova-logo")).toBeInTheDocument()
	})

	it("renders the title", () => {
		render(
			<OnboardingView
				onSelectFreeModels={mockOnSelectFreeModels}
				onSelectPremiumModels={mockOnSelectPremiumModels}
				onSelectBYOK={mockOnSelectBYOK}
			/>,
		)

		// The translation key is returned as-is by the test-utils mock
		expect(screen.getByText("novacode:onboarding.title")).toBeInTheDocument()
	})

	it("renders all three options", () => {
		render(
			<OnboardingView
				onSelectFreeModels={mockOnSelectFreeModels}
				onSelectPremiumModels={mockOnSelectPremiumModels}
				onSelectBYOK={mockOnSelectBYOK}
			/>,
		)

		expect(screen.getByText("novacode:onboarding.freeModels.title")).toBeInTheDocument()
		expect(screen.getByText("novacode:onboarding.freeModels.description")).toBeInTheDocument()

		expect(screen.getByText("novacode:onboarding.premiumModels.title")).toBeInTheDocument()
		expect(screen.getByText("novacode:onboarding.premiumModels.description")).toBeInTheDocument()

		expect(screen.getByText("novacode:onboarding.byok.title")).toBeInTheDocument()
		expect(screen.getByText("novacode:onboarding.byok.description")).toBeInTheDocument()
	})

	it("calls onSelectFreeModels when Free models option is clicked", () => {
		render(
			<OnboardingView
				onSelectFreeModels={mockOnSelectFreeModels}
				onSelectPremiumModels={mockOnSelectPremiumModels}
				onSelectBYOK={mockOnSelectBYOK}
			/>,
		)

		const freeModelsButton = screen.getByText("novacode:onboarding.freeModels.title").closest("button")
		expect(freeModelsButton).toBeInTheDocument()
		fireEvent.click(freeModelsButton!)

		expect(mockOnSelectFreeModels).toHaveBeenCalledTimes(1)
		expect(mockOnSelectPremiumModels).not.toHaveBeenCalled()
		expect(mockOnSelectBYOK).not.toHaveBeenCalled()
	})

	it("calls onSelectPremiumModels when Premium models option is clicked", () => {
		render(
			<OnboardingView
				onSelectFreeModels={mockOnSelectFreeModels}
				onSelectPremiumModels={mockOnSelectPremiumModels}
				onSelectBYOK={mockOnSelectBYOK}
			/>,
		)

		const premiumModelsButton = screen.getByText("novacode:onboarding.premiumModels.title").closest("button")
		expect(premiumModelsButton).toBeInTheDocument()
		fireEvent.click(premiumModelsButton!)

		expect(mockOnSelectPremiumModels).toHaveBeenCalledTimes(1)
		expect(mockOnSelectFreeModels).not.toHaveBeenCalled()
		expect(mockOnSelectBYOK).not.toHaveBeenCalled()
	})

	it("calls onSelectBYOK when BYOK option is clicked", () => {
		render(
			<OnboardingView
				onSelectFreeModels={mockOnSelectFreeModels}
				onSelectPremiumModels={mockOnSelectPremiumModels}
				onSelectBYOK={mockOnSelectBYOK}
			/>,
		)

		const byokButton = screen.getByText("novacode:onboarding.byok.title").closest("button")
		expect(byokButton).toBeInTheDocument()
		fireEvent.click(byokButton!)

		expect(mockOnSelectBYOK).toHaveBeenCalledTimes(1)
		expect(mockOnSelectFreeModels).not.toHaveBeenCalled()
		expect(mockOnSelectPremiumModels).not.toHaveBeenCalled()
	})
})
