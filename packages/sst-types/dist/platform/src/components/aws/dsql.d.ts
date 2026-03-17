import { ComponentResourceOptions, Output } from "@pulumi/pulumi";
import { Component, Transform } from "../component";
import { Link } from "../link";
import { dsql, ec2 } from "@pulumi/aws";
import { Vpc } from "./vpc";
import type { Input } from "../input";
export interface DsqlArgs {
    /**
     * Configure multi-region cluster peering.
     *
     * Creates a cluster in the current region and a peer cluster in another region,
     * linked via a witness region. The witness must differ from both cluster regions.
     *
     * Learn more about [AWS DSQL regions](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/what-is-aurora-dsql.html#region-availability).
     *
     * @example
     *
     * ```ts
   * const cluster = new sst.aws.Dsql("MyCluster", {
   *   regions: {
   *     witness: "us-west-2",
   *     peer: "us-east-2"
   *   }
   * });
   * ```
   */
    regions?: {
        /** The witness region. Must differ from both cluster regions. */
        witness: Input<string>;
        /** The AWS region for the peer cluster. */
        peer: Input<string>;
    };
    /**
     *
     * Create AWS PrivateLink interface endpoints in a VPC for private connectivity.
     * This allows lambdas placed inside a VPC without NAT gateways to connect to the DSQL instance.
     *
     * :::note
     * Currently only single region VPC is supported.
     * :::
     *
     * @example
     *
     * ```ts title="sst.config.ts"
     * const myVpc = new sst.aws.Vpc("MyVpc");
     *
     * const cluster = new sst.aws.Dsql("MyCluster", {
     *   vpc: myVpc
     * });
     * ```
     *
     * #### Customize VPC endpoints
     *
     * ```ts title="sst.config.ts"
     * const myVpc = new sst.aws.Vpc("MyVpc");
     *
     * const cluster = new sst.aws.Dsql("MyCluster", {
     *   vpc: {
     *     instance: vpc,
     *     endpoints: {
     *       management: true,
     *       connection: true,
     *     }
     *   }
     * });
     * ```
     */
    vpc?: Vpc | {
        instance: Vpc;
        endpoints?: {
            /**
             * Endpoint for control plane ops (create, get, update, delete clusters).
             *
             * @default `false`
             */
            management?: boolean;
            /**
             * Endpoint for PostgreSQL client connections.
             *
             * @default `true`
             */
            connection?: boolean;
        };
    };
    /**
     * [Transform](/docs/components#transform) how this component creates its underlying
     * resources.
     */
    transform?: {
        /**
         * Transform the DSQL cluster resource.
         */
        cluster?: Transform<dsql.ClusterArgs>;
        /**
         * Transform the peer DSQL cluster resource.
         */
        peerCluster?: Transform<dsql.ClusterArgs>;
        /**
         * Transform the EC2 security group resource for the DSQL VPC endpoints.
         */
        endpointSecurityGroup?: Transform<ec2.SecurityGroupArgs>;
        /**
         * Transform the EC2 VPC endpoint resource for DSQL management operations.
         */
        managementEndpoint?: Transform<ec2.VpcEndpointArgs>;
        /**
         * Transform the EC2 VPC endpoint resource for DSQL connections.
         */
        connectionEndpoint?: Transform<ec2.VpcEndpointArgs>;
    };
}
/**
 * The `Dsql` component lets you add an [Amazon Aurora DSQL](https://aws.amazon.com/rds/aurora/dsql/) cluster to your app.
 *
 * @example
 *
 * #### Single-region cluster
 *
 * ```ts title="sst.config.ts"
 * const cluster = new sst.aws.Dsql("MyCluster");
 * ```
 *
 * Once linked, you can connect to it from your function code.
 *
 * ```ts title="src/lambda.ts"
 * import { Resource } from "sst";
 * import { AuroraDSQLClient } from "@aws/aurora-dsql-node-postgres-connector";
 *
 * const client = new AuroraDSQLClient({
 *   host: Resource.MyCluster.endpoint,
 *   user: "admin",
 * });
 *
 * await client.connect();
 * const result = await client.query("SELECT NOW() as now");
 * await client.end();
 * ```
 *
 * #### Multi-region cluster
 *
 * ```ts title="sst.config.ts"
 * const cluster = new sst.aws.Dsql("MyCluster", {
 *   regions: {
 *     witness: "us-west-2",
 *     peer: "us-east-2"
 *   }
 * });
 * ```
 *
 * [Check out the full example](/docs/examples/#aws-dsql-multiregion).
 *
 * #### With private VPC endpoints
 *
 * ```ts title="sst.config.ts"
 * const vpc = new sst.aws.Vpc("MyVpc");
 *
 * const cluster = new sst.aws.Dsql("MyCluster", {
 *   vpc: {
 *     instance: vpc,
 *     endpoints: { connection: true }
 *   }
 * });
 * ```
 *
 * [Check out the full example](/docs/examples/#aws-dsql-vpc).
 *
 * #### Link to a function
 *
 * ```ts title="sst.config.ts"
 * new sst.aws.Function("MyFunction", {
 *   handler: "src/lambda.handler",
 *   link: [cluster]
 * });
 * ```
 *
 * You can also use Drizzle ORM to query your DSQL cluster.
 * [Check out the Drizzle example](/docs/examples/#aws-dsql-drizzle).
 *
 * ---
 *
 * ### Cost
 *
 * Aurora DSQL is serverless and uses a pay-per-use pricing model. You are charged for
 * database activity measured in _Distributed Processing Units_ (DPUs) at $8 per million
 * DPUs, and storage at $0.33 per GB-month. When idle, usage scales to zero and you incur
 * no DPU charges.
 *
 * There is a free tier of 100,000 DPUs and 1 GB of storage per month.
 *
 * For example, a single-region cluster averaging 1.3M DPUs per month with 15 GB of storage
 * costs roughly 1.3 x $8 + 15 x $0.33 or **$15 per month**.
 *
 * Check out the [Aurora DSQL pricing](https://aws.amazon.com/rds/aurora/dsql/pricing/) for more details.
 *
 */
export declare class Dsql extends Component implements Link.Linkable {
    private cluster;
    private peerCluster;
    private connectionEndpoint;
    private constructorName;
    constructor(name: string, args?: DsqlArgs, opts?: ComponentResourceOptions);
    /** The region of the cluster. */
    get region(): Output<string>;
    /** The endpoint of the cluster. */
    get endpoint(): Output<string>;
    /**
     * The peer cluster info. Only available for multi-region clusters.
     *
     * @example
     * ```ts title="sst.config.ts"
     * const cluster = new sst.aws.Dsql("MyCluster", {
     *   regions: { peer: "us-east-2" },
     * });
     *
     * return {
     *   peerRegion: cluster.peer.region,
     *   peerEndpoint: cluster.peer.endpoint,
     * };
     * ```
     */
    get peer(): {
        /** The region of the peer cluster. */
        region: Output<string>;
        /** The endpoint of the peer cluster. */
        endpoint: Output<string>;
    };
    /** The underlying [resources](/docs/components/#nodes) this component creates. */
    get nodes(): {
        /** The DSQL cluster. */
        cluster: import("@pulumi/aws/dsql/cluster").Cluster;
        /** The peer DSQL cluster (multi-region only). */
        peerCluster: import("@pulumi/aws/dsql/cluster").Cluster;
    };
    /**
     * Reference an existing DSQL cluster by identifier. Useful for sharing a cluster
     * across stages without creating a new one.
     *
     * :::tip
     * You can use the `static get` method to share a cluster across stages.
     * :::
     *
     * @example
     *
     * #### Single-region cluster
     *
     * ```ts title="sst.config.ts"
     * const cluster = $app.stage === "frank"
     *   ? sst.aws.Dsql.get("MyCluster", { id: "kzttrvbdg4k2o5ze2m2rrwdj7u" })
     *   : new sst.aws.Dsql("MyCluster");
     * ```
     * #### Multi-region cluster
     *
     * ```ts title="sst.config.ts"
     * const cluster = sst.aws.Dsql.get("MyCluster", {
     *   id: "app-dev-mycluster",
     *   peer: {
     *     id: "kzttrvbdg4k2o5ze2m2rrwdj7u",
     *     region: "us-east-2",
     *   }
     * });
     * ```
     */
    static get(name: string, args: {
        id: Input<string>;
        peer?: {
            id: string;
            region: string;
        };
    }, opts?: ComponentResourceOptions): Dsql;
    /** @internal */
    getSSTLink(): {
        properties: {
            region: Output<string>;
            endpoint: Output<string>;
            peer: {
                region: Output<string>;
                endpoint: Output<string>;
            };
        };
        include: {
            effect?: "allow" | "deny";
            actions: string[];
            resources: Input<Input<string>[]>;
            conditions?: Input<Input<{
                test: Input<string>;
                variable: Input<string>;
                values: Input<Input<string>[]>;
            }>[]>;
            type: "aws.permission";
        }[];
    };
}
