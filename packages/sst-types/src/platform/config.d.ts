import "./src/global.d.ts"
import "../types.generated"
import { AppInput, App, Config } from "./src/config"
import * as _awsnative from "@pulumi/aws-native";
import * as _aws from "@pulumi/aws";


declare global {
  // @ts-expect-error
  export import awsnative = _awsnative
  // @ts-expect-error
  export import aws = _aws
  interface Providers {
    providers?: {
      "aws-native"?:  (_awsnative.ProviderArgs & { version?: string }) | boolean | string;
      "aws"?:  (_aws.ProviderArgs & { version?: string }) | boolean | string;
    }
  }
  export const $config: (
    input: Omit<Config, "app"> & {
      app(input: AppInput): Promise<Omit<App, "providers"> & Providers> | (Omit<App, "providers"> & Providers);
    },
  ) => Config;
}
