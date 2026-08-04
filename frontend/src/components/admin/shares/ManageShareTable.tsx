import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Group,
  Menu,
  Skeleton,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import moment from "moment";
import Link from "next/link";
import {
  TbChevronDown,
  TbChevronUp,
  TbDots,
  TbEdit,
  TbEye,
  TbLink,
  TbTrash,
} from "react-icons/tb";
import useTranslate from "../../../hooks/useTranslate.hook";
import { MyShare } from "../../../types/share.type";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import toast from "../../../utils/toast.util";
import showShareLinkModal from "../../account/showShareLinkModal";

export type SortKey =
  | "id"
  | "name"
  | "username"
  | "group"
  | "views"
  | "downloads"
  | "size"
  | "expires"
  | "createdAt"
  | "editedAt";
export type SortDirection = "asc" | "desc";

const ManageShareTable = ({
  shares,
  deleteShare,
  isLoading,
  selectedShareIds,
  toggleShareSelection,
  toggleSelectAllVisible,
  sortKey,
  sortDirection,
  onSort,
  canDelete = true,
  selectedCount,
}: {
  shares: MyShare[];
  deleteShare: (_share: MyShare) => void;
  isLoading: boolean;
  selectedShareIds: string[];
  toggleShareSelection: (_shareId: string) => void;
  toggleSelectAllVisible: () => void;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (_key: SortKey) => void;
  canDelete?: boolean;
  selectedCount?: number;
}) => {
  const modals = useModals();
  const clipboard = useClipboard();
  const t = useTranslate();

  const allVisibleSelected =
    shares.length > 0 &&
    shares.every((share) => selectedShareIds.includes(share.id));

  const renderSortableHeader = (label: string, key: SortKey) => (
    <Button
      variant="subtle"
      compact
      px={0}
      color="gray"
      onClick={() => onSort(key)}
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

  const formatDateTime = (value?: Date | string | null) =>
    value ? moment(value).format("MMM D, YYYY h:mm A") : "-";

  const renderShareActions = (share: MyShare) => (
    <Group position="right" spacing={6} noWrap>
      <ActionIcon
        color="victoria"
        variant="light"
        size={30}
        onClick={() => {
          if (window.isSecureContext) {
            clipboard.copy(`${window.location.origin}/s/${share.id}`);
            toast.success(t("common.notify.copied-link"));
          } else {
            showShareLinkModal(modals, share.id);
          }
        }}
      >
        <TbLink />
      </ActionIcon>
      <Menu position="bottom-end" withinPortal zIndex={500}>
        <Menu.Target>
          <ActionIcon variant="light" size={30}>
            <TbDots size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
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
          {canDelete && (
            <Menu.Item
              icon={<TbTrash size={16} />}
              color="red"
              onClick={() => deleteShare(share)}
            >
              Delete
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );

  return (
    <Box sx={{ display: "block", width: "100%" }}>
      <Box
        sx={{
          display: "block",
          "@media (max-width: 48em)": {
            display: "none",
          },
        }}
      >
        <Table
          verticalSpacing="sm"
          sx={{
            tableLayout: "fixed",
            width: "100%",
            minWidth: 0,
            "th, td": {
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
          }}
        >
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={selectedShareIds.length > 0 && !allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  aria-label="Select all visible shares"
                />
              </th>
              <th style={{ width: "11%" }}>{renderSortableHeader("ID", "id")}</th>
              <th style={{ width: "18%" }}>{renderSortableHeader("Name", "name")}</th>
              <th style={{ width: "8%" }}>{renderSortableHeader("User", "username")}</th>
              <th style={{ width: "8%" }}>{renderSortableHeader("Group", "group")}</th>
              <th style={{ width: "6%" }}>{renderSortableHeader("Views", "views")}</th>
              <th style={{ width: "7%" }}>{renderSortableHeader("Downloads", "downloads")}</th>
              <th style={{ width: "7%" }}>{renderSortableHeader("Size", "size")}</th>
              <th style={{ width: "10%" }}>{renderSortableHeader("Created", "createdAt")}</th>
              <th style={{ width: "10%" }}>{renderSortableHeader("Modified", "editedAt")}</th>
              <th style={{ width: "10%" }}>{renderSortableHeader("Expires", "expires")}</th>
              <th style={{ width: 78 }}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? skeletonRows
              : shares.map((share) => (
                  <tr key={share.id}>
                    <td>
                      <Checkbox
                        checked={selectedShareIds.includes(share.id)}
                        onChange={() => toggleShareSelection(share.id)}
                        aria-label={`Select ${share.name || share.id}`}
                      />
                    </td>
                    <td>{share.id}</td>
                    <td>
                      <Text weight={600}>{share.name || share.id}</Text>
                      {share.description ? (
                        <Text size="xs" color="dimmed" lineClamp={1}>
                          {share.description}
                        </Text>
                      ) : null}
                    </td>
                    <td>
                      {share.creator ? (
                        share.creator.username
                      ) : (
                        <Text color="dimmed">Anonymous</Text>
                      )}
                    </td>
                    <td>
                      {share.group?.name ? (
                        share.group.name
                      ) : (
                        <Text color="dimmed">No group</Text>
                      )}
                    </td>
                    <td>{share.views ?? 0}</td>
                    <td>{share.downloads ?? 0}</td>
                    <td>{byteToHumanSizeString(share.size ?? 0)}</td>
                    <td>
                      <Text size="sm">{formatDateTime(share.createdAt)}</Text>
                    </td>
                    <td>
                      <Text size="sm">{formatDateTime(share.editedAt || share.createdAt)}</Text>
                    </td>
                    <td>
                      {moment(share.expiration).unix() === 0 ||
                      moment(share.expiration).year() === 9999
                        ? "Never"
                        : moment(share.expiration).format("LLL")}
                    </td>
                    <td>{renderShareActions(share)}</td>
                  </tr>
                ))}
          </tbody>
        </Table>
      </Box>

      <Stack
        spacing="sm"
        sx={{
          display: "none",
          "@media (max-width: 48em)": {
            display: "flex",
          },
        }}
      >
        <Group position="apart" align="center" noWrap>
          <Checkbox
            checked={allVisibleSelected}
            indeterminate={selectedShareIds.length > 0 && !allVisibleSelected}
            onChange={toggleSelectAllVisible}
            aria-label="Select all visible shares"
          />
          <Text size="xs" color="dimmed">
            {selectedCount ?? selectedShareIds.length} selected
          </Text>
        </Group>
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Box key={index}>
                <Skeleton height={120} radius="md" />
              </Box>
            ))
          : shares.map((share) => (
              <Box
                key={share.id}
                sx={(theme) => ({
                  borderRadius: 12,
                  padding: 14,
                  background:
                    theme.colorScheme === "dark"
                      ? "rgba(255, 255, 255, 0.035)"
                      : "rgba(0, 0, 0, 0.035)",
                  border: `1px solid ${
                    theme.colorScheme === "dark"
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.08)"
                  }`,
                })}
              >
                <Stack spacing="xs">
                  <Group position="apart" align="flex-start" noWrap>
                    <Group spacing="sm" align="flex-start" noWrap sx={{ minWidth: 0, flex: 1 }}>
                      <Checkbox
                        checked={selectedShareIds.includes(share.id)}
                        onChange={() => toggleShareSelection(share.id)}
                        aria-label={`Select ${share.name || share.id}`}
                        mt={3}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Text weight={700} lineClamp={2}>
                          {share.name || share.id}
                        </Text>
                        <Text size="xs" color="dimmed" lineClamp={1}>
                          {share.id}
                        </Text>
                      </Box>
                    </Group>
                    {renderShareActions(share)}
                  </Group>

                  {share.description ? (
                    <Text size="xs" color="dimmed" lineClamp={2}>
                      {share.description}
                    </Text>
                  ) : null}

                  <Group spacing={8}>
                    <Text size="xs" color="dimmed">
                      {share.creator?.username || "Anonymous"}
                    </Text>
                    <Text size="xs" color="dimmed">
                      {share.group?.name || "No group"}
                    </Text>
                    <Text size="xs" color="dimmed">
                      {byteToHumanSizeString(share.size ?? 0)}
                    </Text>
                  </Group>

                  <Group grow spacing="xs">
                    <Box>
                      <Text size="xs" color="dimmed">Views</Text>
                      <Text size="sm" weight={600}>{share.views ?? 0}</Text>
                    </Box>
                    <Box>
                      <Text size="xs" color="dimmed">Downloads</Text>
                      <Text size="sm" weight={600}>{share.downloads ?? 0}</Text>
                    </Box>
                    <Box>
                      <Text size="xs" color="dimmed">Expires</Text>
                      <Text size="sm" weight={600} lineClamp={1}>
                        {moment(share.expiration).unix() === 0 ||
                        moment(share.expiration).year() === 9999
                          ? "Never"
                          : moment(share.expiration).format("MMM D")}
                      </Text>
                    </Box>
                  </Group>

                  <Group spacing={10}>
                    <Text size="xs" color="dimmed">
                      Created {formatDateTime(share.createdAt)}
                    </Text>
                    <Text size="xs" color="dimmed">
                      Modified {formatDateTime(share.editedAt || share.createdAt)}
                    </Text>
                  </Group>
                </Stack>
              </Box>
            ))}
      </Stack>
    </Box>
  );
};

const skeletonRows = [...Array(10)].map((_, i) => (
  <tr key={i}>
    <td>
      <Skeleton height={20} circle />
    </td>
    {Array.from({ length: 10 }).map((__, cellIndex) => (
      <td key={cellIndex}>
        <Skeleton height={20} />
      </td>
    ))}
    <td>
      <Skeleton height={20} />
    </td>
  </tr>
));

export default ManageShareTable;
