import {
  Badge,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Stack,
  Text,
  Title,
  useMantineColorScheme,
  createStyles,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { cleanNotifications } from "@mantine/notifications";
import pLimit from "p-limit";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { TbArrowUp, TbFiles, TbLink, TbPlaylistAdd } from "react-icons/tb";
import Meta from "../../components/Meta";
import Dropzone from "../../components/upload/Dropzone";
import FileList from "../../components/upload/FileList";
import BulkShareSettingsModal, {
  getBulkModalStyles,
} from "../../components/upload/bulk/BulkShareSettingsModal";
import {
  BulkShareOptions,
  BulkUploadContext,
  downloadManifest,
  normalizeBulkOptions,
  uploadSingleFileAsShare,
} from "../../components/upload/bulk/bulkUpload.util";
import useConfig from "../../hooks/config.hook";
import useConfirmLeave from "../../hooks/confirm-leave.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import { FileUpload } from "../../types/File.type";
import { getUserGroupMemberships } from "../../utils/group-memberships.util";
import toast from "../../utils/toast.util";
import useSiteTheme from "../../theme/useSiteTheme";
import { getBulkUploadMode } from "../../utils/bulk-upload-mode.util";
import { resolveChunkSize } from "../../utils/chunkedUpload.util";

const promiseLimit = pLimit(2);
let errorToastShown = false;

class MassUploadErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[MassUpload] Render error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={(theme) => ({
            padding: 24,
            borderRadius: 18,
            background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.65 : 0.9})`,
            border: `1px solid ${
              theme.colorScheme === "dark"
                ? "rgba(239, 68, 68, 0.35)"
                : "rgba(239, 68, 68, 0.24)"
            }`,
          })}
        >
          <Stack spacing="sm">
            <Text weight={700}>
              Mass upload hit a render error after finishing.
            </Text>
            <Text size="sm" color="dimmed">
              The uploads themselves may still have completed. Refresh this page
              to continue.
            </Text>
            <Button
              variant="light"
              color="red"
              onClick={() => window.location.reload()}
            >
              Refresh page
            </Button>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const useStyles = createStyles((theme) => ({
  hero: {
    marginBottom: 24,
    padding: "18px 24px",
    borderRadius: 20,
    width: "100%",
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(135deg, rgba(10, 20, 36, 0.96) 0%, rgba(11, 35, 35, 0.9) 100%)"
        : "linear-gradient(135deg, rgba(240, 249, 255, 0.95) 0%, rgba(236, 253, 245, 0.95) 100%)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(var(--ls-bulk-btn-rgb), 0.28)"
        : "rgba(var(--ls-bulk-btn-rgb), 0.22)"
    }`,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 12px 40px rgba(0, 0, 0, 0.35), 0 0 60px rgba(var(--ls-bulk-btn-rgb), 0.08)"
        : "0 12px 40px rgba(var(--ls-bulk-btn-rgb), 0.08)",
  },
  heroTitle: {
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
    fontWeight: 800,
    letterSpacing: "-0.03em",
  },
  heroText: {
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[4]
        : theme.colors.gray[7],
    maxWidth: 920,
    lineHeight: 1.55,
  },
  actionBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginTop: 18,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  createButton: {
    minWidth: 210,
    height: 46,
    borderRadius: 14,
    border: "1px solid rgba(var(--ls-accent-rgb), 0.28)",
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(135deg, rgba(var(--ls-accent-rgb), 0.18) 0%, rgba(var(--ls-accent-rgb), 0.3) 100%)"
        : "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
    color: theme.colorScheme === "dark" ? "var(--ls-accent)" : "#f8fffb",
    fontWeight: 700,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 0 24px rgba(var(--ls-accent-rgb), 0.2), 0 10px 26px rgba(0, 0, 0, 0.35)"
        : "0 10px 26px rgba(var(--ls-accent-rgb), 0.18)",
    transition: "all 0.22s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow:
        theme.colorScheme === "dark"
          ? "0 0 32px rgba(var(--ls-accent-rgb), 0.3), 0 14px 30px rgba(0, 0, 0, 0.4)"
          : "0 14px 30px rgba(var(--ls-accent-rgb), 0.24)",
    },
    "&:disabled": {
      opacity: 0.45,
      transform: "none",
      boxShadow: "none",
    },
  },
  progressCard: {
    position: "sticky",
    top: 70,
    zIndex: 30,
    marginBottom: 20,
    padding: "16px 20px",
    borderRadius: 16,
    background:
      theme.colorScheme === "dark"
        ? "rgba(13, 24, 30, 0.95)"
        : "rgba(255, 255, 255, 0.95)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(var(--ls-bulk-btn-rgb), 0.24)"
        : "rgba(var(--ls-bulk-btn-rgb), 0.18)"
    }`,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 8px 32px rgba(0, 0, 0, 0.35), 0 0 36px rgba(var(--ls-bulk-btn-rgb), 0.08)"
        : "0 8px 32px rgba(var(--ls-bulk-btn-rgb), 0.08)",
    backdropFilter: "blur(12px)",
  },
  progressBar: {
    height: 8,
    borderRadius: 999,
    background:
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    background:
      "linear-gradient(90deg, var(--ls-ring-outer) 0%, var(--ls-ring-inner) 50%, var(--ls-ring-center) 100%)",
    boxShadow: "0 0 14px rgba(var(--ls-ring-outer-rgb), 0.32)",
    transition: "width 0.3s ease",
  },
}));

const MassUpload = () => {
  const defaultAccentColor = useSiteTheme().presets[0]?.color ?? "#00ff5a";
  const { classes } = useStyles();
  const { colorScheme } = useMantineColorScheme();
  const t = useTranslate();
  const config = useConfig();
  const { user } = useUser();
  const modals = useModals();
  const allowUninvitedRegisteredShares = !!config.get(
    "share.allowUninvitedRegisteredShares",
  );
  const isLimitedRegisteredUser = !!user && user.canCreateShares === false;
  const canCurrentUserCreateShares =
    !isLimitedRegisteredUser || allowUninvitedRegisteredShares;
  const fallbackRegisteredMaxShareSize = isLimitedRegisteredUser
    ? parseInt(config.get("share.maxUninvitedRegisteredSize"))
    : parseInt(config.get("share.maxSize"));

  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingLimit, setIsLoadingLimit] = useState(true);
  const [maxShareSize, setMaxShareSize] = useState<number | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [_manifestName, setManifestName] = useState<string | null>(null);
  const [totalBytes, setTotalBytes] = useState(0);
  const speedRef = useRef({ bytes: 0, time: 0 });
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [lastNonZeroUploadSpeed, setLastNonZeroUploadSpeed] = useState(0);

  const multipartThreshold =
    Number(config.get("share.multipartThreshold")) || 50 * 1024 * 1024;
  const multipartPartSize = resolveChunkSize(config.get("share.chunkSize"));

  // Multipart is an object-storage feature. Assume it is unavailable until the
  // server says otherwise: the chunked fallback works in either configuration,
  // so guessing wrong here costs speed, while the reverse would break uploads.
  const [storageEnabled, setStorageEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/storage/multipart/config", { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load multipart config");
        return res.json();
      })
      .then((data) => setStorageEnabled(data?.enabled === true))
      .catch(() => setStorageEnabled(false));
  }, []);

  const bulkContext: BulkUploadContext = {
    shareIdLength: config.get("share.shareIdLength"),
    multipartThreshold,
    multipartPartSize,
    defaultAccentColor,
    storageEnabled,
    chunkSize: resolveChunkSize(config.get("share.chunkSize")),
  };

  const overallProgress = useMemo(() => {
    const total = files.length;
    const weightedUploadedBytes = files.reduce((sum, file) => {
      const uploadedBytes = Number.isFinite(file.uploadedBytes)
        ? Math.max(0, Math.min(file.size, file.uploadedBytes || 0))
        : null;

      if (uploadedBytes !== null) {
        return sum + uploadedBytes;
      }

      const safeProgress = Number.isFinite(file.uploadingProgress)
        ? Math.max(0, Math.min(100, file.uploadingProgress))
        : 0;
      return sum + file.size * (safeProgress / 100);
    }, 0);
    const totalProgress =
      totalBytes > 0 && Number.isFinite(weightedUploadedBytes)
        ? (weightedUploadedBytes / totalBytes) * 100
        : 0;

    return {
      total,
      percent: Number.isFinite(totalProgress) ? totalProgress : 0,
      uploadedBytes: Number.isFinite(weightedUploadedBytes)
        ? weightedUploadedBytes
        : 0,
    };
  }, [files, totalBytes]);

  useConfirmLeave({
    message: t("upload.notify.confirm-leave"),
    enabled: isUploading,
  });

  useEffect(() => {
    fetch("/api/shares/limit")
      .then((res) => res.json())
      .then((data) => {
        setMaxShareSize(data.maxShareSize);
        setIsLoadingLimit(false);
      })
      .catch(() => {
        setMaxShareSize(
          user
            ? fallbackRegisteredMaxShareSize
            : parseInt(config.get("share.maxAnonymousSize")),
        );
        setIsLoadingLimit(false);
      });
  }, [config, fallbackRegisteredMaxShareSize, user]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isUploading || overallProgress.uploadedBytes === 0) return;
      const now = Date.now();
      const elapsedSeconds = (now - speedRef.current.time) / 1000;
      const deltaBytes = overallProgress.uploadedBytes - speedRef.current.bytes;

      if (elapsedSeconds > 0) {
        const nextSpeed = Math.max(
          (deltaBytes * 8) / 1024 / 1024 / elapsedSeconds,
          0,
        );
        setUploadSpeed(nextSpeed);
        if (nextSpeed > 0) {
          setLastNonZeroUploadSpeed(nextSpeed);
        }
        speedRef.current = { bytes: overallProgress.uploadedBytes, time: now };
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isUploading, overallProgress.uploadedBytes]);

  useEffect(() => {
    const fileErrorCount = files.filter(
      (file) => file.uploadingProgress === -1,
    ).length;
    if (fileErrorCount > 0 && !errorToastShown) {
      toast.error(t("upload.notify.count-failed", { count: fileErrorCount }), {
        withCloseButton: false,
        autoClose: false,
      });
      errorToastShown = true;
    } else if (fileErrorCount === 0) {
      cleanNotifications();
      errorToastShown = false;
    }
  }, [files, t]);

  const handleDropzoneFilesChanged = (appendingFiles: FileUpload[]) => {
    setManifestName(null);
    setFiles((current) => [...current, ...appendingFiles]);
  };

  const setFileProgress = (
    fileIndex: number,
    progress: number,
    uploadedBytes?: number,
  ) => {
    const safeProgress = Number.isFinite(progress) ? progress : 0;
    const safeUploadedBytes = Number.isFinite(uploadedBytes)
      ? Math.max(0, uploadedBytes || 0)
      : undefined;
    setFiles((currentFiles) => {
      const nextFiles = [...currentFiles];
      const targetFile = nextFiles[fileIndex];
      if (!targetFile) {
        return currentFiles;
      }

      targetFile.uploadingProgress = safeProgress;
      if (safeUploadedBytes !== undefined) {
        targetFile.uploadedBytes = Math.min(targetFile.size, safeUploadedBytes);
      }

      return nextFiles;
    });
  };

  const handleCreateBulkShares = async (bulkOptions: BulkShareOptions) => {
    if (files.length === 0) return;
    const normalizedOptions = normalizeBulkOptions(
      bulkOptions,
      defaultAccentColor,
    );

    setIsUploading(true);
    setCompletedCount(0);
    setTotalBytes(files.reduce((sum, file) => sum + file.size, 0));
    speedRef.current = { bytes: 0, time: Date.now() };
    setUploadSpeed(0);
    setLastNonZeroUploadSpeed(0);

    try {
      const results = await Promise.allSettled(
        files.map((file, fileIndex) =>
          promiseLimit(async () => {
            const entry = await uploadSingleFileAsShare(
              file,
              fileIndex,
              normalizedOptions,
              bulkContext,
              setFileProgress,
            );
            setCompletedCount((current) => current + 1);
            return entry;
          }),
        ),
      );

      const successfulEntries = results
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<{
            fileName: string;
            link: string;
          }> => result.status === "fulfilled",
        )
        .map((result) => result.value);
      const failedCount = results.length - successfulEntries.length;

      if (successfulEntries.length > 0) {
        setManifestName(downloadManifest(successfulEntries));
        if (failedCount === 0) {
          setFiles([]);
        } else {
          setFiles((currentFiles) =>
            currentFiles.filter(
              (_, index) => results[index]?.status !== "fulfilled",
            ),
          );
        }
      }

      if (failedCount === 0) {
        toast.success(
          `Created ${successfulEntries.length} share links and downloaded the manifest.`,
        );
      } else if (successfulEntries.length > 0) {
        toast.error(
          `${failedCount} file${failedCount === 1 ? "" : "s"} failed. The manifest only includes successful uploads.`,
          {
            autoClose: false,
          },
        );
      } else {
        toast.error("Bulk upload failed before any share links were created.", {
          autoClose: false,
        });
      }
    } finally {
      setIsUploading(false);
      setUploadSpeed(0);
    }
  };

  const openBulkShareSettings = () => {
    const maxExpiration =
      isLimitedRegisteredUser && allowUninvitedRegisteredShares
        ? config.get("share.maxUninvitedRegisteredExpiration")
        : !user
          ? config.get("share.maxAnonymousExpiration")
          : config.get("share.maxExpiration");
    const enableEmailRecepients = config.get(
      "email.enableShareEmailRecipients",
    );
    const groupMemberships = getUserGroupMemberships(user);
    const groupOptions = groupMemberships.map((membership) => ({
      value: membership.group.id,
      label: membership.group.name,
    }));

    modals.openModal({
      title: "Bulk Share Settings",
      size: "md",
      centered: true,
      styles: getBulkModalStyles(colorScheme === "dark"),
      children: (
        <BulkShareSettingsModal
          defaultOptions={{
            expiration:
              maxExpiration.value === 0
                ? "7-days"
                : `${Math.max(1, maxExpiration.value)}-${maxExpiration.unit}`,
            recipients: [],
            description: undefined,
            accentColor: defaultAccentColor,
            shareWithGroup: groupOptions.length > 0,
            groupId: groupOptions[0]?.value || null,
            removeExtensionFromShareName: false,
            shareNamePrefix: "",
            security: {},
          }}
          enableEmailRecepients={enableEmailRecepients}
          isUserSignedIn={!!user}
          groupName={groupOptions[0]?.label}
          groupOptions={groupOptions}
          maxExpiration={maxExpiration}
          onSubmit={handleCreateBulkShares}
        />
      ),
    });
  };

  if (isLoadingLimit || maxShareSize === null) {
    return <LoadingOverlay visible />;
  }

  return (
    <>
      <Meta title="Bulk Upload" />
      {isUploading && (
        <Box className={classes.progressCard}>
          <Group position="apart" mb={10}>
            <Group spacing={8}>
              <TbPlaylistAdd size={18} style={{ color: "var(--ls-bulk-btn)" }} />
              <Text weight={700}>Creating individual share links</Text>
              <Badge variant="light" color="cyan">
                {completedCount}/{files.length} complete
              </Badge>
            </Group>
            <Group spacing={8}>
              <Badge
                variant="light"
                color="teal"
                leftSection={<TbArrowUp size={12} />}
              >
                {(uploadSpeed > 0 ? uploadSpeed : lastNonZeroUploadSpeed) < 1
                  ? `${((uploadSpeed > 0 ? uploadSpeed : lastNonZeroUploadSpeed) * 1000).toFixed(0)} Kbps`
                  : `${(uploadSpeed > 0 ? uploadSpeed : lastNonZeroUploadSpeed).toFixed(1)} Mbps`}
              </Badge>
              <Badge variant="light" color="green">
                {formatBytes(overallProgress.uploadedBytes)} /{" "}
                {formatBytes(totalBytes)}
              </Badge>
            </Group>
          </Group>
          <div className={classes.progressBar}>
            <div
              className={classes.progressFill}
              style={{ width: `${overallProgress.percent}%` }}
            />
          </div>
        </Box>
      )}

      <Box className={classes.hero}>
        <Group spacing={10} mb={10}>
          <TbFiles size={24} style={{ color: "var(--ls-bulk-btn)" }} />
          <Title order={2} className={classes.heroTitle}>
            Bulk Upload
          </Title>
        </Group>
        <Text className={classes.heroText}>
          Drop in a stack of files and{" "}
          {config.get("general.appName") || "the app"} will generate a separate
          share per file. Once the upload finishes, a txt file will generate
          with each file and its corresponding share link.
        </Text>
      </Box>

      <Box className={classes.actionBar}>
        <Button
          className={classes.createButton}
          leftIcon={<TbLink size={18} />}
          loading={isUploading}
          disabled={
            files.length === 0 || (!!user && !canCurrentUserCreateShares)
          }
          onClick={openBulkShareSettings}
        >
          Create Separate Shares
        </Button>
      </Box>

      <Dropzone
        maxShareSize={maxShareSize}
        isUserSignedIn={!!user}
        onFilesChanged={handleDropzoneFilesChanged}
        isUploading={isUploading}
      />

      <MassUploadErrorBoundary>
        {files.length > 0 ? (
          <FileList<FileUpload> files={files} setFiles={setFiles} />
        ) : null}
      </MassUploadErrorBoundary>
    </>
  );
};

const MassUploadPage = () => {
  const config = useConfig();
  const router = useRouter();

  const bulkMode = getBulkUploadMode(config.get);
  useEffect(() => {
    if (bulkMode === "modal") {
      router.replace("/upload");
    }
  }, [bulkMode, router]);
  if (bulkMode === "modal") return <LoadingOverlay visible />;

  return <MassUpload />;
};

export default MassUploadPage;
