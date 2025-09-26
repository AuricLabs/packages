import { CustomResourceOptions } from "@pulumi/pulumi";
import { local } from "@pulumi/command";
export declare function siteBuilder(name: string, args: local.CommandArgs, opts?: CustomResourceOptions): $util.Output<$util.Output<import("@pulumi/command/local/command").Command>>;
