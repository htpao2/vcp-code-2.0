import { useMemo, useState } from "react"
import { ImagePlus } from "lucide-react"

import { Button, Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"

type EmojiStickerPickerProps = {
	disabled?: boolean
	onInsert?: (markdown: string) => void
}

const guessMimeType = (source: string) => {
	const lowerSource = source.toLowerCase()
	if (lowerSource.endsWith(".png")) return "image/png"
	if (lowerSource.endsWith(".jpg") || lowerSource.endsWith(".jpeg")) return "image/jpeg"
	if (lowerSource.endsWith(".gif")) return "image/gif"
	if (lowerSource.endsWith(".webp")) return "image/webp"
	if (lowerSource.endsWith(".svg")) return "image/svg+xml"
	return "image/*"
}

export const EmojiStickerPicker = ({ disabled = false, onInsert }: EmojiStickerPickerProps) => {
	const [open, setOpen] = useState(false)
	const [sourceType, setSourceType] = useState<"remote" | "local">("remote")
	const [source, setSource] = useState("")
	const [alt, setAlt] = useState("")
	const [title, setTitle] = useState("")

	const previewMarkdown = useMemo(() => {
		if (!source.trim()) {
			return ""
		}

		const normalizedAlt = alt.trim() || "image"
		const normalizedTitle = title.trim()
		return normalizedTitle
			? `![${normalizedAlt}](${source.trim()} "${normalizedTitle}")`
			: `![${normalizedAlt}](${source.trim()})`
	}, [alt, source, title])

	void onInsert

	const submit = () => {
		const trimmedSource = source.trim()
		if (!trimmedSource) {
			return
		}

		vscode.postMessage({
			type: "sendMediaAsset",
			mediaAsset: {
				assetId: `vcp-media-${Date.now()}`,
				sourceType,
				source: trimmedSource,
				mimeType: guessMimeType(trimmedSource),
				...(alt.trim() ? { alt: alt.trim() } : {}),
				...(title.trim() ? { title: title.trim() } : {}),
			},
		})

		setSource("")
		setAlt("")
		setTitle("")
		setOpen(false)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<StandardTooltip content="发送图片资源">
				<PopoverTrigger asChild>
					<button
						aria-label="发送图片资源"
						disabled={disabled}
						className={cn(
							"relative inline-flex items-center justify-center",
							"bg-transparent border-none p-1.5",
							"rounded-md min-w-[28px] min-h-[28px]",
							"opacity-60 hover:opacity-100 text-vscode-descriptionForeground hover:text-vscode-foreground",
							"transition-all duration-150",
							"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
							"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
							"active:bg-[rgba(255,255,255,0.1)]",
							disabled && "opacity-40 cursor-not-allowed",
						)}>
						<ImagePlus className="h-4 w-4" />
					</button>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent align="end" sideOffset={8} className="w-[360px] overflow-hidden p-0">
				<div className="border-b border-vscode-panel-border px-3 py-2">
					<div className="text-sm font-medium text-vscode-foreground">VCP 多媒体发送</div>
					<div className="text-xs text-vscode-descriptionForeground">
						这里发送的是图源通道请求，最终由 VCP 中间层校验并回传到聊天输入框。
					</div>
				</div>
				<div className="space-y-3 px-3 py-3">
					<div className="flex gap-2">
						<Button
							variant={sourceType === "remote" ? "primary" : "secondary"}
							size="sm"
							onClick={() => setSourceType("remote")}>
							URL
						</Button>
						<Button
							variant={sourceType === "local" ? "primary" : "secondary"}
							size="sm"
							onClick={() => setSourceType("local")}>
							本地文件
						</Button>
					</div>
					<label className="block text-xs text-vscode-descriptionForeground">
						<div className="mb-1">图片来源</div>
						<input
							value={source}
							onChange={(event) => setSource(event.target.value)}
							placeholder={
								sourceType === "remote" ? "https://example.com/image.png" : "C:\\path\\to\\image.png"
							}
							className="h-8 w-full rounded border border-vscode-input-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-input-foreground focus:outline-0"
						/>
					</label>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<label className="block text-xs text-vscode-descriptionForeground">
							<div className="mb-1">Alt 文本</div>
							<input
								value={alt}
								onChange={(event) => setAlt(event.target.value)}
								placeholder="可选"
								className="h-8 w-full rounded border border-vscode-input-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-input-foreground focus:outline-0"
							/>
						</label>
						<label className="block text-xs text-vscode-descriptionForeground">
							<div className="mb-1">标题</div>
							<input
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								placeholder="可选"
								className="h-8 w-full rounded border border-vscode-input-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-input-foreground focus:outline-0"
							/>
						</label>
					</div>
					<div className="rounded border border-vscode-panel-border px-2 py-2 text-[11px] text-vscode-descriptionForeground">
						<div className="mb-1 font-medium text-vscode-foreground">预览</div>
						<div className="break-all">{previewMarkdown || "填写图片来源后会在这里显示预览。"}</div>
					</div>
					<div className="flex justify-end gap-2">
						<Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
							取消
						</Button>
						<Button size="sm" onClick={submit} disabled={!source.trim()}>
							发送
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
