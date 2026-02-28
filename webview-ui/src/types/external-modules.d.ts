declare module "strip-bom" {
	export default function stripBom(input: string): string
}

declare module "debounce" {
	interface DebounceOptions {
		immediate?: boolean
	}

	type Debounced<T extends (...args: any[]) => any> = ((...args: Parameters<T>) => ReturnType<T>) & {
		clear(): void
		flush(): void
		trigger(): void
	}

	export default function debounce<T extends (...args: any[]) => any>(
		fn: T,
		wait?: number,
		options?: DebounceOptions,
	): Debounced<T>
}
