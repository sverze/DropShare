import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as sharp from "sharp";
import { ConfigService } from "./config.service";

const IMAGES_PATH = "../frontend/public/img";

const FAVICON_SIZES = [16, 32, 48];

const PWA_ICON_SIZES = [48, 72, 96, 128, 144, 152, 192, 384, 512];

@Injectable()
export class LogoService {
  private readonly logger = new Logger(LogoService.name);

  constructor(private config: ConfigService) {}

  async create(file: Buffer) {
    const png = await sharp(file).png().toBuffer();

    const resized = await sharp(png).resize(900).png().toBuffer();
    await fs.promises.writeFile(`${IMAGES_PATH}/logo.png`, resized);

    await this.recordOpacity(png);
    await this.stampVersion();
    await this.createFavicon(png);
    await this.createPWAIcons(png);
  }

  private async recordOpacity(png: Buffer) {
    let isOpaque = true;
    try {
      isOpaque = (await sharp(png).stats()).isOpaque;
    } catch (error) {
      this.logger.warn(
        `Could not inspect logo transparency, assuming opaque: ${error}`,
      );
    }

    try {
      await this.config.update("general.themeLogoIsOpaque", isOpaque);
    } catch (error) {
      this.logger.warn(`Could not store logo opacity: ${error}`);
    }
  }

  private async stampVersion() {
    try {
      await this.config.update("general.themeLogoVersion", String(Date.now()));
    } catch (error) {
      this.logger.warn(`Could not stamp logo version: ${error}`);
    }
  }

  async createFavicon(file: Buffer) {
    const images = await Promise.all(
      FAVICON_SIZES.map((size) =>
        sharp(file)
          .resize(size, size, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer(),
      ),
    );

    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);

    const directory = Buffer.alloc(16 * images.length);
    let offset = header.length + directory.length;

    images.forEach((image, index) => {
      const size = FAVICON_SIZES[index];
      const entry = index * 16;
      directory.writeUInt8(size >= 256 ? 0 : size, entry);
      directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
      directory.writeUInt8(0, entry + 2);
      directory.writeUInt8(0, entry + 3);
      directory.writeUInt16LE(1, entry + 4);
      directory.writeUInt16LE(32, entry + 6);
      directory.writeUInt32LE(image.length, entry + 8);
      directory.writeUInt32LE(offset, entry + 12);
      offset += image.length;
    });

    await fs.promises.writeFile(
      `${IMAGES_PATH}/favicon.ico`,
      Buffer.concat([header, directory, ...images]),
    );
  }

  async createPWAIcons(file: Buffer) {
    await fs.promises.mkdir(`${IMAGES_PATH}/icons`, { recursive: true });

    for (const size of PWA_ICON_SIZES) {
      const resized = await sharp(file)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      await fs.promises.writeFile(
        `${IMAGES_PATH}/icons/icon-${size}x${size}.png`,
        resized,
      );
    }
  }
}
