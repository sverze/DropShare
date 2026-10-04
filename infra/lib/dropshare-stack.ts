import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lightsail from "aws-cdk-lib/aws-lightsail";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface DropshareStackProps extends cdk.StackProps {
  /**
   * Custom domain. Optional.
   *
   * Omit it and the stack skips the certificate entirely; the service is
   * reached on the free https://<service>.<id>.<region>.cs.amazonlightsail.com
   * URL that Lightsail issues, which already has working TLS. Add the domain
   * later and redeploy - nothing else about the deployment changes.
   */
  readonly domainName?: string;
  /**
   * Extra names on the same certificate, e.g. the apex when the canonical
   * address is www. Covering both avoids a TLS error for whichever one is not
   * canonical, and avoids a second validation round later.
   */
  readonly alternativeNames?: string[];
  /** nano | micro | small | medium | large | xlarge */
  readonly power: string;
  readonly serviceName: string;
  /**
   * Attach the custom domain to the container service.
   *
   * Leave false for the first deploy. Lightsail will not accept a certificate
   * that is still PENDING_VALIDATION, and the certificate is created by this
   * same stack, so the domain has to go on in a second pass once the DNS
   * challenge has been answered.
   */
  readonly attachDomain: boolean;
  /**
   * Takedown kill switch. Set from `-c dropshare:dark=...`.
   *
   * - `off`   normal operation.
   * - `links` explicit-Deny on `s3:GetObject` for `shares/*` plus the download
   *           distribution disabled. This is the lever that actually revokes
   *           already-issued links: a presigned URL stays valid until it
   *           expires, and because `toCdnUrl()` only swaps the hostname the
   *           signature is equally valid against the bucket's own REST
   *           endpoint - so disabling CloudFront alone revokes nothing. The
   *           app stays up, and `s3:DeleteObject` stays allowed, so content
   *           can still be removed through the admin API while dark.
   * - `all`   the above plus `isDisabled` on the container service.
   *
   * Deliberately scoped to `shares/*`: `_db/` and `_avatars/` must stay
   * readable and writable or Litestream stops replicating and its restore
   * fails at the next boot.
   *
   * Never gate `attachDomain` on this. Lightsail rejects a certificate that is
   * still PENDING_VALIDATION, so dropping the domain would force another
   * manual DNS-validation round to get it back.
   */
  readonly dark: "off" | "links" | "all";
}

/**
 * DropShare on Lightsail Container Service.
 *
 * No EC2 and no EFS. The container service terminates TLS and attaches the
 * custom domain itself, so there is no load balancer and no CloudFront to pay
 * for. SQLite lives on the container's ephemeral disk and is replicated to S3
 * by Litestream; avatars are synced to the same bucket, because the
 * application writes them to local disk and never to object storage
 * (see backend/src/user/user.controller.ts:54).
 */
export class DropshareStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DropshareStackProps) {
    super(scope, id, props);

    const region = cdk.Stack.of(this).region;

    // With no custom domain the site is served from Lightsail's own hostname,
    // which is not known until the service exists. S3 accepts a single
    // wildcard in a CORS origin, so match the whole namespace rather than
    // deploying the bucket twice.
    const corsOrigins = props.domainName
      ? [
          `https://${props.domainName}`,
          ...(props.alternativeNames ?? []).map((n) => `https://${n}`),
        ]
      : ["https://*.cs.amazonlightsail.com"];

    // ------------------------------------------------------------------
    // Storage. One bucket, three prefixes:
    //   shares/    share content, reached by presigned URL
    //   _db/       Litestream replica of the SQLite database
    //   _avatars/  profile images, synced because they are local-disk only
    // ------------------------------------------------------------------
    // ------------------------------------------------------------------
    // Access logs.
    //
    // Both request logs were off, which left two questions unanswerable: who
    // was making 19.2M S3 GETs a month against 187k CloudFront viewer
    // requests, and which IPs had downloaded a file named in a copyright
    // notice. Neither can be answered retrospectively, so they are on now.
    //
    // The `Requester` field will NOT separate Litestream from the download
    // path - `bucket.grantReadWrite(appUser)` gives both the same IAM user.
    // The `Key` prefix does: Litestream touches `_db/`, downloads touch
    // `shares/`. That is the comparison worth running.
    // ------------------------------------------------------------------
    const logBucket = new s3.Bucket(this, "AccessLogsBucket", {
      // CloudFront standard logging writes objects with an ACL, which the
      // default BucketOwnerEnforced setting rejects outright.
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          // Long enough to answer a billing question or a takedown notice,
          // short enough that the logs never become a storage line item.
          id: "expire-access-logs",
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    const bucket = new s3.Bucket(this, "SharesBucket", {
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: "s3-access/",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: corsOrigins,
          allowedHeaders: ["*"],
          // The browser multipart uploader reads ETag back from each part.
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          // Litestream writes many small WAL segments; incomplete multipart
          // uploads from interrupted syncs should not accumulate.
          id: "abort-incomplete-uploads",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(3),
        },
        {
          // Litestream enforces `retention` only against the generation it is
          // currently writing. Every container restart starts a NEW generation
          // and abandons the old one, which Litestream then never touches
          // again - 53 abandoned generations once reached 43 GB here. This
          // sweeps them up.
          //
          // 30 days, not 3: the live generation is refreshed constantly, so
          // this only ever catches abandoned data, and the long window means
          // the replica still survives a month of downtime without expiring
          // the one copy of the database.
          id: "expire-abandoned-litestream-generations",
          prefix: "_db/",
          expiration: cdk.Duration.days(30),
          noncurrentVersionExpiration: cdk.Duration.days(1),
        },
      ],
    });

    // ------------------------------------------------------------------
    // Takedown Deny. The load-bearing half of the kill switch.
    //
    // An explicit Deny in a resource policy beats every Allow, including the
    // account root and the app's own IAM user, so this is what stops content
    // being served no matter which hostname a link points at or who signed it.
    // GetObject only: DeleteObject stays allowed so the offending content can
    // still be removed while the switch is on.
    // ------------------------------------------------------------------
    if (props.dark !== "off") {
      bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: "DmcaDarkDenySharesRead",
          effect: iam.Effect.DENY,
          principals: [new iam.AnyPrincipal()],
          actions: ["s3:GetObject"],
          resources: [bucket.arnForObjects("shares/*")],
        }),
      );
    }

    // ------------------------------------------------------------------
    // CDN for downloads.
    //
    // Presigned URLs go browser-to-S3 directly, which is billed at full S3
    // egress with no free allowance - 560 GB in one month here. CloudFront
    // includes 1 TB/month of egress permanently and pays nothing for origin
    // fetches from S3, so routing the same downloads through it removes the
    // bill without giving up expiring links.
    //
    // The bucket is attached as a CUSTOM origin (its REST endpoint), not an
    // S3 origin with OAC. That is deliberate: CloudFront sends the origin
    // domain as the Host header, which is exactly the host the presigned
    // signature was computed over, so S3 validates it normally. An S3 origin
    // with OAC would have CloudFront re-sign the request and the presigned
    // query parameters would be ignored.
    // ------------------------------------------------------------------
    const downloadOrigin = new origins.HttpOrigin(
      `${bucket.bucketName}.s3.${region}.amazonaws.com`,
      {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        readTimeout: cdk.Duration.seconds(60),
      },
    );

    const cdn = new cloudfront.Distribution(this, "DownloadCdn", {
      comment: "DropShare - presigned S3 downloads",
      // Defence in depth, not a revocation - see the `dark` prop docs. The
      // domain name survives, so CdnUrl stays valid across a dark period.
      enabled: props.dark === "off",
      defaultBehavior: {
        origin: downloadOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        // Every presigned URL carries a unique signature, so a cache key that
        // included it would never hit, and one that excluded it would serve
        // objects to requests that presented no signature at all. Caching is
        // therefore off by design - the saving comes from the free egress
        // tier, not from cache hits, and origin fetches are free anyway.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // Forwards the query string (which carries the signature) plus Range
        // and conditional headers, so seeking within audio and video still
        // works. Everything except Host: the viewer's Host must NOT reach the
        // origin or it would not match what was signed.
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        compress: false,
      },
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      // Viewer-side request counts, so the origin-amplification ratio can be
      // measured against the S3 access logs rather than inferred from the bill.
      enableLogging: true,
      logBucket,
      logFilePrefix: "cloudfront/",
      logIncludesCookies: false,
    });

    const repository = new ecr.Repository(this, "AppRepository", {
      repositoryName: "dropshare",
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ maxImageCount: 5, description: "Keep last 5 images" }],
    });

    // ------------------------------------------------------------------
    // Credentials.
    //
    // Lightsail container services have no instance profile or task role, so
    // unlike EC2 or Fargate the application cannot pick up credentials from
    // the metadata endpoint. A dedicated IAM user is the only option; its
    // secret is held in Secrets Manager and injected by the deployment script
    // rather than baked into the CloudFormation template.
    // ------------------------------------------------------------------
    const appUser = new iam.User(this, "AppUser", {
      userName: `${props.serviceName}-app`,
    });

    bucket.grantReadWrite(appUser);

    const accessKey = new iam.AccessKey(this, "AppAccessKey", {
      user: appUser,
    });

    const appSecret = new secretsmanager.Secret(this, "AppCredentials", {
      secretName: `${props.serviceName}/app-credentials`,
      description: "S3 credentials for the DropShare container and Litestream",
      secretObjectValue: {
        accessKeyId: cdk.SecretValue.unsafePlainText(accessKey.accessKeyId),
        secretAccessKey: accessKey.secretAccessKey,
      },
    });

    // ------------------------------------------------------------------
    // TLS. Lightsail issues and renews its own certificate; validation is a
    // DNS challenge that has to be satisfied at your external provider.
    // ------------------------------------------------------------------
    const certificate = props.domainName
      ? new lightsail.CfnCertificate(this, "SiteCertificate", {
          certificateName: `${props.serviceName}-cert`,
          domainName: props.domainName,
          subjectAlternativeNames: props.alternativeNames?.length
            ? props.alternativeNames
            : undefined,
        })
      : undefined;

    // ------------------------------------------------------------------
    // Compute.
    //
    // scale MUST stay at 1. Two nodes would mean two processes writing the
    // same SQLite database through two independent Litestream replicas, which
    // corrupts it. This service cannot be scaled horizontally.
    // ------------------------------------------------------------------
    const service = new lightsail.CfnContainer(this, "ContainerService", {
      serviceName: props.serviceName,
      power: props.power,
      scale: 1,
      // `dark=all` only. `dark=links` deliberately leaves the app running:
      // stopping it first would take away the admin API needed to delete the
      // reported content.
      isDisabled: props.dark === "all",
      publicDomainNames:
        certificate && props.attachDomain && props.domainName
          ? [
              {
                certificateName: certificate.certificateName,
                domainNames: [
                  props.domainName,
                  ...(props.alternativeNames ?? []),
                ],
              },
            ]
          : undefined,
      privateRegistryAccess: {
        ecrImagePullerRole: { isActive: true },
      },
      // The deployment itself is created by scripts/deploy-container.sh, not
      // here: it carries the image tag and the injected credentials, both of
      // which change more often than the service and neither of which belongs
      // in a CloudFormation template.
    });

    if (certificate) service.node.addDependency(certificate);

    // ------------------------------------------------------------------
    // Outputs
    // ------------------------------------------------------------------
    new cdk.CfnOutput(this, "CdnUrl", {
      value: `https://${cdn.distributionDomainName}`,
      description: "Pass to deploy-container.sh as CDN_URL",
    });
    new cdk.CfnOutput(this, "ServiceName", { value: props.serviceName });
    new cdk.CfnOutput(this, "SharesBucketName", { value: bucket.bucketName });
    new cdk.CfnOutput(this, "EcrRepositoryUri", { value: repository.repositoryUri });
    new cdk.CfnOutput(this, "AppSecretName", { value: appSecret.secretName });
    new cdk.CfnOutput(this, "Region", { value: region });

    new cdk.CfnOutput(this, "NextSteps", {
      value:
        "1) Add the Lightsail certificate DNS challenge, 2) grant the ECR puller role, " +
        "3) run scripts/build-and-push-image.sh, 4) run scripts/deploy-container.sh",
    });
  }
}
