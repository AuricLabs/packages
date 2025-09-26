import { Input } from "@pulumi/pulumi";
export declare namespace Hint {
    function reset(): void;
    function register(name: Input<string>, hint: Input<string>): void;
    function list(): Record<string, Input<string>>;
}
