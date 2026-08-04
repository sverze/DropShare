import {
  ActionIcon,
  Badge,
  Box,
  Button,
  createStyles,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import {
  TbChevronLeft,
  TbChevronRight,
  TbDownload,
  TbExternalLink,
  TbFile,
  TbFileInfo,
  TbGripVertical,
  TbLayoutCards,
  TbMusic,
  TbPhoto,
  TbPlayerPlay,
  TbStack2,
  TbStackPop,
  TbVideo,
  TbX,
} from "react-icons/tb";
import { FileListItem } from "../../types/File.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import { rgbString as hexToRgb } from "../../theme/theme.util";

type PreviewType = "audio" | "video" | "image" | "file";

type LayoutFile = FileListItem & {
  previewGroup?: boolean;
  editableName?: string;
  relativePath?: string | null;
  relativePathOverride?: string | null;
  previewHeader?: string | null;
};

type LayoutItem =
  | {
      key: string;
      type: "group";
      previewType: Exclude<PreviewType, "file">;
      indices: number[];
    }
  | {
      key: string;
      type: "single";
      previewType: PreviewType;
      index: number;
      grouped: boolean;
    };

const useStyles = createStyles(
  (theme, { accentRgb }: { accentRgb: string }) => ({
    modalBody: {
      minHeight: "100vh",
      background:
        theme.colorScheme === "dark"
          ? `radial-gradient(circle at 18% 8%, rgba(${accentRgb}, 0.16), transparent 34%), radial-gradient(circle at 88% 18%, rgba(${accentRgb}, 0.08), transparent 30%), #030705`
          : "linear-gradient(180deg, rgba(240, 253, 244, 0.92), #fff)",
    },
    shell: {
      width: "min(980px, calc(100vw - 32px))",
      margin: "0 auto",
      padding: "18px 0 32px",
    },
    topBar: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      marginBottom: 16,
      padding: "12px 14px",
      borderRadius: 8,
      border: `1px solid rgba(${accentRgb}, ${theme.colorScheme === "dark" ? 0.22 : 0.18})`,
      background:
        theme.colorScheme === "dark"
          ? "linear-gradient(135deg, rgba(12, 18, 28, 0.94), rgba(7, 16, 13, 0.92))"
          : "rgba(255, 255, 255, 0.94)",
      backdropFilter: "blur(18px)",
      boxShadow:
        theme.colorScheme === "dark"
          ? `0 18px 42px rgba(0, 0, 0, 0.36), 0 0 34px rgba(${accentRgb}, 0.08)`
          : "0 18px 42px rgba(15, 23, 42, 0.08)",
    },
    previewCard: {
      position: "relative",
      borderRadius: 8,
      border: `1px solid ${
        theme.colorScheme === "dark"
          ? `rgba(${accentRgb}, 0.2)`
          : `rgba(${accentRgb}, 0.18)`
      }`,
      background:
        theme.colorScheme === "dark"
          ? "linear-gradient(135deg, rgba(16, 19, 25, 0.94), rgba(7, 15, 13, 0.92))"
          : "rgba(255, 255, 255, 0.94)",
      boxShadow:
        theme.colorScheme === "dark"
          ? "0 18px 48px rgba(0, 0, 0, 0.35)"
          : "0 18px 42px rgba(15, 23, 42, 0.08)",
      padding: 16,
      cursor: "grab",
      transition:
        "border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease",

      "&:hover": {
        transform: "translateY(-1px)",
        borderColor:
          theme.colorScheme === "dark"
            ? "rgba(var(--ls-accent-rgb), 0.36)"
            : `rgba(${accentRgb}, 0.34)`,
      },
    },
    dragging: {
      opacity: 0.52,
      cursor: "grabbing",
    },
    dragOver: {
      borderColor: "rgba(var(--ls-accent-rgb), 0.72)",
      boxShadow:
        "0 0 0 1px rgba(var(--ls-accent-rgb), 0.28), 0 20px 54px rgba(0, 0, 0, 0.36)",
    },
    dragHandle: {
      position: "absolute",
      top: 12,
      right: 12,
      color:
        theme.colorScheme === "dark"
          ? theme.colors.gray[4]
          : theme.colors.gray[6],
    },
    actionFrame: {
      display: "inline-flex",
      gap: 6,
      padding: 5,
      borderRadius: 8,
      border: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(15, 23, 42, 0.08)"
      }`,
      background:
        theme.colorScheme === "dark"
          ? "rgba(8, 13, 12, 0.72)"
          : "rgba(255, 255, 255, 0.9)",
    },
    iconPlate: {
      width: 86,
      height: 86,
      borderRadius: 8,
      display: "grid",
      placeItems: "center",
      flexShrink: 0,
      background:
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.09)"
          : "rgba(15, 23, 42, 0.06)",
      color:
        theme.colorScheme === "dark"
          ? theme.colors.gray[5]
          : theme.colors.gray[6],
    },
    timeline: {
      height: 7,
      flex: 1,
      borderRadius: 999,
      background:
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.18)"
          : "rgba(15, 23, 42, 0.16)",
      position: "relative",
      overflow: "hidden",
    },
    timelineDot: {
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: theme.white,
      position: "absolute",
      left: "8%",
      top: "50%",
      transform: "translateY(-50%)",
    },
    mediaFrame: {
      width: "100%",
      height: "clamp(190px, 34vh, 330px)",
      borderRadius: 8,
      overflow: "hidden",
      background: "#000",
      display: "grid",
      placeItems: "center",
      position: "relative",
    },
    media: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
    },
    thumbnailStrip: {
      display: "flex",
      gap: 10,
      overflowX: "auto",
      paddingTop: 12,
    },
    thumbnail: {
      width: 72,
      height: 46,
      borderRadius: 8,
      border: "1px solid rgba(var(--ls-accent-rgb), 0.28)",
      background:
        theme.colorScheme === "dark"
          ? "rgba(255,255,255,0.08)"
          : "rgba(15,23,42,0.06)",
      overflow: "hidden",
      display: "grid",
      placeItems: "center",
      flexShrink: 0,
    },
    headerInput: {
      flex: 1,
      minWidth: 220,

      input: {
        height: 34,
        borderRadius: 8,
        fontWeight: 700,
        background:
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.055)"
            : "rgba(255, 255, 255, 0.82)",
        borderColor:
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(15, 23, 42, 0.1)",
      },
    },
    fileInfo: {
      minWidth: 180,
      color:
        theme.colorScheme === "dark"
          ? theme.colors.gray[4]
          : theme.colors.gray[7],
    },
    playOverlay: {
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center",
      pointerEvents: "none",
    },
    playButton: {
      width: 56,
      height: 56,
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      color: theme.white,
      background: `rgba(${accentRgb}, 0.64)`,
      boxShadow: `0 12px 34px rgba(${accentRgb}, 0.32)`,
      backdropFilter: "blur(8px)",
    },
    emptyState: {
      borderRadius: 8,
      border: `1px dashed ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.14)"
          : "rgba(15, 23, 42, 0.16)"
      }`,
      padding: 32,
      textAlign: "center",
    },
  }),
);

const isBrowserFile = (file: LayoutFile): file is LayoutFile & File =>
  typeof File !== "undefined" && file instanceof File;

const getName = (file: LayoutFile, fallbackIndex: number) => {
  const relativePath =
    file.relativePathOverride ||
    file.relativePath ||
    ("webkitRelativePath" in file ? file.webkitRelativePath : "") ||
    file.name;
  return (
    file.editableName ||
    String(relativePath || file.name || `File ${fallbackIndex + 1}`)
      .split("/")
      .pop() ||
    file.name
  );
};

const getSize = (file: LayoutFile) => {
  const size = Number(file.size);
  return Number.isFinite(size) ? size : 0;
};

const lowerName = (file: LayoutFile) => String(file.name || "").toLowerCase();

const getPreviewType = (file: LayoutFile): PreviewType => {
  const mimeType = "type" in file ? String(file.type || "").toLowerCase() : "";
  const name = lowerName(file);

  if (
    mimeType.startsWith("audio/") ||
    /\.(mp3|wav|flac|aac|ogg|m4a|aif|aiff|alac|opus|m4b)$/.test(name)
  )
    return "audio";
  if (
    mimeType.startsWith("video/") ||
    /\.(mp4|webm|mov|m4v|avi|mkv)$/.test(name)
  )
    return "video";
  if (
    mimeType.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/.test(name)
  )
    return "image";
  return "file";
};

const TypeIcon = ({
  type,
  size = 28,
}: {
  type: PreviewType;
  size?: number;
}) => {
  if (type === "audio") return <TbMusic size={size} />;
  if (type === "video") return <TbVideo size={size} />;
  if (type === "image") return <TbPhoto size={size} />;
  return <TbFile size={size} />;
};

const buildLayoutItems = (files: LayoutFile[]): LayoutItem[] => {
  const items: LayoutItem[] = [];
  const groupedTypes = new Set<Exclude<PreviewType, "file">>();

  files.forEach((file, index) => {
    if ("deleted" in file && file.deleted) return;

    const previewType = getPreviewType(file);
    const grouped = previewType !== "file" && file.previewGroup !== false;

    if (grouped) {
      if (groupedTypes.has(previewType)) return;
      groupedTypes.add(previewType);

      const indices = files
        .map((candidate, candidateIndex) => ({
          candidate: candidate as LayoutFile,
          candidateIndex,
        }))
        .filter(
          ({ candidate }) =>
            !("deleted" in candidate && candidate.deleted) &&
            getPreviewType(candidate) === previewType &&
            candidate.previewGroup !== false,
        )
        .map(({ candidateIndex }) => candidateIndex);

      items.push({
        key: `group-${previewType}`,
        type: "group",
        previewType,
        indices,
      });
      return;
    }

    items.push({
      key: `single-${index}`,
      type: "single",
      previewType,
      index,
      grouped,
    });
  });

  return items;
};

const moveIndicesBefore = (
  files: LayoutFile[],
  draggedIndices: number[],
  targetIndices: number[],
) => {
  const dragged = new Set(draggedIndices);
  const movingFiles = files.filter((_, index) => dragged.has(index));
  const remainingFiles = files.filter((_, index) => !dragged.has(index));
  const firstTargetIndex = targetIndices.find((index) => !dragged.has(index));
  const targetFile =
    firstTargetIndex === undefined ? null : files[firstTargetIndex];
  const insertIndex = targetFile
    ? remainingFiles.indexOf(targetFile)
    : remainingFiles.length;
  const nextFiles = [...remainingFiles];
  nextFiles.splice(
    insertIndex < 0 ? nextFiles.length : insertIndex,
    0,
    ...movingFiles,
  );
  return nextFiles;
};

const useObjectUrl = (file?: LayoutFile | null) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !isBrowserFile(file)) {
      setUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return url;
};

const getServerPreviewUrl = (file: LayoutFile, shareId?: string) => {
  if (!shareId || !("id" in file) || !file.id) return null;
  return `/api/shares/${shareId}/files/${file.id}?download=false&preview=1`;
};

const getServerThumbnailUrl = (file: LayoutFile, shareId?: string) => {
  if (!shareId || !("id" in file) || !file.id) return null;
  return `/api/shares/${shareId}/files/${file.id}/thumbnail`;
};

const PreviewMedia = ({
  file,
  type,
  shareId,
  accentColor,
}: {
  file: LayoutFile;
  type: PreviewType;
  shareId?: string;
  accentColor: string;
}) => {
  const { classes } = useStyles({ accentRgb: hexToRgb(accentColor) });
  const objectUrl = useObjectUrl(file);
  const previewUrl = objectUrl || getServerPreviewUrl(file, shareId);
  const thumbnailUrl =
    type === "video" ? getServerThumbnailUrl(file, shareId) : null;

  if ((type === "image" || type === "video") && (previewUrl || thumbnailUrl)) {
    if (type === "image") {
      return (
        <img className={classes.media} src={previewUrl || ""} alt={file.name} />
      );
    }

    if (thumbnailUrl) {
      return (
        <>
          <img className={classes.media} src={thumbnailUrl} alt={file.name} />
          <Box className={classes.playOverlay}>
            <Box className={classes.playButton}>
              <TbPlayerPlay size={26} />
            </Box>
          </Box>
        </>
      );
    }

    return (
      <video
        className={classes.media}
        src={previewUrl || undefined}
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return <TypeIcon type={type} size={52} />;
};

export default function PreviewLayoutEditor<T extends FileListItem>({
  opened,
  files,
  setFiles,
  onClose,
  shareId,
  accentColor = "#00ff5a",
}: {
  opened: boolean;
  files: T[];
  setFiles: (_files: T[]) => void;
  onClose: () => void;
  shareId?: string;
  accentColor?: string;
}) {
  const accentRgb = hexToRgb(accentColor);
  const { classes, cx } = useStyles({ accentRgb });
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const layoutItems = useMemo(
    () => buildLayoutItems(files as LayoutFile[]),
    [files],
  );

  const withLayoutFields = (
    file: LayoutFile,
    order: number,
    previewGroup = file.previewGroup ?? true,
  ) => {
    if ("uploadingProgress" in file) {
      file.order = order;
      file.previewGroup = previewGroup;
      return file;
    }

    return { ...file, order, previewGroup };
  };

  const updateFiles = (nextFiles: LayoutFile[]) => {
    setFiles(
      nextFiles.map((file, index) => withLayoutFields(file, index)) as T[],
    );
  };

  const setGrouped = (indices: number[], grouped: boolean) => {
    updateFiles(
      (files as LayoutFile[]).map((file, index) =>
        indices.includes(index) ? withLayoutFields(file, index, grouped) : file,
      ),
    );
  };

  const setPreviewHeader = (index: number, previewHeader: string) => {
    const nextPreviewHeader = previewHeader.length > 0 ? previewHeader : null;

    updateFiles(
      (files as LayoutFile[]).map((file, fileIndex) => {
        if (fileIndex !== index) {
          return file;
        }

        if ("uploadingProgress" in file) {
          file.previewHeader = nextPreviewHeader;
          return withLayoutFields(file, fileIndex);
        }

        return withLayoutFields(
          {
            ...file,
            previewHeader: nextPreviewHeader,
          },
          fileIndex,
        );
      }),
    );
  };

  const getItemIndices = (item: LayoutItem) =>
    item.type === "group" ? item.indices : [item.index];

  const handleDrop = (targetItem: LayoutItem) => {
    const draggedItem = layoutItems.find((item) => item.key === draggedKey);
    if (!draggedItem || draggedItem.key === targetItem.key) {
      setDraggedKey(null);
      setDragOverKey(null);
      return;
    }

    updateFiles(
      moveIndicesBefore(
        files as LayoutFile[],
        getItemIndices(draggedItem),
        getItemIndices(targetItem),
      ),
    );
    setDraggedKey(null);
    setDragOverKey(null);
  };

  const renderActions = (item: LayoutItem) => (
    <Group spacing={8}>
      <Box className={classes.actionFrame}>
        <Tooltip label="File info">
          <ActionIcon variant="subtle">
            <TbFileInfo size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Open preview">
          <ActionIcon variant="subtle">
            <TbExternalLink size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Download">
          <ActionIcon variant="subtle" color="red">
            <TbDownload size={18} />
          </ActionIcon>
        </Tooltip>
      </Box>
      {item.type === "group" ? (
        <Button
          compact
          size="xs"
          variant="light"
          leftIcon={<TbStackPop size={14} />}
          onClick={() => setGrouped(item.indices, false)}
        >
          Ungroup
        </Button>
      ) : item.previewType !== "file" && !item.grouped ? (
        <Button
          compact
          size="xs"
          variant="light"
          leftIcon={<TbStack2 size={14} />}
          onClick={() => setGrouped([item.index], true)}
        >
          Group
        </Button>
      ) : null}
    </Group>
  );

  const renderPreviewCard = (item: LayoutItem) => {
    const indices = getItemIndices(item);
    const primaryIndex = indices[0];
    const primaryFile = (files as LayoutFile[])[primaryIndex];
    if (!primaryFile) return null;

    const title =
      item.type === "group"
        ? getName(primaryFile, primaryIndex)
        : getName(primaryFile, primaryIndex);
    const totalSize = indices.reduce(
      (sum, index) =>
        sum + getSize((files as LayoutFile[])[index] as LayoutFile),
      0,
    );
    const itemCount = indices.length;
    const headerValue = primaryFile.previewHeader || "";

    return (
      <Box
        key={item.key}
        className={cx(
          classes.previewCard,
          draggedKey === item.key && classes.dragging,
          dragOverKey === item.key &&
            draggedKey !== item.key &&
            classes.dragOver,
        )}
        draggable
        onDragStart={() => setDraggedKey(item.key)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOverKey(item.key);
        }}
        onDragLeave={() => setDragOverKey(null)}
        onDrop={(event) => {
          event.preventDefault();
          handleDrop(item);
        }}
        onDragEnd={() => {
          setDraggedKey(null);
          setDragOverKey(null);
        }}
      >
        <Tooltip label="Drag to reorder">
          <ActionIcon className={classes.dragHandle} variant="subtle">
            <TbGripVertical size={22} />
          </ActionIcon>
        </Tooltip>

        <Group spacing="sm" mb="sm" pr={40} noWrap>
          <TextInput
            className={classes.headerInput}
            placeholder="Optional header text for this preview"
            value={headerValue}
            maxLength={160}
            onChange={(event) =>
              setPreviewHeader(primaryIndex, event.currentTarget.value)
            }
          />
          {headerValue ? (
            <Badge variant="light" color="green">
              Shows on share
            </Badge>
          ) : null}
        </Group>

        {item.previewType === "audio" ? (
          <Group align="center" spacing="md" pr={40} noWrap>
            <Box className={classes.iconPlate}>
              <TbMusic size={38} />
            </Box>
            <Stack spacing="sm" sx={{ flex: 1, minWidth: 0 }}>
              <Group position="apart" align="flex-start">
                <Box sx={{ minWidth: 0 }}>
                  <Text weight={700} size="lg" lineClamp={2}>
                    {title}
                  </Text>
                  <Text size="sm" color="dimmed">
                    {itemCount} file{itemCount === 1 ? "" : "s"} ·{" "}
                    {byteToHumanSizeString(totalSize)}
                  </Text>
                </Box>
                {renderActions(item)}
              </Group>
              <Group noWrap>
                <ActionIcon
                  size={42}
                  radius={999}
                  variant="filled"
                >
                  <TbPlayerPlay size={21} />
                </ActionIcon>
                <Text color="dimmed">0:00</Text>
                <Box className={classes.timeline}>
                  <Box className={classes.timelineDot} />
                </Box>
                <Text color="dimmed">Preview</Text>
              </Group>
            </Stack>
            <Box className={classes.fileInfo}>
              <Text weight={700} transform="uppercase">
                File info
              </Text>
              <Text size="sm">
                Format:{" "}
                {lowerName(primaryFile).split(".").pop()?.toUpperCase() ||
                  "Audio"}
              </Text>
              <Text size="sm">
                Size: {byteToHumanSizeString(getSize(primaryFile))}
              </Text>
              {item.type === "group" ? (
                <Text size="sm">Grouped audio player</Text>
              ) : null}
            </Box>
          </Group>
        ) : (
          <Stack spacing="md" pr={48}>
            <Group position="apart" align="flex-start">
              <Group spacing="sm" sx={{ minWidth: 0 }}>
                <TypeIcon type={item.previewType} size={20} />
                <Box sx={{ minWidth: 0 }}>
                  <Text weight={700} size="md" lineClamp={2}>
                    {title}
                  </Text>
                  <Text size="sm" color="dimmed">
                    {itemCount} file{itemCount === 1 ? "" : "s"} ·{" "}
                    {byteToHumanSizeString(totalSize)}
                  </Text>
                </Box>
              </Group>
              <Group spacing="sm">
                {item.type === "group" && itemCount > 1 ? (
                  <Box className={classes.actionFrame}>
                    <ActionIcon variant="subtle">
                      <TbChevronLeft size={18} />
                    </ActionIcon>
                    <Text weight={700}>1 / {itemCount}</Text>
                    <ActionIcon variant="subtle">
                      <TbChevronRight size={18} />
                    </ActionIcon>
                  </Box>
                ) : null}
                {renderActions(item)}
              </Group>
            </Group>

            {item.previewType === "file" ? (
              <Group spacing="xl" align="center">
                <Box className={classes.iconPlate}>
                  <TbFile size={50} />
                </Box>
                <Box>
                  <Text weight={700}>{title}</Text>
                  <Text color="dimmed">
                    {byteToHumanSizeString(getSize(primaryFile))}
                  </Text>
                </Box>
              </Group>
            ) : (
              <Box className={classes.mediaFrame}>
                <PreviewMedia
                  file={primaryFile}
                  type={item.previewType}
                  shareId={shareId}
                  accentColor={accentColor}
                />
              </Box>
            )}

            {item.type === "group" && itemCount > 1 ? (
              <Box className={classes.thumbnailStrip}>
                {indices.map((index) => {
                  const file = (files as LayoutFile[])[index];
                  return (
                    <Box key={index} className={classes.thumbnail}>
                      <PreviewMedia
                        file={file}
                        type={item.previewType}
                        shareId={shareId}
                        accentColor={accentColor}
                      />
                    </Box>
                  );
                })}
              </Box>
            ) : null}
          </Stack>
        )}
      </Box>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      padding={0}
      withCloseButton={false}
      styles={{
        body: { padding: 0 },
        content: { background: "transparent" },
      }}
    >
      <Box className={classes.modalBody}>
        <Box className={classes.shell}>
          <Group
            className={classes.topBar}
            position="apart"
            align="center"
            noWrap
          >
            <Box>
              <Text weight={800} size="lg">
                Preview Share Layout
              </Text>
              <Group spacing={8} mt={4}>
                <Badge variant="light" color="green">
                  {layoutItems.length} preview card
                  {layoutItems.length === 1 ? "" : "s"}
                </Badge>
                <Badge variant="light" color="gray">
                  Drag to reorder
                </Badge>
              </Group>
            </Box>
            <Group spacing="xs" noWrap>
              <Button leftIcon={<TbLayoutCards size={16} />} onClick={onClose}>
                Done
              </Button>
              <ActionIcon size={38} variant="light" onClick={onClose}>
                <TbX size={22} />
              </ActionIcon>
            </Group>
          </Group>

          {layoutItems.length === 0 ? (
            <Box className={classes.emptyState}>
              <Text weight={700}>No files to preview</Text>
              <Text size="sm" color="dimmed">
                Add files first, then come back to arrange the preview cards.
              </Text>
            </Box>
          ) : (
            <Stack spacing="lg">
              {layoutItems.map((item) => renderPreviewCard(item))}
            </Stack>
          )}
        </Box>
      </Box>
    </Modal>
  );
}
