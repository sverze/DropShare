import { Injectable } from "@nestjs/common";
import { ConfigService } from "src/config/config.service";
import {
  CAPABILITIES,
  CAPABILITY_GROUPS,
  CAPABILITY_KEYS,
  Capability,
  parseCapabilityMap,
} from "src/auth/capabilities";

const CONFIG_KEY = "access.managerCapabilities";

@Injectable()
export class AccessLevelsService {
  constructor(private readonly config: ConfigService) {}

  getSettings() {
    const map = parseCapabilityMap(this.config.get(CONFIG_KEY));
    return {
      groups: CAPABILITY_GROUPS.map((g) => ({
        category: g.category,
        capabilities: g.capabilities.map(([key, label]) => ({ key, label })),
      })),
      catalog: CAPABILITIES,
      capabilities: Object.fromEntries(
        CAPABILITY_KEYS.map((k) => [k, map[k] === true]),
      ) as Record<Capability, boolean>,
    };
  }

  async updateCapabilities(input: Partial<Record<string, boolean>>) {
    const next: Partial<Record<Capability, boolean>> = {};
    for (const key of CAPABILITY_KEYS) {
      if (input[key]) next[key] = true;
    }
    await this.config.update(CONFIG_KEY, JSON.stringify(next));
    return this.getSettings();
  }
}
