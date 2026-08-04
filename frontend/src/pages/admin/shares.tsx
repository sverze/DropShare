import {
  ActionIcon,
  Box,
  Button,
  Group,
  Pagination,
  Select,
  Space,
  Tabs,
  Text,
  TextInput,
  Title,
  createStyles,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import {
  TbFileZip,
  TbFiles,
  TbLink,
  TbPhoto,
  TbSearch,
  TbShieldSearch,
  TbTrash,
  TbX,
} from "react-icons/tb";
import Meta from "../../components/Meta";
import ManageShareTable, {
  SortDirection,
  SortKey,
} from "../../components/admin/shares/ManageShareTable";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import shareService, { AdminSharesPage } from "../../services/share.service";
import userService from "../../services/user.service";
import { MyShare } from "../../types/share.type";
import { UserGroup } from "../../types/user.type";
import { hasCapability } from "../../utils/capabilities.util";
import toast from "../../utils/toast.util";
import AdminZipManagement from "../../components/admin/AdminZipManagement";
import PreviewProcessing from "./previews";
import AdminShareSecurity from "./share-security";

const NO_GROUP_VALUE = "__no_group__";
const ANONYMOUS_VALUE = "__anonymous__";
const PAGE_SIZE = 25;

const useStyles = createStyles((theme) => ({
  wrapper: {
    minHeight: "calc(100vh - 180px)",
    width: "min(1720px, calc(100vw - 96px))",
    margin: "0 auto",

    [theme.fn.smallerThan("sm")]: {
      width: "calc(100vw - 32px)",
    },
  },

  headerCard: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.2 : 0.3})`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(var(--ls-accent-rgb), 0.05)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  headerContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: theme.spacing.md,

    [theme.fn.smallerThan("sm")]: {
      flexDirection: "column",
    },
  },

  titleSection: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  title: {
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
    fontWeight: 700,
    fontSize: 28,
  },

  titleIcon: {
    color: "var(--ls-accent)",
    filter: "drop-shadow(0 0 8px rgba(var(--ls-accent-rgb), 0.4))",
  },

  subtitle: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[6],
    marginTop: 4,
  },

  statsBadge: {
    background: theme.colorScheme === "dark"
      ? "rgba(var(--ls-accent-rgb), 0.1)"
      : "rgba(var(--ls-accent-rgb), 0.08)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.2)",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    color: "var(--ls-accent)",
    fontWeight: 500,
  },

  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
    width: "100%",
    marginTop: theme.spacing.lg,
  },

  searchInput: {
    minWidth: 280,
    flex: "1 1 280px",

    "& input": {
      background: theme.colorScheme === "dark"
        ? "rgba(0, 0, 0, 0.2)"
        : "rgba(255, 255, 255, 0.6)",
      border: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(0, 0, 0, 0.1)"
      }`,
      borderRadius: 10,
      transition: "all 0.25s ease",

      "&:focus": {
        borderColor: "rgba(var(--ls-accent-rgb), 0.5)",
        boxShadow: "0 0 20px rgba(var(--ls-accent-rgb), 0.1)",
      },
    },
  },

  filterSelect: {
    minWidth: 220,
    flex: "0 0 220px",

    "& input": {
      background: theme.colorScheme === "dark"
        ? "rgba(4, 12, 10, 0.96)"
        : "rgba(255, 255, 255, 0.98)",
      color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
      border: `1px solid rgba(var(--ls-panel-border-rgb), 0.28)`,
      borderRadius: 10,
    },
  },

  selectDropdown: {
    background: theme.colorScheme === "dark"
      ? "rgba(8, 16, 14, 0.99)"
      : "rgba(255, 255, 255, 0.99)",
    border: `1px solid rgba(var(--ls-panel-border-rgb), 0.22)`,
    boxShadow: theme.colorScheme === "dark"
      ? "0 18px 40px rgba(0, 0, 0, 0.55)"
      : "0 18px 40px rgba(0, 0, 0, 0.12)",
    backdropFilter: "none",
    zIndex: 320,
  },

  selectItem: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[1] : theme.colors.dark[7],
    fontWeight: 600,

    "&[data-hovered]": {
      background: `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.12 : 0.08})`,
    },

    "&[data-selected]": {
      background: `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.18 : 0.12})`,
      color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
    },
  },

  tableCard: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
    padding: theme.spacing.lg,
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(var(--ls-accent-rgb), 0.05)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
    overflow: "visible",
  },

  selectionBanner: {
    marginTop: theme.spacing.md,
    padding: "10px 14px",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
    background: "rgba(var(--ls-panel-border-rgb), 0.08)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.25)",
  },
}));

const Shares = () => {
  const { classes } = useStyles();
  const { user: currentUser } = useUser();
  const modals = useModals();
  const t = useTranslate();

  const canViewShares = hasCapability(currentUser, "shares.view");
  const canZip = hasCapability(currentUser, "shares.zip");
  const canSecurity = hasCapability(currentUser, "security.view");
  const canPreviews = hasCapability(currentUser, "previews.manage");

  const canBulkDelete = hasCapability(currentUser, "shares.delete");
  const canBulkAssign = !!currentUser?.isAdmin;

  const firstAvailableTab = canViewShares
    ? "shares"
    : canZip
      ? "zip"
      : canSecurity
        ? "security"
        : canPreviews
          ? "previews"
          : "shares";
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const currentTab = activeTab ?? firstAvailableTab;

  const [data, setData] = useState<AdminSharesPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<UserGroup[]>([]);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState<string | null>(null);

  const [knownUsers, setKnownUsers] = useState<Record<string, string>>({});
  const [hasAnonymous, setHasAnonymous] = useState(false);

  const shares = useMemo(() => data?.shares ?? [], [data]);
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const clearSelection = () => {
    setSelected(new Set());
    setAllMatching(false);
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === search) return;
      setSearch(trimmed);
      setPage(1);
      clearSelection();
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, search]);

  useEffect(() => {
    if (!canViewShares) return;
    userService
      .listGroups()
      .then(setGroups)
      .catch(() => undefined);
  }, [canViewShares]);

  const fetchShares = async () => {
    setIsLoading(true);
    try {
      const result = await shareService.listAllShares({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        userId: userFilter || undefined,
        groupId: groupFilter || undefined,
        sortBy,
        sortDir,
      });

      if (result.pagination.totalPages < page) {
        setPage(result.pagination.totalPages);
        return;
      }

      setData(result);
      if (allMatching && result.pagination.total === 0) {
        setAllMatching(false);
        setSelected(new Set());
      }
      setKnownUsers((prev) => {
        const next = { ...prev };
        result.shares.forEach((share) => {
          if (share.creator?.id && share.creator?.username) {
            next[share.creator.id] = share.creator.username;
          }
        });
        return next;
      });
      if (result.shares.some((share) => !share.creator?.id)) {
        setHasAnonymous(true);
      }
      if (allMatching) {
        setSelected(new Set(result.shares.map((share) => share.id)));
      }
    } catch (error) {
      toast.error("Failed to load shares");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewShares || currentTab !== "shares") return;
    void fetchShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canViewShares,
    currentTab,
    page,
    search,
    userFilter,
    groupFilter,
    sortBy,
    sortDir,
  ]);

  const handleSort = (key: SortKey) => {
    setSortDir((prevDir) => {
      if (sortBy === key) return prevDir === "asc" ? "desc" : "asc";
      return key === "name" || key === "username" || key === "group" || key === "id"
        ? "asc"
        : "desc";
    });
    setSortBy(key);
    setPage(1);
    clearSelection();
  };

  const handleUserFilter = (value: string | null) => {
    setUserFilter(value);
    setPage(1);
    clearSelection();
  };

  const handleGroupFilter = (value: string | null) => {
    setGroupFilter(value);
    setPage(1);
    clearSelection();
  };

  const passedSelectedIds = useMemo(
    () => (allMatching ? shares.map((share) => share.id) : Array.from(selected)),
    [allMatching, shares, selected],
  );

  const toggleShareSelection = (id: string) => {
    if (allMatching) {
      const next = new Set(shares.map((share) => share.id));
      next.delete(id);
      setAllMatching(false);
      setSelected(next);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const everyVisibleSelected =
      shares.length > 0 && shares.every((share) => passedSelectedIds.includes(share.id));
    if (everyVisibleSelected) {
      clearSelection();
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      shares.forEach((share) => next.add(share.id));
      return next;
    });
  };

  const pageFullySelected =
    shares.length > 0 && shares.every((share) => selected.has(share.id));
  const showSelectAllMatchingPrompt =
    !allMatching && pageFullySelected && total > shares.length;
  const selectedCount = allMatching ? total : selected.size;

  const buildBulkBody = () =>
    allMatching
      ? {
          all: true,
          search: search || undefined,
          userId: userFilter || undefined,
          groupId: groupFilter || undefined,
        }
      : { ids: Array.from(selected) };

  const userOptions = useMemo(() => {
    const options = Object.entries(knownUsers)
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, undefined, { sensitivity: "base" }),
      );
    if (hasAnonymous) options.unshift({ value: ANONYMOUS_VALUE, label: "Anonymous" });
    return options;
  }, [knownUsers, hasAnonymous]);

  const groupFilterOptions = useMemo(
    () => [
      { value: NO_GROUP_VALUE, label: "No group" },
      ...groups.map((group) => ({ value: group.id, label: group.name })),
    ],
    [groups],
  );

  const bulkGroupOptions = useMemo(
    () => [
      { value: NO_GROUP_VALUE, label: "Remove group" },
      ...groups.map((group) => ({ value: group.id, label: group.name })),
    ],
    [groups],
  );

  const deleteShare = (share: MyShare) => {
    modals.openConfirmModal({
      title: t("admin.shares.edit.delete.title", { id: share.id }),
      children: (
        <Text size="sm">
          <FormattedMessage id="admin.shares.edit.delete.description" />
        </Text>
      ),
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await shareService.remove(share.id);
          await fetchShares();
        } catch (error) {
          toast.axiosError(error);
        }
      },
    });
  };

  const deleteSelectedShares = () => {
    if (selectedCount === 0) return;

    modals.openConfirmModal({
      title: "Delete selected shares",
      children: (
        <Text size="sm">
          Delete {selectedCount} selected share{selectedCount === 1 ? "" : "s"}? This
          action cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete selected", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          const result = await shareService.bulkDeleteShares(buildBulkBody());
          if (result.failed === 0) {
            toast.success(
              `Deleted ${result.deleted} share${result.deleted === 1 ? "" : "s"}`,
            );
          } else {
            toast.error(`Deleted ${result.deleted}, ${result.failed} failed`);
          }
        } catch (error) {
          toast.axiosError(error);
        } finally {
          clearSelection();
          await fetchShares();
        }
      },
    });
  };

  const assignSelectedToGroup = () => {
    if (selectedCount === 0 || !bulkGroupId) return;

    const targetGroupName =
      bulkGroupId === NO_GROUP_VALUE
        ? "no group"
        : groups.find((group) => group.id === bulkGroupId)?.name ||
          "the selected group";

    modals.openConfirmModal({
      title: "Update selected share groups",
      children: (
        <Text size="sm">
          Assign {selectedCount} selected share{selectedCount === 1 ? "" : "s"} to{" "}
          {targetGroupName}?
        </Text>
      ),
      labels: { confirm: "Apply group", cancel: "Cancel" },
      confirmProps: { color: "green" },
      onConfirm: async () => {
        try {
          const result = await shareService.bulkAssignGroup({
            ...buildBulkBody(),
            targetGroupId:
              bulkGroupId === NO_GROUP_VALUE ? undefined : bulkGroupId,
          });
          if (result.failed === 0) {
            toast.success(
              `Updated ${result.updated} share${result.updated === 1 ? "" : "s"}`,
            );
          } else {
            toast.error(`Updated ${result.updated}, ${result.failed} failed`);
          }
        } catch (error) {
          toast.axiosError(error);
        } finally {
          setBulkGroupId(null);
          clearSelection();
          await fetchShares();
        }
      },
    });
  };

  const hasActiveFilter = !!(search || userFilter || groupFilter);

  return (
    <>
      {(currentTab === "shares" || currentTab === "zip") && (
        <Meta title={t("admin.shares.title")} />
      )}
      <Box className={classes.wrapper}>
        <Tabs
          value={currentTab}
          onTabChange={setActiveTab}
          keepMounted={false}
          variant="outline"
          radius="md"
        >
          <Tabs.List mb="lg">
            {canViewShares && (
              <Tabs.Tab value="shares" icon={<TbLink size={16} />}>
                Shares
              </Tabs.Tab>
            )}
            {canZip && (
              <Tabs.Tab value="zip" icon={<TbFileZip size={16} />}>
                Zip Management
              </Tabs.Tab>
            )}
            {canSecurity && (
              <Tabs.Tab value="security" icon={<TbShieldSearch size={16} />}>
                Share Security
              </Tabs.Tab>
            )}
            {canPreviews && (
              <Tabs.Tab value="previews" icon={<TbPhoto size={16} />}>
                Preview Processing
              </Tabs.Tab>
            )}
          </Tabs.List>

          {canViewShares && (
            <Tabs.Panel value="shares">
              <Box className={classes.headerCard}>
                <div className={classes.headerContent}>
                  <div>
                    <div className={classes.titleSection}>
                      <TbLink size={32} className={classes.titleIcon} />
                      <Title order={3} className={classes.title}>
                        <FormattedMessage id="admin.shares.title" />
                      </Title>
                    </div>
                    <Text className={classes.subtitle}>
                      View and manage all shares on your instance
                    </Text>
                    <Group mt="md" spacing="xs">
                      <span className={classes.statsBadge}>
                        {total} total share{total !== 1 ? "s" : ""}
                      </span>
                      {hasActiveFilter && (
                        <span className={classes.statsBadge}>filtered</span>
                      )}
                    </Group>
                  </div>
                </div>

                <div className={classes.filterBar}>
                  {selectedCount > 0 && (canBulkAssign || canBulkDelete) && (
                    <>
                      {canBulkAssign && (
                        <>
                          <Select
                            placeholder="Assign selected to group"
                            value={bulkGroupId}
                            onChange={setBulkGroupId}
                            data={bulkGroupOptions}
                            clearable
                            className={classes.filterSelect}
                            dropdownPosition="bottom"
                            withinPortal
                            classNames={{
                              dropdown: classes.selectDropdown,
                              item: classes.selectItem,
                            }}
                          />
                          <Button
                            variant="light"
                            leftIcon={<TbFiles size={16} />}
                            disabled={!bulkGroupId}
                            onClick={assignSelectedToGroup}
                          >
                            Apply to {selectedCount} Selected
                          </Button>
                        </>
                      )}
                      {canBulkDelete && (
                        <Button
                          color="red"
                          variant="light"
                          leftIcon={<TbTrash size={16} />}
                          onClick={deleteSelectedShares}
                        >
                          Delete {selectedCount} Selected
                        </Button>
                      )}
                    </>
                  )}

                  <TextInput
                    placeholder="Search shares..."
                    icon={<TbSearch size={18} />}
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.currentTarget.value);
                      if (selected.size > 0 || allMatching) clearSelection();
                    }}
                    className={classes.searchInput}
                    rightSection={
                      searchInput ? (
                        <ActionIcon
                          size="sm"
                          variant="transparent"
                          onClick={() => setSearchInput("")}
                        >
                          <TbX size={14} />
                        </ActionIcon>
                      ) : null
                    }
                  />

                  <Select
                    placeholder="Filter by user"
                    value={userFilter}
                    onChange={handleUserFilter}
                    clearable
                    data={userOptions}
                    className={classes.filterSelect}
                    dropdownPosition="bottom"
                    withinPortal
                    classNames={{
                      dropdown: classes.selectDropdown,
                      item: classes.selectItem,
                    }}
                  />

                  <Select
                    placeholder="Filter by group"
                    value={groupFilter}
                    onChange={handleGroupFilter}
                    clearable
                    data={groupFilterOptions}
                    className={classes.filterSelect}
                    dropdownPosition="bottom"
                    withinPortal
                    classNames={{
                      dropdown: classes.selectDropdown,
                      item: classes.selectItem,
                    }}
                  />
                </div>

                {(showSelectAllMatchingPrompt || allMatching) && (
                  <Box className={classes.selectionBanner}>
                    {allMatching ? (
                      <>
                        <Text size="sm">
                          All {total} matching share{total === 1 ? "" : "s"} across
                          every page are selected.
                        </Text>
                        <Button size="xs" variant="subtle" onClick={clearSelection}>
                          Clear selection
                        </Button>
                      </>
                    ) : (
                      <>
                        <Text size="sm">
                          All {shares.length} shares on this page are selected.
                        </Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => {
                            setAllMatching(true);
                            setSelected(new Set(shares.map((share) => share.id)));
                          }}
                        >
                          Select all {total} matching
                        </Button>
                      </>
                    )}
                  </Box>
                )}
              </Box>

              <Box className={classes.tableCard}>
                <ManageShareTable
                  shares={shares}
                  deleteShare={deleteShare}
                  isLoading={isLoading}
                  selectedShareIds={passedSelectedIds}
                  selectedCount={selectedCount}
                  canDelete={canBulkDelete}
                  toggleShareSelection={toggleShareSelection}
                  toggleSelectAllVisible={toggleSelectAllVisible}
                  sortKey={sortBy}
                  sortDirection={sortDir}
                  onSort={handleSort}
                />

                {totalPages > 1 && (
                  <Group position="apart" mt="md">
                    <Text size="sm" color="dimmed">
                      Page {pagination?.page ?? page} of {totalPages} · {total} share
                      {total === 1 ? "" : "s"}
                    </Text>
                    <Pagination value={page} onChange={setPage} total={totalPages} />
                  </Group>
                )}
              </Box>
            </Tabs.Panel>
          )}

          {canZip && (
            <Tabs.Panel value="zip">
              <AdminZipManagement />
            </Tabs.Panel>
          )}

          {canSecurity && (
            <Tabs.Panel value="security">
              <AdminShareSecurity />
            </Tabs.Panel>
          )}

          {canPreviews && (
            <Tabs.Panel value="previews">
              <PreviewProcessing />
            </Tabs.Panel>
          )}
        </Tabs>
      </Box>
      <Space h="xl" />
    </>
  );
};

export default Shares;
