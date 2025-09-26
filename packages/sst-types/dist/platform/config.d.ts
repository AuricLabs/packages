import "./src/global.d.ts"
import "../types.generated"
import { AppInput, App, Config } from "./src/config"
import * as _aws from "@pulumi/aws";
import * as _awsnative from "@pulumi/aws-native";


declare global {
  // @ts-expect-error
  export import aws = _aws
  // @ts-expect-error
  export import awsnative = _awsnative
  interface Providers {
    providers?: {
      "aws"?:  (_aws.ProviderArgs & { version?: string }) | boolean | string;
      "aws-native"?:  (_awsnative.ProviderArgs & { version?: string }) | boolean | string;
    }
  }
  export const $config: (
    input: Omit<Config, "app"> & {
      app(input: AppInput): Promise<Omit<App, "providers"> & Providers> | (Omit<App, "providers"> & Providers);
    },
  ) => Config;
}
