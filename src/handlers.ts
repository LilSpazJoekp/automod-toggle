import {FieldConfig_Selection_Item, ModAction} from "@devvit/protos";
import {
    Context,
    FormOnSubmitEvent,
    MenuItemOnPressEvent,
    OnTriggerEvent,
    Subreddit,
    TriggerContext,
    WikiPage,
} from "@devvit/public-api";
import _ from "lodash";
import durationParser from "parse-duration";
import {BOT_NAME, JOB_NAME, KNOWN_KEYS} from "./consts.js";
import {addRuleForm, removeRuleForm, showRedisDataModal} from "./main.js";
import {Current} from "./migrations.js";
import {RedisKey} from "./types.js";
import {
    extractData,
    fetchAutomodConfigPage,
    findJobForRule,
    getNextDate,
    getPreviousDate,
    ruleExists,
    validateCron,
} from "./utils.js";

export async function onPressAddRuleHandler(_: MenuItemOnPressEvent, context: Context): Promise<void> {
    context.ui.showForm(addRuleForm);
}

export async function onPressRemoveRuleHandler(_: MenuItemOnPressEvent, context: Context): Promise<void> {
    const {scheduler, ui} = context;
    let jobs = await scheduler.listJobs();
    let options: FieldConfig_Selection_Item[] = [];
    if (jobs.length === 0) {
        ui.showToast({
            appearance: "neutral", text: "No rules to remove!",
        });
        return;
    }
    for (const job of jobs.filter(job => job.name === JOB_NAME)) {
        console.log(job.data)
        options.push({
            label: extractData(job).ruleName, value: extractData(job).ruleName,
        });
    }
    return ui.showForm(removeRuleForm, {options: options});
}

export async function onEventModActionHandler(
    event: OnTriggerEvent<ModAction>,
    context: TriggerContext,
): Promise<void> {
    let currentVersion = new Current()
    const {action, moderator} = event;
    const {reddit, scheduler, subredditId} = context;
    if (moderator?.name === BOT_NAME) {
        return;
    }
    if (action !== "wikirevise") {
        return;
    }
    console.log(`Wiki page was revised by u/${event.moderator?.name}`);
    const subreddit: Subreddit = await reddit.getSubredditById(subredditId);
    const wikiPage: WikiPage = await reddit.getWikiPage(subreddit.name, "config/automoderator");
    for (const job of await scheduler.listJobs()) {
        if (job.name === JOB_NAME && !wikiPage.content.includes(currentVersion
            .generateBorder(extractData(job).ruleName, "start"))) {
            await scheduler.cancelJob(job.id);
            console.log(`Cancelling job ${job.id} because the rule was removed from the AutoModerator config`);
        }
    }
}

export async function onFormSubmitRemoveRuleHandler(event: FormOnSubmitEvent, context: Context) {
    let currentVersion = new Current()
    const {rules} = event.values;
    let {reddit, scheduler, subredditId, ui} = context;
    let currentWikiPage = await fetchAutomodConfigPage(reddit, subredditId);
    let {content} = currentWikiPage
    content = _.trim(content, "-\n");
    let jobs = await scheduler.listJobs();
    for (const rule of rules) {
        console.log(`rule: "${rule}"`)
        console.log(currentVersion.generateBorder(rule, "start"))
        console.log(content)
        let contentParts = content.split(currentVersion.generateBorder(rule, "start"));
        console.log(contentParts)
        if (contentParts.length < 2) {
            console.log(`Rule ${rule} does not exist in the AutoModerator config`);
            continue;
        }
        let firstPart = _.trim(contentParts[0], "-\n");
        console.log(`firstPart: "${firstPart}"`)
        let finalPageParts: string[] = [firstPart];
        console.log(`finalPageParts: "${finalPageParts}"`)
        let remainingContent = contentParts[1];
        console.log(`remainingContent: "${remainingContent}"`)
        let endParts = remainingContent.split(currentVersion.generateBorder(rule, "end"));
        console.log(`endParts: "${endParts}"`)
        let remaining = _.trim(endParts[1], "-\n");
        console.log(`remaining: "${remaining}"`)
        finalPageParts.push(remaining);
        content = finalPageParts.join("\n---\n");
        content = _.trim(content, "-\n");
        for (const job of jobs.filter(findJobForRule(rule))) {
            await scheduler.cancelJob(job.id);
        }
    }
    await currentWikiPage.update(content, `u/${BOT_NAME} removed managed rule(s) ${rules.join(", ")}`);
    ui.showToast({appearance: "success", text: `Rule(s) ${rules.join(", ")} removed!`});
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rejectSubmit(error: string, ui: Context["ui"], values: FormOnSubmitEvent["values"]): Promise<void> {
    async function toast() {
        ui.showToast({
            appearance: "neutral",
            text: error + " Please try again.",
        });
    }

    toast().then(
        () => {
            const {duration, name, rule, startCron} = values;
            ui.showForm(addRuleForm, {existingValues: {duration, name, rule, startCron}});
        },
    );
}

export async function onFormSubmitAddRuleHandler(event: FormOnSubmitEvent, context: Context): Promise<void> {
    let currentVersion = new Current()
    const {duration, name, rule, startCron} = event.values;
    const {reddit, scheduler, subredditId, ui} = context;
    console.log(`Adding a rule named '${name}' with cron ${startCron} and duration ${duration}`)
    // Check if the duration is valid
    const durationSeconds = durationParser(duration, "s");
    if (durationSeconds == null) {
        console.log(`Duration is invalid: ${duration}`)
        await rejectSubmit("Invalid duration.", ui, event.values);
        return;
    }
    // Check if the cron expression is valid
    if (!validateCron(startCron)) {
        console.log(`Cron expression is invalid: ${startCron}`)
        await rejectSubmit("Invalid cron expression.", ui, event.values);
        return;
    }
    // Check if the duration is too long for the cron expression
    const previousCronDate: Date = getPreviousDate(startCron);
    const nextCronDate: Date = getNextDate(startCron);
    const previousDisableDate: Date = new Date(previousCronDate.getTime() + (
        durationSeconds * 1000
    ));
    let shouldBeEnabled = new Date() < previousDisableDate;
    console.log(`prev + durationSeconds: ${previousDisableDate.toISOString()}`)
    console.log(`prev: ${previousCronDate.toISOString()}`)
    console.log(`durationSeconds: ${durationSeconds}`)
    console.log(`next: ${nextCronDate.toISOString()}`)
    console.log(`prev + durationSeconds > next: ${previousDisableDate > nextCronDate}`)
    console.log(`shouldBeEnabled: ${shouldBeEnabled}`)
    if (previousDisableDate > nextCronDate) {
        await rejectSubmit("Duration too long for provided cron schedule.", ui, event.values);
        return;
    }

    // Check if the rule already exists
    if (await ruleExists(name, reddit, scheduler, subredditId)) {
        await rejectSubmit(`A rule named '${name}' already exists.`, ui, event.values);
        return;
    }

    // Add the rule to the wiki page
    let currentWikiPage = await fetchAutomodConfigPage(reddit, subredditId);
    let content = currentWikiPage.content

    content = _.trim(content, "-\n");
    const {newRule, validationRule} = currentVersion.generateRuleString(
        startCron,
        durationSeconds,
        name,
        rule,
        shouldBeEnabled,
    );
    content = `${content.trim()}\n---\n${newRule}`;
    let validationContent = `${content.trim()}\n---\n${validationRule}`;
    // Update the wiki page
    try {
        await currentWikiPage.update(validationContent, `u/${BOT_NAME} validating managed rule ${name}`);
    } catch (e) {
        console.error(e);
        const regex = /"special_errors": \["(.*?):\\n\\n###### DO NOT EDIT THIS LINE/gm;
        // @ts-ignore
        let match = regex.exec(e.message);
        let errorMessage = match ? " Error: " + match[1] : "";
        await rejectSubmit(
            `Failed to add the AutoModerator rule.${errorMessage} Please check the AutoModerator code and try again.`,
            ui,
            event.values,
        );
        return;
    }
    await currentWikiPage.update(content, `u/${BOT_NAME} added managed rule ${name}`);
    // Schedule a job to run at the given time
    await scheduler.runJob({
        name: JOB_NAME, data: {
            cronSchedule: startCron,
            duration: durationSeconds,
            nextState: "enabled",
            ruleName: name,
        },
        cron: startCron,
    });
    if (shouldBeEnabled) {
        let disableIn: Date = previousDisableDate;
        console.log(`Should disable at: ${disableIn.toISOString()}`)
        await scheduler.runJob({
            data: {
                cronSchedule: startCron,
                duration: durationSeconds,
                nextState: "disabled",
                ruleName: name,
            }, name: JOB_NAME,
            runAt: disableIn,
        });
    }
    ui.showToast({text: `Rule ${name} added!`, appearance: "success"});
    console.log("Rule added!")
}

export async function onPressShowRedisDataHandler(_: MenuItemOnPressEvent, context: Context): Promise<void> {
    const {redis, ui} = context;
    let redisData: RedisKey[] = [];
    for (const key of KNOWN_KEYS) {
        redisData.push({key: key, value: await redis.get(key) as string});
    }
    ui.showForm(showRedisDataModal, {dataValues: redisData});
}
