import { ComponentResourceOptions } from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { Component, Transform } from "../component";
import { Link } from "../link";
export interface KvArgs {
    /**
     * [Transform](/docs/components/#transform) how this component creates its underlying
     * resources.
     */
    transform?: {
        /**
         * Transform the R2 KV namespace resource.
         */
        namespace?: Transform<cloudflare.WorkersKvNamespaceArgs>;
    };
}
export interface KvGetArgs {
    /**
     * The ID of the existing KV namespace.
     */
    namespaceId: string;
}
/**
 * The `Kv` component lets you add a [Cloudflare KV storage namespace](https://developers.cloudflare.com/kv/) to
 * your app.
 *
 * @example
 *
 * #### Minimal example
 *
 * ```ts title="sst.config.ts"
 * const storage = new sst.cloudflare.Kv("MyStorage");
 * ```
 *
 * #### Link to a worker
 *
 * You can link KV to a worker.
 *
 * ```ts {3} title="sst.config.ts"
 * new sst.cloudflare.Worker("MyWorker", {
 *   handler: "./index.ts",
 *   link: [storage],
 *   url: true
 * });
 * ```
 *
 * Once linked, you can use the SDK to interact with the bucket.
 *
 * ```ts title="index.ts" {3}
 * import { Resource } from "sst";
 *
 * await Resource.MyStorage.get("someKey");
 * ```
 */
export declare class Kv extends Component implements Link.Linkable {
    private namespace;
    constructor(name: string, args?: KvArgs, opts?: ComponentResourceOptions);
    /**
     * Reference an existing KV namespace with the given name. This is useful when you
     * create a KV namespace in one stage and want to share it in another.
     *
     * :::tip
     * You can use the `static get` method to share KV namespaces across stages.
     * :::
     *
     * @param name The name of the component.
     * @param args The arguments to get the KV namespace.
     * @param opts? Resource options.
     *
     * @example
     * Imagine you create a KV namespace in the `dev` stage. And in your personal stage `frank`,
     * instead of creating a new namespace, you want to share the same one from `dev`.
     *
     * ```ts title="sst.config.ts"
     * const storage = $app.stage === "frank"
     *   ? sst.cloudflare.Kv.get("MyStorage", {
     *       namespaceId: "a1b2c3d4e5f6",
     *     })
     *   : new sst.cloudflare.Kv("MyStorage");
     * ```
     */
    static get(name: string, args: KvGetArgs, opts?: ComponentResourceOptions): Kv;
    /**
     * When you link a KV storage, the storage will be available to the worker and you can
     * interact with it using its [API methods](https://developers.cloudflare.com/kv/api/).
     *
     * @example
     * ```ts title="index.ts" {3}
     * import { Resource } from "sst";
     *
     * await Resource.MyStorage.get("someKey");
     * ```
     *
     * @internal
     */
    getSSTLink(): {
        properties: {
            namespaceId: $util.Output<string>;
        };
        include: {
            type: "cloudflare.binding";
            binding: T;
            properties: Extract<import("./binding").Binding, {
                type: T;
            }>["properties"];
        }[];
    };
    /**
     * The generated ID of the KV namespace.
     * @deprecated Use `namespaceId` instead.
     */
    get id(): $util.Output<string>;
    /**
     * The generated ID of the KV namespace.
     */
    get namespaceId(): $util.Output<string>;
    /**
     * The underlying [resources](/docs/components/#nodes) this component creates.
     */
    get nodes(): {
        /**
         * The Cloudflare KV namespace.
         */
        namespace: import("@pulumi/cloudflare/workersKvNamespace").WorkersKvNamespace;
    };
}
