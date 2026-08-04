import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { CacheableMemory } from "cacheable";
import { createKeyv } from "@keyv/redis";
import { Keyv } from "keyv";
import { ConfigModule } from "src/config/config.module";
import { ConfigService } from "src/config/config.service";

@Module({
  imports: [
    ConfigModule,
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const getConfig = <T,>(
          key: `${string}.${string}`,
          fallback: T,
        ): T => {
          try {
            return configService.get(key) ?? fallback;
          } catch {
            return fallback;
          }
        };

        const useRedis = getConfig("cache.redis-enabled", false);
        const ttl = getConfig("cache.ttl", 0);
        const max = getConfig("cache.maxItems", 5000);

        let config = {
          ttl,
          max,
          stores: [],
        };

        if (useRedis) {
          const redisUrl = getConfig("cache.redis-url", "");
          if (!redisUrl) {
            return config;
          }
          config.stores = [
            new Keyv({ store: new CacheableMemory({ ttl, lruSize: 5000 }) }),
            createKeyv(redisUrl),
          ];
        }

        return config;
      },
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}
