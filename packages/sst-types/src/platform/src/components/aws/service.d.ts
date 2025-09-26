import { ComponentResourceOptions, Output } from "@pulumi/pulumi";
import { Component, Prettify, Transform } from "../component.js";
import { Link } from "../link.js";
import { appautoscaling, ec2, ecs, lb } from "@pulumi/aws";
import { DurationMinutes } from "../duration.js";
import { Input } from "../input.js";
import { FargateBaseArgs, FargateContainerArgs } from "./fargate.js";
import { Dns } from "../dns.js";
type Port = `${number}/${"http" | "https" | "tcp" | "udp" | "tcp_udp" | "tls"}`;
interface ServiceRules {
    /**
     * The port and protocol the service listens on. Uses the format `{port}/{protocol}`.
     *
     * @example
     * ```js
     * {
     *   listen: "80/http"
     * }
     * ```
     */
    listen: Input<Port>;
    /**
     * The port and protocol of the container the service forwards the traffic to. Uses the
     * format `{port}/{protocol}`.
     *
     * @example
     * ```js
     * {
     *   forward: "80/http"
     * }
     * ```
     * @default The same port and protocol as `listen`.
     */
    forward?: Input<Port>;
    /**
     * The name of the container to forward the traffic to. This maps to the `name` defined in the
     * `container` prop.
     *
     * You only need this if there's more than one container. If there's only one container, the
     * traffic is automatically forwarded there.
     */
    container?: Input<string>;
    /**
     * The port and protocol to redirect the traffic to. Uses the format `{port}/{protocol}`.
     *
     * @example
     * ```js
     * {
     *   redirect: "80/http"
     * }
     * ```
     */
    redirect?: Input<Port>;
    /**
     * @deprecated Use `conditions.path` instead.
     */
    path?: Input<string>;
    /**
     * The conditions for the redirect. Only applicable to `http` and `https` protocols.
     */
    conditions?: Input<{
        /**
         * Configure path-based routing. Only requests matching the path are forwarded to
         * the container.
         *
         * ```js
         * {
         *   path: "/api/*"
         * }
         * ```
         *
         * The path pattern is case-sensitive, supports wildcards, and can be up to 128
         * characters.
         * - `*` matches 0 or more characters. For example, `/api/*` matches `/api/` or
         *   `/api/orders`.
         * - `?` matches exactly 1 character. For example, `/api/?.png` matches `/api/a.png`.
         *
         * @default Requests to all paths are forwarded.
         */
        path?: Input<string>;
        /**
         * Configure query string based routing. Only requests matching one of the query
         * string conditions are forwarded to the container.
         *
         * Takes a list of `key`, the name of the query string parameter, and `value` pairs.
         * Where `value` is the value of the query string parameter. But it can be a pattern as well.
         *
         * If multiple `key` and `value` pairs are provided, it'll match requests with **any** of the
         * query string parameters.
         *
         * @default Query string is not checked when forwarding requests.
         *
         * @example
         *
         * For example, to match requests with query string `version=v1`.
         *
         * ```js
         * {
         *   query: [
         *     { key: "version", value: "v1" }
         *   ]
         * }
         * ```
         *
         * Or match requests with query string matching `env=test*`.
         *
         * ```js
         * {
         *   query: [
         *     { key: "env", value: "test*" }
         *   ]
         * }
         * ```
         *
         * Match requests with query string `version=v1` **or** `env=test*`.
         *
         * ```js
         * {
         *   query: [
         *     { key: "version", value: "v1" },
         *     { key: "env", value: "test*" }
         *   ]
         * }
         * ```
         *
         * Match requests with any query string key with value `example`.
         *
         * ```js
         * {
         *   query: [
         *     { value: "example" }
         *   ]
         * }
         * ```
         */
        query?: Input<Input<{
            /**
             * The name of the query string parameter.
             */
            key?: Input<string>;
            /**
             * The value of the query string parameter.
             *
             * If no `key` is provided, it'll match any request where a query string parameter with
             * the given value exists.
             */
            value: Input<string>;
        }>[]>;
        /**
         * Configure header based routing. Only requests matching the header
         * name and values are forwarded to the container.
         *
         * Both the header name and values are case insensitive.
         *
         * @default Header is not checked when forwarding requests.
         *
         * @example
         *
         * For example, if you specify `X-Custom-Header` as the name and `Value1`
         * as a value, it will match requests with the header
         * `x-custom-header: value1` as well.
         *
         * ```js
         * {
         *   header: {
         *     name: "X-Custom-Header",
         *     values: ["Value1", "Value2", "Prefix*"]
         *   }
         * }
         * ```
         */
        header?: Input<{
            /**
             * The name of the HTTP header field to check. This is case-insensitive.
             */
            name: Input<string>;
            /**
             * The values to match against the header value. The rule matches if the
             * request header matches any of these values. Values are case-insensitive
             * and support wildcards (`*` and `?`) for pattern matching.
             */
            values: Input<Input<string>>[];
        }>;
    }>;
}
interface ServiceContainerArgs extends FargateContainerArgs {
    /**
     * Configure the health check for the container. Same as the top-level
     * [`health`](#health).
     */
    health?: ServiceArgs["health"];
    /**
     * Configure how this container works in `sst dev`. Same as the top-level
     * [`dev`](#dev).
     */
    dev?: {
        /**
         * The command that `sst dev` runs to start this in dev mode. Same as the top-level
         * [`dev.command`](#dev-command).
         */
        command: Input<string>;
        /**
         * Configure if you want to automatically start this when `sst dev` starts. Same as the
         * top-level [`dev.autostart`](#dev-autostart).
         */
        autostart?: Input<boolean>;
        /**
         * Change the directory from where the `command` is run. Same as the top-level
         * [`dev.directory`](#dev-directory).
         */
        directory?: Input<string>;
    };
}
export interface ServiceArgs extends FargateBaseArgs {
    /**
     * Configure how this component works in `sst dev`.
     *
     * :::note
     * In `sst dev` your service is not deployed.
     * :::
     *
     * By default, your service in not deployed in `sst dev`. Instead, you can set the
     * `dev.command` and it'll be started locally in a separate tab in the
     * `sst dev` multiplexer. Read more about [`sst dev`](/docs/reference/cli/#dev).
     *
     * This makes it so that the container doesn't have to be redeployed on every change. To
     * disable this and deploy your service in `sst dev`, pass in `false`.
     */
    dev?: false | {
        /**
         * The `url` when this is running in dev mode.
         *
         * Since this component is not deployed in `sst dev`, there is no real URL. But if you are
         * using this component's `url` or linking to this component's `url`, it can be useful to
         * have a placeholder URL. It avoids having to handle it being `undefined`.
         * @default `"http://url-unavailable-in-dev.mode"`
         */
        url?: Input<string>;
        /**
         * The command that `sst dev` runs to start this in dev mode. This is the command you run
         * when you want to run your service locally.
         */
        command?: Input<string>;
        /**
         * Configure if you want to automatically start this when `sst dev` starts. You can still
         * start it manually later.
         * @default `true`
         */
        autostart?: Input<boolean>;
        /**
         * Change the directory from where the `command` is run.
         * @default Uses the `image.dockerfile` path
         */
        directory?: Input<string>;
    };
    /**
     * Configure a public endpoint for the service. When configured, a load balancer
     * will be created to route traffic to the containers. By default, the endpoint is an
     * auto-generated load balancer URL.
     *
     * You can also add a custom domain for the public endpoint.
     * @deprecated Use `loadBalancer` instead.
     * @example
     *
     * ```js
     * {
     *   public: {
     *     domain: "example.com",
     *     rules: [
     *       { listen: "80/http" },
     *       { listen: "443/https", forward: "80/http" }
     *     ]
     *   }
     * }
     * ```
     */
    public?: Input<{
        /**
         * Set a custom domain for your public endpoint.
         *
         * Automatically manages domains hosted on AWS Route 53, Cloudflare, and Vercel. For other
         * providers, you'll need to pass in a `cert` that validates domain ownership and add the
         * DNS records.
         *
         * :::tip
         * Built-in support for AWS Route 53, Cloudflare, and Vercel. And manual setup for other
         * providers.
         * :::
         *
         * @example
         *
         * By default this assumes the domain is hosted on Route 53.
         *
         * ```js
         * {
         *   domain: "example.com"
         * }
         * ```
         *
         * For domains hosted on Cloudflare.
         *
         * ```js
         * {
         *   domain: {
         *     name: "example.com",
         *     dns: sst.cloudflare.dns()
         *   }
         * }
         * ```
         */
        domain?: Input<string | {
            /**
             * The custom domain you want to use.
             *
             * @example
             * ```js
             * {
             *   domain: {
             *     name: "example.com"
             *   }
             * }
             * ```
             *
             * Can also include subdomains based on the current stage.
             *
             * ```js
             * {
             *   domain: {
             *     name: `${$app.stage}.example.com`
             *   }
             * }
             * ```
             */
            name: Input<string>;
            /**
             * Alias domains that should be used.
             *
             * @example
             * ```js {4}
             * {
             *   domain: {
             *     name: "app1.example.com",
             *     aliases: ["app2.example.com"]
             *   }
             * }
             * ```
             */
            aliases?: Input<string[]>;
            /**
             * The ARN of an ACM (AWS Certificate Manager) certificate that proves ownership of the
             * domain. By default, a certificate is created and validated automatically.
             *
             * :::tip
             * You need to pass in a `cert` for domains that are not hosted on supported `dns` providers.
             * :::
             *
             * To manually set up a domain on an unsupported provider, you'll need to:
             *
             * 1. [Validate that you own the domain](https://docs.aws.amazon.com/acm/latest/userguide/domain-ownership-validation.html) by creating an ACM certificate. You can either validate it by setting a DNS record or by verifying an email sent to the domain owner.
             * 2. Once validated, set the certificate ARN as the `cert` and set `dns` to `false`.
             * 3. Add the DNS records in your provider to point to the load balancer endpoint.
             *
             * @example
             * ```js
             * {
             *   domain: {
             *     name: "example.com",
             *     dns: false,
             *     cert: "arn:aws:acm:us-east-1:112233445566:certificate/3a958790-8878-4cdc-a396-06d95064cf63"
             *   }
             * }
             * ```
             */
            cert?: Input<string>;
            /**
             * The DNS provider to use for the domain. Defaults to the AWS.
             *
             * Takes an adapter that can create the DNS records on the provider. This can automate
             * validating the domain and setting up the DNS routing.
             *
             * Supports Route 53, Cloudflare, and Vercel adapters. For other providers, you'll need
             * to set `dns` to `false` and pass in a certificate validating ownership via `cert`.
             *
             * @default `sst.aws.dns`
             *
             * @example
             *
             * Specify the hosted zone ID for the Route 53 domain.
             *
             * ```js
             * {
             *   domain: {
             *     name: "example.com",
             *     dns: sst.aws.dns({
             *       zone: "Z2FDTNDATAQYW2"
             *     })
             *   }
             * }
             * ```
             *
             * Use a domain hosted on Cloudflare, needs the Cloudflare provider.
             *
             * ```js
             * {
             *   domain: {
             *     name: "example.com",
             *     dns: sst.cloudflare.dns()
             *   }
             * }
             * ```
             *
             * Use a domain hosted on Vercel, needs the Vercel provider.
             *
             * ```js
             * {
             *   domain: {
             *     name: "example.com",
             *     dns: sst.vercel.dns()
             *   }
             * }
             * ```
             */
            dns?: Input<false | (Dns & {})>;
        }>;
        /** @deprecated Use `rules` instead. */
        ports?: Input<Prettify<ServiceRules>[]>;
        /**
         * Configure the mapping for the ports the public endpoint listens to and forwards to
         * the service.
         * This supports two types of protocols:
         *
         * 1. Application Layer Protocols: `http` and `https`. This'll create an [Application Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html).
         * 2. Network Layer Protocols: `tcp`, `udp`, `tcp_udp`, and `tls`. This'll create a [Network Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html).
         *
         * :::note
         * If you are listening  on `https` or `tls`, you need to specify a custom `public.domain`.
         * :::
         *
         * You can **not** configure both application and network layer protocols for the same
         * service.
         *
         * @example
         * Here we are listening on port `80` and forwarding it to the service on port `8080`.
         * ```js
         * {
         *   public: {
         *     rules: [
         *       { listen: "80/http", forward: "8080/http" }
         *     ]
         *   }
         * }
         * ```
         *
         * The `forward` port and protocol defaults to the `listen` port and protocol. So in this
         * case both are `80/http`.
         *
         * ```js
         * {
         *   public: {
         *     rules: [
         *       { listen: "80/http" }
         *     ]
         *   }
         * }
         * ```
         *
         * If multiple containers are configured via the `containers` argument, you need to
         * specify which container the traffic should be forwarded to.
         *
         * ```js
         * {
         *   public: {
         *     rules: [
         *       { listen: "80/http", container: "app" },
         *       { listen: "8000/http", container: "admin" },
         *     ]
         *   }
         * }
         * ```
         */
        rules?: Input<Prettify<ServiceRules>[]>;
    }>;
    /**
     * Configure a load balancer to route traffic to the containers.
     *
     * While you can expose a service through API Gateway, it's better to use a load balancer
     * for most traditional web applications. It is more expensive to start but at higher
     * levels of traffic it ends up being more cost effective.
     *
     * Also, if you need to listen on network layer protocols like `tcp` or `udp`, you have to
     * expose it through a load balancer.
     *
     * By default, the endpoint is an auto-generated load balancer URL. You can also add a
     * custom domain for the endpoint.
     *
     * @default Load balancer is not created
     * @example
     *
     * ```js
     * {
     *   loadBalancer: {
     *     domain: "example.com",
     *     rules: [
     *       { listen: "80/http", redirect: "443/https" },
     *       { listen: "443/https", forward: "80/http" }
     *     ]
     *   }
     * }
     * ```
     */
    loadBalancer?: Input<{
        /**
         * Configure if the load balancer should be public or private.
         *
         * When set to `false`, the load balancer endpoint will only be accessible within the
         * VPC.
         *
         * @default `true`
         */
        public?: Input<boolean>;
        /**
         * Set a custom domain for your load balancer endpoint.
         *
         * Automatically manages domains hosted on AWS Route 53, Cloudflare, and Vercel. For other
         * providers, you'll need to pass in a `cert` that validates domain ownership and add the
         * DNS records.
         *
         * :::tip
         * Built-in support for AWS Route 53, Cloudflare, and Vercel. And manual setup for other
         * providers.
         * :::
         *
         * @example
         *
         * By default this assumes the domain is hosted on Route 53.
         *
         * ```js
         * {
         *   domain: "example.com"
         * }
         * ```
         *
         * For domains hosted on Cloudflare.
         *
         * ```js
         * {
         *   domain: {
         *     name: "example.com",
         *     dns: sst.cloudflare.dns()
         *   }
         * }
         * ```
         */
        domain?: Input<string | {
            /**
             * The custom domain you want to use.
             *
             * @example
             * ```js
             * {
             *   domain: {
             *     name: "example.com"
             *   }
             * }
             * ```
             *
             * Can also include subdomains based on the current stage.
             *
             * ```js
             * {
             *   domain: {
             *     name: `${$app.stage}.example.com`
             *   }
             * }
             * ```
             *
             * Wildcard domains are supported.
             *
             * ```js
             * {
             *   domain: {
             *     name: "*.example.com"
             *   }
             * }
             * ```
             */
            name: Input<string>;
            /**
             * Alias domains that should be used.
             *
             * @example
             * ```js {4}
             * {
             *   domain: {
             *     name: "app1.example.com",
             *     aliases: ["app2.example.com"]
             *   }
             * }
             * ```
             */
            aliases?: Input<string[]>;
            /**
             * The ARN of an ACM (AWS Certificate Manager) certificate that proves ownership of the
             * domain. By default, a certificate is created and validated automatically.
             *
             * :::tip
             * You need to pass in a `cert` for domains that are not hosted on supported `dns` providers.
             * :::
             *
             * To manually set up a domain on an unsupported provider, you'll need to:
             *
             * 1. [Validate that you own the domain](https://docs.aws.amazon.com/acm/latest/userguide/domain-ownership-validation.html) by creating an ACM certificate. You can either validate it by setting a DNS record or by verifying an email sent to the domain owner.
             * 2. Once validated, set the certificate ARN as the `cert` and set `dns` to `false`.
             * 3. Add the DNS records in your provider to point to the load balancer endpoint.
             *
             * @example
             * ```js
             * {
             *   domain: {
             *     name: "example.com",
             *     dns: false,
             *     cert: "arn:aws:acm:us-east-1:112233445566:certificate/3a958790-8878-4cdc-a396-06d95064cf63"
             *   }
             * }
             * ```
             */
            cert?: Input<string>;
            /**
             * The DNS provider to use for the domain. Defaults to the AWS.
             *
             * Takes an adapter that can create the DNS records on the provider. This can automate
             * validating the domain and setting up the DNS routing.
             *
             * Supports Route 53, Cloudflare, and Vercel adapters. For other providers, you'll need
             * to set `dns` to `false` and pass in a certificate validating ownership via `cert`.
             *
             * @default `sst.aws.dns`
             *
             * @example
             *
             * Specify the hosted zone ID for the Route 53 domain.
             *
             * ```js
             * {
             *   domain: {
             *     name: "example.com",
             *     dns: sst.aws.dns({
             *       zone: "Z2FDTNDATAQYW2"
             *     })
             *   }
             * }
             * ```
             *
             * Use a domain hosted on Cloudflare, needs the Cloudflare provider.
             *
             * ```js
             * {
             *   domain: {
             *     name: "example.com",
             *     dns: sst.cloudflare.dns()
             *   }
             * }
             * ```
             *
             * Use a domain hosted on Vercel, needs the Vercel provider.
             *
             * ```js
             * {
             *   domain: {
             *     name: "example.com",
             *     dns: sst.vercel.dns()
             *   }
             * }
             * ```
             */
            dns?: Input<false | (Dns & {})>;
        }>;
        /** @deprecated Use `rules` instead. */
        ports?: Input<Prettify<ServiceRules>[]>;
        /**
         * Configure the mapping for the ports the load balancer listens to, forwards, or redirects to
         * the service.
         * This supports two types of protocols:
         *
         * 1. Application Layer Protocols: `http` and `https`. This'll create an [Application Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html).
         * 2. Network Layer Protocols: `tcp`, `udp`, `tcp_udp`, and `tls`. This'll create a [Network Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html).
         *
         * :::note
         * If you want to listen on `https` or `tls`, you need to specify a custom
         * `loadBalancer.domain`.
         * :::
         *
         * You **can not configure** both application and network layer protocols for the same
         * service.
         *
         * @example
         * Here we are listening on port `80` and forwarding it to the service on port `8080`.
         * ```js
         * {
         *   rules: [
         *     { listen: "80/http", forward: "8080/http" }
         *   ]
         * }
         * ```
         *
         * The `forward` port and protocol defaults to the `listen` port and protocol. So in this
         * case both are `80/http`.
         *
         * ```js
         * {
         *   rules: [
         *     { listen: "80/http" }
         *   ]
         * }
         * ```
         *
         * If multiple containers are configured via the `containers` argument, you need to
         * specify which container the traffic should be forwarded to.
         *
         * ```js
         * {
         *   rules: [
         *     { listen: "80/http", container: "app" },
         *     { listen: "8000/http", container: "admin" }
         *   ]
         * }
         * ```
         *
         * You can also route the same port to multiple containers via path-based routing.
         *
         * ```js
         * {
         *   rules: [
         *     {
         *       listen: "80/http",
         *       container: "app",
         *       conditions: { path: "/api/*" }
         *     },
         *     {
         *       listen: "80/http",
         *       container: "admin",
         *       conditions: { path: "/admin/*" }
         *     }
         *   ]
         * }
         * ```
         *
         * Additionally, you can redirect traffic from one port to another. This is
         * commonly used to redirect http to https.
         *
         * ```js
         * {
         *   rules: [
         *     { listen: "80/http", redirect: "443/https" },
         *     { listen: "443/https", forward: "80/http" }
         *   ]
         * }
         * ```
         */
        rules?: Input<Prettify<ServiceRules>[]>;
        /**
         * Configure the health check that the load balancer runs on your containers.
         *
         * :::tip
         * This health check is different from the [`health`](#health) check.
         * :::
         *
         * This health check is run by the load balancer. While, `health` is run by ECS. This
         * cannot be disabled if you are using a load balancer. While the other is off by default.
         *
         * Since this cannot be disabled, here are some tips on how to debug an unhealthy
         * health check.
         *
         * <details>
         * <summary>How to debug a load balancer health check</summary>
         *
         * If you notice a `Unhealthy: Health checks failed` error, it's because the health
         * check has failed. When it fails, the load balancer will terminate the containers,
         * causing any requests to fail.
         *
         * Here's how to debug it:
         *
         * 1. Verify the health check path.
         *
         *    By default, the load balancer checks the `/` path. Ensure it's accessible in your
         *    containers. If your application runs on a different path, then update the path in
         *    the health check config accordingly.
         *
         * 2. Confirm the containers are operational.
         *
         *    Navigate to **ECS console** > select the **cluster** > go to the **Tasks tab** >
         *    choose **Any desired status** under the **Filter desired status** dropdown > select
         *    a task and check for errors under the **Logs tab**. If it has error that means that
         *    the container failed to start.
         *
         * 3. If the container was terminated by the load balancer while still starting up, try
         *    increasing the health check interval and timeout.
         * </details>
         *
         * For `http` and `https` the default is:
         *
         * ```js
         * {
         *   path: "/",
         *   healthyThreshold: 5,
         *   successCodes: "200",
         *   timeout: "5 seconds",
         *   unhealthyThreshold: 2,
         *   interval: "30 seconds"
         * }
         * ```
         *
         * For `tcp` and `udp` the default is:
         *
         * ```js
         * {
         *   healthyThreshold: 5,
         *   timeout: "6 seconds",
         *   unhealthyThreshold: 2,
         *   interval: "30 seconds"
         * }
         * ```
         *
         * @example
         *
         * To configure the health check, we use the _port/protocol_ format. Here we are
         * configuring a health check that pings the `/health` path on port `8080`
         * every 10 seconds.
         *
         * ```js
         * {
         *   rules: [
         *     { listen: "80/http", forward: "8080/http" }
         *   ],
         *   health: {
         *     "8080/http": {
         *       path: "/health",
         *       interval: "10 seconds"
         *     }
         *   }
         * }
         * ```
         *
         */
        health?: Input<Record<Port, Input<{
            /**
             * The URL path to ping on the service for health checks. Only applicable to
             * `http` and `https` protocols.
             * @default `"/"`
             */
            path?: Input<string>;
            /**
             * The time period between each health check request. Must be between `5 seconds`
             * and `300 seconds`.
             * @default `"30 seconds"`
             */
            interval?: Input<DurationMinutes>;
            /**
             * The timeout for each health check request. If no response is received within this
             * time, it is considered failed. Must be between `2 seconds` and `120 seconds`.
             * @default `"5 seconds"`
             */
            timeout?: Input<DurationMinutes>;
            /**
             * The number of consecutive successful health check requests required to consider the
             * target healthy. Must be between 2 and 10.
             * @default `5`
             */
            healthyThreshold?: Input<number>;
            /**
             * The number of consecutive failed health check requests required to consider the
             * target unhealthy. Must be between 2 and 10.
             * @default `2`
             */
            unhealthyThreshold?: Input<number>;
            /**
             * One or more HTTP response codes the health check treats as successful. Only
             * applicable to `http` and `https` protocols.
             *
             * @default `"200"`
             * @example
             * ```js
             * {
             *   successCodes: "200-299"
             * }
             * ```
             */
            successCodes?: Input<string>;
        }>>>;
    }>;
    /**
     * Configure the CloudMap service registry for the service.
     *
     * This creates an `srv` record in the CloudMap service. This is needed if you want to connect
     * an `ApiGatewayV2` VPC link to the service.
     *
     * API Gateway will forward requests to the given port on the service.
     *
     * @example
     * ```js
     * {
     *   serviceRegistry: {
     *     port: 80
     *   }
     * }
     * ```
     */
    serviceRegistry?: Input<{
        /**
         * The port in the service to forward requests to.
         */
        port: number;
    }>;
    /**
     * Configure the service to automatically scale up or down based on the CPU or memory
     * utilization of a container. By default, scaling is disabled and the service will run
     * in a single container.
     *
     * @default `{ min: 1, max: 1 }`
     *
     * @example
     * ```js
     * {
     *   scaling: {
     *     min: 4,
     *     max: 16,
     *     cpuUtilization: 50,
     *     memoryUtilization: 50
     *   }
     * }
     * ```
     */
    scaling?: Input<{
        /**
         * The minimum number of containers to scale down to.
         * @default `1`
         * @example
         * ```js
         * {
         *   scaling: {
         *     min: 4
         *   }
         * }
         * ```
         */
        min?: Input<number>;
        /**
         * The maximum number of containers to scale up to.
         * @default `1`
         * @example
         * ```js
         * {
         *   scaling: {
         *     max: 16
         *   }
         * }
         * ```
         */
        max?: Input<number>;
        /**
         * The target CPU utilization percentage to scale up or down. It'll scale up
         * when the CPU utilization is above the target and scale down when it's below the target.
         * @default `70`
         * @example
         * ```js
         * {
         *   scaling: {
         *     cpuUtilization: 50
         *   }
         * }
         * ```
         */
        cpuUtilization?: Input<false | number>;
        /**
         * The target memory utilization percentage to scale up or down. It'll scale up
         * when the memory utilization is above the target and scale down when it's below the target.
         * @default `70`
         * @example
         * ```js
         * {
         *   scaling: {
         *     memoryUtilization: 50
         *   }
         * }
         * ```
         */
        memoryUtilization?: Input<false | number>;
        /**
         * The target request count to scale up or down. It'll scale up when the request count is
         * above the target and scale down when it's below the target.
         * @default `false`
         * @example
         * ```js
         * {
         *   scaling: {
         *     requestCount: 1500
         *   }
         * }
         * ```
         */
        requestCount?: Input<false | number>;
    }>;
    /**
     * Configure the capacity provider; regular Fargate or Fargate Spot, for this service.
     *
     * :::tip
     * Fargate Spot is a good option for dev or PR environments.
     * :::
     *
     * Fargate Spot allows you to run containers on spare AWS capacity at around 50% discount
     * compared to regular Fargate. [Learn more about Fargate
     * pricing](https://aws.amazon.com/fargate/pricing/).
     *
     * :::note
     * AWS might shut down Fargate Spot instances to reclaim capacity.
     * :::
     *
     * There are a couple of caveats:
     *
     * 1. AWS may reclaim this capacity and **turn off your service** after a two-minute warning.
     *    This is rare, but it can happen.
     * 2. If there's no spare capacity, you'll **get an error**.
     *
     * This makes Fargate Spot a good option for dev or PR environments. You can set this using.
     *
     * ```js
     * {
     *   capacity: "spot"
     * }
     * ```
     *
     * You can also configure the % of regular vs spot capacity you want through the `weight` prop.
     * And optionally set the `base` or first X number of tasks that'll be started using a given
     * capacity.
     *
     * For example, the `base: 1` says that the first task uses regular Fargate, and from that
     * point on there will be an even split between the capacity providers.
     *
     * ```js
     * {
     *   capacity: {
     *     fargate: { weight: 1, base: 1 },
     *     spot: { weight: 1 }
     *   }
     * }
     * ```
     *
     * The `base` works in tandem with the `scaling` prop. So setting `base` to X doesn't mean
     * it'll start those tasks right away. It means that as your service scales up, according to
     * the `scaling` prop, it'll ensure that the first X tasks will be with the given capacity.
     *
     * :::caution
     * Changing `capacity` requires taking down and recreating the ECS service.
     * :::
     *
     * And this is why you can only set the `base` for only one capacity provider. So you
     * are not allowed to do the following.
     *
     * ```js
     * {
     *   capacity: {
     *     fargate: { weight: 1, base: 1 },
     *     // This will give you an error
     *     spot: { weight: 1, base: 1 }
     *   }
     * }
     * ```
     *
     * When you change the `capacity`, the ECS service is terminated and recreated. This will
     * cause some temporary downtime.
     *
     * @default Regular Fargate
     *
     * @example
     *
     * Here are some examples settings.
     *
     * - Use only Fargate Spot.
     *
     *   ```js
     *   {
     *     capacity: "spot"
     *   }
     *   ```
     * - Use 50% regular Fargate and 50% Fargate Spot.
     *
     *   ```js
     *   {
     *     capacity: {
     *       fargate: { weight: 1 },
     *       spot: { weight: 1 }
     *     }
     *   }
     *   ```
     * - Use 50% regular Fargate and 50% Fargate Spot. And ensure that the first 2 tasks use
     *   regular Fargate.
     *
     *   ```js
     *   {
     *     capacity: {
     *       fargate: { weight: 1, base: 2 },
     *       spot: { weight: 1 }
     *     }
     *   }
     *   ```
     */
    capacity?: Input<"spot" | {
        /**
         * Configure how the regular Fargate capacity is allocated.
         */
        fargate?: Input<{
            /**
             * Start the first `base` number of tasks with the given capacity.
             *
             * :::caution
             * You can only specify `base` for one capacity provider.
             * :::
             */
            base?: Input<number>;
            /**
             * Ensure the given ratio of tasks are started for this capacity.
             */
            weight: Input<number>;
        }>;
        /**
         * Configure how the Fargate spot capacity is allocated.
         */
        spot?: Input<{
            /**
             * Start the first `base` number of tasks with the given capacity.
             *
             * :::caution
             * You can only specify `base` for one capacity provider.
             * :::
             */
            base?: Input<number>;
            /**
             * Ensure the given ratio of tasks are started for this capacity.
             */
            weight: Input<number>;
        }>;
    }>;
    /**
     * Configure the health check that ECS runs on your containers.
     *
     * :::tip
     * This health check is different from the [`loadBalancer.health`](#loadbalancer-health) check.
     * :::
     *
     * This health check is run by ECS. While, `loadBalancer.health` is run by the load balancer,
     * if you are using one. This is off by default. While the load balancer one
     * cannot be disabled.
     *
     * This config maps to the `HEALTHCHECK` parameter of the `docker run` command. Learn
     * more about [container health checks](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_HealthCheck.html).
     *
     * @default Health check is disabled
     * @example
     * ```js
     * {
     *   health: {
     *     command: ["CMD-SHELL", "curl -f http://localhost:3000/ || exit 1"],
     *     startPeriod: "60 seconds",
     *     timeout: "5 seconds",
     *     interval: "30 seconds",
     *     retries: 3
     *   }
     * }
     * ```
     */
    health?: Input<{
        /**
         * A string array representing the command that the container runs to determine if it is
         * healthy.
         *
         * It must start with `CMD` to run the command arguments directly. Or `CMD-SHELL` to run
         * the command with the container's default shell.
         *
         * @example
         * ```js
         * {
         *   command: ["CMD-SHELL", "curl -f http://localhost:3000/ || exit 1"]
         * }
         * ```
         */
        command: Input<string[]>;
        /**
         * The grace period to provide containers time to bootstrap before failed health checks
         * count towards the maximum number of retries. Must be between `0 seconds` and
         * `300 seconds`.
         * @default `"0 seconds"`
         */
        startPeriod?: Input<DurationMinutes>;
        /**
         * The maximum time to allow one command to run. Must be between `2 seconds` and
         * `60 seconds`.
         * @default `"5 seconds"`
         */
        timeout?: Input<DurationMinutes>;
        /**
         * The time between running the command for the health check. Must be between `5 seconds`
         * and `300 seconds`.
         * @default `"30 seconds"`
         */
        interval?: Input<DurationMinutes>;
        /**
         * The number of consecutive failures required to consider the check to have failed. Must
         * be between `1` and `10`.
         * @default `3`
         */
        retries?: Input<number>;
    }>;
    /**
     * The containers to run in the service.
     *
     * :::tip
     * You can optionally run multiple containers in a service.
     * :::
     *
     * By default this starts a single container. To add multiple containers in the service, pass
     * in an array of containers args.
     *
     * ```ts
     * {
     *   containers: [
     *     {
     *       name: "app",
     *       image: "nginxdemos/hello:plain-text"
     *     },
     *     {
     *       name: "admin",
     *       image: {
     *         context: "./admin",
     *         dockerfile: "Dockerfile"
     *       }
     *     }
     *   ]
     * }
     * ```
     *
     * If you specify `containers`, you cannot list the above args at the top-level. For example,
     * you **cannot** pass in `image` at the top level.
     *
     * ```diff lang="ts"
     * {
     * -  image: "nginxdemos/hello:plain-text",
     *   containers: [
     *     {
     *       name: "app",
     *       image: "nginxdemos/hello:plain-text"
     *     },
     *     {
     *       name: "admin",
     *       image: "nginxdemos/hello:plain-text"
     *     }
     *   ]
     * }
     * ```
     *
     * You will need to pass in `image` as a part of the `containers`.
     */
    containers?: Input<Prettify<ServiceContainerArgs>>[];
    /**
     * Configure if `sst deploy` should wait for the service to be stable.
     *
     * :::tip
     * For non-prod environments it might make sense to pass in `false`.
     * :::
     *
     * Waiting for this process to finish ensures that new content will be available after
     * the deploy finishes. However, this process can sometimes take more than 5 mins.
     * @default `false`
     * @example
     * ```js
     * {
     *   wait: true
     * }
     * ```
     */
    wait?: Input<boolean>;
    /**
     * [Transform](/docs/components#transform) how this component creates its underlying
     * resources.
     */
    transform?: Prettify<FargateBaseArgs["transform"] & {
        /**
         * Transform the ECS Service resource.
         */
        service?: Transform<ecs.ServiceArgs>;
        /**
         * Transform the AWS Load Balancer resource.
         */
        loadBalancer?: Transform<lb.LoadBalancerArgs>;
        /**
         * Transform the AWS Security Group resource for the Load Balancer.
         */
        loadBalancerSecurityGroup?: Transform<ec2.SecurityGroupArgs>;
        /**
         * Transform the AWS Load Balancer listener resource.
         */
        listener?: Transform<lb.ListenerArgs>;
        /**
         * Transform the AWS Load Balancer target group resource.
         */
        target?: Transform<lb.TargetGroupArgs>;
        /**
         * Transform the AWS Application Auto Scaling target resource.
         */
        autoScalingTarget?: Transform<appautoscaling.TargetArgs>;
    }>;
}
/**
 * The `Service` component lets you create containers that are always running, like web or
 * application servers. It uses [Amazon ECS](https://aws.amazon.com/ecs/) on [AWS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html).
 *
 * @example
 *
 * #### Create a Service
 *
 * Services are run inside an ECS Cluster. If you haven't already, create one.
 *
 * ```ts title="sst.config.ts"
 * const vpc = new sst.aws.Vpc("MyVpc");
 * const cluster = new sst.aws.Cluster("MyCluster", { vpc });
 * ```
 *
 * Add the service to it.
 *
 * ```ts title="sst.config.ts"
 * const service = new sst.aws.Service("MyService", { cluster });
 * ```
 *
 * #### Configure the container image
 *
 * By default, the service will look for a Dockerfile in the root directory. Optionally
 * configure the image context and dockerfile.
 *
 * ```ts title="sst.config.ts"
 * new sst.aws.Service("MyService", {
 *   cluster,
 *   image: {
 *     context: "./app",
 *     dockerfile: "Dockerfile"
 *   }
 * });
 * ```
 *
 * To add multiple containers in the service, pass in an array of containers args.
 *
 * ```ts title="sst.config.ts"
 * new sst.aws.Service("MyService", {
 *   cluster,
 *   containers: [
 *     {
 *       name: "app",
 *       image: "nginxdemos/hello:plain-text"
 *     },
 *     {
 *       name: "admin",
 *       image: {
 *         context: "./admin",
 *         dockerfile: "Dockerfile"
 *       }
 *     }
 *   ]
 * });
 * ```
 *
 * This is useful for running sidecar containers.
 *
 * #### Enable auto-scaling
 *
 * ```ts title="sst.config.ts"
 * new sst.aws.Service("MyService", {
 *   cluster,
 *   scaling: {
 *     min: 4,
 *     max: 16,
 *     cpuUtilization: 50,
 *     memoryUtilization: 50
 *   }
 * });
 * ```
 *
 * #### Expose through API Gateway
 *
 * You can give your service a public URL by exposing it through API Gateway HTTP API. You can
 * also optionally give it a custom domain.
 *
 * ```ts title="sst.config.ts"
 * const service = new sst.aws.Service("MyService", {
 *   cluster,
 *   serviceRegistry: {
 *     port: 80
 *   }
 * });
 *
 * const api = new sst.aws.ApiGatewayV2("MyApi", {
 *   vpc,
 *   domain: "example.com"
 * });
 * api.routePrivate("$default", service.nodes.cloudmapService.arn);
 * ```
 *
 * #### Add a load balancer
 *
 * You can also expose your service by adding a load balancer to it and optionally
 * adding a custom domain.
 *
 * ```ts title="sst.config.ts"
 * new sst.aws.Service("MyService", {
 *   cluster,
 *   loadBalancer: {
 *     domain: "example.com",
 *     rules: [
 *       { listen: "80/http" },
 *       { listen: "443/https", forward: "80/http" }
 *     ]
 *   }
 * });
 * ```
 *
 * #### Link resources
 *
 * [Link resources](/docs/linking/) to your service. This will grant permissions
 * to the resources and allow you to access it in your app.
 *
 * ```ts {5} title="sst.config.ts"
 * const bucket = new sst.aws.Bucket("MyBucket");
 *
 * new sst.aws.Service("MyService", {
 *   cluster,
 *   link: [bucket]
 * });
 * ```
 *
 * You can use the [SDK](/docs/reference/sdk/) to access the linked resources in your service.
 *
 * ```ts title="app.ts"
 * import { Resource } from "sst";
 *
 * console.log(Resource.MyBucket.name);
 * ```
 *
 * #### Service discovery
 *
 * This component automatically creates a Cloud Map service host name for the
 * service. So anything in the same VPC can access it using the service's host name.
 *
 * For example, if you link the service to a Lambda function that's in the same VPC.
 *
 * ```ts title="sst.config.ts" {2,4}
 * new sst.aws.Function("MyFunction", {
 *   vpc,
 *   url: true,
 *   link: [service],
 *   handler: "lambda.handler"
 * });
 * ```
 *
 * You can access the service by its host name using the [SDK](/docs/reference/sdk/).
 *
 * ```ts title="lambda.ts"
 * import { Resource } from "sst";
 *
 * await fetch(`http://${Resource.MyService.service}`);
 * ```
 *
 * [Check out an example](/docs/examples/#aws-cluster-service-discovery).
 *
 * ---
 *
 * ### Cost
 *
 * By default, this uses a _Linux/X86_ _Fargate_ container with 0.25 vCPUs at $0.04048 per
 * vCPU per hour and 0.5 GB of memory at $0.004445 per GB per hour. It includes 20GB of
 * _Ephemeral Storage_ for free with additional storage at $0.000111 per GB per hour. Each
 * container also gets a public IPv4 address at $0.005 per hour.
 *
 * It works out to $0.04048 x 0.25 x 24 x 30 + $0.004445 x 0.5 x 24 x 30 + $0.005
 * x 24 x 30 or **$12 per month**.
 *
 * If you are using all Fargate Spot instances with `capacity: "spot"`, it's $0.01218784 x 0.25
 * x 24 x 30 + $0.00133831 x 0.5 x 24 x 30 + $0.005 x 24 x 30 or **$6 per month**
 *
 * Adjust this for the `cpu`, `memory` and `storage` you are using. And
 * check the prices for _Linux/ARM_ if you are using `arm64` as your `architecture`.
 *
 * The above are rough estimates for _us-east-1_, check out the
 * [Fargate pricing](https://aws.amazon.com/fargate/pricing/) and the
 * [Public IPv4 Address pricing](https://aws.amazon.com/vpc/pricing/) for more details.
 *
 * #### Scaling
 *
 * By default, `scaling` is disabled. If enabled, adjust the above for the number of containers.
 *
 * #### API Gateway
 *
 * If you expose your service through API Gateway, you'll need to add the cost of
 * [API Gateway HTTP API](https://aws.amazon.com/api-gateway/pricing/#HTTP_APIs) as well.
 * For services that don't get a lot of traffic, this ends up being a lot cheaper since API
 * Gateway is pay per request.
 *
 * Learn more about using
 * [Cluster with API Gateway](/docs/examples/#aws-cluster-with-api-gateway).
 *
 * #### Application Load Balancer
 *
 * If you add `loadBalancer` _HTTP_ or _HTTPS_ `rules`, an ALB is created at $0.0225 per hour,
 * $0.008 per LCU-hour, and $0.005 per hour if HTTPS with a custom domain is used. Where LCU
 * is a measure of how much traffic is processed.
 *
 * That works out to $0.0225 x 24 x 30 or **$16 per month**. Add $0.005 x 24 x 30 or **$4 per
 * month** for HTTPS. Also add the LCU-hour used.
 *
 * The above are rough estimates for _us-east-1_, check out the
 * [Application Load Balancer pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)
 * for more details.
 *
 * #### Network Load Balancer
 *
 * If you add `loadBalancer` _TCP_, _UDP_, or _TLS_ `rules`, an NLB is created at $0.0225 per hour and
 * $0.006 per NLCU-hour. Where NCLU is a measure of how much traffic is processed.
 *
 * That works out to $0.0225 x 24 x 30 or **$16 per month**. Also add the NLCU-hour used.
 *
 * The above are rough estimates for _us-east-1_, check out the
 * [Network Load Balancer pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)
 * for more details.
 */
export declare class Service extends Component implements Link.Linkable {
    private readonly _name;
    private readonly _service?;
    private readonly cloudmapNamespace?;
    private readonly cloudmapService?;
    private readonly executionRole?;
    private readonly taskRole;
    private readonly taskDefinition?;
    private readonly loadBalancer?;
    private readonly autoScalingTarget?;
    private readonly domain?;
    private readonly _url?;
    private readonly devUrl?;
    private readonly dev;
    constructor(name: string, args: ServiceArgs, opts?: ComponentResourceOptions);
    /**
     * The URL of the service.
     *
     * If `public.domain` is set, this is the URL with the custom domain.
     * Otherwise, it's the auto-generated load balancer URL.
     */
    get url(): Output<string>;
    /**
     * The name of the Cloud Map service. This is useful for service discovery.
     */
    get service(): Output<string>;
    /**
     * The underlying [resources](/docs/components/#nodes) this component creates.
     */
    get nodes(): {
        /**
         * The Amazon ECS Service.
         */
        readonly service: Output<import("@pulumi/aws/ecs/service.js").Service>;
        /**
         * The Amazon ECS Execution Role.
         */
        executionRole: import("@pulumi/aws/iam/role.js").Role | undefined;
        /**
         * The Amazon ECS Task Role.
         */
        taskRole: import("@pulumi/aws/iam/role.js").Role;
        /**
         * The Amazon ECS Task Definition.
         */
        readonly taskDefinition: Output<import("@pulumi/aws/ecs/taskDefinition.js").TaskDefinition>;
        /**
         * The Amazon Elastic Load Balancer.
         */
        readonly loadBalancer: import("@pulumi/aws/lb/loadBalancer.js").LoadBalancer;
        /**
         * The Amazon Application Auto Scaling target.
         */
        readonly autoScalingTarget: import("@pulumi/aws/appautoscaling/target.js").Target;
        /**
         * The Amazon Cloud Map service.
         */
        readonly cloudmapService: Output<import("@pulumi/aws/servicediscovery/service.js").Service>;
    };
    /** @internal */
    getSSTLink(): {
        properties: {
            url: Output<string> | undefined;
            service: Output<Output<string> | undefined>;
        };
    };
}
export {};
