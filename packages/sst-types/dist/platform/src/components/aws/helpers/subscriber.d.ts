import { Input } from "@pulumi/pulumi";
import { FunctionArgs, FunctionArn } from "../function";
import { Queue } from "../queue";
export declare function isFunctionSubscriber(subscriber?: Input<string | FunctionArgs | FunctionArn>): $util.OutputInstance<boolean>;
export declare function isQueueSubscriber(subscriber?: Input<string | Queue>): $util.OutputInstance<boolean>;
