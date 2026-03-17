/**
 * The AWS Permission Linkable helper is used to define the AWS permissions included with the
 * [`sst.Linkable`](/docs/component/linkable/) component.
 *
 * @example
 *
 * ```ts
 * sst.aws.permission({
 *   actions: ["lambda:InvokeFunction"],
 *   resources: ["*"]
 * })
 * ```
 *
 * @packageDocumentation
 */
import { Prettify } from "../component.js";
import { FunctionPermissionArgs } from "./function.js";
export interface InputArgs extends Prettify<FunctionPermissionArgs> {
}
/**
 * The AWS Permission Linkable helper is used to define the AWS permissions included with the
 * [`sst.Linkable`](/docs/component/linkable/) component.
 *
 * @example
 *
 * ```ts
 * sst.aws.permission({
 *   actions: ["lambda:InvokeFunction"],
 *   resources: ["*"]
 * })
 * ```
 */
export declare function permission(input: InputArgs): {
    effect?: "allow" | "deny";
    actions: string[];
    resources: import("../input.js").Input<import("../input.js").Input<string>[]>;
    conditions?: import("../input.js").Input<import("../input.js").Input<{
        test: import("../input.js").Input<string>;
        variable: import("../input.js").Input<string>;
        values: import("../input.js").Input<import("../input.js").Input<string>[]>;
    }>[]>;
    type: "aws.permission";
};
export type Permission = ReturnType<typeof permission>;
