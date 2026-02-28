import { TextDecoder, TextEncoder } from "util"

const g: any = globalThis

// Node 20+ provides global fetch/Request/Response natively.
// Keep setup files free of test hooks so Vitest can load them before runner init.
g.TextEncoder = TextEncoder
g.TextDecoder = TextDecoder
