import {
  Badge,
  Box,
  Button,
  createStyles,
  Group,
  Loader,
  Pagination,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import {
  TbBan,
  TbClock,
  TbFilter,
  TbLockOpen,
  TbPlayerPlay,
  TbRefresh,
  TbSearch,
  TbShieldCheck,
  TbShieldOff,
  TbShieldSearch,
} from "react-icons/tb";
import Meta from "../../components/Meta";
import userService from "../../services/user.service";

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
    padding: 20,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 4px 24px rgba(0, 0, 0, 0.3)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },
  filterBar: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    padding: 16,
  },
  tableWrapper: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    overflow: "hidden",
  },
  table: {
    "& thead tr th": {
      backgroundColor:
        "rgba(var(--ls-panel-border-rgb), 0.05)",
      borderBottom: `1px solid rgba(var(--ls-panel-border-rgb), 0.1)`,
      padding: "10px 12px",
      fontWeight: 600,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    "& tbody tr td": {
      padding: "10px 12px",
      borderBottom: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.05)"
      }`,
      verticalAlign: "top",
    },
  },
}));

interface Summary {
  misses24h: number;
  throttles24h: number;
  autoBlocks24h: number;
  uniqueIps24h: number;
  blockedIps: number;
  rateLimitExemptIps: number;
  rateLimitExemptIpList: Array<{
    id: string;
    ipAddress: string;
    note?: string | null;
    createdAt: string;
  }>;
  suspiciousIps: Array<{
    ipAddress: string;
    misses: number;
    throttles: number;
    autoBlocks: number;
    uniqueShareIds: number;
    lastSeen: string;
    blocked: boolean;
    blockedIpId?: string | null;
    rateLimitExempt: boolean;
    rateLimitExemptId?: string | null;
  }>;
}

interface EventEntry {
  id: string;
  createdAt: string;
  ipAddress: string;
  method: string;
  path: string;
  shareId: string | null;
  fileId: string | null;
  outcome: "MISS" | "THROTTLED" | "AUTO_BLOCKED";
  reason: string | null;
  userAgent: string | null;
}

interface RecoverableShare {
  id: string;
  name: string | null;
  createdAt: string;
  editedAt: string;
  expiration: string;
  views: number;
  downloads: number;
  fileCount: number;
  creator: {
    id: string;
    username: string;
    email: string;
  } | null;
}

interface ScanQueueStatus {
  clamav: {
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
  queue: {
    active: number;
    queued: number;
    maxConcurrent: number;
    retryAttempts: number;
    retryBaseDelayMs: number;
    autoStartEnabled: boolean;
    queuedJobs: Array<{
      label: string;
      queuedAt: string;
      waitMs: number;
    }>;
    activeJobs: Array<{
      label: string;
      startedAt: string;
      elapsedMs: number;
    }>;
  };
  shares: {
    statusCounts: Record<string, number>;
    staleScanning: Array<{
      id: string;
      virusScanStartedAt: string | null;
      virusScanError: string | null;
    }>;
    failedScans: Array<{
      id: string;
      name: string | null;
      fileCount: number;
      virusScanCompletedAt: string | null;
      virusScanError: string | null;
    }>;
  };
  files: {
    statusCounts: Record<string, number>;
    staleScanning: Array<{
      id: string;
      shareId: string;
      name: string;
      virusScanStartedAt: string | null;
      virusScanError: string | null;
    }>;
    failedScans: Array<{
      id: string;
      shareId: string;
      name: string;
      virusScanCompletedAt: string | null;
      virusScanError: string | null;
    }>;
  };
}

const outcomeColor = (outcome: string) => {
  if (outcome === "AUTO_BLOCKED") return "red";
  if (outcome === "THROTTLED") return "orange";
  return "yellow";
};

const statusColor = (status: string) => {
  if (status === "clean") return "green";
  if (status === "scanning") return "blue";
  if (status === "too_large") return "yellow";
  if (status === "infected" || status === "failed") return "red";
  return "gray";
};

const statusLabel = (status: string) => {
  if (status === "too_large") return "too large";
  return status;
};

const renderStatusBadges = (counts?: Record<string, number>) => {
  const entries = Object.entries(counts || {}).filter(([, count]) => count > 0);
  if (entries.length === 0)
    return (
      <Text size="sm" color="dimmed">
        No scan records
      </Text>
    );

  return (
    <Group spacing={6}>
      {entries.map(([status, count]) => (
        <Badge key={status} color={statusColor(status)} variant="light">
          {statusLabel(status)}: {count}
        </Badge>
      ))}
    </Group>
  );
};

const formatElapsed = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
};

const AdminShareSecurity = () => {
  const { classes } = useStyles();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scanQueue, setScanQueue] = useState<ScanQueueStatus | null>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [recoverableShares, setRecoverableShares] = useState<
    RecoverableShare[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [ip, setIp] = useState("");
  const [shareId, setShareId] = useState("");
  const [blockingIp, setBlockingIp] = useState<string | null>(null);
  const [unblockingIp, setUnblockingIp] = useState<string | null>(null);
  const [exemptingIp, setExemptingIp] = useState<string | null>(null);
  const [removingExemptIp, setRemovingExemptIp] = useState<string | null>(null);
  const [restartingScans, setRestartingScans] = useState(false);
  const [startingAllScans, setStartingAllScans] = useState(false);
  const [recoveringShareId, setRecoveringShareId] = useState<string | null>(
    null,
  );

  const load = async (pageValue = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageValue),
        limit: "50",
      });

      if (outcome) params.set("outcome", outcome);
      if (ip.trim()) params.set("ip", ip.trim());
      if (shareId.trim()) params.set("shareId", shareId.trim());

      const [
        summaryResponse,
        scanQueueResponse,
        eventsResponse,
        recoveryResponse,
      ] =
        await Promise.all([
          fetch("/api/admin/share-security/summary"),
          fetch("/api/admin/share-security/scan-queue"),
          fetch(`/api/admin/share-security/events?${params.toString()}`),
          fetch("/api/admin/share-security/recoverable-shares"),
        ]);

      const summaryJson = await summaryResponse.json();
      const scanQueueJson = await scanQueueResponse.json();
      const eventsJson = await eventsResponse.json();
      const recoveryJson = await recoveryResponse.json();

      setSummary(summaryJson);
      setScanQueue(scanQueueJson);
      setEvents(eventsJson.events || []);
      setTotalPages(eventsJson.pagination?.totalPages || 1);
      setRecoverableShares(Array.isArray(recoveryJson) ? recoveryJson : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  const handleRefresh = async () => {
    await load(page);
  };

  const refreshScanQueue = async () => {
    const response = await fetch("/api/admin/share-security/scan-queue");
    if (response.ok) {
      setScanQueue(await response.json());
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshScanQueue();
    }, 2000);

    return () => window.clearInterval(timer);
  }, []);

  const handleSearch = async () => {
    setPage(1);
    await load(1);
  };

  const handleBlockIp = async (ipAddress: string) => {
    setBlockingIp(ipAddress);
    try {
      await userService.createBlockedIp({
        ipAddress,
        note: "Blocked from share security monitor",
      });
      await load(page);
    } finally {
      setBlockingIp(null);
    }
  };

  const handleUnblockIp = async (
    ipAddress: string,
    blockedIpId?: string | null,
  ) => {
    if (!blockedIpId) return;

    setUnblockingIp(ipAddress);
    try {
      await userService.deleteBlockedIp(blockedIpId);
      await load(page);
    } finally {
      setUnblockingIp(null);
    }
  };

  const handleExemptIp = async (ipAddress: string) => {
    setExemptingIp(ipAddress);
    try {
      const response = await fetch(
        "/api/admin/share-security/rate-limit-exemptions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ipAddress,
            note: "Rate-limit exception from share security monitor",
          }),
        },
      );

      if (!response.ok && response.status !== 409) {
        throw new Error("Failed to add rate-limit exception");
      }

      await load(page);
    } finally {
      setExemptingIp(null);
    }
  };

  const handleRemoveExemptIp = async (
    ipAddress: string,
    exemptionId?: string | null,
  ) => {
    if (!exemptionId) return;

    setRemovingExemptIp(ipAddress);
    try {
      const response = await fetch(
        `/api/admin/share-security/rate-limit-exemptions/${exemptionId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to remove rate-limit exception");
      }

      await load(page);
    } finally {
      setRemovingExemptIp(null);
    }
  };

  const handleRestartScans = async () => {
    setRestartingScans(true);
    try {
      const response = await fetch("/api/admin/share-security/restart-scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeFailed: true, includeStale: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to restart scans");
      }

      await load(page);
    } finally {
      setRestartingScans(false);
    }
  };

  const handleStartAllScans = async () => {
    setStartingAllScans(true);
    try {
      const response = await fetch("/api/admin/share-security/restart-scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeFailed: true,
          includeStale: true,
          includeNotScanned: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start scans");
      }

      await load(page);
    } finally {
      setStartingAllScans(false);
    }
  };

  const handleRecoverShare = async (targetShareId: string) => {
    setRecoveringShareId(targetShareId);
    try {
      const response = await fetch(
        `/api/admin/share-security/recoverable-shares/${targetShareId}/relock`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to recover share");
      }

      await load(page);
    } finally {
      setRecoveringShareId(null);
    }
  };

  return (
    <>
      <Meta title="Share Security" />
      <Stack spacing="lg" className={classes.pageWrapper}>
        <Group position="apart" align="center">
          <div>
            <Title order={2}>Share Security</Title>
            <Text color="dimmed">
              Monitor file virus scans, throttled lookup bursts, and
              auto-blocked IPs.
            </Text>
          </div>
          <Button
            leftIcon={<TbRefresh size={16} />}
            variant="light"
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Group>

        <SimpleGrid
          cols={6}
          breakpoints={[
            { maxWidth: "md", cols: 3 },
            { maxWidth: "sm", cols: 1 },
          ]}
        >
          <Box className={classes.statCard}>
            <Text size="xs" color="dimmed">
              Misses (24h)
            </Text>
            <Title order={3}>{summary?.misses24h ?? "-"}</Title>
          </Box>
          <Box className={classes.statCard}>
            <Text size="xs" color="dimmed">
              Throttles (24h)
            </Text>
            <Title order={3}>{summary?.throttles24h ?? "-"}</Title>
          </Box>
          <Box className={classes.statCard}>
            <Text size="xs" color="dimmed">
              Auto-blocks (24h)
            </Text>
            <Title order={3}>{summary?.autoBlocks24h ?? "-"}</Title>
          </Box>
          <Box className={classes.statCard}>
            <Text size="xs" color="dimmed">
              Unique IPs (24h)
            </Text>
            <Title order={3}>{summary?.uniqueIps24h ?? "-"}</Title>
          </Box>
          <Box className={classes.statCard}>
            <Text size="xs" color="dimmed">
              Blocked IPs
            </Text>
            <Title order={3}>{summary?.blockedIps ?? "-"}</Title>
          </Box>
          <Box className={classes.statCard}>
            <Text size="xs" color="dimmed">
              Rate-limit exceptions
            </Text>
            <Title order={3}>{summary?.rateLimitExemptIps ?? "-"}</Title>
          </Box>
        </SimpleGrid>

        <Box className={classes.tableWrapper}>
          <Box p="md">
            <Group position="apart" mb="sm" align="flex-start">
              <div>
                <Title order={4}>Virus Scan Queue</Title>
                <Text size="sm" color="dimmed">
                  Live queue state and file-based scan outcomes
                </Text>
              </div>
              <Group spacing={8}>
                <Badge
                  color={scanQueue?.clamav.active ? "green" : "red"}
                  variant="light"
                >
                  ClamAV {scanQueue?.clamav.active ? "active" : "offline"}
                </Badge>
                <Badge
                  color={scanQueue?.queue.autoStartEnabled ? "green" : "gray"}
                  variant="light"
                >
                  Auto-start {scanQueue?.queue.autoStartEnabled ? "on" : "off"}
                </Badge>
              </Group>
            </Group>

            <SimpleGrid
              cols={5}
              breakpoints={[
                { maxWidth: "md", cols: 2 },
                { maxWidth: "sm", cols: 1 },
              ]}
            >
              <Box className={classes.statCard}>
                <Text size="xs" color="dimmed">
                  ClamAV
                </Text>
                <Title order={3}>
                  {scanQueue?.clamav.active ? "Active" : "Offline"}
                </Title>
                <Text size="xs" color="dimmed">
                  {scanQueue?.clamav.initialized ? "Connected" : "Reconnecting"}
                </Text>
              </Box>
              <Box className={classes.statCard}>
                <Text size="xs" color="dimmed">
                  Active scans
                </Text>
                <Title order={3}>{scanQueue?.queue.active ?? "-"}</Title>
              </Box>
              <Box className={classes.statCard}>
                <Text size="xs" color="dimmed">
                  Queued scans
                </Text>
                <Title order={3}>{scanQueue?.queue.queued ?? "-"}</Title>
              </Box>
              <Box className={classes.statCard}>
                <Text size="xs" color="dimmed">
                  Concurrency
                </Text>
                <Title order={3}>{scanQueue?.queue.maxConcurrent ?? "-"}</Title>
              </Box>
              <Box className={classes.statCard}>
                <Text size="xs" color="dimmed">
                  Retries
                </Text>
                <Title order={3}>
                  {scanQueue
                    ? `${scanQueue.queue.retryAttempts} / ${scanQueue.queue.retryBaseDelayMs}ms`
                    : "-"}
                </Title>
              </Box>
            </SimpleGrid>

            <Stack spacing="xs" mt="md">
              <Group position="apart" align="flex-start">
                <Text size="sm" weight={600}>
                  Derived share statuses
                </Text>
                {renderStatusBadges(scanQueue?.shares.statusCounts)}
              </Group>
              <Group position="apart" align="flex-start">
                <Text size="sm" weight={600}>
                  File scan statuses
                </Text>
                {renderStatusBadges(scanQueue?.files.statusCounts)}
              </Group>
              {(scanQueue?.shares.statusCounts.too_large || 0) > 0 ||
              (scanQueue?.files.statusCounts.too_large || 0) > 0 ? (
                <Text size="xs" color="dimmed">
                  Too-large files are above the ClamAV limit and are not retried
                  by scan queue actions.
                </Text>
              ) : null}
              {scanQueue?.clamav.lastError ? (
                <Box mt="xs">
                  <Text
                    size="sm"
                    weight={600}
                    color={scanQueue.clamav.active ? "dimmed" : "red"}
                    mb={4}
                  >
                    ClamAV health
                  </Text>
                  <Text size="sm" color="dimmed">
                    {scanQueue.clamav.host}:{scanQueue.clamav.port} · failures:{" "}
                    {scanQueue.clamav.consecutiveFailures} · last good:{" "}
                    {scanQueue.clamav.lastSuccessfulAt
                      ? new Date(
                          scanQueue.clamav.lastSuccessfulAt,
                        ).toLocaleString()
                      : "-"}
                  </Text>
                  {!scanQueue.clamav.active ? (
                    <Text size="sm" color="red">
                      {scanQueue.clamav.lastError}
                    </Text>
                  ) : null}
                </Box>
              ) : null}
              {(scanQueue?.queue.activeJobs.length || 0) > 0 ? (
                <Box mt="xs">
                  <Text size="sm" weight={600} mb={6}>
                    Currently scanning
                  </Text>
                  <Stack spacing={4}>
                    {scanQueue?.queue.activeJobs.map((job) => (
                      <Group
                        key={`${job.label}-${job.startedAt}`}
                        position="apart"
                      >
                        <Text size="sm">{job.label}</Text>
                        <Text size="xs" color="dimmed">
                          {formatElapsed(job.elapsedMs)}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Box>
              ) : null}
              {(scanQueue?.queue.queuedJobs.length || 0) > 0 ? (
                <Box mt="xs">
                  <Text size="sm" weight={600} mb={6}>
                    Queued jobs
                  </Text>
                  <Stack spacing={4}>
                    {scanQueue?.queue.queuedJobs.map((job) => (
                      <Group
                        key={`${job.label}-${job.queuedAt}`}
                        position="apart"
                      >
                        <Text size="sm">{job.label}</Text>
                        <Text size="xs" color="dimmed">
                          {formatElapsed(job.waitMs)} waiting
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Box>
              ) : null}
              {(scanQueue?.shares.staleScanning.length || 0) > 0 ||
              (scanQueue?.files.staleScanning.length || 0) > 0 ? (
                <Box mt="xs">
                  <Text size="sm" weight={600} color="orange" mb={6}>
                    Stale scans over 1 hour
                  </Text>
                  <Stack spacing={4}>
                    {scanQueue?.shares.staleScanning.map((share) => (
                      <Text key={share.id} size="sm">
                        Share {share.id}
                      </Text>
                    ))}
                    {scanQueue?.files.staleScanning.map((file) => (
                      <Text key={file.id} size="sm">
                        File {file.shareId}/{file.id} · {file.name}
                      </Text>
                    ))}
                  </Stack>
                </Box>
              ) : null}
              {(scanQueue?.shares.failedScans?.length || 0) > 0 ||
              (scanQueue?.files.failedScans?.length || 0) > 0 ? (
                <Box mt="xs">
                  <Text size="sm" weight={600} color="red" mb={6}>
                    Failed scan records
                  </Text>
                  <Stack spacing={4}>
                    {scanQueue?.shares.failedScans?.map((share) => (
                      <Box key={share.id}>
                        <Text size="sm">
                          Share {share.id}
                          {share.name ? ` · ${share.name}` : ""} ·{" "}
                          {share.fileCount} file
                          {share.fileCount === 1 ? "" : "s"}
                        </Text>
                        <Text size="xs" color="dimmed">
                          {share.virusScanCompletedAt
                            ? new Date(
                                share.virusScanCompletedAt,
                              ).toLocaleString()
                            : "No completion time"}{" "}
                          · {share.virusScanError || "No error message"}
                        </Text>
                      </Box>
                    ))}
                    {scanQueue?.files.failedScans?.map((file) => (
                      <Box key={file.id}>
                        <Text size="sm">
                          File {file.shareId}/{file.id} · {file.name}
                        </Text>
                        <Text size="xs" color="dimmed">
                          {file.virusScanCompletedAt
                            ? new Date(
                                file.virusScanCompletedAt,
                              ).toLocaleString()
                            : "No completion time"}{" "}
                          · {file.virusScanError || "No error message"}
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : null}
              <Group position="right" mt="sm">
                <Button
                  leftIcon={<TbPlayerPlay size={16} />}
                  loading={startingAllScans}
                  onClick={handleStartAllScans}
                  disabled={
                    startingAllScans ||
                    restartingScans ||
                    !scanQueue ||
                    ((scanQueue.files.statusCounts.not_scanned || 0) === 0 &&
                      (scanQueue.files.statusCounts.failed || 0) === 0 &&
                      scanQueue.files.staleScanning.length === 0)
                  }
                >
                  Start All Pending Scans
                </Button>
                <Button
                  leftIcon={<TbRefresh size={16} />}
                  variant="light"
                  color="orange"
                  loading={restartingScans}
                  onClick={handleRestartScans}
                  disabled={
                    restartingScans ||
                    startingAllScans ||
                    !scanQueue ||
                    ((scanQueue.shares.statusCounts.failed || 0) === 0 &&
                      (scanQueue.files.statusCounts.failed || 0) === 0 &&
                      scanQueue.shares.staleScanning.length === 0 &&
                      scanQueue.files.staleScanning.length === 0)
                  }
                >
                  Restart Failed & Stale Scans
                </Button>
              </Group>
            </Stack>
          </Box>
        </Box>

        <Box className={classes.tableWrapper}>
          <Box p="md">
            <Group position="apart" mb="xs" align="flex-start">
              <div>
                <Title order={4}>Share Recovery</Title>
                <Text size="sm" color="dimmed">
                  Published shares can appear deleted if an edit leaves them
                  unlocked. Relock them here when files are still attached.
                </Text>
              </div>
              <Badge color={recoverableShares.length > 0 ? "orange" : "green"}>
                {recoverableShares.length} recoverable
              </Badge>
            </Group>
            <ScrollArea>
              <Table className={classes.table} verticalSpacing="sm">
                <thead>
                  <tr>
                    <th>Share</th>
                    <th>Owner</th>
                    <th>Files</th>
                    <th>Views</th>
                    <th>Downloads</th>
                    <th>Edited</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recoverableShares.map((share) => (
                    <tr key={share.id}>
                      <td>
                        <Text weight={600}>{share.name || "Untitled share"}</Text>
                        <Text size="xs" color="dimmed">
                          {share.id}
                        </Text>
                      </td>
                      <td>
                        <Text size="sm">
                          {share.creator?.username || "Unknown"}
                        </Text>
                        <Text size="xs" color="dimmed">
                          {share.creator?.email || "-"}
                        </Text>
                      </td>
                      <td>{share.fileCount}</td>
                      <td>{share.views}</td>
                      <td>{share.downloads}</td>
                      <td>{new Date(share.editedAt).toLocaleString()}</td>
                      <td>
                        <Button
                          size="xs"
                          variant="light"
                          leftIcon={<TbLockOpen size={14} />}
                          loading={recoveringShareId === share.id}
                          onClick={() => handleRecoverShare(share.id)}
                        >
                          Relock share
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {recoverableShares.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <Text size="sm" color="dimmed">
                          No stuck unlocked shares with files attached.
                        </Text>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </ScrollArea>
          </Box>
        </Box>

        <Box className={classes.filterBar}>
          <Group align="end">
            <TextInput
              icon={<TbSearch size={14} />}
              label="IP contains"
              placeholder="83.228"
              value={ip}
              onChange={(event) => setIp(event.currentTarget.value)}
            />
            <TextInput
              icon={<TbShieldSearch size={14} />}
              label="Share ID contains"
              placeholder="abc123"
              value={shareId}
              onChange={(event) => setShareId(event.currentTarget.value)}
            />
            <Select
              label="Outcome"
              placeholder="All outcomes"
              clearable
              value={outcome}
              onChange={setOutcome}
              data={[
                { label: "Miss", value: "MISS" },
                { label: "Throttled", value: "THROTTLED" },
                { label: "Auto-blocked", value: "AUTO_BLOCKED" },
              ]}
            />
            <Button leftIcon={<TbFilter size={14} />} onClick={handleSearch}>
              Apply
            </Button>
          </Group>
        </Box>

        <Box className={classes.tableWrapper}>
          <Box p="md">
            <Group position="apart" mb="xs">
              <Title order={4}>Suspicious IPs</Title>
              <Text size="sm" color="dimmed">
                Recent offenders from the last 24 hours
              </Text>
            </Group>
            <ScrollArea>
              <Table className={classes.table} verticalSpacing="sm">
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>Misses</th>
                    <th>Throttles</th>
                    <th>Auto-blocks</th>
                    <th>Unique IDs</th>
                    <th>Last Seen</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.suspiciousIps || []).map((entry) => (
                    <tr key={entry.ipAddress}>
                      <td>
                        <Text weight={600}>{entry.ipAddress}</Text>
                        {entry.blocked ? (
                          <Badge color="red" mt={6}>
                            Blocked
                          </Badge>
                        ) : null}
                        {entry.rateLimitExempt ? (
                          <Badge color="green" mt={6} ml={entry.blocked ? 6 : 0}>
                            Exempt
                          </Badge>
                        ) : null}
                      </td>
                      <td>{entry.misses}</td>
                      <td>{entry.throttles}</td>
                      <td>{entry.autoBlocks}</td>
                      <td>{entry.uniqueShareIds}</td>
                      <td>
                        <Group spacing={6}>
                          <TbClock size={14} />
                          <Text size="sm">
                            {new Date(entry.lastSeen).toLocaleString()}
                          </Text>
                        </Group>
                      </td>
                      <td>
                        <Group spacing={6}>
                          {entry.blocked ? (
                            <Button
                              size="xs"
                              variant="light"
                              loading={unblockingIp === entry.ipAddress}
                              leftIcon={<TbLockOpen size={14} />}
                              onClick={() =>
                                handleUnblockIp(
                                  entry.ipAddress,
                                  entry.blockedIpId,
                                )
                              }
                            >
                              Unblock
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              color="red"
                              variant="light"
                              loading={blockingIp === entry.ipAddress}
                              leftIcon={<TbBan size={14} />}
                              onClick={() => handleBlockIp(entry.ipAddress)}
                            >
                              Block IP
                            </Button>
                          )}
                          {entry.rateLimitExempt ? (
                            <Button
                              size="xs"
                              color="gray"
                              variant="light"
                              loading={removingExemptIp === entry.ipAddress}
                              leftIcon={<TbShieldOff size={14} />}
                              onClick={() =>
                                handleRemoveExemptIp(
                                  entry.ipAddress,
                                  entry.rateLimitExemptId,
                                )
                              }
                            >
                              Remove exception
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="light"
                              loading={exemptingIp === entry.ipAddress}
                              leftIcon={<TbShieldCheck size={14} />}
                              onClick={() => handleExemptIp(entry.ipAddress)}
                            >
                              Exception
                            </Button>
                          )}
                        </Group>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </ScrollArea>
          </Box>
        </Box>

        <Box className={classes.tableWrapper}>
          <Box p="md">
            <Group position="apart" mb="xs">
              <Title order={4}>Rate-limit Exceptions</Title>
              <Text size="sm" color="dimmed">
                These IPs skip share lookup throttling and auto-block checks.
              </Text>
            </Group>
            <ScrollArea>
              <Table className={classes.table} verticalSpacing="sm">
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>Note</th>
                    <th>Added</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.rateLimitExemptIpList || []).map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <Text weight={600}>{entry.ipAddress}</Text>
                      </td>
                      <td>
                        <Text size="sm" color="dimmed">
                          {entry.note || "-"}
                        </Text>
                      </td>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>
                        <Button
                          size="xs"
                          color="gray"
                          variant="light"
                          loading={removingExemptIp === entry.ipAddress}
                          leftIcon={<TbShieldOff size={14} />}
                          onClick={() =>
                            handleRemoveExemptIp(entry.ipAddress, entry.id)
                          }
                        >
                          Remove exception
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(summary?.rateLimitExemptIpList || []).length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <Text size="sm" color="dimmed">
                          No rate-limit exceptions yet.
                        </Text>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </ScrollArea>
          </Box>
        </Box>

        <Box className={classes.tableWrapper}>
          <Box p="md">
            <Group position="apart" mb="xs">
              <Title order={4}>Recent Share Security Events</Title>
              {loading ? <Loader size="sm" /> : null}
            </Group>
            <ScrollArea>
              <Table className={classes.table} verticalSpacing="sm">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Outcome</th>
                    <th>IP</th>
                    <th>Share ID</th>
                    <th>Path</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.createdAt).toLocaleString()}</td>
                      <td>
                        <Badge color={outcomeColor(event.outcome)}>
                          {event.outcome}
                        </Badge>
                      </td>
                      <td>{event.ipAddress}</td>
                      <td>{event.shareId || "-"}</td>
                      <td>
                        <Text size="sm">{event.path}</Text>
                      </td>
                      <td>
                        <Text size="sm" color="dimmed">
                          {event.reason || "-"}
                        </Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </ScrollArea>
            <Group position="apart" mt="md">
              <Text size="sm" color="dimmed">
                Admin-only feed of invalid share lookups, rate-limit bursts, and
                auto-block actions.
              </Text>
              <Pagination
                value={page}
                onChange={(value) => {
                  setPage(value);
                  load(value);
                }}
                total={totalPages}
              />
            </Group>
          </Box>
        </Box>
      </Stack>
    </>
  );
};

export default AdminShareSecurity;
