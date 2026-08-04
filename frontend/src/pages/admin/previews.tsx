import {
  Badge,
  Box,
  Button,
  createStyles,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { TbPlayerPlay, TbRefresh } from "react-icons/tb";
import Meta from "../../components/Meta";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";

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
    overflow: "hidden",
  },
  selectDropdown: {
    background:
      theme.colorScheme === "dark"
        ? "rgba(8, 16, 14, 0.99)"
        : "rgba(255, 255, 255, 0.99)",
    border: `1px solid rgba(var(--ls-panel-border-rgb), 0.22)`,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 18px 40px rgba(0, 0, 0, 0.55)"
        : "0 18px 40px rgba(0, 0, 0, 0.12)",
    zIndex: 1000,
  },
  selectItem: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[1] : theme.colors.dark[7],
    fontWeight: 600,

    "&[data-hovered]": {
      background:
        `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.12 : 0.08})`,
    },

    "&[data-selected]": {
      background:
        `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.18 : 0.12})`,
    },
  },
  table: {
    "& th": {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    "& td, & th": {
      padding: "10px 12px",
      borderBottom: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.06)"
      }`,
    },
  },
}));

type PreviewFile = {
  type: "video" | "audio";
  id: string;
  shareId: string;
  shareName: string | null;
  name: string;
  size: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
};

type PreviewStatus = {
  queue: {
    videoQueued: number;
    videoActive: boolean;
    metadataQueued: number;
    metadataActive: boolean;
  };
  video: {
    total: number;
    statusCounts: Record<string, number>;
    files: PreviewFile[];
  };
  audio: {
    total: number;
    statusCounts: Record<string, number>;
    files: PreviewFile[];
  };
};

const statusColor = (status: string) => {
  if (status === "ready") return "green";
  if (status === "processing") return "blue";
  if (status === "queued") return "yellow";
  if (status === "failed") return "red";
  return "gray";
};

const renderCounts = (counts: Record<string, number>) => (
  <Group spacing={6}>
    {Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => (
        <Badge key={status} color={statusColor(status)} variant="light">
          {status.replace("_", " ")}: {count}
        </Badge>
      ))}
  </Group>
);

const formatTime = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const PreviewProcessing = () => {
  const { classes } = useStyles();
  const [status, setStatus] = useState<PreviewStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [enqueueing, setEnqueueing] = useState(false);
  const [type, setType] = useState<"all" | "video" | "audio">("all");
  const [shareId, setShareId] = useState("");

  const load = async () => {
    const response = await fetch("/api/admin/previews/status");
    if (!response.ok) throw new Error("Failed to load preview status");
    setStatus(await response.json());
  };

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        await load();
      } catch {
        if (!cancelled) toast.error("Failed to load preview status");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const rows = useMemo(() => {
    const files = [
      ...(status?.video.files || []),
      ...(status?.audio.files || []),
    ];

    return files
      .filter((file) => type === "all" || file.type === type)
      .filter((file) => !shareId.trim() || file.shareId.includes(shareId.trim()))
      .sort((left, right) => {
        const score = (file: PreviewFile) =>
          file.status === "processing" ? 0 : file.status === "queued" ? 1 : file.status === "failed" ? 2 : 3;
        return score(left) - score(right);
      });
  }, [shareId, status, type]);

  const enqueue = async (includeReady = false) => {
    setEnqueueing(true);
    try {
      const response = await fetch("/api/admin/previews/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          includeReady,
          includeFailed: true,
          shareId: shareId.trim() || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to queue preview work");
      const result = await response.json();
      toast.success(`Queued ${result.queuedVideos} video and ${result.queuedAudio} audio jobs`);
      await load();
    } catch {
      toast.error("Failed to queue preview work");
    } finally {
      setEnqueueing(false);
    }
  };

  return (
    <>
      <Meta title="Preview Processing" />
      <Stack className={classes.pageWrapper} spacing="lg">
        <Group position="apart" align="center">
          <div>
            <Title order={2}>Preview Processing</Title>
            <Text color="dimmed">
              Monitor and queue video thumbnails, adaptive previews, and audio metadata.
            </Text>
          </div>
          <Button
            leftIcon={<TbRefresh size={16} />}
            variant="light"
            onClick={() => void load()}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>

        <SimpleGrid cols={4} breakpoints={[{ maxWidth: "sm", cols: 1 }]}>
          <Box className={classes.panel}>
            <Text size="xs" color="dimmed">Video files</Text>
            <Title order={3}>{status?.video.total ?? "-"}</Title>
            {renderCounts(status?.video.statusCounts || {})}
          </Box>
          <Box className={classes.panel}>
            <Text size="xs" color="dimmed">Audio files</Text>
            <Title order={3}>{status?.audio.total ?? "-"}</Title>
            {renderCounts(status?.audio.statusCounts || {})}
          </Box>
          <Box className={classes.panel}>
            <Text size="xs" color="dimmed">Video queue</Text>
            <Title order={3}>{status?.queue.videoQueued ?? "-"}</Title>
            <Badge color={status?.queue.videoActive ? "blue" : "gray"} variant="light">
              {status?.queue.videoActive ? "active" : "idle"}
            </Badge>
          </Box>
          <Box className={classes.panel}>
            <Text size="xs" color="dimmed">Audio metadata queue</Text>
            <Title order={3}>{status?.queue.metadataQueued ?? "-"}</Title>
            <Badge color={status?.queue.metadataActive ? "blue" : "gray"} variant="light">
              {status?.queue.metadataActive ? "active" : "idle"}
            </Badge>
          </Box>
        </SimpleGrid>

        <Box className={classes.panel}>
          <Group align="end">
            <Select
              label="Type"
              value={type}
              onChange={(value) => setType((value as "all" | "video" | "audio") || "all")}
              withinPortal
              dropdownPosition="bottom"
              classNames={{
                dropdown: classes.selectDropdown,
                item: classes.selectItem,
              }}
              data={[
                { value: "all", label: "All previews" },
                { value: "video", label: "Video previews" },
                { value: "audio", label: "Audio metadata" },
              ]}
            />
            <TextInput
              label="Share ID"
              placeholder="Optional"
              value={shareId}
              onChange={(event) => setShareId(event.currentTarget.value)}
            />
            <Button
              leftIcon={<TbPlayerPlay size={16} />}
              onClick={() => void enqueue(false)}
              loading={enqueueing}
            >
              Push Missing / Failed
            </Button>
            <Button
              variant="light"
              color="orange"
              onClick={() => void enqueue(true)}
              loading={enqueueing}
            >
              Force Rebuild All
            </Button>
          </Group>
        </Box>

        <Box className={classes.panel}>
          <Table className={classes.table} verticalSpacing="sm">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>File</th>
                <th>Share</th>
                <th>Size</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((file) => (
                <tr key={`${file.type}-${file.id}`}>
                  <td>{file.type}</td>
                  <td>
                    <Badge color={statusColor(file.status)} variant="light">
                      {file.status}
                    </Badge>
                  </td>
                  <td>
                    <Text weight={600} lineClamp={1}>{file.name}</Text>
                    <Text size="xs" color="dimmed">{file.id}</Text>
                  </td>
                  <td>
                    <Text lineClamp={1}>{file.shareName || file.shareId}</Text>
                    <Text size="xs" color="dimmed">{file.shareId}</Text>
                  </td>
                  <td>{byteToHumanSizeString(Number(file.size || 0))}</td>
                  <td>{formatTime(file.startedAt)}</td>
                  <td>{formatTime(file.completedAt)}</td>
                  <td>
                    <Text size="xs" color={file.error ? "red" : "dimmed"} lineClamp={2}>
                      {file.error || "-"}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      </Stack>
    </>
  );
};

export default PreviewProcessing;
