import skillsData from "../../public/data/skills.json";

export type SkillGroup = "ml" | "frontend" | "backend" | "mobile" | "automation" | "gray";

type SkillEntry = {
  name: string;
  icon: string;
  group?: SkillGroup;
  aliases?: string[];
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");

const skillEntries = skillsData as SkillEntry[];

const skillLookup = new Map<string, SkillEntry>();

for (const entry of skillEntries) {
  skillLookup.set(normalize(entry.name), entry);

  for (const alias of entry.aliases ?? []) {
    skillLookup.set(normalize(alias), entry);
  }
}

export const getSkillEntry = (tool: string) => skillLookup.get(normalize(tool));

export const getSkillGroup = (tool: string): SkillGroup => getSkillEntry(tool)?.group ?? "gray";
