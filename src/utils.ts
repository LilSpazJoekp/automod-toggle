import {
    Context,
    RedditAPIClient,
    ScheduledCronJob,
    ScheduledJob,
    ScheduledJobEvent,
    Scheduler,
    Subreddit,
    TriggerContext,
    WikiPage,
} from "@devvit/public-api";
import cronParser from "cron-parser";
import * as info from "../package.json";
import {BOT_NAME, JOB_NAME} from "./consts.js";
import {Current} from "./migrations.js";


interface ScheduledJobData {
    cronSchedule: string;
    duration: number;
    nextState: "enabled" | "disabled";
    ruleName: string;
}

export async function fetchAutomodConfigPage(reddit: RedditAPIClient, subredditId: string): Promise<WikiPage> {
    const subreddit: Subreddit = await reddit.getSubredditById(subredditId);
    return await reddit.getWikiPage(subreddit.name, "config/automoderator");
}

export async function ruleExists(
    name: string,
    reddit: RedditAPIClient,
    scheduler: Scheduler,
    subredditId: string,
): Promise<boolean> {
    let currentVersion = new Current()
    return (
            await scheduler.listJobs()
        )
            .filter(findJobForRule(name)).length > 0
        || (
            await fetchAutomodConfigPage(reddit, subredditId)
        ).content.includes(currentVersion.generateBorder(name, "start"));
}

export async function setInstalledVersion(context: TriggerContext): Promise<void> {
    console.log("Setting installed version to", readVersion());
    await context.redis.set("version", readVersion());
}

export async function toggleRule(event: ScheduledJobEvent, context: Context): Promise<void> {
    let currentVersion = new Current()
    const {cronSchedule, duration, nextState, ruleName} = extractData(event);
    console.log("Toggling rule", ruleName)
    let {reddit, scheduler, subredditId} = context;
    let currentWikiPage: WikiPage = await fetchAutomodConfigPage(reddit, subredditId);
    console.log("currentWikiPage:", currentWikiPage.content)
    let start = currentVersion.generateBorder(ruleName, "start")
    console.log("start:", start)
    let end = currentVersion.generateBorder(ruleName, "end")
    console.log("end:", end)
    let header = currentVersion.generateInfoHeader(cronSchedule, duration);
    console.log("header:", header)
    let parts: string[] = currentWikiPage.content.split(`${start}\n${header}`);
    console.log("parts:", parts)
    if (parts.length < 2) {
        console.error(`Failed to find rule ${ruleName}`);
        // let jobs = await scheduler.listJobs();
        // for (const job of jobs.filter(findJobForRule(ruleName))) {
        //     await scheduler.cancelJob(job.id);
        // }
        return;
    }
    let wikiParts: string[] = [parts[0].trim(), start, header];
    console.log("wikiParts:", wikiParts)
    let remaining: string = parts[1].trim();
    console.log("remaining:", remaining)
    let remainingParts: string[] = remaining.split(end);
    console.log("remainingParts:", remainingParts)
    let rule: string = remainingParts[0].trim();
    console.log("rule:", rule)
    for (const line of rule.split("\n")) {
        if (nextState === "enabled") {
            if (line.startsWith("#")) {
                wikiParts.push(`${line.substring(1, line.length)}`);
            } else {
                wikiParts.push(`${line}`);
            }
        } else {
            wikiParts.push(`#${line}`);
        }
    }
    wikiParts.push(end, remainingParts[1].trim())
    console.log("wikiParts:", wikiParts)
    let newWikiPage = wikiParts.join("\n");
    console.log("newWikiPage:", newWikiPage)
    await currentWikiPage.update(newWikiPage, `u/${BOT_NAME} ${nextState} managed rule ${ruleName}`);
    if (nextState === "enabled") {
        console.log("Scheduling job to disable rule", ruleName, "in", duration, "seconds");
        await scheduler.runJob(
            {
                data: {
                    cronSchedule: cronSchedule,
                    duration: duration,
                    nextState: "disabled",
                    ruleName: ruleName,
                },
                name: JOB_NAME,
                runAt: new Date(Date.now() + duration * 1000),
            },
        )
    }
    console.log("Rule", ruleName, "toggled", nextState);
}

export function extractData(job: ScheduledJob | ScheduledCronJob | ScheduledJobEvent): ScheduledJobData {
    let data = job.data;
    if (data == null) {
        return job.data as ScheduledJobData;
    }
    if (data.hasOwnProperty("data")) {
        return data.data as ScheduledJobData;
    }
    return job.data as ScheduledJobData;
}

export function findJobForRule(name: string) {
    return (job: ScheduledJob | ScheduledCronJob) => {
        if (job.name === JOB_NAME && extractData(job).ruleName === name) {
            return job;
        }
    }
}

export function getNextDate(cron: string): Date {
    let parsedCron = cronParser.parseExpression(cron);
    return parsedCron.next().toDate();
}

export function getPreviousDate(cron: string): Date {
    let parsedCron = cronParser.parseExpression(cron);
    return parsedCron.prev().toDate();
}

export function readVersion(): string {
    // @ts-ignore
    return info.version;
}

export function validateCron(cron: string): boolean {
    try {
        cronParser.parseExpression(cron);
    } catch (e) {
        return false;
    }
    let parsedCron = cronParser.parseExpression(cron);
    return parsedCron.hasNext();
}
