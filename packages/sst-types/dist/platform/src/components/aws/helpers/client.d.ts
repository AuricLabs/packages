export type {} from "@smithy/types";
type ClientOptions = {
    region?: string;
    retrableErrors?: string[];
};
export declare const useClient: <C extends unknown>(client: new (config: any) => C, opts?: ClientOptions) => C;
