/**
 * Image generation model constants
 */

/**
 * API method used for image generation
 */
export type ImageGenerationApiMethod = "chat_completions" | "images_api"

export interface ImageGenerationModel {
	value: string
	label: string
	provider: ImageGenerationProvider
	apiMethod?: ImageGenerationApiMethod
}

export const IMAGE_GENERATION_MODELS: ImageGenerationModel[] = [
	// OpenRouter models
	{ value: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", provider: "openrouter" },
	{ value: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image Preview", provider: "openrouter" },
	{ value: "openai/gpt-5-image", label: "GPT-5 Image", provider: "openrouter" },
	{ value: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini", provider: "openrouter" },
	{ value: "black-forest-labs/flux.2-flex", label: "Black Forest Labs FLUX.2 Flex", provider: "openrouter" },
	{ value: "black-forest-labs/flux.2-pro", label: "Black Forest Labs FLUX.2 Pro", provider: "openrouter" },
	// novacode_change start: disable roo cloud models, add openrouter models with novacode provider
	{ value: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", provider: "novacode" },
	{ value: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image Preview", provider: "novacode" },
	{ value: "openai/gpt-5-image", label: "GPT-5 Image", provider: "novacode" },
	{ value: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini", provider: "novacode" },
	{ value: "black-forest-labs/flux.2-flex", label: "Black Forest Labs FLUX.2 Flex", provider: "novacode" },
	{ value: "black-forest-labs/flux.2-pro", label: "Black Forest Labs FLUX.2 Pro", provider: "novacode" },
	// novacode_change end
]

/**
 * Get array of model values only (for backend validation)
 */
export const IMAGE_GENERATION_MODEL_IDS = IMAGE_GENERATION_MODELS.map((m) => m.value)

/**
 * Image generation provider type
 */
export type ImageGenerationProvider = "openrouter" | "novacode" // novacode_change: remove roo, add novacode

/**
 * Get the image generation provider with backwards compatibility
 * - If provider is explicitly set, use it
 * - If a model is already configured (existing users), default to "openrouter"
 * - Otherwise default to "roo" (new users)
 */
export function getImageGenerationProvider(
	explicitProvider: ImageGenerationProvider | undefined,
	hasExistingModel: boolean,
): ImageGenerationProvider {
	return explicitProvider !== undefined ? explicitProvider : hasExistingModel ? "openrouter" : "novacode" // novacode_change: remove roo, add novacode
}
