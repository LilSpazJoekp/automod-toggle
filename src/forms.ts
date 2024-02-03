import {Data, Form} from "@devvit/public-api";
import {sortBy} from "lodash";
import {RedisKey} from "./types.js";

export function addRuleFormGenerator(_: Data): Form {
    return {
        acceptLabel: "Add",
        fields: [
            {
                defaultValue: "test",
                label: "Rule Name",
                name: "name",
                required: true,
                type: "string",
            },
            {
                defaultValue: "",
                label: "Cron schedule (UTC) to enable rule",
                name: "startCron",
                placeholder: "0 0 * * 3",
                required: true,
                type: "string",
            },
            {
                defaultValue: "30 seconds",
                label: "Duration. Can be human readable or in seconds.",
                name: "duration",
                placeholder: "1 day",
                required: true,
                type: "string",
            },
            {
                label: "AutoModerator Rule(s)",
                name: "rule",
                required: true,
                type: "paragraph",
            },
        ],
        title: "Add AutoModerator Toggled Block",
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
