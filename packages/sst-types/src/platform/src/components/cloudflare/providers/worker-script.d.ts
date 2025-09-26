/**
 * @deprecated This component was meant to be used instead of WorkersScript to handle
 * large file content. This was because WorkersScript used to serialize the content
 * into the state, causing the state to grow very large. Cloudflare provider has
 * since been updated to use the new `contentFile` and `contentSha256` properties
 * to handle large file content.
 */
import { CustomResourceOptions, Output, dynamic } from "@pulumi/pulumi";
import { WorkersScriptArgs } from "@pulumi/cloudflare";
import { Input } from "../../input.js";
export interface WorkerScriptInputs extends Omit<WorkersScriptArgs, "content"> {
    content: Input<{
        filename: Input<string>;
        hash: Input<string>;
    }>;
}
export interface WorkerScript {
    scriptName: Output<string>;
}
export declare class WorkerScript extends dynamic.Resource {
    constructor(name: string, args: WorkerScriptInputs, opts?: CustomResourceOptions);
}
