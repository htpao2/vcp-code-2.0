import { useMemo, useState } from "react"
import { SmilePlus } from "lucide-react"

import { Button, Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { cn } from "@/lib/utils"

type EmojiStickerPickerProps = {
	disabled?: boolean
	onInsert: (markdown: string) => void
}

type StickerPreset = {
	id: string
	label: string
	emoji: string
	url: string
}

const STICKER_PRESETS: StickerPreset[] = [
	{
		id: "party",
		label: "庆祝",
		emoji: "🥳",
		url: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f973.png",
	},
	{
		id: "fire",
		label: "火力全开",
		emoji: "🔥",
		url: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f525.png",
	},
	{
		id: "thumbs-up",
		label: "收到",
		emoji: "👍",
		url: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f44d.png",
	},
	{
		id: "rocket",
		label: "开工",
		emoji: "🚀",
		url: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f680.png",
	},
	{
		id: "sparkles",
		label: "灵感",
		emoji: "✨",
		url: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/2728.png",
	},
	{
		id: "eyes",
		label: "围观",
		emoji: "👀",
		url: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f440.png",
	},
	{
		id: "thinking",
		label: "思考",
		emoji: "🤔",
		url: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f914.png",
	},
	{
		id: "tada",
		label: "完成",
		emoji: "🎉",
		url: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f389.png",
	},
]

export const EmojiStickerPicker = ({ disabled = false, onInsert }: EmojiStickerPickerProps) => {
	const [open, setOpen] = useState(false)

	const groupedPresets = useMemo(() => {
		return [
			{
				title: "快捷表情包",
				items: STICKER_PRESETS,
			},
		]
	}, [])

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<StandardTooltip content="插入表情包">
				<PopoverTrigger asChild>
					<button
						aria-label="插入表情包"
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
						<SmilePlus className="h-4 w-4" />
					</button>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent align="end" sideOffset={8} className="w-[320px] p-0 overflow-hidden">
				<div className="border-b border-vscode-panel-border px-3 py-2">
					<div className="text-sm font-medium text-vscode-foreground">表情包</div>
					<div className="text-xs text-vscode-descriptionForeground">
						点击即可把 Markdown 图片贴到输入框中。
					</div>
				</div>
				<div className="max-h-[320px] overflow-y-auto px-3 py-3">
					{groupedPresets.map((group) => (
						<div key={group.title} className="space-y-2">
							<div className="text-xs font-medium uppercase tracking-wide text-vscode-descriptionForeground">
								{group.title}
							</div>
							<div className="grid grid-cols-4 gap-2">
								{group.items.map((item) => (
									<Button
										key={item.id}
										variant="ghost"
										size="sm"
										className="h-auto flex-col gap-1 rounded-lg border border-vscode-panel-border py-3"
										onClick={() => {
											onInsert(`![${item.label}](${item.url})`)
											setOpen(false)
										}}>
										<span className="text-xl leading-none">{item.emoji}</span>
										<span className="text-[11px] leading-none text-vscode-descriptionForeground">
											{item.label}
										</span>
									</Button>
								))}
							</div>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	)
}
