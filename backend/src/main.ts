import {
  ClassSerializerInterceptor,
  Logger,
  LogLevel,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";
import { NextFunction, Request, Response } from "express";
import * as fs from "fs";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import {
  DATA_DIRECTORY,
  LOG_LEVEL_AVAILABLE,
  LOG_LEVEL_DEFAULT,
  LOG_LEVEL_ENV,
} from "./constants";

function generateNestJsLogLevels(): LogLevel[] {
  if (LOG_LEVEL_ENV) {
    const levelIndex = LOG_LEVEL_AVAILABLE.indexOf(LOG_LEVEL_ENV as any);
    if (levelIndex === -1) {
      throw new Error(`log level ${LOG_LEVEL_ENV} unknown`);
    }

    return LOG_LEVEL_AVAILABLE.slice(levelIndex, LOG_LEVEL_AVAILABLE.length);
  } else {
    const levelIndex = LOG_LEVEL_AVAILABLE.indexOf(LOG_LEVEL_DEFAULT);
    return LOG_LEVEL_AVAILABLE.slice(levelIndex, LOG_LEVEL_AVAILABLE.length);
  }
}

async function bootstrap() {
  const logLevels = generateNestJsLogLevels();
  Logger.log(`Showing ${logLevels.join(", ")} messages`);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels,
    bodyParser: false,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const config = app.get<ConfigService>(ConfigService);

  const captureRawBody = (req: Request & { rawBody?: Buffer }, _res: Response, buffer: Buffer) => {
    if (buffer?.length) {
      req.rawBody = Buffer.from(buffer);
    }
  };

  app.use(bodyParser.json({ limit: "5mb", verify: captureRawBody }));
  app.use(bodyParser.urlencoded({ extended: true, limit: "5mb", verify: captureRawBody }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const chunkSize = config.get("share.chunkSize");
    bodyParser.raw({
      type: "application/octet-stream",
      limit: `${chunkSize}B`,
    })(req, res, next);
  });

  app.use(cookieParser());
  app.set("trust proxy", true);

  app.setGlobalPrefix("api");

  if (process.env.NODE_ENV == "development") {
    const config = new DocumentBuilder()
      .setTitle("DropShare API")
      .setVersion("1.0")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/swagger", app, document);
  }

  await app.listen(
    parseInt(process.env.BACKEND_PORT || process.env.PORT || "8080"),
  );

  const crashLogger = new Logger("ProcessCrash");

  process.on("unhandledRejection", (reason, promise) => {
    crashLogger.error(
      `Unhandled Promise Rejection: ${reason}`,
      reason instanceof Error ? reason.stack : undefined,
    );
  });

  process.on("uncaughtException", (error, origin) => {
    crashLogger.error(
      `Uncaught Exception (${origin}): ${error.message}`,
      error.stack,
    );
    const crashInfo = `[${new Date().toISOString()}] ${origin}: ${error.message}\n${error.stack}\n\n`;
    try {
      fs.appendFileSync(`${DATA_DIRECTORY}/crash.log`, crashInfo);
    } catch (_) {
    }

    if (process.env.EXIT_ON_UNCAUGHT_EXCEPTION !== "false") {
      setImmediate(() => process.exit(1));
    }
  });

  process.on("SIGTERM", () => {
    crashLogger.warn("Received SIGTERM signal");
  });

  process.on("SIGINT", () => {
    crashLogger.warn("Received SIGINT signal");
  });
}
bootstrap();
