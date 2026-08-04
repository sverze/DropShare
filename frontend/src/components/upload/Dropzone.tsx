import { createStyles, Group, Text, Box, Button } from "@mantine/core";
import { Dropzone as MantineDropzone } from "@mantine/dropzone";
import React, { ForwardedRef, ReactNode, useRef } from "react";
import { TbCloudUpload, TbFolder } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import { FileUpload } from "../../types/File.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";

type FilesChangedHandler = (..._args: [FileUpload[]]) => void;

const useStyles = createStyles((theme) => {
  const accent = "var(--ls-accent)";
  const accentRgb = "var(--ls-accent-rgb)";

  return {
    wrapper: {
      position: "relative",
      marginBottom: 30,
    },

    dropzone: {
      background:
        theme.colorScheme === "dark"
          ? "rgba(var(--ls-panel-bg-rgb), 0.6)"
          : "linear-gradient(180deg, rgba(244, 252, 245, 0.96) 0%, rgba(235, 247, 237, 0.99) 100%)",
      backdropFilter: "blur(12px)",
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor:
        theme.colorScheme === "dark"
          ? `rgba(${accentRgb}, 0.4)`
          : `rgba(${accentRgb}, 0.62)`,
      borderRadius: 16,
      paddingTop: 40,
      paddingBottom: 40,
      boxShadow:
        theme.colorScheme === "dark"
          ? `0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(${accentRgb}, 0.05)`
          : `0 18px 38px rgba(15, 23, 42, 0.08), 0 0 58px rgba(${accentRgb}, 0.16)`,
      transition: "all 0.25s ease",

      "&:hover": {
        borderColor: accent,
        boxShadow:
          theme.colorScheme === "dark"
            ? `0 4px 24px rgba(0, 0, 0, 0.3), 0 0 50px rgba(${accentRgb}, 0.15)`
            : `0 18px 40px rgba(15, 23, 42, 0.09), 0 0 68px rgba(${accentRgb}, 0.2)`,
        background:
          theme.colorScheme === "dark"
            ? `rgba(${accentRgb}, 0.08)`
            : `rgba(${accentRgb}, 0.14)`,
      },

      "&[data-accept]": {
        borderColor: accent,
        borderStyle: "solid",
        boxShadow: `0 0 60px rgba(${accentRgb}, 0.3)`,
        background:
          theme.colorScheme === "dark"
            ? `rgba(${accentRgb}, 0.08)`
            : `rgba(${accentRgb}, 0.12)`,
      },

      "&[data-reject]": {
        borderColor: "#ef4444",
        borderStyle: "solid",
        boxShadow: "0 0 60px rgba(239, 68, 68, 0.3)",
        background:
          theme.colorScheme === "dark"
            ? "rgba(239, 68, 68, 0.08)"
            : "rgba(239, 68, 68, 0.05)",
      },

      "&[data-disabled]": {
        opacity: 0.5,
        filter: "grayscale(0.2)",
        cursor: "not-allowed",
        boxShadow:
          theme.colorScheme === "dark"
            ? "0 4px 24px rgba(0, 0, 0, 0.28)"
            : "0 4px 24px rgba(15, 23, 42, 0.06)",
      },
    },

    icon: {
      color: accent,
      filter: `drop-shadow(0 0 8px rgba(${accentRgb}, 0.4))`,
    },

    title: {
      color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
      fontWeight: 700,
    },

    description: {
      color:
        theme.colorScheme === "dark"
          ? theme.colors.gray[4]
          : theme.colors.gray[6],
    },

    hint: {
      color:
        theme.colorScheme === "dark"
          ? theme.colors.gray[5]
          : theme.colors.gray[5],
      fontSize: 13,
    },

    modeToggle: {
      marginBottom: 16,
    },
    modeRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      marginBottom: 16,
      flexWrap: "wrap",
    },

    modeControl: {
      backgroundColor:
        theme.colorScheme === "dark"
          ? "rgba(var(--ls-panel-bg-rgb), 0.6)"
          : "rgba(240, 250, 242, 0.94)",
      border: `1px solid ${
        theme.colorScheme === "dark"
          ? `rgba(${accentRgb}, 0.2)`
          : `rgba(${accentRgb}, 0.3)`
      }`,
      borderRadius: 12,
      padding: 4,
    },

    modeLabel: {
      fontSize: 13,
      fontWeight: 500,
      padding: "8px 16px",
      borderRadius: 8,
      transition: "all 0.2s ease",

      "&[data-active]": {
        backgroundColor: `rgba(${accentRgb}, 0.15)`,
        color: accent,
        boxShadow: `0 0 12px rgba(${accentRgb}, 0.2)`,
      },

      "&:not([data-active])": {
        color:
          theme.colorScheme === "dark"
            ? theme.colors.gray[5]
            : theme.colors.gray[6],
        "&:hover": {
          backgroundColor:
            theme.colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
        },
      },
    },

    folderDropzone: {
      cursor: "pointer",
    },

    guestNotice: {
      overflow: "hidden",
      borderRadius: 24,
      border: `1px solid ${
        theme.colorScheme === "dark"
          ? `rgba(${accentRgb}, 0.18)`
          : `rgba(${accentRgb}, 0.28)`
      }`,
      background:
        theme.colorScheme === "dark"
          ? `linear-gradient(135deg, rgba(${accentRgb}, 0.12), transparent 42%), rgba(3, 10, 7, 0.8)`
          : `linear-gradient(135deg, rgba(${accentRgb}, 0.1), rgba(255, 255, 255, 0.86) 46%), rgba(248, 255, 250, 0.9)`,
      boxShadow:
        theme.colorScheme === "dark"
          ? "0 18px 55px rgba(0, 0, 0, 0.34)"
          : "0 18px 45px rgba(15, 23, 42, 0.08)",
    },

    guestNoticeInner: {
      padding: "26px 30px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",

      [theme.fn.smallerThan("sm")]: {
        padding: "22px",
      },
    },

    guestBadge: {
      display: "inline-flex",
      marginBottom: 12,
      padding: "7px 12px",
      borderRadius: 999,
      color: accent,
      background: `rgba(${accentRgb}, 0.09)`,
      border: `1px solid rgba(${accentRgb}, 0.18)`,
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },

    guestTitle: {
      color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: "-0.03em",
      lineHeight: 1.18,

      [theme.fn.smallerThan("sm")]: {
        fontSize: 21,
      },
    },

    guestText: {
      maxWidth: 660,
      color:
        theme.colorScheme === "dark"
          ? theme.colors.gray[4]
          : theme.colors.gray[7],
      lineHeight: 1.55,
      textAlign: "center",
    },

    guestActions: {
      marginTop: 20,
      justifyContent: "center",
    },
  };
});

const Dropzone = ({
  title,
  isUploading,
  maxShareSize,
  limitedRegisteredMaxShareSize,
  invitedRegisteredMaxShareSize,
  isUserSignedIn = false,
  guestUploadsDisabled = false,
  rightAction,
  onFilesChanged,
}: {
  title?: string;
  isUploading: boolean;
  maxShareSize: number;
  limitedRegisteredMaxShareSize?: number;
  invitedRegisteredMaxShareSize?: number;
  isUserSignedIn?: boolean;
  guestUploadsDisabled?: boolean;
  rightAction?: ReactNode;
  onFilesChanged: FilesChangedHandler;
}) => {
  const t = useTranslate();
  const { classes } = useStyles();
  const openRef = useRef<() => void>();
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const showGuestLock = !isUserSignedIn && guestUploadsDisabled;
  const lockedDescription =
    "Guest uploads are disabled right now. Create an account or sign in to upload files.";
  const guestTierHint =
    !isUserSignedIn &&
    limitedRegisteredMaxShareSize &&
    invitedRegisteredMaxShareSize
      ? `Registered accounts can upload up to ${byteToHumanSizeString(
          limitedRegisteredMaxShareSize,
        )}. Invited accounts can upload up to ${byteToHumanSizeString(
          invitedRegisteredMaxShareSize,
        )}.`
      : null;

  const renderGuestUploadNotice = () => {
    if (!showGuestLock) return null;

    return (
      <Box className={classes.guestNotice}>
        <Box className={classes.guestNoticeInner}>
          <Text component="span" className={classes.guestBadge}>
            Uploads locked
          </Text>
          <Text className={classes.guestTitle}>
            You are browsing as a guest
          </Text>
          <Text mt={8} className={classes.guestText}>
            {lockedDescription}
          </Text>
          <Group spacing="sm" className={classes.guestActions}>
            <Button component="a" href="/auth/signUp" radius="xl" size="sm">
              Create Account
            </Button>
            <Button
              component="a"
              href="/auth/signIn"
              radius="xl"
              size="sm"
              variant="default"
            >
              Sign In
            </Button>
          </Group>
        </Box>
      </Box>
    );
  };

  const handleFiles = (files: FileUpload[]) => {
    if (showGuestLock) {
      toast.error("You must register to upload files");
      return;
    }

    const fileSizeSum = files.reduce((n, { size }) => n + size, 0);

    if (fileSizeSum > maxShareSize) {
      toast.error(
        t("upload.dropzone.notify.file-too-big", {
          maxSize: byteToHumanSizeString(maxShareSize),
        }),
      );
    } else {
      files = files.map((newFile) => {
        const extendedFile = newFile as FileUpload & {
          webkitRelativePath?: string;
          path?: string;
          relativePathOverride?: string;
        };
        extendedFile.uploadingProgress = 0;
        if (
          !extendedFile.webkitRelativePath &&
          typeof extendedFile.path === "string"
        ) {
          const normalized = extendedFile.path.replace(/^\.?\/+/, "");
          if (normalized.includes("/")) {
            extendedFile.relativePathOverride = normalized;
          }
        }
        return extendedFile;
      });
      onFilesChanged(files);
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      const files = Array.from(fileList) as FileUpload[];
      handleFiles(files);
    }
    e.target.value = "";
  };

  const openFolderPicker = () => {
    if (!folderInputRef.current) return;
    folderInputRef.current.value = "";
    folderInputRef.current.click();
  };

  return (
    <div className={classes.wrapper}>
      <input
        ref={(node) => {
          folderInputRef.current = node;
          if (node) {
            (node as any).webkitdirectory = true;
            (node as any).directory = true;
            (node as any).mozdirectory = true;
          }
        }}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFolderSelect}
      />

      <Box className={classes.modeRow}>
        <div />
        {rightAction}
      </Box>

      {showGuestLock ? (
        renderGuestUploadNotice()
      ) : (
        <MantineDropzone
          onReject={(e) => {
            toast.error(e[0].errors[0].message);
          }}
          disabled={isUploading}
          openRef={openRef as ForwardedRef<() => void>}
          onDrop={(files: FileUpload[]) => handleFiles(files)}
          className={classes.dropzone}
          radius="md"
        >
          <div style={{ pointerEvents: "none" }}>
            <Group position="center">
              <TbCloudUpload size={50} className={classes.icon} />
            </Group>
            <Text align="center" size="lg" mt="xl" className={classes.title}>
              {title || <FormattedMessage id="upload.dropzone.title" />}
            </Text>
            <Text
              align="center"
              size="sm"
              mt="xs"
              className={classes.description}
            >
              Drop files or a whole folder here, or click to browse. A
              folder&apos;s structure is kept (max{" "}
              {byteToHumanSizeString(maxShareSize)}).
            </Text>
            {guestTierHint && (
              <Text align="center" mt="xs" className={classes.hint}>
                {guestTierHint}
              </Text>
            )}
            <Group position="center" mt="md">
              <Button
                variant="subtle"
                size="xs"
                radius="xl"
                leftIcon={<TbFolder size={16} />}
                style={{ pointerEvents: "auto" }}
                onClick={(event) => {
                  event.stopPropagation();
                  openFolderPicker();
                }}
              >
                Select a folder instead
              </Button>
            </Group>
          </div>
        </MantineDropzone>
      )}
    </div>
  );
};

export default Dropzone;
