import { ComponentResourceOptions } from "@pulumi/pulumi";
import { ImageArgs } from "@pulumi/docker-build";
export declare function imageBuilder(name: string, args: ImageArgs, opts?: ComponentResourceOptions): $util.Output<$util.Output<import("@pulumi/docker-build/image").Image>>;
