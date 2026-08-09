#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DropshareStack } from "../lib/dropshare-stack";

const app = new cdk.App();

const account =
  process.env.CDK_DEFAULT_ACCOUNT ?? app.node.tryGetContext("dropshare:account");

const region =
  app.node.tryGetContext("dropshare:region") ??
  process.env.CDK_DEFAULT_REGION ??
  "us-east-1";

// Optional. With no domain the service is reached on the Lightsail-issued
// hostname, which already has TLS; add -c dropshare:domainName=... later and
// redeploy to move it onto your own.
const rawDomain = app.node.tryGetContext("dropshare:domainName") as
  | string
  | undefined;

const domainName =
  rawDomain && !rawDomain.startsWith("REPLACE-ME") ? rawDomain : undefined;

new DropshareStack(app, "DropshareApp", {
  env: { account, region },
  domainName,
  power: app.node.tryGetContext("dropshare:power") ?? "small",
  serviceName: app.node.tryGetContext("dropshare:serviceName") ?? "dropshare",
  alternativeNames: String(app.node.tryGetContext("dropshare:altNames") ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean),
  attachDomain:
    String(app.node.tryGetContext("dropshare:attachDomain") ?? "false") === "true",
  description: `DropShare on Lightsail Container Service - ${
    domainName ?? "Lightsail-issued hostname"
  }`,
});

app.synth();
