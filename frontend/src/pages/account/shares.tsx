import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  createStyles,
  Group,
  Loader,
  Menu,
  Pagination,
  Paper,
  SimpleGrid,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import moment from "moment";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  TbDots,
  TbChevronDown,
  TbChevronUp,
  TbDownload,
  TbEdit,
  TbEye,
  TbFiles,
  TbLink,
  TbSearch,
  TbTrash,
  TbX,
} from "react-icons/tb";
import Meta from "../../components/Meta";
import useUser from "../../hooks/user.hook";
import shareService from "../../services/share.service";
import { MyShare, MySharesDashboard } from "../../types/share.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import { getUserGroupMemberships } from "../../utils/group-memberships.util";
import { downloadShareLinksTextFile } from "../../utils/shareLinksExport.util";
import toast from "../../utils/toast.util";

const useStyles = createStyles((theme) => ({
  pageWrapper: {
    position: "relative",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },

  statCard: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.72 : 0.88})`,
    backdropFilter: "blur(12px)",
    borderRadius: 18,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.12 : 0.14})`,
    padding: theme.spacing.lg,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 10px 35px rgba(0, 0, 0, 0.22)"
        : "0 10px 30px rgba(0, 0, 0, 0.06)",
  },

  statLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
  },

  statValue: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.1,
  },

  searchWrapper: {
    position: "relative",
    width: 340,
    [theme.fn.smallerThan("sm")]: {
      width: "100%",
    },
  },

  searchInput: {
    "& input": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.03)",
      border: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(0, 0, 0, 0.08)"
      }`,
      borderRadius: 10,
      padding: "10px 16px 10px 42px",
      fontSize: 14,
    },
  },

  searchIcon: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[5],
    pointerEvents: "none",
    zIndex: 1,
  },

  clearButton: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 1,
  },

  panel: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.85})`,
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
      padding: "14px 16px",
      fontWeight: 600,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color: theme.colorScheme === "dark" ? theme.colors.gray[3] : theme.colors.gray[7],
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
      verticalAlign: "top",
    },
    "& tbody tr:last-of-type td": {
      borderBottom: "none",
    },
  },

  shareLink: {
    textDecoration: "none",
    color: theme.colorScheme === "dark" ? "#7aff9a" : "#00a63a",
    fontWeight: 600,
    transition: "opacity 0.2s ease",
    "&:hover": {
      opacity: 0.82,
    },
  },

  actionButton: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[6],
    transition: "all 0.15s ease",
    "&:hover": {
      backgroundColor:
        `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.1})`,
      color: theme.white,
    },
  },

  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: theme.spacing.md,
  },

  ipListRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: 12,
    background:
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.03)"
        : "rgba(0, 0, 0, 0.025)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.04)"
        : "rgba(0, 0, 0, 0.04)"
    }`,
  },

  emptyState: {
    padding: "56px 20px",
    textAlign: "center",
  },
}));

const DEFAULT_LIMIT = 30;
const EXPORT_LIMIT = 100;

type SortKey = "name" | "files" | "views" | "downloads" | "size" | "expires";
type SortDirection = "asc" | "desc";

const StatsCard = ({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) => {
  const { classes } = useStyles();

  return (
    <Paper className={classes.statCard}>
      <Group position="apart" align="flex-start" mb="sm">
        <Text className={classes.statLabel}>{label}</Text>
        <Box style={{ opacity: 0.85 }}>{icon}</Box>
      </Group>
      <Text className={classes.statValue}>{value}</Text>
      {hint ? (
        <Text size="sm" color="dimmed" mt="xs">
          {hint}
        </Text>
      ) : null}
    </Paper>
  );
};

const MyShares = () => {
  const { classes } = useStyles();
  const modals = useModals();
  const clipboard = useClipboard();
  const { user } = useUser();

  const [dashboard, setDashboard] = useState<MySharesDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedShareIds, setSelectedShareIds] = useState<string[]>([]);
  const [isExportingLinks, setIsExportingLinks] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("expires");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const groupMemberships = getUserGroupMemberships(user);
  const primaryGroupMembership = groupMemberships[0] || null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const getShares = async (targetPage = page, targetSearch = debouncedSearchQuery) => {
    setIsLoading(true);
    try {
      const data = await shareService.getMyShares({
        page: targetPage,
        limit: DEFAULT_LIMIT,
        search: targetSearch || undefined,
      });
      setDashboard(data);
    } catch (e) {
      toast.error("Failed to load shares");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getShares(page, debouncedSearchQuery);
  }, [page, debouncedSearchQuery]);

  useEffect(() => {
    setSelectedShareIds([]);
  }, [page, debouncedSearchQuery, dashboard?.pagination?.total]);

  const shares = dashboard?.shares ?? [];
  const stats = dashboard?.stats;
  const pagination = dashboard?.pagination;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "name" ? "asc" : "desc");
  };

  const sortedShares = useMemo(() => {
    const getExpirationTimestamp = (share: MyShare) => {
      if (
        !share.expiration ||
        moment(share.expiration).unix() === 0 ||
        moment(share.expiration).year() === 9999
      ) {
        return Number.POSITIVE_INFINITY;
      }

      return new Date(share.expiration).getTime();
    };

    return [...shares].sort((left, right) => {
      let comparison = 0;

      switch (sortKey) {
        case "name":
          comparison = (left.name || left.id).localeCompare(right.name || right.id, undefined, {
            sensitivity: "base",
            numeric: true,
          });
          break;
        case "files":
          comparison = (left.files?.length ?? 0) - (right.files?.length ?? 0);
          break;
        case "views":
          comparison = (left.views ?? 0) - (right.views ?? 0);
          break;
        case "downloads":
          comparison = (left.downloads ?? 0) - (right.downloads ?? 0);
          break;
        case "size":
          comparison = (left.size ?? 0) - (right.size ?? 0);
          break;
        case "expires":
          comparison = getExpirationTimestamp(left) - getExpirationTimestamp(right);
          break;
      }

      return sortDirection === "asc" ? comparison : comparison * -1;
    });
  }, [shares, sortDirection, sortKey]);

  const renderSortableHeader = (label: string, key: SortKey) => (
    <Button
      variant="subtle"
      compact
      px={0}
      color="gray"
      onClick={() => toggleSort(key)}
      rightIcon={
        <Box
          sx={{
            width: 14,
            height: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: sortKey === key ? 1 : 0,
          }}
        >
          {sortDirection === "asc" ? <TbChevronUp size={14} /> : <TbChevronDown size={14} />}
        </Box>
      }
      styles={{
        root: {
          height: "auto",
          minHeight: "auto",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
        },
        inner: { justifyContent: "flex-start" },
        label: { color: "inherit" },
        rightIcon: { marginLeft: 6 },
      }}
    >
      {label}
    </Button>
  );
  const deleteShare = async (share: MyShare) => {
    modals.openConfirmModal({
      title: "Delete Share",
      children: (
        <Text size="sm">
          Are you sure you want to delete "{share.name || share.id}"? This action cannot be undone.
        </Text>
      ),
      labels: {
        confirm: "Delete",
        cancel: "Cancel",
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await shareService.remove(share.id);
          toast.success("Share deleted successfully");

          const nextPage =
            shares.length === 1 && page > 1 ? page - 1 : page;
          setPage(nextPage);
          await getShares(nextPage, debouncedSearchQuery);
        } catch (e) {
          toast.error("Failed to delete share");
        }
      },
    });
  };

  const toggleShareSelection = (shareId: string) => {
    setSelectedShareIds((current) =>
      current.includes(shareId)
        ? current.filter((id) => id !== shareId)
        : [...current, shareId],
    );
  };

  const allVisibleSelected =
    shares.length > 0 && shares.every((share) => selectedShareIds.includes(share.id));

  const toggleSelectAllVisible = () => {
    setSelectedShareIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !shares.some((share) => share.id === id));
      }

      const next = new Set(current);
      shares.forEach((share) => next.add(share.id));
      return Array.from(next);
    });
  };

  const deleteSelectedShares = async () => {
    if (selectedShareIds.length === 0) return;

    modals.openConfirmModal({
      title: "Delete selected shares",
      children: (
        <Text size="sm">
          Delete {selectedShareIds.length} selected share{selectedShareIds.length === 1 ? "" : "s"}?
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete selected", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        const targets = [...selectedShareIds];
        const results = await Promise.allSettled(targets.map((id) => shareService.remove(id)));
        const failed = results.filter((result) => result.status === "rejected").length;

        if (failed === 0) {
          toast.success("Selected shares deleted successfully");
        } else {
          toast.error(`${failed} share${failed === 1 ? "" : "s"} failed to delete`);
        }

        setSelectedShareIds([]);
        const nextPage =
          shares.length === targets.length && page > 1 ? page - 1 : page;
        setPage(nextPage);
        await getShares(nextPage, debouncedSearchQuery);
      },
    });
  };

  const addSelectedSharesToGroup = async () => {
    if (selectedShareIds.length === 0 || !primaryGroupMembership?.group?.id) return;

    const groupName = primaryGroupMembership.group.name;
    modals.openConfirmModal({
      title: `Add selected shares to ${groupName}?`,
      children: (
        <Text size="sm">
          Add {selectedShareIds.length} selected share
          {selectedShareIds.length === 1 ? "" : "s"} to {groupName} so the group can see
          them?
        </Text>
      ),
      labels: { confirm: "Add to group", cancel: "Cancel" },
      confirmProps: { color: "green" },
      onConfirm: async () => {
        const targets = [...selectedShareIds];
        const results = await Promise.allSettled(
          targets.map((id) =>
            shareService.update(id, {
              shareWithGroup: true,
              groupId: primaryGroupMembership.group.id,
            }),
          ),
        );
        const failed = results.filter((result) => result.status === "rejected").length;

        if (failed === 0) {
          toast.success(`Added selected shares to ${groupName}`);
        } else {
          toast.error(`${failed} share${failed === 1 ? "" : "s"} failed to add to group`);
        }

        setSelectedShareIds([]);
        await getShares(page, debouncedSearchQuery);
      },
    });
  };

  const copyLink = (share: MyShare) => {
    const link = `${window.location.origin}/s/${share.id}`;
    clipboard.copy(link);
    toast.success("Link copied to clipboard");
  };

  const downloadShareLinks = async () => {
    setIsExportingLinks(true);
    try {
      const exportParams = {
        limit: EXPORT_LIMIT,
        search: debouncedSearchQuery || undefined,
      };
      const firstPage = await shareService.getMyShares({
        page: 1,
        ...exportParams,
      });
      const remainingPages = Array.from(
        { length: Math.max(0, (firstPage.pagination?.totalPages ?? 1) - 1) },
        (_, index) => index + 2,
      );
      const remainingResults = await Promise.all(
        remainingPages.map((exportPage) =>
          shareService.getMyShares({
            page: exportPage,
            ...exportParams,
          }),
        ),
      );
      const exportShares = [
        ...(firstPage.shares ?? []),
        ...remainingResults.flatMap((pageData) => pageData.shares ?? []),
      ];

      if (exportShares.length === 0) {
        toast.error("No shares to export");
        return;
      }

      downloadShareLinksTextFile(
        exportShares,
        window.location.origin,
        "My Shares link export",
        debouncedSearchQuery
          ? `my-shares-links-${debouncedSearchQuery}`
          : "my-shares-links",
      );
      toast.success(`${exportShares.length} share links downloaded`);
    } catch {
      toast.error("Failed to download share links");
    } finally {
      setIsExportingLinks(false);
    }
  };

  const summaryCards = useMemo(() => {
    if (!stats) return [];

    return [
      {
        label: "Total Shares",
        value: stats.totalShares,
        hint: "Active public shares",
        icon: <TbLink size={20} />,
      },
      {
        label: "Total Files",
        value: stats.totalFiles,
        hint: byteToHumanSizeString(stats.totalSize),
        icon: <TbFiles size={20} />,
      },
      {
        label: "Total Views",
        value: stats.totalViews,
        hint: "Across all active shares",
        icon: <TbEye size={20} />,
      },
      {
        label: "Downloads",
        value: stats.totalDownloads,
        hint: "Across all active shares",
        icon: <TbDownload size={20} />,
      },
    ];
  }, [stats]);

  if (isLoading && !dashboard) {
    return (
      <>
        <Meta title="My Shares" />
        <Center style={{ height: "50vh" }}>
          <Loader />
        </Center>
      </>
    );
  }

  return (
    <>
      <Meta title="My Shares" />

      <Box className={classes.pageWrapper}>
        <div className={classes.header}>
          <div>
            <Title order={2}>My Shares</Title>
            <Text size="sm" color="dimmed" mt={4}>
              Browse your shares, track performance, and manage access.
            </Text>
          </div>

          <Group spacing="sm" align="center">
            <Button
              variant="light"
              leftIcon={<TbDownload size={16} />}
              loading={isExportingLinks}
              onClick={downloadShareLinks}
              disabled={isLoading || (dashboard?.pagination?.total ?? 0) === 0}
            >
              Download Links
            </Button>
            {selectedShareIds.length > 0 ? (
              <>
                {primaryGroupMembership?.group?.id ? (
                  <Button
                    variant="light"
                    leftIcon={<TbFiles size={16} />}
                    onClick={addSelectedSharesToGroup}
                  >
                    Add to {primaryGroupMembership.group.name}
                  </Button>
                ) : null}
                <Button
                  color="red"
                  variant="light"
                  leftIcon={<TbTrash size={16} />}
                  onClick={deleteSelectedShares}
                >
                  Delete {selectedShareIds.length} Selected
                </Button>
              </>
            ) : null}

            <Box className={classes.searchWrapper}>
              <TbSearch size={18} className={classes.searchIcon} />
              <TextInput
                placeholder="Search shares by name, ID, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                className={classes.searchInput}
                styles={{ input: { paddingLeft: 42 } }}
              />
              {searchQuery ? (
                <ActionIcon
                  size="sm"
                  className={classes.clearButton}
                  onClick={() => setSearchQuery("")}
                  variant="subtle"
                >
                  <TbX size={14} />
                </ActionIcon>
              ) : null}
            </Box>
          </Group>
        </div>

        {stats ? (
          <SimpleGrid cols={4} breakpoints={[{ maxWidth: "md", cols: 2 }, { maxWidth: "xs", cols: 1 }]} mb="xl">
            {summaryCards.map((card) => (
              <StatsCard
                key={card.label}
                icon={card.icon}
                label={card.label}
                value={card.value}
                hint={card.hint}
              />
            ))}
          </SimpleGrid>
        ) : null}

        <Box className={classes.panel}>
          {isLoading ? (
            <Center py={70}>
              <Loader />
            </Center>
          ) : shares.length === 0 ? (
            <div className={classes.emptyState}>
              <Text size="lg" weight={500} mb="xs">
                {debouncedSearchQuery ? "No matching shares" : "No shares yet"}
              </Text>
              <Text color="dimmed">
                {debouncedSearchQuery
                  ? `Nothing matched "${debouncedSearchQuery}".`
                  : "Create your first share by uploading files."}
              </Text>
            </div>
          ) : (
            <>
              <Table className={classes.table} horizontalSpacing="md">
                <thead>
                  <tr>
                    <th>
                      <Checkbox
                        checked={allVisibleSelected}
                        indeterminate={
                          selectedShareIds.length > 0 && !allVisibleSelected
                        }
                        onChange={toggleSelectAllVisible}
                        aria-label="Select all visible shares"
                      />
                    </th>
                    <th>{renderSortableHeader("Name", "name")}</th>
                    <th>{renderSortableHeader("Files", "files")}</th>
                    <th>{renderSortableHeader("Views", "views")}</th>
                    <th>{renderSortableHeader("Downloads", "downloads")}</th>
                    <th>{renderSortableHeader("Size", "size")}</th>
                    <th>{renderSortableHeader("Expires", "expires")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedShares.map((share) => (
                    <tr key={share.id}>
                      <td>
                        <Checkbox
                          checked={selectedShareIds.includes(share.id)}
                          onChange={() => toggleShareSelection(share.id)}
                          aria-label={`Select ${share.name || share.id}`}
                        />
                      </td>
                      <td>
                        <Link href={`/s/${share.id}`} className={classes.shareLink}>
                          {share.name || share.id}
                        </Link>
                        {share.description ? (
                          <Text size="xs" color="dimmed" lineClamp={1}>
                            {share.description}
                          </Text>
                        ) : null}
                        <Group spacing={6} mt={8}>
                          {share.security?.passwordProtected ? (
                            <Badge size="xs" radius="sm" color="gray" variant="light">
                              Password
                            </Badge>
                          ) : null}
                          {share.security?.maxViews ? (
                            <Badge size="xs" radius="sm" color="blue" variant="light">
                              Max {share.security.maxViews} views
                            </Badge>
                          ) : null}
                        </Group>
                      </td>
                      <td>{share.files?.length ?? 0}</td>
                      <td>{share.views ?? 0}</td>
                      <td>{share.downloads ?? 0}</td>
                      <td>{byteToHumanSizeString(share.size ?? 0)}</td>
                      <td>
                        {share.expiration &&
                        moment(share.expiration).unix() !== 0 &&
                        moment(share.expiration).year() !== 9999
                          ? moment(share.expiration).format("LLL")
                          : "Never"}
                      </td>
                      <td>
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon className={classes.actionButton}>
                              <TbDots size={20} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              icon={<TbLink size={16} />}
                              onClick={() => copyLink(share)}
                            >
                              Copy Link
                            </Menu.Item>
                            <Menu.Item
                              icon={<TbEye size={16} />}
                              component={Link}
                              href={`/s/${share.id}`}
                            >
                              View Share
                            </Menu.Item>
                            <Menu.Item
                              icon={<TbEdit size={16} />}
                              component={Link}
                              href={`/share/${share.id}/edit`}
                            >
                              Edit Share
                            </Menu.Item>
                            <Menu.Item
                              icon={<TbTrash size={16} />}
                              color="red"
                              onClick={() => deleteShare(share)}
                            >
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {(pagination?.totalPages ?? 1) > 1 ? (
                <Group position="apart" p="md">
                  <Text size="sm" color="dimmed">
                    Showing page {pagination?.page} of {pagination?.totalPages} ({pagination?.total} total shares)
                  </Text>
                  <Pagination
                    value={page}
                    onChange={setPage}
                    total={pagination?.totalPages ?? 1}
                    siblings={1}
                    boundaries={1}
                  />
                </Group>
              ) : null}
            </>
          )}
        </Box>

      </Box>
    </>
  );
};

export default MyShares;
