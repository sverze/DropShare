import {
  Box,
  Button,
  Center,
  createStyles,
  Grid,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  TbChartBar,
  TbDownload,
  TbEye,
  TbFiles,
  TbList,
  TbRefresh,
  TbServer,
  TbShare,
  TbTrash,
  TbUsers,
} from "react-icons/tb";
import Meta from "../../components/Meta";

const useStyles = createStyles((theme) => ({
  pageWrapper: {
    position: "relative",
  },

  statCard: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    padding: 24,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 4px 24px rgba(0, 0, 0, 0.3)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
    transition: "all 0.2s ease",
    minHeight: 118,
    height: "100%",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow:
        theme.colorScheme === "dark"
          ? "0 8px 32px rgba(0, 0, 0, 0.4)"
          : "0 8px 32px rgba(0, 0, 0, 0.1)",
    },
  },

  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(var(--ls-panel-border-rgb), 0.1)",
  },

  statValue: {
    fontSize: 32,
    fontWeight: 700,
    color: theme.colorScheme === "dark" ? "#fff" : theme.colors.dark[8],
    lineHeight: 1.2,
  },

  statLabel: {
    fontSize: 14,
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[4]
        : theme.colors.gray[6],
    fontWeight: 500,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 16,
    color: theme.colorScheme === "dark" ? "#fff" : theme.colors.dark[8],
  },

  tableWrapper: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    overflow: "hidden",
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 4px 24px rgba(0, 0, 0, 0.3)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  table: {
    "& thead tr th": {
      backgroundColor:
        "rgba(var(--ls-panel-border-rgb), 0.05)",
      borderBottom: `1px solid rgba(var(--ls-panel-border-rgb), 0.1)`,
      padding: "12px 16px",
      fontWeight: 600,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color:
        theme.colorScheme === "dark"
          ? theme.colors.gray[3]
          : theme.colors.gray[7],
    },
    "& tbody tr": {
      transition: "background-color 0.15s ease",
      "&:hover": {
        backgroundColor:
          `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.05 : 0.04})`,
      },
    },
    "& tbody tr td": {
      padding: "12px 16px",
      borderBottom: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.05)"
      }`,
    },
    "& tbody tr:last-of-type td": {
      borderBottom: "none",
    },
  },

  storageCard: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    padding: 24,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 4px 24px rgba(0, 0, 0, 0.3)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
    minHeight: 118,
    height: "100%",
    display: "flex",
    alignItems: "center",
  },

  activityCard: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    padding: 24,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 4px 24px rgba(0, 0, 0, 0.3)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  activityItem: {
    padding: "12px 0",
    borderBottom: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.05)"
    }`,
    "&:last-of-type": {
      borderBottom: "none",
    },
  },
}));

interface Stats {
  totalShares: number;
  totalFiles: number;
  totalUsers: number;
  totalViews: number;
  totalDownloads: number;
  last24h?: {
    views: number;
    downloads: number;
    visitors: number;
    activeShares: number;
  };
  dailyTrend?: Array<{ date: string; views: number; downloads: number }>;
  trackingSince?: string | null;
  storageUsed: number;
  storageLimit: number;
  popularShares: Array<{
    id: string;
    name: string;
    views: number;
    downloads: number;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    details?: string | null;
    time: string;
  }>;
  userStats: Array<{
    username: string;
    shareCount: number;
    totalViews: number;
  }>;
}

interface StorageHealth {
  enabled: boolean;
  activeDownloads: number;
  queuedDownloads: number;
  activeSourceDownloads: number;
  recentFailures: number;
  recentFailuresByCode: Record<string, number>;
  sourceCache: {
    path: string;
    maxBytes: number;
    maxAgeMs: number;
    totalBytes: number;
    fileCount: number;
    activeDownloads: number;
    oldestMtime: string | null;
    newestMtime: string | null;
  };
}

interface StorageSlice {
  bytes: number;
  objects: number;
}

interface StorageBreakdown {
  enabled: boolean;
  generatedAt: string;
  cached: boolean;
  totalBytes: number;
  totalObjects: number;
  sourceFiles: StorageSlice;
  zips: StorageSlice;
  previews: StorageSlice;
  other: StorageSlice;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const AdminStats = () => {
  const { classes } = useStyles();
  const [stats, setStats] = useState<Stats | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const fetchStats = async () => {
    try {
      const [statsResponse, storageResponse, breakdownResponse] =
        await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/storage/health"),
          fetch("/api/admin/storage/breakdown"),
        ]);

      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setStats(data);
      } else {
        setStats({
          totalShares: 0,
          totalFiles: 0,
          totalUsers: 0,
          totalViews: 0,
          totalDownloads: 0,
          storageUsed: 0,
          storageLimit: 10 * 1024 * 1024 * 1024,
          popularShares: [],
          recentActivity: [],
          userStats: [],
        });
      }

      if (storageResponse.ok) {
        setStorageHealth(await storageResponse.json());
      }

      if (breakdownResponse.ok) {
        setBreakdown(await breakdownResponse.json());
      }
    } catch (e) {
      setStats({
        totalShares: 0,
        totalFiles: 0,
        totalUsers: 0,
        totalViews: 0,
        totalDownloads: 0,
        storageUsed: 0,
        storageLimit: 10 * 1024 * 1024 * 1024,
        popularShares: [],
        recentActivity: [],
        userStats: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const clearSourceCache = async () => {
    setIsClearingCache(true);
    try {
      await fetch("/api/admin/storage/source-cache", { method: "DELETE" });
      await fetchStats();
    } finally {
      setIsClearingCache(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Meta title="Admin Stats" />
        <Center style={{ height: "50vh" }}>
          <Loader />
        </Center>
      </>
    );
  }

  return (
    <>
      <Meta title="Admin Stats" />

      <Box className={classes.pageWrapper}>
        <Group position="apart" mb="xl">
          <Title order={2}>Platform Statistics</Title>
          <Button
            component={Link}
            href="/admin/logs"
            variant="outline"
            leftIcon={<TbList size={18} />}
            styles={(_theme) => ({
              root: {
                borderColor: "rgba(var(--ls-accent-rgb), 0.4)",
                color: "var(--ls-accent)",
                "&:hover": {
                  backgroundColor: "rgba(var(--ls-accent-rgb), 0.1)",
                  borderColor: "var(--ls-accent)",
                },
              },
            })}
          >
            Request Logs
          </Button>
        </Group>

        <SimpleGrid
          cols={4}
          spacing="lg"
          mb="xl"
          breakpoints={[
            { maxWidth: "lg", cols: 3 },
            { maxWidth: "md", cols: 2 },
            { maxWidth: "sm", cols: 1 },
          ]}
        >
          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={4}>
                <Text className={classes.statValue}>
                  {stats?.totalShares ?? 0}
                </Text>
                <Text className={classes.statLabel}>Total Shares</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbShare size={24} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>

          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={4}>
                <Text className={classes.statValue}>
                  {stats?.totalFiles ?? 0}
                </Text>
                <Text className={classes.statLabel}>Total Files</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbFiles size={24} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>

          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={4}>
                <Text className={classes.statValue}>
                  {stats?.totalUsers ?? 0}
                </Text>
                <Text className={classes.statLabel}>Total Users</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbUsers size={24} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>

          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={4}>
                <Text className={classes.statValue}>
                  {stats?.totalViews ?? 0}
                </Text>
                <Text className={classes.statLabel}>Total Views</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbEye size={24} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>
        </SimpleGrid>

        <Grid mb="xl">
          <Grid.Col span={12} md={4}>
            <Box className={classes.statCard}>
              <Group position="apart" align="flex-start">
                <Stack spacing={4}>
                  <Text className={classes.statValue}>
                    {stats?.totalDownloads ?? 0}
                  </Text>
                  <Text className={classes.statLabel}>Total Downloads</Text>
                </Stack>
                <Box className={classes.statIcon}>
                  <TbDownload size={24} color="var(--ls-accent)" />
                </Box>
              </Group>
            </Box>
          </Grid.Col>

          <Grid.Col span={12} md={4}>
            <Box className={classes.storageCard}>
              <Group position="apart" sx={{ width: "100%" }}>
                <Box>
                  <Text className={classes.sectionTitle} mb={0}>
                    Storage Usage
                  </Text>
                  <Text size="xl" weight={700}>
                    {formatBytes(
                      breakdown?.enabled
                        ? breakdown.totalBytes
                        : stats?.storageUsed ?? 0,
                    )}{" "}
                    used
                  </Text>
                  <Text size="sm" color="dimmed">
                    {breakdown?.enabled
                      ? `Everything in the bucket, including zips and previews`
                      : "Total stored across active files"}
                  </Text>
                </Box>
                <Box className={classes.statIcon}>
                  <TbServer size={24} color="var(--ls-accent)" />
                </Box>
              </Group>
            </Box>
          </Grid.Col>

        {breakdown?.enabled && (
          <Grid.Col span={12}>
            <Box className={classes.storageCard}>
              <Group position="apart" align="flex-start" sx={{ width: "100%" }}>
                <Box sx={{ width: "100%" }}>
                  <Group position="apart" align="baseline">
                    <Text className={classes.sectionTitle} mb={0}>
                      Storage Breakdown
                    </Text>
                    <Text size="xs" color="dimmed">
                      {breakdown.totalObjects.toLocaleString()} objects
                      {breakdown.cached ? " · cached" : ""}
                    </Text>
                  </Group>

                  <Text size="sm" color="dimmed" mb="md">
                    Zips and previews are regenerated from the source files, so
                    they can be cleared to reclaim space.
                  </Text>

                  {(
                    [
                      ["Source files", breakdown.sourceFiles, "var(--ls-accent)"],
                      ["Zips", breakdown.zips, "#f59e0b"],
                      ["Previews", breakdown.previews, "#38bdf8"],
                      ["Other", breakdown.other, "#8b8b8b"],
                    ] as [string, StorageSlice, string][]
                  ).map(([label, slice, color]) => {
                    const pct = breakdown.totalBytes
                      ? (slice.bytes / breakdown.totalBytes) * 100
                      : 0;
                    return (
                      <Box key={label} mb="sm">
                        <Group position="apart" spacing="xs" mb={4}>
                          <Text size="sm" weight={600}>
                            {label}
                          </Text>
                          <Text size="sm" color="dimmed">
                            {formatBytes(slice.bytes)} ·{" "}
                            {slice.objects.toLocaleString()} objects ·{" "}
                            {pct.toFixed(1)}%
                          </Text>
                        </Group>
                        <Box
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            background: "rgba(var(--ls-panel-border-rgb), 0.25)",
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            sx={{
                              width: `${Math.max(pct, pct > 0 ? 0.5 : 0)}%`,
                              height: "100%",
                              background: color,
                              borderRadius: 4,
                            }}
                          />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Group>
            </Box>
          </Grid.Col>
        )}

          <Grid.Col span={12} md={4}>
            <Box className={classes.storageCard}>
              <Group position="apart" sx={{ width: "100%" }} align="flex-start">
                <Box>
                  <Text className={classes.sectionTitle} mb={0}>
                    Source Cache
                  </Text>
                  <Text size="xl" weight={700}>
                    {formatBytes(storageHealth?.sourceCache.totalBytes ?? 0)}
                  </Text>
                  <Text size="sm" color="dimmed">
                    {storageHealth?.sourceCache.fileCount ?? 0} files ·{" "}
                    {storageHealth?.sourceCache.activeDownloads ?? 0} active
                  </Text>
                  <Group spacing="xs" mt="sm">
                    <Button
                      size="xs"
                      compact
                      variant="outline"
                      leftIcon={<TbRefresh size={14} />}
                      onClick={fetchStats}
                    >
                      Refresh
                    </Button>
                    <Button
                      size="xs"
                      compact
                      color="red"
                      variant="outline"
                      leftIcon={<TbTrash size={14} />}
                      loading={isClearingCache}
                      onClick={clearSourceCache}
                    >
                      Clear
                    </Button>
                  </Group>
                </Box>
                <Box className={classes.statIcon}>
                  <TbServer size={24} color="var(--ls-accent)" />
                </Box>
              </Group>
            </Box>
          </Grid.Col>
        </Grid>

        <Group position="apart" align="baseline" mb="sm">
          <Text className={classes.sectionTitle} mb={0}>
            Last 24 hours
          </Text>
          {stats?.trackingSince && (
            <Text size="xs" color="dimmed">
              Downloads &amp; the daily trend track from{" "}
              {new Date(stats.trackingSince).toLocaleString()}
            </Text>
          )}
        </Group>

        <SimpleGrid
          cols={4}
          spacing="lg"
          mb="xl"
          breakpoints={[
            { maxWidth: "md", cols: 2 },
            { maxWidth: "xs", cols: 1 },
          ]}
        >
          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={4}>
                <Text className={classes.statValue}>
                  {(stats?.last24h?.views ?? 0).toLocaleString()}
                </Text>
                <Text className={classes.statLabel}>Views (24h)</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbEye size={24} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>

          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={4}>
                <Text className={classes.statValue}>
                  {(stats?.last24h?.downloads ?? 0).toLocaleString()}
                </Text>
                <Text className={classes.statLabel}>Downloads (24h)</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbDownload size={24} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>

          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={4}>
                <Text className={classes.statValue}>
                  {(stats?.last24h?.visitors ?? 0).toLocaleString()}
                </Text>
                <Text className={classes.statLabel}>Approx. visitors (24h)</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbUsers size={24} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>

          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={4}>
                <Text className={classes.statValue}>
                  {(stats?.last24h?.activeShares ?? 0).toLocaleString()}
                </Text>
                <Text className={classes.statLabel}>Active shares (24h)</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbShare size={24} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>
        </SimpleGrid>

        {stats?.dailyTrend && stats.dailyTrend.length > 0 && (
          <Box className={classes.statCard} mb="xl">
            <Group position="apart" align="baseline" mb="md">
              <Text weight={600}>Daily activity - last 14 days</Text>
              <Group spacing="md">
                <Group spacing={6}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: "var(--ls-accent)",
                    }}
                  />
                  <Text size="xs" color="dimmed">
                    Views
                  </Text>
                </Group>
                <Group spacing={6}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: "#38bdf8",
                    }}
                  />
                  <Text size="xs" color="dimmed">
                    Downloads
                  </Text>
                </Group>
              </Group>
            </Group>

            {(() => {
              const trend = stats.dailyTrend;
              const max = Math.max(
                1,
                ...trend.map((d) => Math.max(d.views, d.downloads)),
              );
              return (
                <Group
                  spacing={8}
                  align="flex-end"
                  noWrap
                  sx={{ height: 140, overflowX: "auto" }}
                >
                  {trend.map((d) => (
                    <Stack
                      key={d.date}
                      spacing={4}
                      align="center"
                      sx={{ flex: 1, minWidth: 26 }}
                    >
                      <Group
                        spacing={2}
                        align="flex-end"
                        noWrap
                        sx={{ height: 104, width: "100%", justifyContent: "center" }}
                      >
                        <Box
                          title={`${d.views} views`}
                          sx={{
                            width: 9,
                            height: `${Math.round((d.views / max) * 100)}%`,
                            minHeight: d.views > 0 ? 2 : 0,
                            background: "var(--ls-accent)",
                            borderRadius: "2px 2px 0 0",
                          }}
                        />
                        <Box
                          title={`${d.downloads} downloads`}
                          sx={{
                            width: 9,
                            height: `${Math.round((d.downloads / max) * 100)}%`,
                            minHeight: d.downloads > 0 ? 2 : 0,
                            background: "#38bdf8",
                            borderRadius: "2px 2px 0 0",
                          }}
                        />
                      </Group>
                      <Text size={10} color="dimmed">
                        {d.date.slice(5)}
                      </Text>
                    </Stack>
                  ))}
                </Group>
              );
            })()}
          </Box>
        )}

        <Grid>
          <Grid.Col span={12} md={6}>
            <Text className={classes.sectionTitle}>Most Popular Shares</Text>
            <Box className={classes.tableWrapper}>
              {stats?.popularShares && stats.popularShares.length > 0 ? (
                <Table className={classes.table}>
                  <thead>
                    <tr>
                      <th>Share</th>
                      <th>Views</th>
                      <th>Downloads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.popularShares.map((share) => (
                      <tr key={share.id}>
                        <td>
                          <Text size="sm" weight={500} lineClamp={1}>
                            {share.name || share.id}
                          </Text>
                        </td>
                        <td>
                          <Group spacing={4}>
                            <TbEye size={14} style={{ opacity: 0.6 }} />
                            <Text size="sm">{share.views}</Text>
                          </Group>
                        </td>
                        <td>
                          <Group spacing={4}>
                            <TbDownload size={14} style={{ opacity: 0.6 }} />
                            <Text size="sm">{share.downloads}</Text>
                          </Group>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Box p="xl" ta="center">
                  <Text color="dimmed">No shares yet</Text>
                </Box>
              )}
            </Box>
          </Grid.Col>

          <Grid.Col span={12} md={6}>
            <Text className={classes.sectionTitle}>Top Users by Activity</Text>
            <Box className={classes.tableWrapper}>
              {stats?.userStats && stats.userStats.length > 0 ? (
                <Table className={classes.table}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Shares</th>
                      <th>Total Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.userStats.map((user, index) => (
                      <tr key={index}>
                        <td>
                          <Text size="sm" weight={500}>
                            {user.username}
                          </Text>
                        </td>
                        <td>
                          <Text size="sm">{user.shareCount}</Text>
                        </td>
                        <td>
                          <Text size="sm">{user.totalViews}</Text>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Box p="xl" ta="center">
                  <Text color="dimmed">No user activity yet</Text>
                </Box>
              )}
            </Box>
          </Grid.Col>
        </Grid>

        {stats?.recentActivity && stats.recentActivity.length > 0 && (
          <Box mt="xl">
            <Text className={classes.sectionTitle}>Recent Activity</Text>
            <Box className={classes.activityCard}>
              {stats.recentActivity.map((activity, index) => (
                <Box key={index} className={classes.activityItem}>
                  <Group position="apart">
                    <Group spacing="sm">
                      <TbChartBar size={16} style={{ opacity: 0.6 }} />
                      <Box>
                        <Text size="sm">{activity.description}</Text>
                        {activity.details && (
                          <Text size="xs" color="dimmed">
                            {activity.details}
                          </Text>
                        )}
                      </Box>
                    </Group>
                    <Text size="xs" color="dimmed">
                      {activity.time}
                    </Text>
                  </Group>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </>
  );
};

export default AdminStats;
