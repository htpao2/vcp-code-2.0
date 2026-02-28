// Re-export device auth types from @roo-code/types
export type { DeviceAuthInitiateResponse, DeviceAuthPollResponse, DeviceAuthState } from "@roo-code/types"
export { DeviceAuthInitiateResponseSchema, DeviceAuthPollResponseSchema } from "@roo-code/types"

// Novacode-specific auth types
export * from "./novacode.js"
