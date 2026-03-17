import { ComponentResourceOptions, Output } from "@pulumi/pulumi";
import { Component, Transform } from "../component";
import { FunctionArgs, FunctionArn } from "./function.js";
import { Input } from "../input.js";
import { iam, scheduler } from "@pulumi/aws";
import { Task } from "./task";
export interface CronV2Args {
    /**
     * The function that'll be executed when the cron job runs.
     * @deprecated Use `function` instead.
     *
     * @example
     *
     * ```ts
     * {
     *   job: "src/cron.handler"
     * }
     * ```
     *
     * You can pass in the full function props.
     *
     * ```ts
     * {
     *   job: {
     *     handler: "src/cron.handler",
     *     timeout: "60 seconds"
     *   }
     * }
     * ```
     *
     * You can also pass in a function ARN.
     *
     * ```ts
     * {
     *   job: "arn:aws:lambda:us-east-1:000000000000:function:my-sst-app-jayair-MyFunction",
     * }
     * ```
     */
    job?: Input<string | FunctionArgs | FunctionArn>;
    /**
     * The function that'll be executed when the cron job runs.
     *
     * @example
     *
     * ```ts
     * {
     *   function: "src/cron.handler"
     * }
     * ```
     *
     * You can pass in the full function props.
     *
     * ```ts
     * {
     *   function: {
     *     handler: "src/cron.handler",
     *     timeout: "60 seconds"
     *   }
     * }
     * ```
     *
     * You can also pass in a function ARN.
     *
     * ```ts
     * {
     *   function: "arn:aws:lambda:us-east-1:000000000000:function:my-sst-app-jayair-MyFunction",
     * }
     * ```
     */
    function?: Input<string | FunctionArgs | FunctionArn>;
    /**
     * The task that'll be executed when the cron job runs.
     *
     * @example
     *
     * For example, let's say you have a task.
     *
     * ```js title="sst.config.ts"
     * const cluster = new sst.aws.Cluster("MyCluster");
     * const task = new sst.aws.Task("MyTask", { cluster });
     * ```
     *
     * You can then pass in the task to the cron job.
     *
     * ```js title="sst.config.ts"
     * new sst.aws.CronV2("MyCronJob", {
     *   task,
     *   schedule: "rate(1 minute)"
     * });
     * ```
     *
     */
    task?: Task;
    /**
     * The event that'll be passed to the function or task.
     *
     * @example
     * ```ts
     * {
     *   event: {
     *     foo: "bar",
     *   }
     * }
     * ```
     *
     * For Lambda functions, the event will be passed to the function as an event.
     *
     * ```ts
     * function handler(event) {
     *   console.log(event.foo);
     * }
     * ```
     *
     * For ECS Fargate tasks, the event will be passed to the task as the `SST_EVENT`
     * environment variable.
     *
     * ```ts
     * const event = JSON.parse(process.env.SST_EVENT);
     * console.log(event.foo);
     * ```
     */
    event?: Input<any>;
    /**
     * The schedule for the cron job.
     *
     * :::note
     * The cron job continues to run even after you exit `sst dev`.
     * :::
     *
     * @example
     *
     * You can use a [rate expression](https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html).
     *
     * ```ts
     * {
     *   schedule: "rate(5 minutes)"
     *   // schedule: "rate(1 minute)"
     *   // schedule: "rate(5 minutes)"
     *   // schedule: "rate(1 hour)"
     *   // schedule: "rate(5 hours)"
     *   // schedule: "rate(1 day)"
     *   // schedule: "rate(5 days)"
     * }
     * ```
     * Or a [cron expression](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html#eb-cron-expressions).
     *
     * ```ts
     * {
     *   schedule: "cron(15 10 * * ? *)", // 10:15 AM (UTC) every day
     * }
     * ```
     *
     * Or an [at expression](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html#one-time) for a one-time schedule.
     *
     * ```ts
     * {
     *   schedule: "at(2025-06-01T10:00:00)",
     * }
     * ```
     */
    schedule: Input<`rate(${string})` | `cron(${string})` | `at(${string})`>;
    /**
     * The IANA timezone for the cron schedule. When set, the cron expression is
     * evaluated in this timezone, with automatic DST handling.
     *
     * @default `"UTC"`
     * @example
     * ```ts
     * {
     *   timezone: "America/New_York"
     * }
     * ```
     */
    timezone?: Input<string>;
    /**
     * Configures whether the cron job is enabled. When disabled, the cron job won't run.
     * @default true
     * @example
     * ```ts
     * {
     *   enabled: false
     * }
     * ```
     */
    enabled?: Input<boolean>;
    /**
     * The number of retry attempts for failed invocations. Between 0 and 185.
     *
     * @default `0`
     * @example
     * ```ts
     * {
     *   retries: 3
     * }
     * ```
     */
    retries?: Input<number>;
    /**
     * The ARN of an SQS queue to use as a dead-letter queue. When all retry
     * attempts are exhausted, failed events are sent to this queue.
     *
     * @example
     * ```ts
     * {
     *   dlq: myQueue.arn
     * }
     * ```
     */
    dlq?: Input<string>;
    /**
     * [Transform](/docs/components#transform) how this component creates its underlying resources.
     */
    transform?: {
        /**
         * Transform the EventBridge Scheduler Schedule resource.
         */
        schedule?: Transform<scheduler.ScheduleArgs>;
        /**
         * Transform the IAM Role resource.
         */
        role?: Transform<iam.RoleArgs>;
    };
}
/**
 * The `CronV2` component lets you add cron jobs to your app
 * using [Amazon EventBridge Scheduler](https://docs.aws.amazon.com/scheduler/latest/UserGuide/what-is-scheduler.html). The cron job can invoke a `Function` or a container `Task`.
 *
 * @example
 * #### Cron job function
 *
 * Pass in a `schedule` and a `function` that'll be executed.
 *
 * ```ts title="sst.config.ts"
 * new sst.aws.CronV2("MyCronJob", {
 *   function: "src/cron.handler",
 *   schedule: "rate(1 minute)"
 * });
 * ```
 *
 * #### Cron job container task
 *
 * Create a container task and pass in a `schedule` and a `task` that'll be executed.
 *
 * ```ts title="sst.config.ts" {5}
 * const cluster = new sst.aws.Cluster("MyCluster");
 * const task = new sst.aws.Task("MyTask", { cluster });
 *
 * new sst.aws.CronV2("MyCronJob", {
 *   task,
 *   schedule: "rate(1 day)"
 * });
 * ```
 *
 * #### Set a timezone
 *
 * ```ts title="sst.config.ts"
 * new sst.aws.CronV2("MyCronJob", {
 *   function: "src/cron.handler",
 *   schedule: "cron(15 10 * * ? *)",
 *   timezone: "America/New_York"
 * });
 * ```
 *
 * #### Configure retries
 *
 * ```ts title="sst.config.ts"
 * new sst.aws.CronV2("MyCronJob", {
 *   function: "src/cron.handler",
 *   schedule: "rate(1 minute)",
 *   retries: 3
 * });
 * ```
 *
 * #### One-time schedule
 *
 * ```ts title="sst.config.ts"
 * new sst.aws.CronV2("MyCronJob", {
 *   function: "src/cron.handler",
 *   schedule: "at(2025-06-01T10:00:00)"
 * });
 * ```
 *
 * #### Customize the function
 *
 * ```js title="sst.config.ts"
 * new sst.aws.CronV2("MyCronJob", {
 *   schedule: "rate(1 minute)",
 *   function: {
 *     handler: "src/cron.handler",
 *     timeout: "60 seconds"
 *   }
 * });
 * ```
 */
export declare class CronV2 extends Component {
    private _name;
    private fn?;
    private _schedule;
    private _role;
    constructor(name: string, args: CronV2Args, opts?: ComponentResourceOptions);
    /**
     * The underlying [resources](/docs/components/#nodes) this component creates.
     */
    get nodes(): {
        /**
         * The AWS Lambda Function that'll be invoked when the cron job runs.
         * @deprecated Use `nodes.function` instead.
         */
        readonly job: Output<sst.aws.Function>;
        /**
         * The AWS Lambda Function that'll be invoked when the cron job runs.
         */
        readonly function: Output<sst.aws.Function>;
        /**
         * The EventBridge Scheduler Schedule resource.
         */
        schedule: import("@pulumi/aws/scheduler/schedule").Schedule;
        /**
         * The IAM Role resource.
         */
        role: import("@pulumi/aws/iam/role").Role;
    };
}
