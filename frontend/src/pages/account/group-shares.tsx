import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  CopyButton,
  createStyles,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
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
  TbHeartHandshake,
  TbLink,
  TbSearch,
  TbTrash,
  TbX,
} from "react-icons/tb";
import Meta from "../../components/Meta";
import useUser from "../../hooks/user.hook";
import donationService from "../../services/donation.service";
import shareService from "../../services/share.service";
import { DonationIntent, GroupDonationSummary } from "../../types/donation.type";
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

  emptyState: {
    padding: "56px 20px",
    textAlign: "center",
  },

  donationCard: {
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(135deg, rgba(20, 55, 36, 0.72), rgba(10, 18, 16, 0.78))"
        : "linear-gradient(135deg, rgba(232, 255, 238, 0.9), rgba(255, 255, 255, 0.88))",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(90, 255, 140, 0.18)"
        : "rgba(0, 170, 65, 0.18)"
    }`,
    borderRadius: 18,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 18px 45px rgba(0, 0, 0, 0.22)"
        : "0 18px 38px rgba(0, 120, 50, 0.08)",
  },

  walletBox: {
    borderRadius: 14,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.08)"
    }`,
    background:
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.04)"
        : "rgba(0, 0, 0, 0.03)",
    padding: theme.spacing.md,
  },
}));

const DEFAULT_LIMIT = 30;
const EXPORT_LIMIT = 100;

type SortKey = "name" | "owner" | "files" | "views" | "downloads" | "size" | "expires";
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
    <Box className={classes.statCard}>
      <Group position="apart" mb="sm">
        <Text className={classes.statLabel}>{label}</Text>
        <ActionIcon variant="light" radius="xl">
          {icon}
        </ActionIcon>
      </Group>
      <Text className={classes.statValue}>{value}</Text>
      {hint ? (
        <Text size="sm" color="dimmed" mt={6}>
          {hint}
        </Text>
      ) : null}
    </Box>
  );
};

const GroupShares = () => {
  const { classes } = useStyles();
  const { user, refreshUser } = useUser();
  const modals = useModals();
  const clipboard = useClipboard();
  const [dashboard, setDashboard] = useState<MySharesDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("expires");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [donationSummary, setDonationSummary] = useState<GroupDonationSummary | null>(null);
  const [donationIntent, setDonationIntent] = useState<DonationIntent | null>(null);
  const [donationAmount, setDonationAmount] = useState("5");
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isCreatingDonation, setIsCreatingDonation] = useState(false);
  const [isExportingLinks, setIsExportingLinks] = useState(false);
  const groupMemberships = getUserGroupMemberships(user);
  const groupOptions = groupMemberships.map((membership) => ({
    value: membership.group.id,
    label: membership.group.name,
  }));
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const selectedMembership = groupMemberships.find(
    (membership) => membership.group.id === selectedGroupId,
  );

  useEffect(() => {
    refreshUser().catch(() => null);
  }, [refreshUser]);

  useEffect(() => {
    if (selectedGroupId && groupMemberships.some((membership) => membership.group.id === selectedGroupId)) {
      return;
    }

    setSelectedGroupId(groupMemberships[0]?.group.id || null);
  }, [groupMemberships, selectedGroupId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const getShares = async (targetPage = page, targetSearch = debouncedSearchQuery) => {
    if (!selectedGroupId) {
      setDashboard({
        shares: [],
        pagination: { page: 1, limit: DEFAULT_LIMIT, total: 0, totalPages: 1 },
        stats: {
          totalShares: 0,
          totalFiles: 0,
          totalViews: 0,
          totalDownloads: 0,
          totalSize: 0,
          uniqueVisitors30d: 0,
        },
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await shareService.getGroupShares({
        page: targetPage,
        limit: DEFAULT_LIMIT,
        search: targetSearch || undefined,
        groupId: selectedGroupId,
      });
      setDashboard(data);
    } catch {
      toast.error("Failed to load group shares");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getShares(page, debouncedSearchQuery);
  }, [page, debouncedSearchQuery, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) {
      setDonationSummary(null);
      return;
    }

    donationService
      .getGroupSummary(selectedGroupId)
      .then((summary) => {
        setDonationSummary(summary);
      })
      .catch(() => setDonationSummary(null));
  }, [selectedGroupId]);

  const shares = dashboard?.shares ?? [];
  const stats = dashboard?.stats;
  const pagination = dashboard?.pagination;
  const isGroupLeader = selectedMembership?.role === "leader";

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
        case "owner":
          comparison = (left.creator?.username || "").localeCompare(
            right.creator?.username || "",
            undefined,
            {
              sensitivity: "base",
              numeric: true,
            },
          );
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

  const summaryCards = useMemo(() => {
    if (!stats) return [];

    return [
      {
        label: "Total Shares",
        value: stats.totalShares,
        hint: "Active group shares",
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
        hint: "Across all active group shares",
        icon: <TbEye size={20} />,
      },
      {
        label: "Downloads",
        value: stats.totalDownloads,
        hint: "Across all active group shares",
        icon: <TbDownload size={20} />,
      },
    ];
  }, [stats]);

  const copyLink = (share: MyShare) => {
    clipboard.copy(`${window.location.origin}/s/${share.id}`);
    toast.success("Link copied to clipboard");
  };

  const downloadShareLinks = async () => {
    if (!selectedGroupId) return;

    setIsExportingLinks(true);
    try {
      const exportParams = {
        limit: EXPORT_LIMIT,
        search: debouncedSearchQuery || undefined,
        groupId: selectedGroupId,
      };
      const firstPage = await shareService.getGroupShares({
        page: 1,
        ...exportParams,
      });
      const remainingPages = Array.from(
        { length: Math.max(0, (firstPage.pagination?.totalPages ?? 1) - 1) },
        (_, index) => index + 2,
      );
      const remainingResults = await Promise.all(
        remainingPages.map((exportPage) =>
          shareService.getGroupShares({
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
        toast.error("No group shares to export");
        return;
      }

      const groupName = selectedMembership?.group.name || "group";
      downloadShareLinksTextFile(
        exportShares,
        window.location.origin,
        `${groupName} group link export`,
        debouncedSearchQuery
          ? `${groupName}-group-links-${debouncedSearchQuery}`
          : `${groupName}-group-links`,
      );
      toast.success(`${exportShares.length} group share links downloaded`);
    } catch {
      toast.error("Failed to download group share links");
    } finally {
      setIsExportingLinks(false);
    }
  };

  const formatCurrency = (value: number, currency = donationSummary?.displayCurrency || "USD") =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: value < 10 ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(value);

  const createDonationIntent = async () => {
    if (!selectedGroupId) return;
    const amountFiat = Number.parseFloat(donationAmount);
    if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
      toast.error("Enter a valid donation amount");
      return;
    }

    setIsCreatingDonation(true);
    try {
      const intent = await donationService.createIntent(selectedGroupId, {
        amountFiat,
      });
      setDonationIntent(intent);
    } catch {
      toast.error("Unable to start donation");
    } finally {
      setIsCreatingDonation(false);
    }
  };

  const deleteShare = async (share: MyShare) => {
    modals.openConfirmModal({
      title: "Delete Share",
      children: (
        <Text size="sm">
          Are you sure you want to delete "{share.name || share.id}"? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await shareService.remove(share.id);
          toast.success("Share deleted successfully");
          await getShares(page, debouncedSearchQuery);
        } catch {
          toast.error("Failed to delete share");
        }
      },
    });
  };

  if (isLoading && !dashboard) {
    return (
      <>
        <Meta title="Group Shares" />
        <Center style={{ height: "50vh" }}>
          <Loader />
        </Center>
      </>
    );
  }

  return (
    <>
      <Meta title="Group Shares" />

      <Box className={classes.pageWrapper}>
        <div className={classes.header}>
          <div>
            <Title order={2}>Group Shares</Title>
            <Text size="sm" color="dimmed" mt={4}>
              Browse your group’s shared uploads and manage them if you’re a group leader.
            </Text>
          </div>

          <Group align="flex-end" spacing="sm">
            <Button
              variant="light"
              leftIcon={<TbDownload size={16} />}
              loading={isExportingLinks}
              onClick={downloadShareLinks}
              disabled={
                isLoading ||
                !selectedGroupId ||
                (dashboard?.pagination?.total ?? 0) === 0
              }
            >
              Download Links
            </Button>
            {groupOptions.length > 0 ? (
              <Select
                label="Group"
                data={groupOptions}
                value={selectedGroupId}
                onChange={(value) => {
                  setSelectedGroupId(value);
                  setPage(1);
                }}
                withinPortal
                sx={{ width: 220 }}
              />
            ) : null}
            <Box className={classes.searchWrapper}>
              <TbSearch size={18} className={classes.searchIcon} />
              <TextInput
                placeholder="Search group shares by name, ID, or description..."
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

        {donationSummary?.enabled ? (
          <Box className={classes.donationCard}>
            <Group position="apart" align="center" spacing="lg">
              <Group spacing="md">
                <ActionIcon variant="light" radius="xl" size="lg">
                  <TbHeartHandshake size={22} />
                </ActionIcon>
                <div>
                  <Text weight={700}>Support {donationSummary.groupName}</Text>
                  <Text size="sm" color="dimmed">
                    Group storage is about {byteToHumanSizeString(donationSummary.storageBytes)}.
                    Estimated storage cost is {formatCurrency(donationSummary.estimatedMonthlyDisplay)} per month, while the server is about{" "}
                    {formatCurrency(donationSummary.serverCostPerMonthDisplay)} per month overall.
                  </Text>
                </div>
              </Group>
              <Group spacing="sm">
                <Badge color="green" variant="light" size="lg">
                  {formatCurrency(donationSummary.donatedDisplayAllTime)} donated all time
                </Badge>
                {donationSummary.btcEnabled && (
                  <Button
                    leftIcon={<TbHeartHandshake size={18} />}
                    variant="light"
                    onClick={() => {
                      setDonationIntent(null);
                      setDonationAmount(
                        Math.max(1, Math.ceil(donationSummary.estimatedMonthlyDisplay)).toString(),
                      );
                      setIsDonationModalOpen(true);
                    }}
                  >
                    Donate
                  </Button>
                )}
                {donationSummary.externalUrl && (
                  <Button
                    component="a"
                    href={donationSummary.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    leftIcon={<TbHeartHandshake size={18} />}
                    variant={donationSummary.btcEnabled ? "subtle" : "light"}
                  >
                    {donationSummary.externalLabel}
                  </Button>
                )}
              </Group>
            </Group>
          </Box>
        ) : null}

        <Box className={classes.panel}>
          {!selectedGroupId ? (
            <div className={classes.emptyState}>
              <Text size="lg" weight={500} mb="xs">
                No group assigned
              </Text>
              <Text color="dimmed">
                You’ll see group shares here once an admin adds you to a group.
              </Text>
            </div>
          ) : isLoading ? (
            <Center py={70}>
              <Loader />
            </Center>
          ) : shares.length === 0 ? (
            <div className={classes.emptyState}>
              <Text size="lg" weight={500} mb="xs">
                {debouncedSearchQuery ? "No matching group shares" : "No group shares yet"}
              </Text>
              <Text color="dimmed">
                {debouncedSearchQuery
                  ? `Nothing matched "${debouncedSearchQuery}".`
                  : "Uploads created with group sharing enabled will show up here."}
              </Text>
            </div>
          ) : (
            <>
              <Table className={classes.table} horizontalSpacing="md">
                <thead>
                  <tr>
                    <th>{renderSortableHeader("Name", "name")}</th>
                    <th>{renderSortableHeader("Owner", "owner")}</th>
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
                        <Link href={`/s/${share.id}`} className={classes.shareLink}>
                          {share.name || share.id}
                        </Link>
                        {share.description ? (
                          <Text size="xs" color="dimmed" lineClamp={1}>
                            {share.description}
                          </Text>
                        ) : null}
                      </td>
                      <td>{share.creator?.username || "-"}</td>
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
                            {isGroupLeader && share.canEdit ? (
                              <>
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
                              </>
                            ) : null}
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

      <Modal
        opened={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
        title={`Support ${donationSummary?.groupName || "this group"}`}
        centered
        size="lg"
      >
        <Stack spacing="md">
          <Text color="dimmed">
            {donationSummary?.donationNote ||
              "Donations are optional and help cover storage for this group."}
          </Text>

          <Badge color="green" variant="light" size="lg" style={{ alignSelf: "flex-start" }}>
            BTC donations
          </Badge>

          <Group spacing="xs">
            {[1, 3, 12].map((multiplier) => {
              const base = Math.max(1, donationSummary?.estimatedMonthlyDisplay || 1);
              const amount = Math.ceil(base * multiplier);
              return (
                <Button
                  key={multiplier}
                  variant={donationAmount === amount.toString() ? "filled" : "light"}
                  onClick={() => {
                    setDonationAmount(amount.toString());
                    setDonationIntent(null);
                  }}
                >
                  {multiplier}x cost · {formatCurrency(amount)}
                </Button>
              );
            })}
          </Group>

          <TextInput
            label={`Donation amount in ${donationSummary?.displayCurrency || "USD"}`}
            value={donationAmount}
            onChange={(event) => {
              setDonationAmount(event.currentTarget.value);
              setDonationIntent(null);
            }}
          />

          {donationIntent ? (
            <Box className={classes.walletBox}>
              {donationIntent.checkoutUrl ? (
                <>
                  <Text size="sm" color="dimmed" mb="sm">
                    BTCPay will generate a unique BTC invoice address for this donation.
                  </Text>
                  <Button
                    component="a"
                    href={donationIntent.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    fullWidth
                  >
                    Open BTCPay checkout
                  </Button>
                  {donationIntent.expiresInMinutes ? (
                    <Text size="xs" color="dimmed" mt="xs">
                      Invoice expires in {donationIntent.expiresInMinutes} minutes.
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text size="sm" color="dimmed" mb={6}>
                    Send {formatCurrency(donationIntent.amountDisplay, donationIntent.displayCurrency)} worth of BTC to:
                  </Text>
                  <Group position="apart" spacing="sm" noWrap>
                    <Text size="sm" weight={700} style={{ wordBreak: "break-all" }}>
                      {donationIntent.address}
                    </Text>
                    <CopyButton value={donationIntent.address || ""}>
                      {({ copied, copy }) => (
                        <Button variant="light" color={copied ? "teal" : "green"} onClick={copy}>
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      )}
                    </CopyButton>
                  </Group>
                </>
              )}
              <Divider my="sm" />
              <Text size="xs" color="dimmed">
                Donation ID: {donationIntent.id}
              </Text>
              {donationIntent.invoiceId ? (
                <Text size="xs" color="dimmed" mt={4}>
                  BTCPay invoice: {donationIntent.invoiceId}
                </Text>
              ) : null}
              <Text size="xs" color="dimmed" mt={4}>
                {donationIntent.instructions}
              </Text>
            </Box>
          ) : (
            <Button
              leftIcon={<TbHeartHandshake size={18} />}
              loading={isCreatingDonation}
              onClick={createDonationIntent}
            >
              Show wallet address
            </Button>
          )}
        </Stack>
      </Modal>
    </>
  );
};

export default GroupShares;
