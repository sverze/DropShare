import * as cdk from "aws-cdk-lib";
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
      ? [`https://${props.domainName}`]
      : ["https://*.cs.amazonlightsail.com"];

    // ------------------------------------------------------------------
    // Storage. One bucket, three prefixes:
    //   shares/    share content, reached by presigned URL
    //   _db/       Litestream replica of the SQLite database
    //   _avatars/  profile images, synced because they are local-disk only
    // ------------------------------------------------------------------
    const bucket = new s3.Bucket(this, "SharesBucket", {
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
      ],
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
      isDisabled: false,
      publicDomainNames:
        certificate && props.attachDomain && props.domainName
          ? [
              {
                certificateName: certificate.certificateName,
                domainNames: [props.domainName],
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
