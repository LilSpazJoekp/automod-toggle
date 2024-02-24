import {AppUpgrade} from "@devvit/protos";
import {OnTriggerEvent, ScheduledCronJob, ScheduledJob, TriggerContext, WikiPage} from "@devvit/public-api";

import {BOT_NAME} from "./consts.js";
import {extractData, fetchAutomodConfigPage, readVersion, setInstalledVersion} from "./utils.js";

// The Current class is the current version.
// To add a new version:
// 1. Create a new class that extends the base class and override the methods.
//    This new class will preserve the behavior of the previous version.
// 2. Add a new check that references the new class in the migrateRules function.

interface Version {
    generateRuleString(cronSchedule: string, duration: number, name: string, rule: string, enabled: boolean): {
        newRule: string;
        validationRule: string
    };

    generateBorder(name: string, borderType: "start" | "end"): string;

    generateInfoHeader(cronSchedule: string, duration: number): string;

    generateBorderLine(...body: string[]): string;

    generateRule(rule: string, job: ScheduledJob | ScheduledCronJob): string;

    extractRule(currentWikiPage: string, job: ScheduledJob | ScheduledCronJob): string;
}

export class Current implements Version {
    constructor() {
    }

    generateRuleString(
        cronSchedule: string,
        duration: number,
        name: string,
        rule: string,
        enabled: boolean,
    ): { newRule: string; validationRule: string } {
        let parts: string[] = [this.generateBorder(name, "start"), this.generateInfoHeader(cronSchedule, duration)];
        let validationParts: string[] = [
            this.generateBorder(name, "start"),
            this.generateInfoHeader(cronSchedule, duration),
        ];
        rule = rule.trim()
        validationParts.push(`${rule}`);
        if (!enabled) {
            let ruleParts: string[] = []
            for (const line of rule.split("\n")) {
                ruleParts.push(`#${line}`);
            }
            rule = ruleParts.join("\n");
            rule = rule.trim()
        }
        parts.push(rule);
        parts.push(this.generateBorder(name, "end"));
        validationParts.push(this.generateBorder(name, "end"));
        console.log(validationParts.join("\n").trim());
        return {newRule: parts.join("\n").trim(), validationRule: validationParts.join("\n").trim()};
    }

    generateBorder(name: string, borderType: "start" | "end"): string {
        return this.generateBorderLine(`${borderType} ${BOT_NAME} managed rule ${name}`);
    }

    generateInfoHeader(cronSchedule: string, duration: number): string {
        return this.generateBorderLine(
            "This rule will be automatically enabled at according to the following cron schedule here:",
            `https://crontab.guru/#${(
                cronSchedule.replace(/ /g, "_")
            )} (in the UTC timezone) and disabled ${duration} seconds later.`,
            "To delete this rule use the 'Delete AutoModerator Toggled Block' in the subreddit context menu!",
            "DO NOT EDIT THIS BLOCK WHILE IT IS COMMENTED OUT",
        );
    }

    generateBorderLine(...body: string[]): string {
        return body.map(line => {
            return `###### DO NOT EDIT THIS LINE - ${line.trim()}`;
        }).join("\n");
    }

    generateRule(rule: string, job: ScheduledJob | ScheduledCronJob): string {
        const {
            duration, // in seconds
            ruleName,
            cronSchedule,
        } = extractData(job);
        let start = this.generateBorder(ruleName, "start")
        let end = this.generateBorder(ruleName, "end")
        let header = this.generateInfoHeader(cronSchedule, duration);
        let ruleParts: string[] = [start, header, rule, end];
        return ruleParts.join("\n");
    }

    extractRule(currentWikiPage: string, job: any): string {
        const {
            duration, // in seconds
            ruleName,
            cronSchedule,
        } = extractData(job);
        console.log(`currentWikiPage: ${currentWikiPage}`)
        let start = this.generateBorder(ruleName, "start")
        let end = this.generateBorder(ruleName, "end")
        let header = this.generateInfoHeader(cronSchedule, duration);
        let parts: string[] = currentWikiPage.split(`${start}\n${header}`);
        let remaining: string = parts[1];
        let remainingParts: string[] = remaining.split(end);
        return remainingParts[0].trim()
    }
}

export class Version001128 extends Current {
    // override methods to change behavior of the previous version.
    override generateInfoHeader(cronSchedule: string, duration: number): string {
        return this.generateBorderLine(
            "This rule will be automatically enabled at according to the following cron schedule here:",
            `https://crontab.guru/#${(
                cronSchedule.replace(/ /g, "_")
            )} (in the UTC timezone) and disabled ${duration} seconds later.`,
            "To delete this rule use the 'Delete AutoModerator Toggled Block' in the subreddit context menu!",
            "DO NOT EDIT THIS BLOCK WHILE IT IS COMMENTED OUT",
        );
    }
}

export async function migrateRules(_: OnTriggerEvent<AppUpgrade>, context: TriggerContext) {
    let {redis, reddit, subredditId} = context;
    const installedVersion = await redis.get("version");
    const latestVersion: string = readVersion()
    console.log("Installed version is", installedVersion);
    if (installedVersion == null) {
        return;
    }
    let previousVersion: Version | undefined;
    // Add checks for migrations here. This needs to reference the previous version and the new class.
    if (installedVersion === "0.0.1.128") {
        previousVersion = new Version001128()
    }

    if (previousVersion != null) {
        let nextVersion = new Current();
        console.log(`Migrating from version ${installedVersion} to ${latestVersion}`)
        let currentWikiPage: WikiPage = await fetchAutomodConfigPage(reddit, subredditId);
        console.log(currentWikiPage.content)
        let jobs = await context.scheduler.listJobs();
        for (const job of jobs) {
            let existingRule = previousVersion.extractRule(currentWikiPage.content, job)
            let currentRule = previousVersion.generateRule(existingRule, job)
            let newRule = nextVersion.generateRule(existingRule, job)
            if (currentRule !== newRule) {
                await currentWikiPage.update(
                    currentWikiPage.content.replace(currentRule, newRule),
                    `Migrate ${BOT_NAME} managed rule ${extractData(job).ruleName}`,
                );
                console.log(`Migrated ${BOT_NAME} managed rule ${extractData(job).ruleName}`);
            }
        }
    }
    await setInstalledVersion(context)
}
