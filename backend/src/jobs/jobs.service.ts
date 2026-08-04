import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as fs from "fs";
import * as moment from "moment";
import { FileService } from "src/file/file.service";
import { PrismaService } from "src/prisma/prisma.service";
import { ConfigService } from "src/config/config.service";
import { ReverseShareService } from "src/reverseShare/reverseShare.service";
import { SHARE_DIRECTORY } from "../constants";
import {
  scheduledJobsDisabled,
  skipScheduledJob,
} from "../utils/scheduled-jobs.util";

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private prisma: PrismaService,
    private reverseShareService: ReverseShareService,
    private fileService: FileService,
    private config: ConfigService,
  ) {
    if (scheduledJobsDisabled()) {
      this.logger.warn(
        "DISABLE_SCHEDULED_JOBS=true - all scheduled cleanup is off. " +
          "Nothing will be expired, pruned or deleted on a timer.",
      );
    }
  }

  private skip(job: string): boolean {
    return skipScheduledJob(this.logger, job);
  }

  @Cron("0 * * * *")
  async deleteExpiredShares() {
    if (this.skip("deleteExpiredShares")) return;
    try {
      const expiredShares = await this.prisma.share.findMany({
        where: {
          AND: [
            { expiration: { lt: new Date() } },
            { expiration: { not: moment(0).toDate() } },
          ],
        },
      });

      let deletedCount = 0;
      for (const expiredShare of expiredShares) {
        try {
          await this.prisma.share.delete({
            where: { id: expiredShare.id },
          });

          await this.fileService.deleteAllFiles(expiredShare.id);
          deletedCount++;
        } catch (innerError) {
          this.logger.error(
            `Failed to delete expired share ${expiredShare.id}: ${innerError.message}`,
            innerError.stack,
          );
        }
      }

      if (deletedCount > 0) {
        this.logger.log(`Deleted ${deletedCount} expired shares`);
      }
    } catch (error) {
      this.logger.error(
        `Error in deleteExpiredShares job: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron("0 * * * *")
  async deleteExpiredReverseShares() {
    if (this.skip("deleteExpiredReverseShares")) return;
    try {
      const expiredReverseShares = await this.prisma.reverseShare.findMany({
        where: {
          shareExpiration: { lt: new Date() },
        },
      });

      let deletedCount = 0;
      for (const expiredReverseShare of expiredReverseShares) {
        try {
          await this.reverseShareService.remove(expiredReverseShare.id);
          deletedCount++;
        } catch (innerError) {
          this.logger.error(
            `Failed to delete expired reverse share ${expiredReverseShare.id}: ${innerError.message}`,
            innerError.stack,
          );
        }
      }

      if (deletedCount > 0) {
        this.logger.log(`Deleted ${deletedCount} expired reverse shares`);
      }
    } catch (error) {
      this.logger.error(
        `Error in deleteExpiredReverseShares job: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron("0 */6 * * *")
  async deleteUnfinishedShares() {
    if (this.skip("deleteUnfinishedShares")) return;
    try {
      const unfinishedShares = await this.prisma.share.findMany({
        where: {
          createdAt: { lt: moment().subtract(1, "day").toDate() },
          editedAt: { lt: moment().subtract(1, "day").toDate() },
          uploadLocked: false,
          views: 0,
          downloads: 0,
        },
      });

      let deletedCount = 0;
      for (const unfinishedShare of unfinishedShares) {
        try {
          await this.prisma.share.delete({
            where: { id: unfinishedShare.id },
          });

          await this.fileService.deleteAllFiles(unfinishedShare.id);
          deletedCount++;
        } catch (innerError) {
          this.logger.error(
            `Failed to delete unfinished share ${unfinishedShare.id}: ${innerError.message}`,
            innerError.stack,
          );
        }
      }

      if (deletedCount > 0) {
        this.logger.log(`Deleted ${deletedCount} unfinished shares`);
      }
    } catch (error) {
      this.logger.error(
        `Error in deleteUnfinishedShares job: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron("0 0 * * *")
  deleteTemporaryFiles() {
    try {
      let filesDeleted = 0;

      if (!fs.existsSync(SHARE_DIRECTORY)) {
        this.logger.log(
          "Share directory does not exist, skipping temp file cleanup",
        );
        return;
      }

      const shareDirectories = fs
        .readdirSync(SHARE_DIRECTORY, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const shareDirectory of shareDirectories) {
        try {
          const dirPath = `${SHARE_DIRECTORY}/${shareDirectory}`;

          if (!fs.existsSync(dirPath)) continue;

          const temporaryFiles = fs
            .readdirSync(dirPath)
            .filter((file) => file.endsWith(".tmp-chunk"));

          for (const file of temporaryFiles) {
            try {
              const filePath = `${dirPath}/${file}`;
              const stats = fs.statSync(filePath);
              const isOlderThanOneDay = moment(stats.mtime)
                .add(1, "day")
                .isBefore(moment());

              if (isOlderThanOneDay) {
                fs.rmSync(filePath);
                filesDeleted++;
              }
            } catch (fileError) {
              this.logger.error(
                `Failed to delete temp file ${file}: ${fileError.message}`,
              );
            }
          }
        } catch (dirError) {
          this.logger.error(
            `Failed to process directory ${shareDirectory}: ${dirError.message}`,
          );
        }
      }

      this.logger.log(`Deleted ${filesDeleted} temporary files`);
    } catch (error) {
      this.logger.error(
        `Error in deleteTemporaryFiles job: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron("1 * * * *")
  async deleteExpiredTokens() {
    if (this.skip("deleteExpiredTokens")) return;
    try {
      const { count: refreshTokenCount } =
        await this.prisma.refreshToken.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });

      const { count: loginTokenCount } =
        await this.prisma.loginToken.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });

      const { count: resetPasswordTokenCount } =
        await this.prisma.resetPasswordToken.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });

      const deletedTokensCount =
        refreshTokenCount + loginTokenCount + resetPasswordTokenCount;

      if (deletedTokensCount > 0) {
        this.logger.log(`Deleted ${deletedTokensCount} expired tokens`);
      }
    } catch (error) {
      this.logger.error(
        `Error in deleteExpiredTokens job: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron("30 3 * * *")
  async pruneOldRequestLogs() {
    if (this.skip("pruneOldRequestLogs")) return;
    try {
      // Retention is configurable: 30 days of traffic can be millions of rows.
      const configured = Number(this.config.get("general.requestLogRetentionDays"));
      const days = Number.isFinite(configured) && configured > 0 ? configured : 30;
      const cutoff = moment().subtract(days, "days").toDate();
      const oldest = await this.prisma.requestLog.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      if (!oldest || oldest.createdAt >= cutoff) return;

      let start = new Date(oldest.createdAt);
      let total = 0;
      const DAY = 24 * 60 * 60 * 1000;
      while (start < cutoff) {
        const end = new Date(Math.min(start.getTime() + DAY, cutoff.getTime()));
        const { count } = await this.prisma.requestLog.deleteMany({
          where: { createdAt: { gte: start, lt: end } },
        });
        total += count;
        start = end;
      }

      if (total > 0) {
        this.logger.log(`Pruned ${total} request logs older than ${days} days`);
      }
    } catch (error) {
      this.logger.error(
        `Error in pruneOldRequestLogs job: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron("45 3 * * *")
  async pruneOldEmailLogs() {
    if (this.skip("pruneOldEmailLogs")) return;
    try {
      const cutoff = moment().subtract(30, "days").toDate();
      const oldest = await this.prisma.emailLog.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      if (!oldest || oldest.createdAt >= cutoff) return;

      let start = new Date(oldest.createdAt);
      let total = 0;
      const DAY = 24 * 60 * 60 * 1000;
      while (start < cutoff) {
        const end = new Date(Math.min(start.getTime() + DAY, cutoff.getTime()));
        const { count } = await this.prisma.emailLog.deleteMany({
          where: { createdAt: { gte: start, lt: end } },
        });
        total += count;
        start = end;
      }

      if (total > 0) {
        this.logger.log(`Pruned ${total} email logs older than 30 days`);
      }
    } catch (error) {
      this.logger.error(
        `Error in pruneOldEmailLogs job: ${error.message}`,
        error.stack,
      );
    }
  }
}
