import {
  Box,
  Button,
  createStyles,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Badge,
  Loader,
  Table,
  Progress,
  Pagination,
  ScrollArea,
  Alert,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState, useEffect, useRef } from "react";
import {
  TbRefresh,
  TbFileZip,
  TbAlertCircle,
  TbCheck,
  TbX,
  TbClock,
} from "react-icons/tb";
import axios from "axios";

const useStyles = createStyles((theme) => ({
  pageWrapper: {
    minHeight: "calc(100vh - 180px)",
  },

  panel: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.14 : 0.18})`,
    padding: theme.spacing.lg,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(var(--ls-accent-rgb), 0.05)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  statValue: {
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1,
    marginTop: 6,
  },

  table: {
    "& thead th": {
      backgroundColor:
        "rgba(var(--ls-panel-border-rgb), 0.05)",
      borderBottom: `1px solid rgba(var(--ls-panel-border-rgb), 0.1)`,
    },
    "& tbody td": {
      borderBottom: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.05)"
      }`,
    },
  },
}));

interface ZipStatus {
  summary: {
    totalShares: number;
    sharesWithZips: number;
    multiFileShares: number;
    sharesNeedingZips: number;
    percentComplete: number;
  };
  regen?: {
    running: boolean;
    total: number;
    processed: number;
    successful: number;
    failed: number;
    startedAt: string | null;
    finishedAt: string | null;
  };
  sharesNeedingZips: Array<{
    id: string;
    name: string;
    fileCount: number;
    sizeMB: string;
    createdAt: string;
  }>;
}

const PAGE_SIZE = 25;

export default function AdminZipManagement() {
  const { classes } = useStyles();

  const [status, setStatus] = useState<ZipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const wasRunning = useRef(false);

  const loadStatus = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await axios.get("/api/shares/admin/zip-status");
      const data: ZipStatus = response.data;

      if (wasRunning.current && !data.regen?.running) {
        const ok = data.regen?.successful ?? 0;
        const failed = data.regen?.failed ?? 0;
        notifications.show({
          title: "Zip regeneration complete",
          message: `${ok} succeeded${failed ? `, ${failed} failed` : ""}.`,
          color: failed ? "orange" : "green",
          icon: failed ? <TbAlertCircle size={20} /> : <TbCheck size={20} />,
        });
      }
      wasRunning.current = !!data.regen?.running;

      setStatus(data);
    } catch (error) {
      if (!silent) {
        notifications.show({
          title: "Error",
          message: "Failed to load zip status",
          color: "red",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const needing = status?.sharesNeedingZips ?? [];
  const totalPages = Math.max(1, Math.ceil(needing.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = needing.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!status?.regen?.running) return;
    const timer = setInterval(() => void loadStatus(true), 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.regen?.running]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const regenerateAllZips = async () => {
    if (submitting || status?.regen?.running) return;
    setSubmitting(true);
    try {
      const response = await axios.post("/api/shares/admin/regenerate-zips");

      notifications.show({
        title: response.data.alreadyRunning
          ? "Already running"
          : "Regeneration started",
        message: response.data.message,
        color: "blue",
        icon: <TbFileZip size={20} />,
        autoClose: 5000,
      });

      if (response.data.total > 0) wasRunning.current = true;
      await loadStatus(true);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to start zip regeneration",
        color: "red",
        icon: <TbX size={20} />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const regenerateSingleZip = async (shareId: string) => {
    try {
      setRegeneratingId(shareId);

      notifications.show({
        id: `regenerate-${shareId}`,
        title: "Starting Regeneration",
        message: `Creating zip for ${shareId}...`,
        color: "blue",
        loading: true,
        autoClose: false,
      });

      await axios.post(`/api/shares/admin/${shareId}/regenerate-zip`);

      notifications.update({
        id: `regenerate-${shareId}`,
        title: "Success",
        message: `Zip creation triggered for ${shareId}`,
        color: "green",
        loading: false,
        autoClose: 3000,
        icon: <TbCheck size={20} />,
      });

      setTimeout(() => {
        loadStatus();
      }, 2000);
    } catch (error) {
      notifications.update({
        id: `regenerate-${shareId}`,
        title: "Error",
        message: `Failed to regenerate zip for ${shareId}`,
        color: "red",
        loading: false,
        autoClose: 5000,
        icon: <TbX size={20} />,
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  if (loading) {
    return (
      <Stack
        className={classes.pageWrapper}
        align="center"
        spacing="lg"
        style={{ paddingTop: 100 }}
      >
        <Loader size="xl" />
        <Text color="dimmed">Loading zip status...</Text>
      </Stack>
    );
  }

  return (
    <Stack className={classes.pageWrapper} spacing="lg">
      <Group position="apart" align="center">
        <div>
          <Title order={2}>Zip Management</Title>
          <Text color="dimmed">Manage and regenerate share zip archives</Text>
        </div>
        <Group>
          <Button
            variant="light"
            leftIcon={<TbRefresh size={16} />}
            onClick={() => loadStatus()}
          >
            Refresh
          </Button>
          <Button
            leftIcon={<TbFileZip size={16} />}
            onClick={regenerateAllZips}
            loading={submitting || status?.regen?.running}
            disabled={!status || status.summary.sharesNeedingZips === 0}
          >
            {status?.regen?.running ? "Regenerating…" : "Regenerate All Zips"}
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={4} breakpoints={[{ maxWidth: "sm", cols: 2 }]}>
        <Box className={classes.panel}>
          <Text size="xs" color="dimmed">
            Total Shares
          </Text>
          <Text className={classes.statValue}>{status?.summary.totalShares || 0}</Text>
        </Box>
        <Box className={classes.panel}>
          <Text size="xs" color="dimmed">
            Multi-File Shares
          </Text>
          <Text className={classes.statValue}>
            {status?.summary.multiFileShares || 0}
          </Text>
        </Box>
        <Box className={classes.panel}>
          <Text size="xs" color="dimmed">
            Zips Ready
          </Text>
          <Text className={classes.statValue} color="green">
            {status?.summary.sharesWithZips || 0}
          </Text>
        </Box>
        <Box className={classes.panel}>
          <Text size="xs" color="dimmed">
            Needs Zips
          </Text>
          <Text className={classes.statValue} color="orange">
            {status?.summary.sharesNeedingZips || 0}
          </Text>
        </Box>
      </SimpleGrid>

      <Box className={classes.panel}>
        <Group position="apart" mb="xs">
          <Text size="sm" weight={500}>
            Completion Progress
          </Text>
          <Text size="sm" weight={600} color="green">
            {status?.summary.percentComplete || 0}%
          </Text>
        </Group>
        <Progress
          value={status?.summary.percentComplete || 0}
          size="lg"
          radius="xl"
          color="green"
        />
      </Box>

      {status && status.summary.sharesNeedingZips > 0 && (
        <Alert
          icon={<TbAlertCircle size={16} />}
          title="Action Required"
          color="orange"
        >
          {status.summary.sharesNeedingZips} share
          {status.summary.sharesNeedingZips > 1 ? "s" : ""} with multiple files do not
          have zip archives. Click "Regenerate All Zips" to create them.
        </Alert>
      )}

      {status?.regen?.running && (
        <Box className={classes.panel}>
          <Group position="apart" mb="xs">
            <Text weight={600} size="lg">
              Regenerating zips…
            </Text>
            <Badge color="blue" size="lg">
              {status.regen.processed}/{status.regen.total}
            </Badge>
          </Group>
          <Progress
            value={
              status.regen.total
                ? (status.regen.processed / status.regen.total) * 100
                : 0
            }
            size="lg"
            radius="xl"
            color="blue"
            striped
            animate
          />
          <Text size="sm" color="dimmed" mt="xs">
            {status.regen.successful} succeeded
            {status.regen.failed ? `, ${status.regen.failed} failed` : ""} · this
            runs in the background - you can leave this page.
          </Text>
        </Box>
      )}

      <Box className={classes.panel}>
        <Group position="apart" mb="md">
          <Text weight={600} size="lg">
            Shares Needing Zips
          </Text>
          <Badge color="orange" size="lg">
            {status?.sharesNeedingZips.length || 0} shares
          </Badge>
        </Group>

        {status && status.sharesNeedingZips.length > 0 ? (
          <>
            <ScrollArea>
              <Table className={classes.table}>
                <thead>
                  <tr>
                    <th>Share ID</th>
                    <th>Name</th>
                    <th>Files</th>
                    <th>Size</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((share) => (
                    <tr key={share.id}>
                    <td>
                      <Text size="sm" weight={500}>
                        {share.id}
                      </Text>
                    </td>
                    <td>
                      <Text size="sm">{share.name || "-"}</Text>
                    </td>
                    <td>
                      <Badge variant="light" color="green">
                        {share.fileCount}
                      </Badge>
                    </td>
                    <td>
                      <Text size="sm" color="dimmed">
                        {share.sizeMB} MB
                      </Text>
                    </td>
                    <td>
                      <Text size="sm" color="dimmed">
                        {new Date(share.createdAt).toLocaleDateString()}
                      </Text>
                    </td>
                    <td>
                      <Tooltip label="Regenerate zip for this share">
                        <ActionIcon
                          variant="light"
                          onClick={() => regenerateSingleZip(share.id)}
                          loading={regeneratingId === share.id}
                        >
                          <TbRefresh size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
                </tbody>
              </Table>
            </ScrollArea>
            {totalPages > 1 && (
              <Group position="apart" mt="md">
                <Text size="sm" color="dimmed">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}-
                  {Math.min(safePage * PAGE_SIZE, needing.length)} of {needing.length}
                </Text>
                <Pagination value={safePage} onChange={setPage} total={totalPages} />
              </Group>
            )}
          </>
        ) : (
          <Alert icon={<TbCheck size={16} />} title="All Done!" color="green">
            All multi-file shares have zip archives ready.
          </Alert>
        )}
      </Box>

      <Alert icon={<TbClock size={16} />} title="Note" color="blue">
        Zip creation runs in the background. Large shares may take several minutes.
        Refresh the page to see updated status.
      </Alert>
    </Stack>
  );
}
