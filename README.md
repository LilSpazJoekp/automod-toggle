# AutoModerator Toggle

automod-toggle is an app that allows subreddit moderators to add AutoModerator rules that will be automatically toggled
on and off based on a set schedule. This is useful for subreddits that want to have different rules enabled/disabled at
scheduled intervals.

## Usage

Adding a new toggled rule is pretty straightforward:

1. Navigate to the main page of your subreddit and find the "About Community" the sidebar on the right of the page.

   ![Image](https://i.imgur.com/Xs2agQr.png)
2. To the left of the "Mod Tools" button, you will see "AutoMod Toggle" in the dropdown menu. This is called the
   subreddit context menu.

   ![Image](https://i.imgur.com/VntzNlC.png)
3. You should see a form appear like this:

   ![Image](https://i.imgur.com/XOJHB8d.png)

### Adding a new rule

There are 4 fields to fill out:

- **Rule Name**: This is the name of the rule that will be added to the AutoModerator configuration. It should be unique
  and descriptive.
- **Cron Schedule**: This is the schedule that the rule will be toggled on. For example, `0 0 * * *` would toggle the
  rule on at midnight every day. More information on cron schedules can be found in
  the [Cron Expressions](#cron-expressions) section at the bottom of the About section.
- **Duration**: This is the amount of time that the rule will be enabled for. It can either the number of seconds or a
  human-readable format, such as `1 hour`, `12 hours`, `3 days`, `1 week`, etc.
- **AutoModerator Rule(s)**: This is the rule that will be added to the end of the AutoModerator configuration. It must
  be a valid
  AutoModerator rule config. The rule will need to be provided in a non-commented out state. The rule will never be
  correctly enabled and disabled. For example, the following rule would be valid:
    ```yaml
    type: submission
    action: remove
    ```
  The following rule would be invalid:
    ```yaml
    # type: submission
    # action: remove
    ```
  If you need a rule to be disabled for a specific time frame, consider inverting the schedule. See
  the [Examples](#examples)
  at the bottom of the About section for some examples. The rule will be automatically commented out when it is toggled
  off. You can add multiple rules seperated by `---`. You can find more information on AutoModerator
  rules [here](https://www.reddit.com/wiki/automoderator/full-documentation).

### Editing a rule

To edit a rule, you can modify it in the AutoModerator configuration wiki page. Refrain from modifying the rule while it
is toggled off (commented out) as it may cause the rule to be toggled on in a bad state. It is strongly recommended to
only edit the rule when it is not commented out. Note: do not edit the lines above and below the rule as it will break
the toggling functionality.

### Deleting a rule

To delete a rule, navigate to the subreddit context menu and use the "Remove AutoModerator Toggled Block" option. This
will remove the rule from the AutoModerator configuration and cancel the toggling schedule.

**WARNING**: **Do not** manually remove it from the AutoModerator configuration wiki page. This will cause the app to
try and toggle the rule on and off and may cause issues.

## Cron Expressions

Cron expressions are used to define a schedule for something to happen. In this app, it is used to define the time that
a rule will be toggled on. The duration will determine how long the rule will stay enabled. The time is based on
[Universal Coordinated Time (UTC)](https://www.timeanddate.com/worldclock/timezone/utc). A great tool to help you
understand and build cron expressions is [Cron Expression Generator & Explainer](https://crontab.guru/).

A cron expression is a string that is made up of 5 fields that represent the following:

```
* * * * *
| | | | |
| | | | +---- Day of the week (0 - 7) (Sunday is 0 or 7, Monday is 1, Tuesday is 2 and so on)
| | | +------ Month of the year (1 - 12)
| | +-------- Day of the month (1 - 31)
| +---------- Hour of the day (0 - 23)
```

Each field can be a one of the following (lets use the day of the week field as an example):

- A single value: `5` (Every Friday)
- A range of values: `1-5` (Every day-of-week from Monday through Friday)
- A list of values: `1,3,5` (Every Monday, Wednesday, and Friday)
- A wildcard: `*` (Every day of the week)
- A step value: `*/2` (Every 2nd day of the week. This would be equivalent to Sunday, Tuesday, Thursday, and Saturday.)
- A step range: `1-5/2` (every 2nd value from 1 to 5. This would be equivalent to Monday, Wednesday, and Friday.)

### Cron Expression Examples

The following examples are in the UTC timezone.

- Midnight every day:
    ```cronexp
    0 0 * * *
    ```
- 6:00 AM every Monday:
    ```cronexp
    0 6 * * 1
    ```
- 6:00 AM every Monday and Wednesday:
    ```cronexp
    0 6 * * 1,3
    ```
- 6:00 AM every day:
    ```cronexp
    0 6 * * *
    ```
- midnight on the 1st of every month:
    ```cronexp
    0 0 1 * *
    ```

## Examples

Here are some examples of how you might use the app to schedule rules.

### Example 1

Let's say you need a rule that is enabled every night from 12am to 8am CST. You would fill out the form like this:

- **Rule Name**: `Night Rule`
- **Cron Schedule**: `0 6 * * *`
- **Duration**: `8 hours`
- **AutoModerator Rule(s)**: The rule that you want enabled for 8 hours.

### Example 2

Let's say you need a rule that is enabled every Monday, Wednesday, and Friday at 12am CST for 24 hours. You would fill
out the form like this:

- **Rule Name**: `MWF Rule`
- **Cron Schedule**: `0 6 * * 1,3,5`
- **Duration**: `24 hours`
- **AutoModerator Rule(s)**: The rule that you want enabled for 24 hours.

### Example 3

Let's say you need a rule that enabled from Thursday 5pm CST (11pm UTC) to Saturday at 12am CST (6am UTC). You would
fill out the form like this:

- **Rule Name**: `Friday Rule`
- **Cron Schedule**: `59 22 * * 4` This is off by 1 minute to avoid the rule being toggled off and on at the same time.
- **Duration**: `31 hours`
- **AutoModerator Rule(s)**: The rule that you want enabled for 31 hours.

But you also want a rule that is active for the remainder of week (the inverse of the previous rule). You would fill out
the form like this:

- **Rule Name**: `Non-Friday Rule`
- **Cron Schedule**: `0 6 * * 6`
- **Duration**: `137 hours`
- **AutoModerator Rule(s)**: The rule that would be active for the remainder of week.

In this example, the `Friday Rule` would be enabled every Thursday at 5pm CST (11pm UTC) and stay enabled until Saturday
at 12am CST (6am UTC). The `Non-Friday Rule` would be enabled every Saturday at 12am CST (6am UTC) and stay enabled for
137 hours (the duration until Thursday at 5pm CST (11pm UTC)).

## Notes

- The app will not allow you to add a rule when the duration will overlap with the cron schedule. For example, if you
  try to add a rule that is enabled every Monday at 12am with a duration of 2 weeks, the app will not allow you to add
  the rule.
- If you try and add a rule with invalid config, the add rule form will reappear and display an error message.
