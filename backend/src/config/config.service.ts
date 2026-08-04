import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Config } from "@prisma/client";
import * as argon from "argon2";
import { EventEmitter } from "events";
import * as fs from "fs";
import { PrismaService } from "src/prisma/prisma.service";
import { stringToTimespan } from "src/utils/date.util";
import { parse as yamlParse } from "yaml";
import {
  configVariables as seededConfigVariables,
  YamlConfig,
} from "../../prisma/seed/config.seed";
import { CONFIG_FILE } from "src/constants";

export const SHARE_PRESET_COUNT = 9;

const NON_COLOR_THEME_KEYS = new Set([
  "general.themeLogoIsOpaque",
  "general.themeHeaderStyle",
]);

const HEADER_STYLES = new Set(["default", "minimal"]);

@Injectable()
export class ConfigService extends EventEmitter {
  yamlConfig?: YamlConfig;
  logger = new Logger(ConfigService.name);

  constructor(
    @Inject("CONFIG_VARIABLES") private configVariables: Config[],
    private prisma: PrismaService,
  ) {
    super();
  }

  async initialize() {
    await this.loadYamlConfig();

    if (this.yamlConfig) {
      await this.migrateInitUser();
    }
  }

  private async loadYamlConfig() {
    let configFile: string = "";
    try {
      configFile = fs.readFileSync(CONFIG_FILE, "utf8");
    } catch (e) {
      this.logger.log(
        "Config.yaml is not set. Falling back to UI configuration.",
      );
    }
    try {
      this.yamlConfig = yamlParse(configFile);

      if (this.yamlConfig) {
        for (const configVariable of this.configVariables) {
          const category = this.yamlConfig[configVariable.category];
          if (!category) continue;
          configVariable.value = category[configVariable.name];
          this.emit("update", configVariable.name, configVariable.value);
        }
      }
    } catch (e) {
      this.logger.error(
        "Failed to parse config.yaml. Falling back to UI configuration: ",
        e,
      );
    }
  }

  private async migrateInitUser(): Promise<void> {
    if (!this.yamlConfig.initUser.enabled) return;

    const userCount = await this.prisma.user.count({
      where: { isAdmin: true },
    });
    if (userCount === 1) {
      this.logger.log(
        "Skip initial user creation. Admin user is already existent.",
      );
      return;
    }
    await this.prisma.user.create({
      data: {
        email: this.yamlConfig.initUser.email,
        username: this.yamlConfig.initUser.username,
        password: this.yamlConfig.initUser.password
          ? await argon.hash(this.yamlConfig.initUser.password)
          : null,
        isAdmin: this.yamlConfig.initUser.isAdmin,
        role: this.yamlConfig.initUser.isAdmin ? "admin" : "user",
      },
    });
  }

  private getMergedConfigVariables(): Config[] {
    const seededEntries = Object.entries(seededConfigVariables).flatMap(
      ([category, variables]) =>
        Object.entries(variables).map(([name, properties], order) => {
          const existingConfigVariable = this.configVariables.find(
            (variable) =>
              variable.category === category && variable.name === name,
          );

          return (
            existingConfigVariable ?? {
              updatedAt: new Date(),
              name,
              category,
              type: properties.type,
              defaultValue: properties.defaultValue ?? "",
              value: properties.value ?? null,
              obscured: properties.obscured ?? false,
              secret: properties.secret ?? true,
              locked: properties.locked ?? false,
              order,
            }
          );
        }),
    );

    return seededEntries;
  }

  /**
   * general.appUrl drives OAuth callbacks, the passkey RP ID, error redirects
   * and email links, but nothing ever seeded it from the environment. A fresh
   * install therefore sat on the http://localhost:3000 default even when
   * APP_URL was set, and the operator had to notice and fix it by hand in
   * Admin -> Config. Fall back to APP_URL when no value has been saved; an
   * explicit admin value still wins, so this only fills the gap.
   */
  private resolveAppUrl(storedValue?: string | null): string | undefined {
    if (storedValue) return storedValue;
    return process.env.APP_URL?.trim() || undefined;
  }

  get(key: `${string}.${string}`): any {
    const configVariable = this.configVariables.filter(
      (variable) => `${variable.category}.${variable.name}` == key,
    )[0];

    const fallbackVariable = !configVariable
      ? seededConfigVariables[key.split(".")[0]]?.[key.split(".")[1]]
      : null;

    if (!configVariable && !fallbackVariable)
      throw new Error(`Config variable ${key} not found`);

    const variableType = configVariable?.type ?? fallbackVariable?.type;
    const value =
      configVariable?.value ??
      configVariable?.defaultValue ??
      fallbackVariable?.value ??
      fallbackVariable?.defaultValue;

    if (key === "general.appUrl") {
      const resolved = this.resolveAppUrl(configVariable?.value);
      if (resolved) return resolved;
    }

    if (variableType == "number" || variableType == "filesize")
      return parseInt(value);
    if (variableType == "boolean") return value == "true";
    if (variableType == "string" || variableType == "text")
      return value;
    if (variableType == "timespan") return stringToTimespan(value);
  }

  getSharePresets(): { color: string; name: string }[] {
    const shipped = JSON.parse(
      seededConfigVariables.general.themeSharePresets.defaultValue,
    );

    let raw: string;
    try {
      raw = this.get("general.themeSharePresets");
    } catch {
      return shipped;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      this.logger.warn(
        "general.themeSharePresets is not valid JSON, falling back to the default palette",
      );
    }

    return shipped;
  }

  has(key: `${string}.${string}`): boolean {
    return this.configVariables.some(
      (variable) => `${variable.category}.${variable.name}` === key,
    );
  }

  async getByCategory(category: string) {
    const configVariables = this.getMergedConfigVariables()
      .filter((c) => !c.locked && category == c.category)
      .sort((c) => c.order);

    return configVariables.map((variable) => {
      const isAppUrl =
        variable.category === "general" && variable.name === "appUrl";

      return {
        ...variable,
        key: `${variable.category}.${variable.name}`,
        // Show what the app actually uses, so the admin form does not display
        // localhost while APP_URL is in effect.
        value: isAppUrl
          ? (this.resolveAppUrl(variable.value) ?? variable.defaultValue)
          : (variable.value ?? variable.defaultValue),
        allowEdit: this.isEditAllowed(),
      };
    });
  }

  async list() {
    const configVariables = this.getMergedConfigVariables().filter(
      (c) => !c.secret,
    );

    return configVariables.map((variable) => {
      const isAppUrl =
        variable.category === "general" && variable.name === "appUrl";

      return {
        ...variable,
        key: `${variable.category}.${variable.name}`,
        value: isAppUrl
          ? (this.resolveAppUrl(variable.value) ?? variable.defaultValue)
          : (variable.value ?? variable.defaultValue),
      };
    });
  }

  async updateMany(data: { key: string; value: string | number | boolean }[]) {
    if (!this.isEditAllowed())
      throw new BadRequestException(
        "You are only allowed to update config variables via the config.yaml file",
      );

    const response: Config[] = [];

    for (const variable of data) {
      response.push(await this.update(variable.key, variable.value));
    }

    return response;
  }

  async update(key: string, value: string | number | boolean) {
    if (!this.isEditAllowed())
      throw new BadRequestException(
        "You are only allowed to update config variables via the config.yaml file",
      );

    const configVariable = await this.prisma.config.findUnique({
      where: {
        name_category: {
          category: key.split(".")[0],
          name: key.split(".")[1],
        },
      },
    });

    if (!configVariable || configVariable.locked)
      throw new NotFoundException("Config variable not found");

    if (value === "") {
      value = null;
    } else if (
      typeof value != configVariable.type &&
      typeof value == "string" &&
      configVariable.type != "text" &&
      configVariable.type != "timespan"
    ) {
      throw new BadRequestException(
        `Config variable must be of type ${configVariable.type}`,
      );
    }

    this.validateConfigVariable(key, value);

    const updatedVariable = await this.prisma.config.update({
      where: {
        name_category: {
          category: key.split(".")[0],
          name: key.split(".")[1],
        },
      },
      data: { value: value === null ? null : value.toString() },
    });

    this.configVariables = await this.prisma.config.findMany();

    this.emit("update", key, value);

    return updatedVariable;
  }

  validateConfigVariable(key: string, value: string | number | boolean) {
    if (key === "general.themeHeaderStyle" && value !== null) {
      if (typeof value !== "string" || !HEADER_STYLES.has(value.trim())) {
        throw new BadRequestException(
          `${key} must be one of: ${[...HEADER_STYLES].join(", ")}`,
        );
      }
    }

    if (
      key.startsWith("general.theme") &&
      value !== null &&
      !NON_COLOR_THEME_KEYS.has(key)
    ) {
      if (key === "general.themeSharePresets") {
        this.validateSharePresets(value);
      } else if (
        typeof value !== "string" ||
        !/^#[0-9a-fA-F]{6}$/.test(value.trim())
      ) {
        throw new BadRequestException(
          `${key} must be a hex color in the form #rrggbb`,
        );
      }
    }

    const validations = [
      {
        key: "share.shareIdLength",
        condition: (value: number) => value >= 2 && value <= 50,
        message: "Share ID length must be between 2 and 50",
      },
      {
        key: "share.zipCompressionLevel",
        condition: (value: number) => value >= 0 && value <= 9,
        message: "Zip compression level must be between 0 and 9",
      },
      {
        key: "share.chunkSize",
        condition: (value: number) => value >= 5 * 1024 * 1024,
        message: "Multipart part size must be at least 5 MB",
      },
      {
        key: "share.multipartThreshold",
        condition: (value: number) => value >= 5 * 1024 * 1024,
        message: "Multipart threshold must be at least 5 MB",
      },
    ];

    const validation = validations.find((validation) => validation.key == key);
    if (validation && !validation.condition(value as any)) {
      throw new BadRequestException(validation.message);
    }
  }

  private validateSharePresets(value: string | number | boolean) {
    const reject = (reason: string) => {
      throw new BadRequestException(`Share color presets ${reason}`);
    };

    if (typeof value !== "string") reject("must be JSON");

    let parsed: unknown;
    try {
      parsed = JSON.parse(value as string);
    } catch {
      return reject("must be valid JSON");
    }

    if (!Array.isArray(parsed)) return reject("must be a JSON array");
    if (parsed.length !== SHARE_PRESET_COUNT)
      return reject(`must contain exactly ${SHARE_PRESET_COUNT} entries`);

    for (const entry of parsed) {
      if (!entry || typeof entry !== "object")
        return reject("entries must be objects");

      const { color, name } = entry as { color?: unknown; name?: unknown };

      if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color.trim()))
        return reject("colors must be hex values in the form #rrggbb");

      if (typeof name !== "string" || !name.trim())
        return reject("entries must each have a name");

      if (name.length > 32) reject("names must be 32 characters or fewer");
    }
  }

  isEditAllowed(): boolean {
    return this.yamlConfig === undefined || this.yamlConfig === null;
  }
}
