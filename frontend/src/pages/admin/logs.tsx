import {
  Badge,
  Box,
  Button,
  Center,
  createStyles,
  Grid,
  Group,
  Loader,
  Modal,
  Pagination,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useEffect, useState } from "react";
import {
  TbActivity,
  TbBrowser,
  TbClock,
  TbDeviceDesktop,
  TbDeviceMobile,
  TbDeviceTablet,
  TbFilter,
  TbNetwork,
  TbRefresh,
  TbRobot,
  TbSearch,
  TbServer,
  TbTrash,
  TbWorld,
} from "react-icons/tb";
import Meta from "../../components/Meta";

const useStyles = createStyles((theme) => ({
  pageWrapper: {
    position: "relative",
  },

  statCard: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    padding: 20,
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(var(--ls-panel-border-rgb), 0.1)",
  },

  statValue: {
    fontSize: 24,
    fontWeight: 700,
    color: theme.colorScheme === "dark" ? "#fff" : theme.colors.dark[8],
    lineHeight: 1.2,
  },

  statLabel: {
    fontSize: 12,
    color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[6],
    fontWeight: 500,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
    color: theme.colorScheme === "dark" ? "#fff" : theme.colors.dark[8],
  },

  tableWrapper: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    overflow: "hidden",
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  table: {
    "& thead tr th": {
      backgroundColor: "rgba(var(--ls-panel-border-rgb), 0.05)",
      borderBottom: `1px solid rgba(var(--ls-panel-border-rgb), 0.1)`,
      padding: "10px 12px",
      fontWeight: 600,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color: theme.colorScheme === "dark" ? theme.colors.gray[3] : theme.colors.gray[7],
    },
    "& tbody tr": {
      transition: "background-color 0.15s ease",
      "&:hover": {
        backgroundColor: `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.05 : 0.04})`,
      },
    },
    "& tbody tr td": {
      padding: "10px 12px",
      borderBottom: `1px solid ${theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.05)"}`,
      fontSize: 13,
    },
    "& tbody tr:last-of-type td": {
      borderBottom: "none",
    },
  },

  filterBar: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    padding: 16,
    marginBottom: 16,
  },

  chartCard: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    padding: 20,
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  barItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderBottom: `1px solid ${theme.colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.05)"
      : "rgba(0, 0, 0, 0.05)"}`,
    "&:last-of-type": {
      borderBottom: "none",
    },
  },

  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(var(--ls-accent-rgb), 0.3)",
    transition: "width 0.3s ease",
  },

  deleteButton: {
    color: theme.colors.red[6],
    "&:hover": {
      backgroundColor: theme.colorScheme === "dark"
        ? "rgba(239, 68, 68, 0.15)"
        : "rgba(239, 68, 68, 0.1)",
    },
  },
}));

interface LogEntry {
  id: string;
  createdAt: string;
  ipAddress: string;
  method: string;
  path: string;
  statusCode: number | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  userId: string | null;
  username: string | null;
  responseTime: number | null;
}

interface LogsSummary {
  totalLogs: number;
  logs24h: number;
  logs7d: number;
  uniqueIps24h: number;
  errorRate24h: string;
  topIps: Array<{ ipAddress: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
  browsers: Array<{ name: string; count: number }>;
  operatingSystems: Array<{ name: string; count: number }>;
  devices: Array<{ name: string; count: number }>;
}

interface LogsResponse {
  logs: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const getStatusBadgeColor = (status: number | null): string => {
  if (!status) return "gray";
  if (status >= 500) return "red";
  if (status >= 400) return "orange";
  if (status >= 300) return "blue";
  if (status >= 200) return "green";
  return "gray";
};

const getDeviceIcon = (device: string | null) => {
  switch (device) {
    case "Mobile":
      return <TbDeviceMobile size={14} />;
    case "Tablet":
      return <TbDeviceTablet size={14} />;
    case "Bot":
      return <TbRobot size={14} />;
    default:
      return <TbDeviceDesktop size={14} />;
  }
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString();
};

const AdminLogs = () => {
  const { classes } = useStyles();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<LogsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [ipFilter, setIpFilter] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState<string | null>(null);

  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearDays, setClearDays] = useState("30");

  const fetchSummary = async () => {
    try {
      const response = await fetch("/api/admin/logs/summary");
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (e) {
      console.error("Failed to fetch logs summary:", e);
    }
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });

      if (ipFilter) params.append("ip", ipFilter);
      if (pathFilter) params.append("path", pathFilter);
      if (methodFilter) params.append("method", methodFilter);

      const response = await fetch(`/api/admin/logs?${params}`);
      if (response.ok) {
        const data: LogsResponse = await response.json();
        setLogs(data.logs);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const clearOldLogs = async () => {
    try {
      const response = await fetch(`/api/admin/logs/clear?olderThanDays=${clearDays}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setClearModalOpen(false);
        fetchLogs();
        fetchSummary();
      }
    } catch (e) {
      console.error("Failed to clear logs:", e);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, ipFilter, pathFilter, methodFilter]);

  const maxCount = summary?.topIps[0]?.count || 1;

  if (isLoading && !logs.length) {
    return (
      <>
        <Meta title="Request Logs" />
        <Center style={{ height: "50vh" }}>
          <Loader />
        </Center>
      </>
    );
  }

  return (
    <>
      <Meta title="Request Logs" />

      <Box className={classes.pageWrapper}>
        <Group position="apart" mb="xl">
          <Title order={2}>Request Logs</Title>
          <Group spacing="sm">
            <Button
              variant="subtle"
              leftIcon={<TbRefresh size={16} />}
              onClick={() => {
                fetchLogs();
                fetchSummary();
              }}
            >
              Refresh
            </Button>
            <Button
              variant="subtle"
              color="red"
              leftIcon={<TbTrash size={16} />}
              onClick={() => setClearModalOpen(true)}
            >
              Clear Old Logs
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={5} spacing="md" mb="xl" breakpoints={[
          { maxWidth: "xl", cols: 5 },
          { maxWidth: "lg", cols: 3 },
          { maxWidth: "md", cols: 2 },
          { maxWidth: "sm", cols: 1 },
        ]}>
          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={2}>
                <Text className={classes.statValue}>{summary?.totalLogs ?? 0}</Text>
                <Text className={classes.statLabel}>Total Requests</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbServer size={20} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>

          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={2}>
                <Text className={classes.statValue}>{summary?.logs24h ?? 0}</Text>
                <Text className={classes.statLabel}>Last 24 Hours</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbClock size={20} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>

          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={2}>
                <Text className={classes.statValue}>{summary?.uniqueIps24h ?? 0}</Text>
                <Text className={classes.statLabel}>Unique IPs (24h)</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbNetwork size={20} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>

          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={2}>
                <Text className={classes.statValue}>{summary?.logs7d ?? 0}</Text>
                <Text className={classes.statLabel}>Last 7 Days</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbActivity size={20} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>

          <Box className={classes.statCard}>
            <Group position="apart" align="flex-start">
              <Stack spacing={2}>
                <Text className={classes.statValue}>{summary?.errorRate24h ?? "0"}%</Text>
                <Text className={classes.statLabel}>Error Rate (24h)</Text>
              </Stack>
              <Box className={classes.statIcon}>
                <TbWorld size={20} color="var(--ls-accent)" />
              </Box>
            </Group>
          </Box>
        </SimpleGrid>

        <Grid mb="xl">
          <Grid.Col span={12} md={4}>
            <Box className={classes.chartCard}>
              <Text className={classes.sectionTitle}>Top IPs (7 days)</Text>
              {summary?.topIps.slice(0, 5).map((ip, i) => (
                <Box key={i} className={classes.barItem}>
                  <Text size="xs" style={{ minWidth: 120, fontFamily: "monospace" }}>
                    {ip.ipAddress.length > 15 ? ip.ipAddress.slice(0, 15) + "..." : ip.ipAddress}
                  </Text>
                  <Box style={{ flex: 1 }}>
                    <Box
                      className={classes.bar}
                      style={{ width: `${(ip.count / maxCount) * 100}%` }}
                    />
                  </Box>
                  <Text size="xs" color="dimmed">{ip.count}</Text>
                </Box>
              ))}
              {(!summary?.topIps || summary.topIps.length === 0) && (
                <Text size="sm" color="dimmed">No data yet</Text>
              )}
            </Box>
          </Grid.Col>

          <Grid.Col span={12} md={4}>
            <Box className={classes.chartCard}>
              <Text className={classes.sectionTitle}>Browsers (7 days)</Text>
              {summary?.browsers.slice(0, 5).map((browser, i) => (
                <Box key={i} className={classes.barItem}>
                  <Group spacing={8}>
                    <TbBrowser size={14} style={{ opacity: 0.6 }} />
                    <Text size="xs">{browser.name}</Text>
                  </Group>
                  <Text size="xs" color="dimmed" ml="auto">{browser.count}</Text>
                </Box>
              ))}
              {(!summary?.browsers || summary.browsers.length === 0) && (
                <Text size="sm" color="dimmed">No data yet</Text>
              )}
            </Box>
          </Grid.Col>

          <Grid.Col span={12} md={4}>
            <Box className={classes.chartCard}>
              <Text className={classes.sectionTitle}>Devices (7 days)</Text>
              {summary?.devices.map((device, i) => (
                <Box key={i} className={classes.barItem}>
                  <Group spacing={8}>
                    {getDeviceIcon(device.name)}
                    <Text size="xs">{device.name}</Text>
                  </Group>
                  <Text size="xs" color="dimmed" ml="auto">{device.count}</Text>
                </Box>
              ))}
              {(!summary?.devices || summary.devices.length === 0) && (
                <Text size="sm" color="dimmed">No data yet</Text>
              )}
            </Box>
          </Grid.Col>
        </Grid>

        <Box className={classes.filterBar}>
          <Group>
            <TbFilter size={18} style={{ opacity: 0.6 }} />
            <TextInput
              placeholder="Filter by IP"
              size="sm"
              value={ipFilter}
              onChange={(e) => {
                setIpFilter(e.target.value);
                setPage(1);
              }}
              icon={<TbSearch size={14} />}
              style={{ width: 160 }}
            />
            <TextInput
              placeholder="Filter by path"
              size="sm"
              value={pathFilter}
              onChange={(e) => {
                setPathFilter(e.target.value);
                setPage(1);
              }}
              icon={<TbSearch size={14} />}
              style={{ width: 160 }}
            />
            <Select
              placeholder="Method"
              size="sm"
              value={methodFilter}
              onChange={(value) => {
                setMethodFilter(value);
                setPage(1);
              }}
              data={[
                { value: "", label: "All Methods" },
                { value: "GET", label: "GET" },
                { value: "POST", label: "POST" },
                { value: "PUT", label: "PUT" },
                { value: "PATCH", label: "PATCH" },
                { value: "DELETE", label: "DELETE" },
              ]}
              style={{ width: 120 }}
              clearable
            />
            <Text size="sm" color="dimmed" ml="auto">
              {total.toLocaleString()} total logs
            </Text>
          </Group>
        </Box>

        <Box className={classes.tableWrapper}>
          <ScrollArea>
            <Table className={classes.table}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>IP Address</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Device</th>
                  <th>Browser / OS</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <Text size="xs" color="dimmed">
                        {formatDate(log.createdAt)}
                      </Text>
                    </td>
                    <td>
                      <Text size="xs" style={{ fontFamily: "monospace" }}>
                        {log.ipAddress}
                      </Text>
                    </td>
                    <td>
                      <Badge
                        size="xs"
                        variant="outline"
                        color={log.method === "GET" ? "blue" : log.method === "POST" ? "green" : "orange"}
                      >
                        {log.method}
                      </Badge>
                    </td>
                    <td>
                      <Tooltip label={log.path} disabled={log.path.length < 40}>
                        <Text size="xs" lineClamp={1} style={{ maxWidth: 200 }}>
                          {log.path}
                        </Text>
                      </Tooltip>
                    </td>
                    <td>
                      <Badge size="xs" color={getStatusBadgeColor(log.statusCode)}>
                        {log.statusCode ?? "-"}
                      </Badge>
                    </td>
                    <td>
                      <Group spacing={4}>
                        {getDeviceIcon(log.device)}
                        <Text size="xs">{log.device}</Text>
                      </Group>
                    </td>
                    <td>
                      <Text size="xs" color="dimmed">
                        {log.browser} / {log.os}
                      </Text>
                    </td>
                    <td>
                      <Text size="xs" color="dimmed">
                        {log.responseTime ? `${log.responseTime}ms` : "-"}
                      </Text>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <Text ta="center" color="dimmed" py="xl">
                        No logs found
                      </Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </ScrollArea>
        </Box>

        {totalPages > 1 && (
          <Group position="center" mt="lg">
            <Pagination
              value={page}
              onChange={setPage}
              total={totalPages}
            />
          </Group>
        )}
      </Box>

      <Modal
        opened={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title="Clear Old Logs"
        centered
      >
        <Stack>
          <Text size="sm">
            This will permanently delete logs older than the specified number of days.
          </Text>
          <Select
            label="Delete logs older than"
            value={clearDays}
            onChange={(value) => setClearDays(value || "30")}
            data={[
              { value: "7", label: "7 days" },
              { value: "14", label: "14 days" },
              { value: "30", label: "30 days" },
              { value: "60", label: "60 days" },
              { value: "90", label: "90 days" },
            ]}
          />
          <Group position="right" mt="md">
            <Button variant="subtle" onClick={() => setClearModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={clearOldLogs}>
              Delete Logs
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default AdminLogs;
