import { HTMLAttributes } from "react" // novacode_change
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"
import { Slider } from "../ui"
import { vscode } from "../../utils/vscode"
import { Button } from "vscrui"

type NotificationSettingsProps = HTMLAttributes<HTMLDivElement> & {
	ttsEnabled?: boolean
	ttsSpeed?: number
	soundEnabled?: boolean
	soundVolume?: number
	systemNotificationsEnabled?: boolean // novacode_change
	areSettingsCommitted?: boolean // novacode_change
	setCachedStateField: SetCachedStateField<
		"ttsEnabled" | "ttsSpeed" | "soundEnabled" | "soundVolume" | "systemNotificationsEnabled"
	>
}

export const NotificationSettings = ({
	ttsEnabled,
	ttsSpeed,
	soundEnabled,
	soundVolume,
	systemNotificationsEnabled, // novacode_change
	areSettingsCommitted, // novacode_change
	setCachedStateField,
	...props
}: NotificationSettingsProps) => {
	const { t } = useAppTranslation()

	// novacode_change start
	const onTestNotificationClick = () => {
		vscode.postMessage({
			type: "showSystemNotification",
			notificationOptions: {
				title: t("novacode:settings.systemNotifications.testTitle"),
				message: t("novacode:settings.systemNotifications.testMessage"),
			},
			alwaysAllow: true,
		})
	}
	// novacode_change end

	return (
		<div {...props}>
			<SectionHeader>{t("settings:sections.notifications")}</SectionHeader>

			<Section>
				<SearchableSetting
					settingId="notifications-tts"
					section="notifications"
					label={t("settings:notifications.tts.label")}>
					<VSCodeCheckbox
						checked={ttsEnabled}
						onChange={(e: any) => setCachedStateField("ttsEnabled", e.target.checked)}
						data-testid="tts-enabled-checkbox">
						<span className="font-medium">{t("settings:notifications.tts.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:notifications.tts.description")}
					</div>
				</SearchableSetting>

				{ttsEnabled && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<SearchableSetting
							settingId="notifications-tts-speed"
							section="notifications"
							label={t("settings:notifications.tts.speedLabel")}>
							<label className="block font-medium mb-1">
								{t("settings:notifications.tts.speedLabel")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={0.1}
									max={2.0}
									step={0.01}
									value={[ttsSpeed ?? 1.0]}
									onValueChange={([value]) => setCachedStateField("ttsSpeed", value)}
									data-testid="tts-speed-slider"
								/>
								<span className="w-10">{((ttsSpeed ?? 1.0) * 100).toFixed(0)}%</span>
							</div>
						</SearchableSetting>
					</div>
				)}

				<SearchableSetting
					settingId="notifications-sound"
					section="notifications"
					label={t("settings:notifications.sound.label")}>
					<VSCodeCheckbox
						checked={soundEnabled}
						onChange={(e: any) => setCachedStateField("soundEnabled", e.target.checked)}
						data-testid="sound-enabled-checkbox">
						<span className="font-medium">{t("settings:notifications.sound.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:notifications.sound.description")}
					</div>
				</SearchableSetting>

				{soundEnabled && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<SearchableSetting
							settingId="notifications-sound-volume"
							section="notifications"
							label={t("settings:notifications.sound.volumeLabel")}>
							<label className="block font-medium mb-1">
								{t("settings:notifications.sound.volumeLabel")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={0}
									max={1}
									step={0.01}
									value={[soundVolume ?? 0.5]}
									onValueChange={([value]) => setCachedStateField("soundVolume", value)}
									data-testid="sound-volume-slider"
								/>
								<span className="w-10">{((soundVolume ?? 0.5) * 100).toFixed(0)}%</span>
							</div>
						</SearchableSetting>
					</div>
				)}

				{/* novacode_change start */}
				<div>
					<VSCodeCheckbox
						checked={systemNotificationsEnabled}
						onChange={(e: any) => setCachedStateField("systemNotificationsEnabled", e.target.checked)}
						data-testid="system-notifications-enabled-checkbox">
						<span className="font-medium">{t("novacode:settings.systemNotifications.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("novacode:settings.systemNotifications.description")}
					</div>
				</div>
				{systemNotificationsEnabled && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<Button
							className="w-fit text-vscode-button-background hover:text-vscode-button-hoverBackground"
							onClick={onTestNotificationClick}>
							{t("novacode:settings.systemNotifications.testButton")}
						</Button>
					</div>
				)}
				{/* novacode_change end */}
			</Section>
		</div>
	)
}
