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

// Takedown kill switch. Deploy-time only, nothing deleted, fully reversible.
//
//   -c dropshare:dark=links  deny public reads of shares/* and disable the
//                            download CDN. Stops all distribution while
//                            leaving the app reachable, which is what you
//                            want first: the admin API is how you remove
//                            content, so do not stop the container before it.
//   -c dropshare:dark=all    the above plus stop the container service.
//   (default "off")
//
// The Deny is scoped to shares/* deliberately. _db/ must stay readable or
// Litestream's restore fails at boot under `set -eu` and the container
// crash-loops. See infra/README.md "Takedown".
const dark = (() => {
  const v = String(app.node.tryGetContext("dropshare:dark") ?? "off").trim();
  if (v !== "off" && v !== "links" && v !== "all") {
    throw new Error(
      `dropshare:dark must be one of off | links | all, got "${v}"`,
    );
  }
  return v as "off" | "links" | "all";
})();

new DropshareStack(app, "DropshareApp", {
  dark,
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
