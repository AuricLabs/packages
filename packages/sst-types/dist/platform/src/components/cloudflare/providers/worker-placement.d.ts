import { CustomResourceOptions, Input, Output, dynamic } from "@pulumi/pulumi";
interface Inputs {
    accountId: string;
    scriptName: string;
    mode?: string;
    region?: string;
    host?: string;
    hostname?: string;
}
export interface WorkerPlacementInputs {
    accountId?: Input<Inputs["accountId"]>;
    scriptName: Input<Inputs["scriptName"]>;
    mode?: Input<Inputs["mode"]>;
    region?: Input<Inputs["region"]>;
    host?: Input<Inputs["host"]>;
    hostname?: Input<Inputs["hostname"]>;
}
export interface WorkerPlacement {
    scriptName: Output<string>;
}
export declare class WorkerPlacement extends dynamic.Resource {
    constructor(name: string, args: WorkerPlacementInputs, opts?: CustomResourceOptions);
}
export {};
