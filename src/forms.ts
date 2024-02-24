import {Data, Form} from "@devvit/public-api";
import {sortBy} from "lodash";
import {RedisKey} from "./types.js";

export function addRuleFormGenerator(data: Data): Form {
    const {existingValues} = data
    const {duration, name, rule, startCron} = existingValues || {duration: "", name: "", rule: "", startCron: ""}
    return {
        acceptLabel: "Add",
        fields: [
            {
                defaultValue: name,
                label: "Rule Name",
                name: "name",
                placeholder: "Rule Name",
                required: true,
                type: "string",
            },
            {
                defaultValue: startCron,
                label: "Cron schedule (UTC) to enable rule",
                name: "startCron",
                placeholder: "0 0 * * 3",
                required: true,
                type: "string",
            },
            {
                defaultValue: duration,
                label: "Duration. Can be human readable or in seconds. Examples (without quotes): '1 day', '2 hours', '30 minutes', or '3600'",
                name: "duration",
                placeholder: "1 day",
                required: true,
                type: "string",
            },
            {
                defaultValue: rule,
                label: "AutoModerator Rule(s)",
                name: "rule",
                required: true,
                type: "paragraph",
            },
        ],
        title: "Add AutoModerator Toggled Block",
        description: "This will add a rule to the bottom of the AutoModerator config page that will be enabled at the specified time and disabled after the specified duration.",
    }
}

export function removeRuleFormGenerator(data: Data): Form {
    return {
        acceptLabel: "Remove",
        fields: [
            {
                label: "Rule Name",
                multiSelect: true,
                name: "rules",
                options: sortBy(data.options, "label"),
                required: true,
                type: "select",
            },
        ],
        title: "Remove AutoModerator Toggled Block",
    };
}

export function redisDataModalGenerator(data: Data): Form {
    const {dataValues} = data
    return {
        fields: dataValues.map((redisKey: RedisKey) => {
            return {
                defaultValue: redisKey.value,
                disabled: true,
                label: redisKey.key,
                name: redisKey.key,
                required: false,
                type: "paragraph",
            }
        }),
        title: "Redis Data",
    };
}
