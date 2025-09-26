import { ComponentResourceOptions, Output } from "@pulumi/pulumi";
import { Plan, SsrSite, SsrSiteArgs } from "../ssr-site.js";
export interface SolidStartArgs extends SsrSiteArgs {
    /**
     * Configure how this component works in `sst dev`.
     *
     * :::note
     * In `sst dev` your SolidStart app is run in dev mode; it's not deployed.
     * :::
     *
     * Instead of deploying your SolidStart app, this starts it in dev mode. It's run
     * as a separate process in the `sst dev` multiplexer. Read more about
     * [`sst dev`](/docs/reference/cli/#dev).
     *
     * To disable dev mode, pass in `false`.
     */
    dev?: SsrSiteArgs["dev"];
    /**
     * Path to the directory where your SolidStart app is located.  This path is relative to your `sst.config.ts`.
     *
     * By default it assumes your SolidStart app is in the root of your SST app.
     * @default `"."`
     *
     * @example
     *
     * If your SolidStart app is in a package in your monorepo.
     *
     * ```js
     * {
     *   path: "packages/web"
     * }
     * ```
     */
    path?: SsrSiteArgs["path"];
    /**
     * [Link resources](/docs/linking/) to your SolidStart app. This will:
     *
     * 1. Grant the permissions needed to access the resources.
     * 2. Allow you to access it in your site using the [SDK](/docs/reference/sdk/).
     *
     * @example
     *
     * Takes a list of resources to link to the function.
     *
     * ```js
     * {
     *   link: [bucket, stripeKey]
     * }
     * ```
     *
     * You can access the linked resources as bindings in your SolidStart app.
     */
    link?: SsrSiteArgs["link"];
    /**
     * Set environment variables in your SolidStart app. These are made available:
     *
     * 1. In `vinxi build`, they are loaded into `process.env`.
     * 2. Locally while running `vinxi dev` through `sst dev`.
     *
     * :::tip
     * You can also `link` resources to your SolidStart app and access them in a type-safe way with the [SDK](/docs/reference/sdk/). We recommend linking since it's more secure.
     * :::
     *
     * @example
     * ```js
     * {
     *   environment: {
     *     API_URL: api.url,
     *     STRIPE_PUBLISHABLE_KEY: "pk_test_123"
     *   }
     * }
     * ```
     *
     * You can access the environment variables in your SolidStart app as follows:
     */
    environment?: SsrSiteArgs["environment"];
    /**
     * Set a custom domain for your SolidStart app.
     *
     * @example
     *
     * ```js
     * {
     *   domain: "my-app.com"
     * }
     * ```
     */
    domain?: SsrSiteArgs["domain"];
    /**
     * The command used internally to build your SolidStart app.
     *
     * @default `"npm run build"`
     *
     * @example
     *
     * If you want to use a different build command.
     * ```js
     * {
     *   buildCommand: "yarn build"
     * }
     * ```
     */
    buildCommand?: SsrSiteArgs["buildCommand"];
}
/**
 * The `SolidStart` component lets you deploy a [SolidStart](https://start.solidjs.com) app to Cloudflare.
 *
 * @example
 *
 * #### Minimal example
 *
 * Deploy the SolidStart app that's in the project root.
 *
 * ```js title="sst.config.ts"
 * new sst.cloudflare.SolidStart("MyWeb");
 * ```
 *
 * #### Change the path
 *
 * Deploys the SolidStart app in the `my-solid-start-app/` directory.
 *
 * ```js {2} title="sst.config.ts"
 * new sst.cloudflare.SolidStart("MyWeb", {
 *   path: "my-solid-start-app/"
 * });
 * ```
 *
 * #### Add a custom domain
 *
 * Set a custom domain for your SolidStart app.
 *
 * ```js {2} title="sst.config.ts"
 * new sst.cloudflare.SolidStart("MyWeb", {
 *   domain: "my-app.com"
 * });
 * ```
 *
 * #### Link resources
 *
 * [Link resources](/docs/linking/) to your SolidStart app. This will grant permissions
 * to the resources and allow you to access it in your site.
 *
 * ```ts {4} title="sst.config.ts"
 * const bucket = new sst.cloudflare.Bucket("MyBucket");
 *
 * new sst.cloudflare.SolidStart("MyWeb", {
 *   link: [bucket]
 * });
 * ```
 *
 * You can use the [SDK](/docs/reference/sdk/) to access the linked resources
 * in your SolidStart app.
 *
 * ```ts title="src/app.tsx"
 * import { Resource } from "sst";
 *
 * console.log(Resource.MyBucket.name);
 * ```
 */
export declare class SolidStart extends SsrSite {
    constructor(name: string, args?: SolidStartArgs, opts?: ComponentResourceOptions);
    protected buildPlan(outputPath: Output<string>): Output<Plan>;
    /**
     * The URL of the SolidStart app.
     *
     * If the `domain` is set, this is the URL with the custom domain.
     * Otherwise, it's the auto-generated Worker URL.
     */
    get url(): Output<string | undefined>;
}
