import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Container,
  Group,
  Loader,
  Pagination,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  createStyles,
} from "@mantine/core";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { TbAlertCircle, TbCheck, TbDownload, TbEye, TbSearch } from "react-icons/tb";
import Meta from "../components/Meta";
import useConfig from "../hooks/config.hook";
import useUser from "../hooks/user.hook";
import api from "../services/api.service";

const useStyles = createStyles((theme) => ({
  panel: {
    background: `rgba(var(--ls-panel-bg-rgb), ${
      theme.colorScheme === "dark" ? 0.6 : 0.85
    })`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${
      theme.colorScheme === "dark" ? 0.1 : 0.15
    })`,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 4px 24px rgba(0, 0, 0, 0.3)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  table: {
    "& thead tr th": {
      backgroundColor: "rgba(var(--ls-panel-border-rgb), 0.05)",
      borderBottom: "1px solid rgba(var(--ls-panel-border-rgb), 0.1)",
      padding: "14px 16px",
      fontWeight: 600,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color:
        theme.colorScheme === "dark"
          ? theme.colors.gray[3]
          : theme.colors.gray[7],
    },
    "& tbody tr td": {
      padding: "12px 16px",
      borderBottom: "1px solid rgba(var(--ls-panel-border-rgb), 0.06)",
    },
    "& tbody tr:last-of-type td": { borderBottom: "none" },
  },

  accentTitle: {
    letterSpacing: "-0.02em",
    "& span": { color: "var(--ls-accent)" },
  },
}));

type ExportShare = {
  id: string;
  name: string | null;
  displayName: string;
  description: string | null;
  createdAt: string;
  fileCount: number;
  size: number;
  sizeLabel: string;
};

type ExportBatch = {
  index: number;
  shareCount: number;
  bytes: number;
  sizeLabel: string;
};

type BatchInfo = {
  userId: string;
  username: string;
  totalBytes: number;
  totalSizeLabel: string;
  batches: ExportBatch[];
};

const PAGE_SIZE = 25;

const humanSize = (bytes: number) => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

const ExportPage = () => {
  const router = useRouter();
  const { user } = useUser();
  const { classes } = useStyles();
  const config = useConfig();
  const appName = config.get("general.appName") || "This site";

  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState<ExportShare[]>([]);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [startedParts, setStartedParts] = useState<Set<number>>(new Set());
  const [limitBytes, setLimitBytes] = useState(2 * 1024 * 1024 * 1024);
  const [limitShares, setLimitShares] = useState(500);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewUser =
    typeof router.query.previewUser === "string" ? router.query.previewUser : "";
  const forUserQS = previewUser
    ? `?forUser=${encodeURIComponent(previewUser)}`
    : "";

  useEffect(() => {
    if (user === null && router.isReady) {
      router.push(`/auth/signIn?redirect=${encodeURIComponent(router.asPath)}`);
    }
  }, [user, router.isReady]);

  useEffect(() => {
    if (!user || !router.isReady) return;
    api
      .get(`/export/shares${forUserQS}`)
      .then(({ data }) => {
        setShares(data.shares ?? []);
        if (data.bulkLimitBytes) setLimitBytes(data.bulkLimitBytes);
        if (data.bulkLimitShares) setLimitShares(data.bulkLimitShares);
      })
      .catch(() => setError("Could not load your shares. Please refresh."))
      .finally(() => setLoading(false));

    api
      .get(`/export/batches${forUserQS}`)
      .then(({ data }) => {
        setBatchInfo(data);
        try {
          const raw = localStorage.getItem(`dropshare-export-parts-${data.userId}`);
          setStartedParts(new Set(raw ? JSON.parse(raw) : []));
        } catch {
          setStartedParts(new Set());
        }
      })
      .catch(() => setBatchInfo(null));
  }, [user, router.isReady, previewUser]);

  const markPartStarted = (index: number) => {
    setStartedParts((prev) => {
      const next = new Set(prev);
      next.add(index);
      if (batchInfo) {
        try {
          localStorage.setItem(
            `dropshare-export-parts-${batchInfo.userId}`,
            JSON.stringify(Array.from(next)),
          );
        } catch {
        }
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shares;
    return shares.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  }, [shares, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectedShares = shares.filter((s) => selected.has(s.id));
  const selectedBytes = selectedShares.reduce((n, s) => n + s.size, 0);
  const overLimit = selectedBytes > limitBytes;
  const overCount = selected.size > limitShares;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAllFiltered = () => setSelected(new Set(filtered.map((s) => s.id)));

  const downloadSelected = async () => {
    setBusy("bulk");
    setError(null);
    try {
      const res = await api.post(
        `/export/bulk-zip${forUserQS}`,
        { shareIds: Array.from(selected) },
        { responseType: "blob" },
      );
      triggerDownload(
        res.data,
        `dropshare-export-${new Date().toISOString().slice(0, 10)}.zip`,
      );
    } catch {
      setError(
        "That download failed. If your selection is large, try fewer shares at a time.",
      );
    } finally {
      setBusy(null);
    }
  };

  if (!user || loading) {
    return (
      <Container size="md" py={80}>
        <Group position="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  return (
    <>
      <Meta title="Download your files" />
      <Container size="lg" py="xl">
        <Stack spacing="lg">
          <Box>
            <Title order={2} className={classes.accentTitle}>
              Download <span>your files</span>
            </Title>
            <Text color="dimmed" size="sm" mt={4}>
              {appName} has shut down. Everything you uploaded is listed
              below, so you can download whatever you want to keep. Each share
              arrives as a zip named after it, containing its files and an{" "}
              <b>info.txt</b> with the title, description, sections and lyrics.
            </Text>
          </Box>

          {previewUser && batchInfo && (
            <Alert icon={<TbEye />} color="grape">
              Admin preview - this is @{batchInfo.username}&apos;s export page
              exactly as they see it. Downloads are real; nothing changes for
              them.
            </Alert>
          )}

          {error && (
            <Alert icon={<TbAlertCircle />} color="red">
              {error}
            </Alert>
          )}

          {batchInfo && batchInfo.batches.length > 0 && (
            <Box className={classes.panel} p="md">
              <Text weight={600}>Download everything</Text>
              <Text size="xs" color="dimmed" mt={2}>
                {batchInfo.totalSizeLabel} in {batchInfo.batches.length} part
                {batchInfo.batches.length === 1 ? "" : "s"}. Parts download in
                your browser&apos;s download manager - start several at once,
                leave this page, come back any time. The parts never change, so
                you can pick up where you left off. A checkmark means you
                started that part; confirm it finished in your browser&apos;s
                downloads.
              </Text>
              <Stack spacing={6} mt="sm">
                {batchInfo.batches.map((b) => (
                  <Group key={b.index} position="apart" spacing="xs">
                    <Group spacing="xs">
                      <Text size="sm" weight={500}>
                        Part {b.index}
                      </Text>
                      <Text size="sm" color="dimmed">
                        {b.sizeLabel} · {b.shareCount} share
                        {b.shareCount === 1 ? "" : "s"}
                      </Text>
                      {startedParts.has(b.index) && (
                        <Badge
                          color="green"
                          variant="light"
                          leftSection={<TbCheck size={10} />}
                        >
                          started
                        </Badge>
                      )}
                    </Group>
                    <Button
                      size="xs"
                      variant={startedParts.has(b.index) ? "default" : "light"}
                      leftIcon={<TbDownload size={14} />}
                      component="a"
                      href={`/api/export/batches/${b.index}/zip${forUserQS}`}
                      onClick={() => markPartStarted(b.index)}
                    >
                      Download
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Box>
          )}

          <Box className={classes.panel} p="md">
            <Group position="apart" align="center" spacing="md">
              <Group spacing="xs">
                <Text size="sm">
                  <b>{selected.size}</b> selected
                  {selected.size > 0 && ` · ${humanSize(selectedBytes)}`}
                </Text>
                {overLimit && (
                  <Badge color="orange" variant="light">
                    over {humanSize(limitBytes)} limit
                  </Badge>
                )}
                {overCount && (
                  <Badge color="orange" variant="light">
                    over {limitShares}-share limit
                  </Badge>
                )}
              </Group>
              <Group spacing="xs">
                <Button
                  variant="default"
                  size="xs"
                  onClick={selectAllFiltered}
                  disabled={filtered.length === 0}
                >
                  Select all{query ? " matching" : ""} ({filtered.length})
                </Button>
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => setSelected(new Set())}
                  disabled={selected.size === 0}
                >
                  Clear
                </Button>
                <Button
                  leftIcon={<TbDownload size={16} />}
                  size="xs"
                  loading={busy === "bulk"}
                  disabled={selected.size === 0 || overLimit || overCount}
                  onClick={downloadSelected}
                >
                  Download selected
                </Button>
              </Group>
            </Group>
            {(overLimit || overCount) && (
              <Text size="xs" color="dimmed" mt="xs">
                One download is limited to {humanSize(limitBytes)} and{" "}
                {limitShares} shares. Deselect some (or download them
                individually) and try again - you can come back for the rest.
              </Text>
            )}
          </Box>

          <TextInput
            icon={<TbSearch size={16} />}
            placeholder="Search your shares by name or description"
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setPage(1);
            }}
          />

          <Box className={classes.panel}>
            <Table
              highlightOnHover
              verticalSpacing="sm"
              className={classes.table}
            >
            <thead>
              <tr>
                <th style={{ width: 40 }} />
                <th>Share</th>
                <th style={{ width: 90 }}>Files</th>
                <th style={{ width: 110 }}>Size</th>
                <th style={{ width: 130 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Checkbox
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      aria-label={`Select ${s.displayName}`}
                    />
                  </td>
                  <td>
                    <Text size="sm" weight={500} lineClamp={1}>
                      {s.displayName}
                    </Text>
                    {s.description && (
                      <Text size="xs" color="dimmed" lineClamp={1}>
                        {s.description}
                      </Text>
                    )}
                  </td>
                  <td>
                    <Text size="sm">{s.fileCount}</Text>
                  </td>
                  <td>
                    <Text size="sm">{s.sizeLabel}</Text>
                  </td>
                  <td>
                    <Button
                      size="xs"
                      variant="light"
                      leftIcon={<TbDownload size={14} />}
                      component="a"
                      href={`/api/export/shares/${s.id}/zip${forUserQS}`}
                    >
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <Text color="dimmed" size="sm" align="center" py="lg">
                      {shares.length === 0
                        ? "You don't have any uploaded shares."
                        : "No shares match your search."}
                    </Text>
                  </td>
                </tr>
              )}
            </tbody>
            </Table>
          </Box>

          {pageCount > 1 && (
            <Group position="center">
              <Pagination total={pageCount} value={page} onChange={setPage} />
            </Group>
          )}
        </Stack>
      </Container>
    </>
  );
};

export default ExportPage;
