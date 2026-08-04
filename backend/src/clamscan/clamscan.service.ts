import { Injectable, Logger } from "@nestjs/common";
import * as NodeClam from "clamscan";
import * as fs from "fs";
import * as net from "net";
import { FileService } from "src/file/file.service";
import { PrismaService } from "src/prisma/prisma.service";
import { Readable } from "stream";
import { CLAMAV_HOST, CLAMAV_PORT, SHARE_DIRECTORY } from "../constants";

const clamscanConfig = {
  clamdscan: {
    host: CLAMAV_HOST,
    port: CLAMAV_PORT,
    localFallback: false,
  },
  preference: "clamdscan",
};

export type ClamStreamScanResult = {
  status: "clean" | "infected" | "too_large";
  raw: string;
  threats: string[];
};

type ClamAvStatus = {
  host: string;
  port: number;
  active: boolean;
  initialized: boolean;
  checking: boolean;
  lastCheckedAt: string | null;
  lastSuccessfulAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
};

@Injectable()
export class ClamScanService {
  private readonly logger = new Logger(ClamScanService.name);
  private readonly streamScanTimeoutMs = Number(
    process.env.CLAMAV_STREAM_SCAN_TIMEOUT_MS || 60 * 60 * 1000,
  );
  private readonly reconnectDelayMs = Number(
    process.env.CLAMAV_RECONNECT_DELAY_MS || 30 * 1000,
  );
  private readonly healthcheckTimeoutMs = Number(
    process.env.CLAMAV_HEALTHCHECK_TIMEOUT_MS || 2 * 1000,
  );
  private clamScan: NodeClam | null = null;
  private clamScanInitPromise: Promise<NodeClam | null> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private checking = false;
  private lastCheckedAt: Date | null = null;
  private lastSuccessfulAt: Date | null = null;
  private lastError: string | null = null;
  private consecutiveFailures = 0;

  constructor(
    private fileService: FileService,
    private prisma: PrismaService,
  ) {
    void this.getClamScan();
  }

  private recordClamAvSuccess() {
    this.lastCheckedAt = new Date();
    this.lastSuccessfulAt = this.lastCheckedAt;
    this.lastError = null;
    this.consecutiveFailures = 0;
  }

  private recordClamAvFailure(error: unknown) {
    this.lastCheckedAt = new Date();
    this.lastError = error instanceof Error ? error.message : String(error);
    this.consecutiveFailures++;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.getClamScan(true);
    }, this.reconnectDelayMs);
  }

  private async getClamScan(force = false): Promise<NodeClam | null> {
    if (this.clamScan && !force) return this.clamScan;
    if (this.clamScanInitPromise) return this.clamScanInitPromise;

    this.checking = true;
    this.clamScanInitPromise = new NodeClam()
      .init(clamscanConfig)
      .then((res) => {
        this.clamScan = res;
        this.recordClamAvSuccess();
        this.logger.log("ClamAV is active");
        return res;
      })
      .catch((error) => {
        this.clamScan = null;
        this.recordClamAvFailure(error);
        this.logger.warn(
          `ClamAV is not active; retrying in ${this.reconnectDelayMs}ms`,
        );
        this.scheduleReconnect();
        return null;
      })
      .finally(() => {
        this.checking = false;
        this.clamScanInitPromise = null;
      });

    return this.clamScanInitPromise;
  }

  private async canConnectToClamAv(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: CLAMAV_HOST, port: CLAMAV_PORT });
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, this.healthcheckTimeoutMs);

      socket.once("connect", () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });

      socket.once("error", () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  async getStatus(): Promise<ClamAvStatus> {
    const active = await this.canConnectToClamAv();
    if (active) {
      this.recordClamAvSuccess();
      if (!this.clamScan) {
        void this.getClamScan(true);
      }
    } else {
      this.clamScan = null;
      this.recordClamAvFailure(
        new Error(`Unable to connect to ClamAV at ${CLAMAV_HOST}:${CLAMAV_PORT}`),
      );
      this.scheduleReconnect();
    }

    return {
      host: CLAMAV_HOST,
      port: CLAMAV_PORT,
      active,
      initialized: this.clamScan !== null,
      checking: this.checking,
      lastCheckedAt: this.lastCheckedAt?.toISOString() || null,
      lastSuccessfulAt: this.lastSuccessfulAt?.toISOString() || null,
      lastError: this.lastError,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  async scanStream(stream: Readable): Promise<ClamStreamScanResult> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(
        { host: CLAMAV_HOST, port: CLAMAV_PORT },
        () => {
          socket.write("zINSTREAM\0");
          stream.resume();
        },
      );

      let response = "";
      let settled = false;
      let pausedForBackpressure = false;

      const finish = (error?: Error, result?: ClamStreamScanResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        stream.destroy();
        socket.destroy();

        if (error) {
          reject(error);
          return;
        }

        resolve(result!);
      };

      const timeout = setTimeout(() => {
        finish(new Error("ClamAV scan timed out"));
      }, this.streamScanTimeoutMs);

      stream.pause();

      stream.on("data", (chunk: Buffer) => {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length, 0);

        if (!socket.write(length) || !socket.write(chunk)) {
          pausedForBackpressure = true;
          stream.pause();
        }
      });

      socket.on("drain", () => {
        if (pausedForBackpressure) {
          pausedForBackpressure = false;
          stream.resume();
        }
      });

      stream.on("end", () => {
        socket.write(Buffer.alloc(4));
      });

      stream.on("error", (error) => {
        finish(error instanceof Error ? error : new Error("Stream scan failed"));
      });

      socket.on("data", (chunk) => {
        response += chunk.toString("utf8");
      });

      socket.on("end", () => {
        const raw = response.replace(/\0/g, "").trim();

        if (!raw) {
          this.recordClamAvFailure(new Error("ClamAV returned an empty scan response"));
          finish(new Error("ClamAV returned an empty scan response"));
          return;
        }

        if (raw.includes("FOUND")) {
          this.recordClamAvSuccess();
          const threat = raw
            .replace(/^stream:\s*/i, "")
            .replace(/\s+FOUND.*$/i, "")
            .trim();
          const threats = threat ? [threat] : ["Unknown threat"];
          const status = threats.some((item) =>
            item.toLowerCase().includes("heuristics.limits.exceeded"),
          )
            ? "too_large"
            : "infected";

          finish(undefined, { status, raw, threats });
          return;
        }

        if (raw.includes("OK")) {
          this.recordClamAvSuccess();
          finish(undefined, { status: "clean", raw, threats: [] });
          return;
        }

        if (raw.includes("ERROR")) {
          if (
            raw.toLowerCase().includes("instream size limit exceeded") ||
            raw.toLowerCase().includes("size limit exceeded") ||
            raw.toLowerCase().includes("size limit reached")
          ) {
            const threat = "Heuristics.Limits.Exceeded";
            this.recordClamAvSuccess();
            finish(undefined, { status: "too_large", raw, threats: [threat] });
            return;
          }

          this.recordClamAvFailure(new Error(raw));
          finish(new Error(raw));
          return;
        }

        this.recordClamAvFailure(new Error(`Unrecognized ClamAV response: ${raw}`));
        finish(new Error(`Unrecognized ClamAV response: ${raw}`));
      });

      socket.on("error", (error) => {
        this.clamScan = null;
        this.recordClamAvFailure(error);
        this.scheduleReconnect();
        finish(error);
      });
    });
  }

  async check(shareId: string) {
    const clamScan = await this.getClamScan();

    if (!clamScan) return [];

    const infectedFiles = [];
    const shareDirectory = `${SHARE_DIRECTORY}/${shareId}`;

    if (!fs.existsSync(shareDirectory)) {
      this.logger.debug(
        `Skipping local ClamAV cleanup for ${shareId}: ${shareDirectory} does not exist`,
      );
      return [];
    }

    const files = fs
      .readdirSync(shareDirectory)
      .filter((file) => file != "archive.zip");

    for (const fileId of files) {
      const { isInfected } = await clamScan
        .isInfected(`${shareDirectory}/${fileId}`)
        .catch((error) => {
          this.clamScan = null;
          this.recordClamAvFailure(error);
          this.scheduleReconnect();
          this.logger.warn("ClamAV is not active");
          return { isInfected: false };
        });

      const fileName =
        (await this.prisma.file.findUnique({ where: { id: fileId } }))?.name ||
        fileId;

      if (isInfected) {
        infectedFiles.push({ id: fileId, name: fileName });
      }
    }

    return infectedFiles;
  }

  async checkAndRemove(shareId: string) {
    const infectedFiles = await this.check(shareId);

    if (infectedFiles.length > 0) {
      await this.fileService.deleteAllFiles(shareId);
      await this.prisma.file.deleteMany({ where: { shareId } });

      const fileNames = infectedFiles.map((file) => file.name).join(", ");

      await this.prisma.share.update({
        where: { id: shareId },
        data: {
          removedReason: `Your share got removed because the file(s) ${fileNames} are malicious.`,
        },
      });

      this.logger.warn(
        `Share ${shareId} deleted because it contained ${infectedFiles.length} malicious file(s)`,
      );
    }
  }
}
