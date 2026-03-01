// novacode_change - new file
import { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { getDefaultSkillSettings, type SkillSettings } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@src/components/ui"

interface SkillMetadata {
	name: string
	description: string
	path: string
	source: "global" | "project"
	mode?: string
}

const InstalledSkillsView = () => {
	const { t } = useTranslation()
	const [skills, setSkills] = useState<SkillMetadata[]>([])
	const [skillToDelete, setSkillToDelete] = useState<SkillMetadata | null>(null)
	const [skillSettings, setSkillSettings] = useState<SkillSettings>(getDefaultSkillSettings())

	useEffect(() => {
		// Request skills data on mount
		vscode.postMessage({ type: "refreshSkills" })
	}, [])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "skillsData") {
				setSkills(message.skills ?? [])
				return
			}
			if (message.type === "state" && message.state?.skillSettings) {
				setSkillSettings(message.state.skillSettings)
				return
			}
			if (message.type === "skillSettingsUpdated" && message.skillSettings) {
				setSkillSettings(message.skillSettings)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const updateSkillSettings = (patch: Partial<SkillSettings>) => {
		const next: SkillSettings = {
			...skillSettings,
			...patch,
			disabledSkills: patch.disabledSkills ?? skillSettings.disabledSkills,
		}
		setSkillSettings(next)
		vscode.postMessage({
			type: "updateSkillSettings",
			skillSettings: next,
		})
	}

	const toggleSkillEnabled = (skillName: string, enabled: boolean) => {
		const disabledSet = new Set(skillSettings.disabledSkills)
		if (enabled) {
			disabledSet.delete(skillName)
		} else {
			disabledSet.add(skillName)
		}
		updateSkillSettings({ disabledSkills: Array.from(disabledSet) })
	}

	const handleDelete = (skill: SkillMetadata) => {
		setSkillToDelete(skill)
	}

	const confirmDelete = () => {
		if (!skillToDelete) return

		vscode.postMessage({
			type: "removeInstalledMarketplaceItem",
			mpItem: {
				type: "skill",
				id: skillToDelete.name,
				name: skillToDelete.name,
				description: skillToDelete.description,
				category: "",
				githubUrl: "",
				content: "",
				displayName: skillToDelete.name,
				displayCategory: "",
			},
			mpInstallOptions: { target: skillToDelete.source },
		})
		setSkillToDelete(null)
	}

	const globalSkills = skills.filter((s) => s.source === "global")
	const projectSkills = skills.filter((s) => s.source === "project")
	const disabledSkills = useMemo(() => new Set(skillSettings.disabledSkills), [skillSettings.disabledSkills])

	return (
		<div className="px-5">
			<div className="text-xs text-[var(--vscode-descriptionForeground)] mb-4">
				<p>
					{t("novacode:skills.description")}{" "}
					<VSCodeLink
						href="https://nova.ai/docs/features/skills"
						style={{ display: "inline" }}
						className="text-xs">
						{t("novacode:docs")}
					</VSCodeLink>
				</p>
			</div>

			<div
				className="mb-4 rounded-md p-3"
				style={{
					border: "1px solid var(--vscode-editorWidget-border)",
					background: "var(--vscode-sideBar-background)",
				}}>
				<div className="text-xs font-medium mb-2 text-[var(--vscode-foreground)]">Skill Runtime Settings</div>
				<div className="flex flex-col gap-2 text-xs text-[var(--vscode-foreground)]">
					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={skillSettings.enabled}
							onChange={(event) => updateSkillSettings({ enabled: event.target.checked })}
						/>
						Enable Skills
					</label>
					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={skillSettings.exposeInSlashCommands}
							onChange={(event) => updateSkillSettings({ exposeInSlashCommands: event.target.checked })}
						/>
						Show Skills in / Commands
					</label>
					<label className="flex items-center gap-2">
						<span>Source Priority</span>
						<select
							value={skillSettings.sourcePreference}
							onChange={(event) =>
								updateSkillSettings({
									sourcePreference: event.target.value as SkillSettings["sourcePreference"],
								})
							}>
							<option value="project-first">Project first</option>
							<option value="global-first">Global first</option>
						</select>
					</label>
				</div>
			</div>

			{skills.length === 0 ? (
				<div className="text-sm text-[var(--vscode-descriptionForeground)] py-4">
					{t("novacode:skills.noSkills")}
				</div>
			) : (
				<>
					{/* Project Skills */}
					{projectSkills.length > 0 && (
						<SkillsSection
							title={t("novacode:skills.projectSkills")}
							skills={projectSkills}
							onDelete={handleDelete}
							onToggle={toggleSkillEnabled}
							disabledSkills={disabledSkills}
						/>
					)}

					{/* Global Skills */}
					{globalSkills.length > 0 && (
						<SkillsSection
							title={t("novacode:skills.globalSkills")}
							skills={globalSkills}
							onDelete={handleDelete}
							onToggle={toggleSkillEnabled}
							disabledSkills={disabledSkills}
						/>
					)}
				</>
			)}

			{/* Delete Confirmation Dialog */}
			<Dialog open={!!skillToDelete} onOpenChange={(open) => !open && setSkillToDelete(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("novacode:skills.deleteDialog.title")}</DialogTitle>
						<DialogDescription>
							{t("novacode:skills.deleteDialog.description", { skillName: skillToDelete?.name })}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setSkillToDelete(null)}>
							{t("novacode:skills.deleteDialog.cancel")}
						</Button>
						<Button variant="primary" onClick={confirmDelete}>
							{t("novacode:skills.deleteDialog.delete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

interface SkillsSectionProps {
	title: string
	skills: SkillMetadata[]
	onDelete: (skill: SkillMetadata) => void
	onToggle: (skillName: string, enabled: boolean) => void
	disabledSkills: Set<string>
}

const SkillsSection = ({ title, skills, onDelete, onToggle, disabledSkills }: SkillsSectionProps) => {
	return (
		<div className="mb-4">
			<h4 className="text-sm font-medium text-[var(--vscode-foreground)] mb-2">{title}</h4>
			<div className="flex flex-col gap-2">
				{skills.map((skill) => (
					<SkillRow
						key={`${skill.source}-${skill.name}`}
						skill={skill}
						onDelete={onDelete}
						onToggle={onToggle}
						enabled={!disabledSkills.has(skill.name)}
					/>
				))}
			</div>
		</div>
	)
}

interface SkillRowProps {
	skill: SkillMetadata
	onDelete: (skill: SkillMetadata) => void
	onToggle: (skillName: string, enabled: boolean) => void
	enabled: boolean
}

const SkillRow = ({ skill, onDelete, onToggle, enabled }: SkillRowProps) => {
	return (
		<div
			className="flex items-center justify-between p-2 rounded gap-2"
			style={{ background: "var(--vscode-textCodeBlock-background)" }}>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium text-[var(--vscode-foreground)]">{skill.name}</span>
					{skill.mode && (
						<span
							className="text-xs px-1.5 py-0.5 rounded"
							style={{
								background: "var(--vscode-badge-background)",
								color: "var(--vscode-badge-foreground)",
							}}>
							{skill.mode}
						</span>
					)}
					{!enabled && (
						<span
							className="text-xs px-1.5 py-0.5 rounded"
							style={{
								background: "var(--vscode-inputValidation-warningBackground)",
								color: "var(--vscode-inputValidation-warningForeground)",
							}}>
							Disabled
						</span>
					)}
				</div>
				<div className="text-xs text-[var(--vscode-descriptionForeground)] truncate">{skill.description}</div>
			</div>
			<Button
				variant="ghost"
				size="icon"
				onClick={() => onDelete(skill)}
				style={{ marginLeft: "4px" }}
				aria-label={`Delete skill ${skill.name}`}>
				<span className="codicon codicon-trash" style={{ fontSize: "14px" }}></span>
			</Button>
			<Button
				variant="secondary"
				size="sm"
				onClick={() => onToggle(skill.name, !enabled)}
				aria-label={`${enabled ? "Disable" : "Enable"} skill ${skill.name}`}>
				{enabled ? "Disable" : "Enable"}
			</Button>
		</div>
	)
}

export default InstalledSkillsView
