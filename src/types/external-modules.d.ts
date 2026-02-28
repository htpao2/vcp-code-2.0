declare module "strip-bom" {
	export default function stripBom(input: string): string
}

declare module "workerpool" {
	namespace workerpool {
		type Pool = any
		type Worker = any
		function pool(...args: any[]): Pool
		function worker(methods: Record<string, (...args: any[]) => any>): void
	}

	export = workerpool
}

declare module "mammoth" {
	export interface RawTextResult {
		value: string
		messages?: unknown[]
	}

	interface MammothApi {
		extractRawText(options: { path: string }): Promise<RawTextResult>
	}

	const mammoth: MammothApi
	export default mammoth
}
