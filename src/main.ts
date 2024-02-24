import {AppInstall} from "@devvit/protos";
import {Devvit, OnTriggerEvent, TriggerContext} from "@devvit/public-api";
import {DEBUGGING, JOB_NAME} from "./consts.js";
import {addRuleFormGenerator, redisDataModalGenerator, removeRuleFormGenerator} from "./forms.js";
import {
    onEventModActionHandler,
    onFormSubmitAddRuleHandler,
    onFormSubmitRemoveRuleHandler,
    onPressAddRuleHandler,
    onPressRemoveRuleHandler,
    onPressShowRedisDataHandler,
} from "./handlers.js";

import {migrateRules} from "./migrations.js";
import {setInstalledVersion, toggleRule} from "./utils.js";


Devvit.configure({
    redditAPI: true,
    redis: true,
});

Devvit.addTrigger({
    event: "AppInstall",
    onEvent: async (_: OnTriggerEvent<AppInstall>, context: TriggerContext): Promise<void> => {
        await setInstalledVersion(context);
    },
})


Devvit.addTrigger({
    event: "AppUpgrade",
    onEvent: migrateRules,
})

Devvit.addMenuItem({
    forUserType: "moderator",
    label: "Add AutoModerator Toggled Block",
    location: DEBUGGING ? "post" : "subreddit",
    onPress: onPressAddRuleHandler,
});

Devvit.addMenuItem({
    forUserType: "moderator",
    label: "Remove AutoModerator Toggled Block",
    location: DEBUGGING ? "post" : "subreddit",
    onPress: onPressRemoveRuleHandler,
});

if (DEBUGGING) {
    Devvit.addMenuItem({
        forUserType: "moderator",
        label: "See Redis Data",
        location: "post",
        onPress: onPressShowRedisDataHandler,
    });
}
Devvit.addTrigger({
    event: "ModAction",
    onEvent: onEventModActionHandler,
});

export const addRuleForm = Devvit.createForm(
    addRuleFormGenerator,
    onFormSubmitAddRuleHandler,
);

export const removeRuleForm = Devvit.createForm(
    removeRuleFormGenerator,
    onFormSubmitRemoveRuleHandler,
);

export const showRedisDataModal = Devvit.createForm(
    redisDataModalGenerator,
    async () => {
    },
);

Devvit.addSchedulerJob(
    {
        name: JOB_NAME,
        onRun: toggleRule,
    },
);

// noinspection JSUnusedGlobalSymbols
export default Devvit;
