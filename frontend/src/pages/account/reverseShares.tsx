import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Progress,
  Stack,
  Text,
  Title,
  Tooltip,
  createStyles,
  useMantineColorScheme,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import moment from "moment";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  TbCircleCheck,
  TbClockOff,
  TbCopy,
  TbFileUpload,
  TbInbox,
  TbInfoCircle,
  TbLink,
  TbPlus,
  TbTrash,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import showReverseShareLinkModal from "../../components/account/showReverseShareLinkModal";
import showShareLinkModal from "../../components/account/showShareLinkModal";
import CenterLoader from "../../components/core/CenterLoader";
import showCreateReverseShareModal from "../../components/share/modals/showCreateReverseShareModal";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import { MyReverseShare } from "../../types/share.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";

const ACCENT = "var(--ls-accent)";

const useStyles = createStyles((theme) => ({
  wrapper: {
    minHeight: "calc(100vh - 180px)",
  },

  headerCard: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.2 : 0.3})`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(var(--ls-accent-rgb), 0.05)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  card: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.82})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.14 : 0.18})`,
    padding: theme.spacing.lg,
    transition: "border-color 0.2s ease",

    "&:hover": {
      borderColor:
        "rgba(var(--ls-panel-border-rgb), 0.3)",
    },
  },

  cardInactive: {
    opacity: 0.55,
    "&:hover": { opacity: 0.8 },
  },

  cardTitle: {
    fontWeight: 600,
    fontSize: 16,
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
  },

  metaLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[6]
        : theme.colors.gray[6],
  },

  metaValue: {
    fontSize: 14,
    fontWeight: 500,
    color: theme.colorScheme === "dark" ? theme.colors.gray[2] : theme.colors.dark[7],
  },

  receivedBox: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTop: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.07)"
        : "rgba(0, 0, 0, 0.07)"
    }`,
  },

  emptyIcon: {
    color: ACCENT,
    opacity: 0.85,
  },
}));

type ReverseShareStatus = "active" | "used" | "expired";

const getStatus = (reverseShare: MyReverseShare): ReverseShareStatus => {
  const expiresAt = moment(reverseShare.shareExpiration);
  const neverExpires = expiresAt.unix() === 0;
  if (!neverExpires && expiresAt.isBefore(moment())) return "expired";
  if (reverseShare.remainingUses <= 0) return "used";
  return "active";
};

const STATUS_META: Record<
  ReverseShareStatus,
  { label: string; color: string; icon: typeof TbCircleCheck }
> = {
  active: { label: "Active", color: "green", icon: TbCircleCheck },
  used: { label: "Used up", color: "orange", icon: TbFileUpload },
  expired: { label: "Expired", color: "gray", icon: TbClockOff },
};

const ReverseShares = () => {
  const { classes, cx } = useStyles();
  const modals = useModals();
  const clipboard = useClipboard();
  const t = useTranslate();
  const router = useRouter();
  const { colorScheme } = useMantineColorScheme();

  const config = useConfig();
  const reverseSharesEnabled = !!config.get("share.allowReverseShares");

  const [reverseShares, setReverseShares] = useState<MyReverseShare[]>();

  const getReverseShares = () => {
    shareService.getMyReverseShares().then((shares) => setReverseShares(shares));
  };

  useEffect(() => {
    if (!reverseSharesEnabled) {
      router.replace("/account/shares");
      return;
    }
    getReverseShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reverseSharesEnabled]);

  const sorted = useMemo(() => {
    const rank: Record<ReverseShareStatus, number> = {
      active: 0,
      used: 1,
      expired: 2,
    };
    return [...(reverseShares ?? [])].sort(
      (a, b) => rank[getStatus(a)] - rank[getStatus(b)],
    );
  }, [reverseShares]);

  if (!reverseSharesEnabled || !reverseShares) return <CenterLoader />;

  const copyUploadLink = (reverseShare: MyReverseShare) => {
    if (window.isSecureContext) {
      clipboard.copy(`${window.location.origin}/upload/${reverseShare.token}`);
      toast.success(t("common.notify.copied-link"));
    } else {
      showReverseShareLinkModal(modals, reverseShare.token);
    }
  };

  const confirmDelete = (reverseShare: MyReverseShare) => {
    modals.openConfirmModal({
      title: t("account.reverseShares.modal.delete.title"),
      children: (
        <Text size="sm">
          <FormattedMessage id="account.reverseShares.modal.delete.description" />
        </Text>
      ),
      confirmProps: { color: "red" },
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      onConfirm: () => {
        shareService.removeReverseShare(reverseShare.id);
        setReverseShares(
          reverseShares.filter((item) => item.id !== reverseShare.id),
        );
      },
    });
  };

  const openCreateModal = () =>
    showCreateReverseShareModal(
      modals,
      config.get("smtp.enabled"),
      config.get("share.maxExpiration"),
      getReverseShares,
      colorScheme === "dark",
    );

  return (
    <>
      <Meta title={t("account.reverseShares.title")} />
      <Box className={classes.wrapper}>
        <Box className={classes.headerCard}>
          <Group position="apart" align="flex-start">
            <div>
              <Group align="center" spacing={6}>
                <Title order={3}>
                  <FormattedMessage id="account.reverseShares.title" />
                </Title>
                <Tooltip
                  position="bottom"
                  multiline
                  width={240}
                  label={t("account.reverseShares.description")}
                  events={{ hover: true, focus: false, touch: true }}
                >
                  <ActionIcon>
                    <TbInfoCircle />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Text size="sm" color="dimmed" mt={4}>
                Send someone a link so they can upload files to you.
              </Text>
            </div>
            <Button leftIcon={<TbPlus size={18} />} onClick={openCreateModal}>
              <FormattedMessage id="common.button.create" />
            </Button>
          </Group>
        </Box>

        {reverseShares.length === 0 ? (
          <Center style={{ height: "55vh" }}>
            <Stack align="center" spacing={10}>
              <TbInbox size={48} className={classes.emptyIcon} />
              <Title order={3}>
                <FormattedMessage id="account.reverseShares.title.empty" />
              </Title>
              <Text color="dimmed">
                <FormattedMessage id="account.reverseShares.description.empty" />
              </Text>
              <Button
                mt="sm"
                variant="light"
                leftIcon={<TbPlus size={18} />}
                onClick={openCreateModal}
              >
                <FormattedMessage id="common.button.create" />
              </Button>
            </Stack>
          </Center>
        ) : (
          <Stack spacing="md">
            {sorted.map((reverseShare) => {
              const status = getStatus(reverseShare);
              const meta = STATUS_META[status];
              const StatusIcon = meta.icon;
              const isActive = status === "active";
              const expiresAt = moment(reverseShare.shareExpiration);
              const neverExpires = expiresAt.unix() === 0;

              return (
                <Box
                  key={reverseShare.id}
                  className={cx(classes.card, {
                    [classes.cardInactive]: !isActive,
                  })}
                >
                  <Group position="apart" align="flex-start" noWrap>
                    <div style={{ minWidth: 0 }}>
                      <Group spacing={8} align="center" noWrap>
                        <Text className={classes.cardTitle} truncate>
                          {reverseShare.name || "Untitled link"}
                        </Text>
                        <Badge
                          color={meta.color}
                          variant="light"
                          size="sm"
                          leftSection={
                            <StatusIcon
                              size={12}
                              style={{ display: "block" }}
                            />
                          }
                        >
                          {meta.label}
                        </Badge>
                      </Group>
                      <Text size="xs" color="dimmed" mt={2}>
                        {`/upload/${reverseShare.token}`}
                      </Text>
                    </div>

                    <Group spacing={8} noWrap>
                      <Tooltip
                        label={
                          isActive
                            ? "Copy upload link"
                            : "This link can no longer be used"
                        }
                      >
                        <Button
                          size="xs"
                          variant="light"
                          leftIcon={<TbCopy size={14} />}
                          onClick={() => copyUploadLink(reverseShare)}
                          disabled={!isActive}
                        >
                          Copy link
                        </Button>
                      </Tooltip>
                      <Tooltip label={t("common.button.delete")}>
                        <ActionIcon
                          color="red"
                          variant="light"
                          size={30}
                          onClick={() => confirmDelete(reverseShare)}
                        >
                          <TbTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>

                  <Group spacing={40} mt="md">
                    <div style={{ minWidth: 96 }}>
                      <Text className={classes.metaLabel}>Uses left</Text>
                      <Text className={classes.metaValue}>
                        {reverseShare.maxUseCount
                          ? `${reverseShare.remainingUses} of ${reverseShare.maxUseCount}`
                          : reverseShare.remainingUses}
                      </Text>
                      {reverseShare.maxUseCount ? (
                        <Progress
                          mt={6}
                          size="xs"
                          radius="xl"
                          color={isActive ? "green" : "gray"}
                          value={
                            (reverseShare.remainingUses /
                              reverseShare.maxUseCount) *
                            100
                          }
                        />
                      ) : null}
                    </div>
                    <div>
                      <Text className={classes.metaLabel}>Max upload size</Text>
                      <Text className={classes.metaValue}>
                        {byteToHumanSizeString(
                          parseInt(reverseShare.maxShareSize),
                        )}
                      </Text>
                    </div>
                    <div>
                      <Text className={classes.metaLabel}>
                        {status === "expired" ? "Expired" : "Expires"}
                      </Text>
                      <Tooltip
                        label={neverExpires ? "Never" : expiresAt.format("LLL")}
                      >
                        <Text className={classes.metaValue}>
                          {neverExpires ? "Never" : expiresAt.fromNow()}
                        </Text>
                      </Tooltip>
                    </div>
                  </Group>

                  <Box className={classes.receivedBox}>
                    {reverseShare.shares.length === 0 ? (
                      <Text size="sm" color="dimmed">
                        <FormattedMessage id="account.reverseShares.table.no-shares" />
                      </Text>
                    ) : (
                      <>
                        <Text className={classes.metaLabel} mb={6}>
                          {reverseShare.shares.length === 1
                            ? `1 ${t("account.reverseShares.table.count.singular")} received`
                            : `${reverseShare.shares.length} ${t("account.reverseShares.table.count.plural")} received`}
                        </Text>
                        <Group spacing={8}>
                          {reverseShare.shares.map((share) => (
                            <Group
                              key={share.id}
                              spacing={4}
                              noWrap
                              style={{ maxWidth: 260 }}
                            >
                              <Anchor
                                href={`${window.location.origin}/share/${share.id}`}
                                target="_blank"
                                size="sm"
                              >
                                <Text size="sm" truncate maw={170}>
                                  {share.name || share.id}
                                </Text>
                              </Anchor>
                              <ActionIcon
                                variant="subtle"
                                size={22}
                                onClick={() => {
                                  if (window.isSecureContext) {
                                    clipboard.copy(
                                      `${window.location.origin}/s/${share.id}`,
                                    );
                                    toast.success(
                                      t("common.notify.copied-link"),
                                    );
                                  } else {
                                    showShareLinkModal(modals, share.id);
                                  }
                                }}
                              >
                                <TbLink size={14} />
                              </ActionIcon>
                            </Group>
                          ))}
                        </Group>
                      </>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    </>
  );
};

export default ReverseShares;
