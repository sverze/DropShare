import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Collapse,
  Group,
  Menu,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
  useMantineTheme,
  ScrollArea,
  createStyles,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
} from "react";
import Hls from "hls.js";
import {
  TbDownload,
  TbWaveSquare,
  TbPlayerPlay,
  TbPlayerPause,
  TbMusic,
  TbChevronLeft,
  TbChevronRight,
  TbVolume,
  TbVolume3,
  TbVideo,
  TbFolder,
  TbFile,
  TbFileZip,
  TbChevronDown,
  TbFolderOpen,
  TbCode,
  TbCopy,
  TbExternalLink,
  TbFileInfo,
  TbPhoto,
  TbFileTypePdf,
  TbMaximize,
  TbListDetails,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import { FileMetaData } from "../../types/File.type";
import { Share } from "../../types/share.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import TableSortIcon, { TableSort } from "../core/SortIcon";
import { rgbExpr as hexToRgb } from "../../theme/theme.util";

const DARK_MODE_ACCENT = "var(--ls-accent)";
const LIGHT_MODE_ACCENT = "var(--ls-accent)";
const DARK_SHARE_SURFACE =
  "linear-gradient(135deg, rgba(24, 27, 33, 0.72) 0%, rgba(15, 18, 24, 0.84) 100%)";
// The file list surface follows the share's own accent, not the site theme.
// It previously used --ls-panel-bg-rgb (dark) and a fixed green wash (light),
// so a share with a custom colour still showed the site's colour around its
// files. Both are now a neutral base with a wash of the share accent.
const darkShareSurfaceSoft = (accentRgb: string) =>
  `linear-gradient(135deg, rgba(${accentRgb}, 0.12) 0%, rgba(18, 20, 24, 0.88) 100%)`;
const lightShareSurfaceSoft = (accentRgb: string) =>
  `linear-gradient(180deg, rgba(${accentRgb}, 0.10) 0%, rgba(252, 252, 253, 0.99) 100%)`;

const getResponseErrorMessage = async (
  response: Response,
  fallback: string,
) => {
  try {
    const body = await response.clone().json();
    if (typeof body?.message === "string" && body.message.trim()) {
      return body.message;
    }
    if (typeof body?.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    try {
      const text = await response.text();
      if (text.trim()) return text;
    } catch {
    }
  }

  return fallback;
};

const getStorageAwareErrorMessage = (message: string, fallback: string) => {
  const lower = message.toLowerCase();
  if (
    lower.includes("storage timed out") ||
    lower.includes("storage is temporarily unavailable") ||
    lower.includes("storage unavailable") ||
    lower.includes("request socket did not establish")
  ) {
    return "Storage timed out while fetching the file. Please try again shortly.";
  }

  return message || fallback;
};

function getEffectiveAccent(
  colorScheme: "dark" | "light",
  accentColor?: string,
): string {
  if (accentColor) return accentColor;
  return colorScheme === "light" ? LIGHT_MODE_ACCENT : DARK_MODE_ACCENT;
}

const useStyles = createStyles(
  (theme, { accentColor }: { accentColor: string }) => {
    const effectiveAccent = getEffectiveAccent(theme.colorScheme, accentColor);

    return {
      "@keyframes fileListSpin": {
        "0%": { transform: "rotate(0deg)" },
        "100%": { transform: "rotate(360deg)" },
      },

      tableWrapper: {
        background:
          theme.colorScheme === "dark"
            ? darkShareSurfaceSoft(hexToRgb(effectiveAccent))
            : lightShareSurfaceSoft(hexToRgb(effectiveAccent)),
        backdropFilter: "blur(12px)",
        borderRadius: 16,
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? `rgba(${hexToRgb(effectiveAccent)}, 0.15)`
            : `rgba(${hexToRgb(effectiveAccent)}, 0.3)`
        }`,
        overflow: "hidden",
        boxShadow:
          theme.colorScheme === "dark"
            ? `0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(${hexToRgb(effectiveAccent)}, 0.03)`
            : `0 18px 40px rgba(15, 23, 42, 0.08), 0 0 58px rgba(${hexToRgb(effectiveAccent)}, 0.16)`,

        [theme.fn.smallerThan("sm")]: {
          borderRadius: 12,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        },
      },
      previewHeader: {
        marginTop: 30,
        marginBottom: 4,
        padding: "0 6px",
      },
      firstPreviewHeader: {
        marginTop: -8,
      },
      previewHeaderText: {
        fontSize: 20,
        lineHeight: 1.2,
        fontWeight: 800,
        color:
          theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
      },
      previewHeaderAccent: {
        width: 40,
        height: 3,
        borderRadius: 999,
        marginTop: 8,
        background: `linear-gradient(90deg, rgba(${hexToRgb(effectiveAccent)}, 0.95), rgba(${hexToRgb(effectiveAccent)}, 0.25))`,
      },
      table: {
        "& thead tr th": {
          backgroundColor:
            theme.colorScheme === "dark"
              ? `rgba(${hexToRgb(effectiveAccent)}, 0.06)`
              : `rgba(${hexToRgb(effectiveAccent)}, 0.1)`,
          borderBottom: `1px solid ${
            theme.colorScheme === "dark"
              ? `rgba(${hexToRgb(effectiveAccent)}, 0.12)`
              : `rgba(${hexToRgb(effectiveAccent)}, 0.18)`
          }`,
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
        "& tbody tr": {
          transition: "background-color 0.15s ease",
          "&:hover": {
            backgroundColor:
              theme.colorScheme === "dark"
                ? `rgba(${hexToRgb(effectiveAccent)}, 0.06)`
                : `rgba(${hexToRgb(effectiveAccent)}, 0.1)`,
          },
        },
        "& tbody tr td": {
          padding: "12px 16px",
          borderBottom: `1px solid ${
            theme.colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.05)"
          }`,
        },
        "& tbody tr:last-of-type td": {
          borderBottom: "none",
        },

        [theme.fn.smallerThan("sm")]: {
          "& thead tr th": {
            padding: "10px 12px",
            fontSize: 11,
          },
          "& tbody tr td": {
            padding: "10px 12px",
          },
        },
      },
      fileName: {
        fontWeight: 500,
        color:
          theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
        wordBreak: "break-word",

        [theme.fn.smallerThan("sm")]: {
          maxWidth: "150px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "block",
        },
      },
      fileSize: {
        color:
          theme.colorScheme === "dark"
            ? theme.colors.gray[5]
            : theme.colors.gray[6],
        fontSize: 13,
        whiteSpace: "nowrap",

        [theme.fn.smallerThan("sm")]: {
          fontSize: 11,
        },
      },
      actionButton: {
        width: 34,
        height: 34,
        borderRadius: 10,
        color:
          theme.colorScheme === "dark"
            ? theme.colors.gray[4]
            : theme.colors.gray[6],
        backgroundColor:
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.05)"
            : `rgba(${hexToRgb(effectiveAccent)}, 0.1)`,
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.08)"
            : `rgba(${hexToRgb(effectiveAccent)}, 0.22)`
        }`,
        transition:
          "background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",

        [theme.fn.smallerThan("sm")]: {
          width: 30,
          height: 30,
          borderRadius: 8,
        },

        "&:hover": {
          backgroundColor:
            theme.colorScheme === "dark"
              ? `rgba(${hexToRgb(effectiveAccent)}, 0.18)`
              : `rgba(${hexToRgb(effectiveAccent)}, 0.24)`,
          borderColor:
            theme.colorScheme === "dark"
              ? `rgba(${hexToRgb(effectiveAccent)}, 0.35)`
              : `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
          color: theme.colorScheme === "dark" ? theme.white : effectiveAccent,
          boxShadow:
            theme.colorScheme === "dark"
              ? `0 4px 12px rgba(${hexToRgb(effectiveAccent)}, 0.25)`
              : `0 8px 18px rgba(${hexToRgb(effectiveAccent)}, 0.24)`,
        },
        "&:active": {
          transform: "none",
        },
      },
      downloadButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        color: theme.colorScheme === "dark" ? effectiveAccent : "#fff",
        backgroundColor:
          theme.colorScheme === "dark"
            ? `rgba(${hexToRgb(effectiveAccent)}, 0.2)`
            : effectiveAccent,
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? `rgba(${hexToRgb(effectiveAccent)}, 0.4)`
            : effectiveAccent
        }`,
        transition:
          "background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",

        [theme.fn.smallerThan("sm")]: {
          width: 32,
          height: 32,
          borderRadius: 8,
        },

        "&:hover": {
          backgroundColor:
            theme.colorScheme === "dark"
              ? `rgba(${hexToRgb(effectiveAccent)}, 0.35)`
              : `rgba(${hexToRgb(effectiveAccent)}, 0.85)`,
          borderColor: effectiveAccent,
          color: theme.colorScheme === "dark" ? effectiveAccent : "#fff",
          boxShadow:
            theme.colorScheme === "dark"
              ? `0 4px 16px rgba(${hexToRgb(effectiveAccent)}, 0.4)`
              : `0 4px 16px rgba(${hexToRgb(effectiveAccent)}, 0.35)`,
        },
        "&:active": {
          transform: "none",
        },
      },

      scanCleanButton: {
        color: "#51cf66",
        borderColor: "rgba(81, 207, 102, 0.35)",
        background: "rgba(81, 207, 102, 0.12)",
      },

      scanWarnButton: {
        color: "#ffd43b",
        borderColor: "rgba(255, 212, 59, 0.35)",
        background: "rgba(255, 212, 59, 0.12)",
      },

      scanDangerButton: {
        color: "#ff6b6b",
        borderColor: "rgba(255, 107, 107, 0.38)",
        background: "rgba(255, 107, 107, 0.12)",
      },

      spinIcon: {
        animation: "fileListSpin 1s linear infinite",
      },
      actionsGroup: {
        display: "flex",
        gap: 6,
        flexWrap: "nowrap",

        [theme.fn.smallerThan("sm")]: {
          gap: 4,
        },
      },
      playerCard: {
        background:
          theme.colorScheme === "dark"
            ? DARK_SHARE_SURFACE
            : "linear-gradient(180deg, rgba(244, 252, 245, 0.97) 0%, rgba(235, 247, 237, 0.99) 100%)",
        backdropFilter: "blur(16px)",
        borderRadius: 16,
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? `rgba(${hexToRgb(effectiveAccent)}, 0.18)`
            : `rgba(${hexToRgb(effectiveAccent)}, 0.32)`
        }`,
        marginTop: theme.spacing.lg,
        padding: theme.spacing.lg,
        boxShadow:
          theme.colorScheme === "dark"
            ? `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 50px rgba(${hexToRgb(effectiveAccent)}, 0.05)`
            : `0 22px 46px rgba(15, 23, 42, 0.09), 0 0 72px rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
      },
      coverArt: {
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
      },
      previewActionsFrame: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: 6,
        borderRadius: 14,
        background:
          theme.colorScheme === "dark"
            ? "rgba(10, 16, 14, 0.72)"
            : `rgba(${hexToRgb(effectiveAccent)}, 0.12)`,
        backdropFilter: "blur(10px)",
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? "rgba(255,255,255,0.08)"
            : `rgba(${hexToRgb(effectiveAccent)}, 0.22)`
        }`,
        boxShadow:
          theme.colorScheme === "dark"
            ? "0 10px 24px rgba(0,0,0,0.22)"
            : `0 12px 28px rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
      },
      audioRange: {
        WebkitAppearance: "none",
        appearance: "none",
        width: "100%",
        height: 6,
        borderRadius: 999,
        cursor: "pointer",
        background:
          "linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) var(--slider-progress), var(--slider-rest) var(--slider-progress), var(--slider-rest) 100%)",
        "&::-webkit-slider-runnable-track": {
          height: 6,
          borderRadius: 999,
          background: "transparent",
        },
        "&::-moz-range-track": {
          height: 6,
          borderRadius: 999,
          background: "transparent",
        },
        "&::-webkit-slider-thumb": {
          WebkitAppearance: "none",
          appearance: "none",
          width: 16,
          height: 16,
          marginTop: -5,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.95)",
          background: "#fff",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        },
        "&::-moz-range-thumb": {
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.95)",
          background: "#fff",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        },
      },
    };
  },
);

const formatDuration = (seconds?: number | null) => {
  if (seconds == null) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

const getFileExtension = (name?: string | null) =>
  name?.split(".").pop()?.toLowerCase() || "";

const shouldShowAudioCreatedDate = (name?: string | null) => {
  const ext = getFileExtension(name);
  return ext === "wav" || ext === "m4a";
};

const getDisplayAudioFormat = (
  name?: string | null,
  detectedFormat?: string | null,
) => {
  const ext = getFileExtension(name);
  const explicitMap: Record<string, string> = {
    m4a: "M4A",
    wav: "WAV",
    mp3: "MP3",
    flac: "FLAC",
    aac: "AAC",
    ogg: "OGG",
    opus: "OPUS",
    m4b: "M4B",
    m4p: "M4P",
    aiff: "AIFF",
    alac: "ALAC",
  };

  if (ext && explicitMap[ext]) return explicitMap[ext];
  if (ext) return ext.toUpperCase();
  if (!detectedFormat) return null;
  return detectedFormat.split(",")[0]?.trim().toUpperCase() || null;
};

const getAudioTrackNumber = (metadata: any) => {
  const track = metadata?.track;
  if (!track) return null;
  if (typeof track === "number") return String(track);
  if (typeof track?.no === "number" && typeof track?.of === "number") {
    return `${track.no}/${track.of}`;
  }
  if (typeof track?.no === "number") return String(track.no);
  return null;
};

const getAudioMetadataText = (value?: string | number | null) => {
  if (value == null) return "-";
  const text = String(value).trim();
  return text || "-";
};

interface TreeNode {
  name: string;
  fullPath: string;
  size?: number;
  isDirectory: boolean;
  children: TreeNode[];
}

type PathToggle = (..._args: [string]) => void;
type IndexSelect = (..._args: [number]) => void;
type PreviewStyle = "full" | "consolidated";
type MediaPreviewType = "image" | "video";

const buildTree = (
  contents: { name: string; size: number; isDirectory: boolean }[],
): TreeNode[] => {
  const root: TreeNode[] = [];

  for (const item of contents) {
    const parts = item.name.split("/").filter((p) => p);
    let currentLevel = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      let existing = currentLevel.find((n) => n.name === part);

      if (!existing) {
        existing = {
          name: part,
          fullPath: currentPath,
          isDirectory: isLast ? item.isDirectory : true,
          size: isLast ? item.size : undefined,
          children: [],
        };
        currentLevel.push(existing);
      }

      currentLevel = existing.children;
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };

  sortNodes(root);
  return root;
};

const TreeNodeItem = ({
  node,
  depth = 0,
  selectedPaths,
  onToggle,
}: {
  node: TreeNode;
  depth?: number;
  selectedPaths?: Set<string>;
  onToggle?: PathToggle;
}) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <Box>
      <Group
        spacing={8}
        noWrap
        sx={(theme) => ({
          paddingLeft: depth * 20,
          paddingTop: 6,
          paddingBottom: 6,
          paddingRight: 8,
          cursor: hasChildren ? "pointer" : "default",
          borderRadius: theme.radius.sm,
          "&:hover": {
            backgroundColor:
              theme.colorScheme === "dark"
                ? theme.colors.dark[5]
                : theme.colors.gray[1],
          },
        })}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <Box
          sx={{
            width: 16,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {hasChildren && (
            <TbChevronDown
              size={14}
              style={{
                transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 0.15s ease",
                opacity: 0.6,
              }}
            />
          )}
        </Box>

        <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          {node.isDirectory ? (
            expanded ? (
              <TbFolderOpen size={18} style={{ color: "#f0c000" }} />
            ) : (
              <TbFolder size={18} style={{ color: "#f0c000" }} />
            )
          ) : (
            <TbFile size={18} style={{ opacity: 0.7 }} />
          )}
        </Box>

        {!node.isDirectory && onToggle && selectedPaths && (
          <Checkbox
            checked={selectedPaths.has(node.fullPath)}
            onChange={(event) => {
              event.stopPropagation();
              onToggle(node.fullPath);
            }}
            onClick={(event) => event.stopPropagation()}
            size="xs"
          />
        )}

        <Box
          component="span"
          sx={{
            flex: "1 1 auto",
            fontSize: 14,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={node.name}
        >
          {node.name}
        </Box>

        {!node.isDirectory && node.size != null && (
          <Text
            size="xs"
            color="dimmed"
            sx={{ flexShrink: 0, marginLeft: "auto" }}
          >
            {byteToHumanSizeString(node.size)}
          </Text>
        )}
      </Group>

      {hasChildren && expanded && (
        <Box>
          {node.children.map((child, index) => (
            <TreeNodeItem
              key={`${child.fullPath}-${index}`}
              node={child}
              depth={depth + 1}
              selectedPaths={selectedPaths}
              onToggle={onToggle}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

const ZipTreeView = ({
  contents,
  selectedPaths,
  onToggle,
}: {
  contents: { name: string; size: number; isDirectory: boolean }[];
  selectedPaths: Set<string>;
  onToggle: PathToggle;
}) => {
  const tree = buildTree(contents);

  return (
    <Box>
      {tree.map((node, index) => (
        <TreeNodeItem
          key={`${node.fullPath}-${index}`}
          node={node}
          selectedPaths={selectedPaths}
          onToggle={onToggle}
        />
      ))}
    </Box>
  );
};

const AudioGroupTrackList = ({
  files,
  metadataByFileId,
  loadingByFileId,
  currentIndex,
  onSelect,
  accentColor = "#00ff5a",
}: {
  files: FileMetaData[];
  metadataByFileId: Record<string, any>;
  loadingByFileId: Record<string, boolean>;
  currentIndex: number;
  onSelect: IndexSelect;
  accentColor?: string;
}) => {
  const theme = useMantineTheme();
  const effectiveAccent = getEffectiveAccent(theme.colorScheme, accentColor);
  const accentRgb = hexToRgb(effectiveAccent);
  const headerColor =
    theme.colorScheme === "dark" ? "rgba(255,255,255,0.82)" : theme.colors.dark[7];
  const mutedColor =
    theme.colorScheme === "dark" ? "rgba(255,255,255,0.58)" : theme.colors.gray[7];
  const columns = [
    { key: "track", label: "Track", defaultWidth: 92, minWidth: 72 },
    { key: "file", label: "File", defaultWidth: 430, minWidth: 190 },
    { key: "length", label: "Length", defaultWidth: 110, minWidth: 86 },
    { key: "encodedBy", label: "Encoded by", defaultWidth: 190, minWidth: 130 },
  ] as const;
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    columns.reduce(
      (widths, column) => ({
        ...widths,
        [column.key]: column.defaultWidth,
      }),
      {},
    ),
  );
  const resizeStateRef = useRef<{
    key: string;
    startX: number;
    startWidth: number;
    minWidth: number;
  } | null>(null);
  const totalTableWidth = columns.reduce(
    (total, column) => total + (columnWidths[column.key] || column.defaultWidth),
    0,
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      setColumnWidths((current) => ({
        ...current,
        [resizeState.key]: Math.max(
          resizeState.minWidth,
          resizeState.startWidth + event.clientX - resizeState.startX,
        ),
      }));
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const startColumnResize = (
    event: React.MouseEvent,
    columnKey: string,
    minWidth: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      key: columnKey,
      startX: event.clientX,
      startWidth: columnWidths[columnKey] || minWidth,
      minWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <Box
      sx={(theme) => ({
        marginTop: 8,
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid rgba(${accentRgb}, ${
          theme.colorScheme === "dark" ? 0.18 : 0.22
        })`,
        background:
          theme.colorScheme === "dark"
            ? "linear-gradient(180deg, rgba(12, 15, 19, 0.92) 0%, rgba(9, 11, 14, 0.96) 100%)"
            : "rgba(255,255,255,0.92)",
        boxShadow:
          theme.colorScheme === "dark"
            ? `0 16px 32px rgba(0,0,0,0.24), 0 0 36px rgba(${accentRgb}, 0.05)`
            : `0 16px 32px rgba(15,23,42,0.08), 0 0 36px rgba(${accentRgb}, 0.06)`,
      })}
    >
      <ScrollArea type="hover">
        <Table
          sx={(theme) => ({
            width: "100%",
            minWidth: totalTableWidth,
            tableLayout: "fixed",
            "& th": {
              position: "relative",
              padding: "7px 16px 7px 10px",
              fontSize: 11,
              lineHeight: 1.1,
              textTransform: "uppercase",
              letterSpacing: 0,
              color: headerColor,
              background:
                theme.colorScheme === "dark"
                  ? "rgba(255,255,255,0.055)"
                  : `rgba(${accentRgb}, 0.08)`,
              borderBottom: `1px solid rgba(${accentRgb}, 0.14)`,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
            "& td": {
              padding: "6px 10px",
              fontSize: 12,
              lineHeight: 1.2,
              color:
                theme.colorScheme === "dark"
                  ? "rgba(255,255,255,0.78)"
                  : theme.colors.dark[7],
              borderBottom:
                theme.colorScheme === "dark"
                  ? "1px solid rgba(255,255,255,0.035)"
                  : "1px solid rgba(0,0,0,0.04)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
            "& tbody tr": {
              cursor: "pointer",
              transition: "background-color 0.14s ease, color 0.14s ease",
              "&:nth-of-type(odd)": {
                background:
                  theme.colorScheme === "dark"
                    ? "rgba(255,255,255,0.025)"
                    : "rgba(0,0,0,0.018)",
              },
              "&:hover": {
                background: `rgba(${accentRgb}, 0.11)`,
              },
            },
          })}
        >
          <colgroup>
            {columns.map((column) => (
              <col
                key={column.key}
                style={{
                  width: columnWidths[column.key] || column.defaultWidth,
                }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} title={column.label}>
                  {column.label}
                  <Box
                    component="span"
                    onMouseDown={(event) =>
                      startColumnResize(event, column.key, column.minWidth)
                    }
                    sx={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: 10,
                      height: "100%",
                      cursor: "col-resize",
                      userSelect: "none",
                      touchAction: "none",
                      "&::after": {
                        content: "\"\"",
                        position: "absolute",
                        top: 7,
                        bottom: 7,
                        right: 4,
                        width: 1,
                        borderRadius: 999,
                        background: `rgba(${accentRgb}, 0.28)`,
                      },
                      "&:hover::after": {
                        background: `rgba(${accentRgb}, 0.75)`,
                      },
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {files.map((file, index) => {
              const metadata = metadataByFileId[file.id];
              const isLoading = loadingByFileId[file.id];
              const isCurrent = index === currentIndex;

              return (
                <tr
                  key={file.id}
                  onClick={() => onSelect(index)}
                  style={
                    isCurrent
                      ? {
                          background: `linear-gradient(90deg, rgba(${accentRgb}, 0.18), rgba(${accentRgb}, 0.06))`,
                          boxShadow: `inset 3px 0 0 ${effectiveAccent}`,
                        }
                      : undefined
                  }
                >
                  <td>{isLoading ? "..." : getAudioMetadataText(getAudioTrackNumber(metadata))}</td>
                  <td title={file.name}>
                    <Text
                      size="xs"
                      weight={isCurrent ? 800 : 600}
                      color={isCurrent ? effectiveAccent : undefined}
                      lineClamp={1}
                    >
                      {file.name}
                    </Text>
                  </td>
                  <td>{isLoading ? "..." : formatDuration(metadata?.duration) || "-"}</td>
                  <td title={metadata?.encodedBy || ""} style={{ color: mutedColor }}>
                    {isLoading ? "..." : getAudioMetadataText(metadata?.encodedBy)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
};

const isAudioFile = (filename: string): boolean => {
  const audioExtensions = [
    ".mp3",
    ".wav",
    ".flac",
    ".aac",
    ".ogg",
    ".m4a",
    ".wma",
    ".aif",
    ".aiff",
    ".alac",
    ".opus",
    ".m4b",
  ];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return audioExtensions.includes(ext);
};

const isVideoFile = (filename: string): boolean => {
  const videoExtensions = [
    ".mp4",
    ".webm",
    ".mkv",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".m4v",
    ".ogv",
  ];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return videoExtensions.includes(ext);
};

const isArchiveFile = (filename: string): boolean => {
  const zipExtensions = [
    ".zip",
    ".7z",
    ".rar",
    ".tar",
    ".gz",
    ".tar.gz",
    ".tgz",
  ];
  const lowerName = filename.toLowerCase();
  return zipExtensions.some((ext) => lowerName.endsWith(ext));
};

const needsServerRendition = (filename: string): boolean => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return ext === ".heic" || ext === ".heif";
};

const imagePreviewSrc = (
  shareId: string,
  file: { id: string; name: string },
): string =>
  needsServerRendition(file.name)
    ? `/api/shares/${shareId}/files/${file.id}/thumbnail?size=preview`
    : `/api/shares/${shareId}/files/${file.id}?download=false&preview=1`;

const isImageFile = (filename: string): boolean => {
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
    ".ico",
    ".tiff",
    ".tif",
    ".heic",
    ".heif",
  ];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return imageExtensions.includes(ext);
};

const isPdfFile = (filename: string): boolean => {
  return filename.toLowerCase().endsWith(".pdf");
};

const isInlinePreviewFile = (filename: string): boolean => {
  return (
    isAudioFile(filename) || isVideoFile(filename) || isImageFile(filename)
  );
};

const AudioPlayerCard = ({
  file,
  shareId,
  actions,
  metadata,
  isLoading,
  lyricsData,
  lyricsOpen = false,
  onLyricsToggle,
  showNavigation = false,
  currentIndex = 0,
  totalFiles = 1,
  onPrevious,
  onNext,
  accentColor = "#00ff5a",
  variant = "full",
  showTrackListToggle = false,
  trackListOpen = false,
  onTrackListToggle,
}: {
  file: FileMetaData;
  shareId: string;
  actions?: React.ReactNode;
  metadata: any;
  isLoading: boolean;
  lyricsData?: ShareLyricsPanelData | null;
  lyricsOpen?: boolean;
  onLyricsToggle?: () => void;
  showNavigation?: boolean;
  currentIndex?: number;
  totalFiles?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  accentColor?: string;
  variant?: PreviewStyle;
  showTrackListToggle?: boolean;
  trackListOpen?: boolean;
  onTrackListToggle?: () => void;
}) => {
  const theme = useMantineTheme();
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressFrameRef = useRef<number | null>(null);
  const effectiveAccent = getEffectiveAccent(theme.colorScheme, accentColor);
  const { classes } = useStyles({ accentColor: effectiveAccent });
  const navigationFrameSx = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 36,
    padding: "2px 8px",
    borderRadius: 999,
    background:
      theme.colorScheme === "dark"
        ? `linear-gradient(135deg, rgba(${hexToRgb(effectiveAccent)}, 0.24) 0%, rgba(10, 16, 14, 0.82) 100%)`
        : `rgba(${hexToRgb(effectiveAccent)}, 0.12)`,
    border: `1px solid rgba(${hexToRgb(effectiveAccent)}, ${theme.colorScheme === "dark" ? 0.4 : 0.25})`,
    boxShadow:
      theme.colorScheme === "dark"
        ? `0 10px 26px rgba(${hexToRgb(effectiveAccent)}, 0.18)`
        : `0 8px 20px rgba(${hexToRgb(effectiveAccent)}, 0.08)`,
  } as const;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const seekMax = duration || 100;
  const seekProgress = `${Math.max(
    0,
    Math.min(100, (currentTime / seekMax) * 100 || 0),
  )}%`;
  const volumeProgress = `${Math.max(
    0,
    Math.min(100, ((isMuted ? 0 : volume) / 1) * 100 || 0),
  )}%`;
  const hasLyrics = Boolean(lyricsData?.text?.trim());
  const sliderRestColor =
    theme.colorScheme === "dark"
      ? "rgba(255,255,255,0.16)"
      : "rgba(0,0,0,0.14)";
  const isConsolidated = variant === "consolidated";
  const trackListToggleAction =
    showTrackListToggle && onTrackListToggle ? (
      <Tooltip
        label={trackListOpen ? "Hide audio list" : "Show audio list"}
        withArrow
        position="top"
        withinPortal
      >
        <ActionIcon
          onClick={onTrackListToggle}
          className={classes.actionButton}
          title={trackListOpen ? "Hide audio list" : "Show audio list"}
          sx={{
            color: effectiveAccent,
            borderColor: `rgba(${hexToRgb(effectiveAccent)}, 0.36)`,
            background: trackListOpen
              ? `rgba(${hexToRgb(effectiveAccent)}, 0.22)`
              : undefined,
          }}
        >
          <TbListDetails size={18} />
        </ActionIcon>
      </Tooltip>
    ) : null;

  const audioUrl = `/api/shares/${shareId}/files/${file.id}?download=false&preview=1`;

  const stopProgressTracking = () => {
    if (progressFrameRef.current !== null) {
      cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = null;
    }
  };

  const syncProgress = () => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(audio.currentTime);

    if (!audio.paused && !audio.ended) {
      progressFrameRef.current = requestAnimationFrame(syncProgress);
    } else {
      progressFrameRef.current = null;
    }
  };

  const startProgressTracking = () => {
    stopProgressTracking();
    progressFrameRef.current = requestAnimationFrame(syncProgress);
  };

  useEffect(() => {
    stopProgressTracking();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = audioUrl;
      audioRef.current.load();
      audioRef.current.currentTime = 0;
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
    return () => stopProgressTracking();
  }, [audioUrl, file.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      setIsPlaying(false);
      stopProgressTracking();
      setCurrentTime(audio.currentTime);
    };
    const handleVolume = () => {
      setVolume(audio.volume);
      setIsMuted(audio.muted || audio.volume === 0);
    };
    const handleSeeking = () => setCurrentTime(audio.currentTime);
    const handleSeeked = () => {
      setCurrentTime(audio.currentTime);
      if (!audio.paused && !audio.ended) {
        startProgressTracking();
      }
    };
    const handleLoadedData = () => {
      setCurrentTime(audio.currentTime);
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleError = () => {
      stopProgressTracking();
      setIsPlaying(false);
      toast.error(
        "Audio playback failed. The file may be temporarily unavailable from storage.",
      );
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("volumechange", handleVolume);
    audio.addEventListener("seeking", handleSeeking);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("loadeddata", handleLoadedData);
    audio.addEventListener("error", handleError);

    return () => {
      stopProgressTracking();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("volumechange", handleVolume);
      audio.removeEventListener("seeking", handleSeeking);
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("loadeddata", handleLoadedData);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      startProgressTracking();
    } else {
      stopProgressTracking();
    }

    return () => stopProgressTracking();
  }, [isPlaying]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused && !audio.ended) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        setIsPlaying(false);
        toast.error(
          "Unable to start audio playback. Please try again shortly.",
        );
      });
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleEnded = () => {
    stopProgressTracking();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (volume === 0) setVolume(0.5);
    } else {
      setIsMuted(true);
    }
  };

  if (isLoading) {
    return (
      <Paper
        p="lg"
        radius="md"
        sx={(theme) => ({
          background:
            theme.colorScheme === "dark"
              ? DARK_SHARE_SURFACE
              : "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(16px)",
          borderRadius: 16,
          border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
          marginTop: theme.spacing.md,
        })}
      >
        <Group position="center">
          <Skeleton height={120} width={120} radius="md" />
          <Stack sx={{ flex: 1 }} spacing="sm">
            <Skeleton height={20} width="60%" />
            <Skeleton height={40} width="100%" />
            <Skeleton height={14} width="40%" />
          </Stack>
          <Stack spacing="xs" sx={{ minWidth: 150 }}>
            <Skeleton height={14} width="100%" />
            <Skeleton height={14} width="80%" />
            <Skeleton height={14} width="90%" />
          </Stack>
        </Group>
      </Paper>
    );
  }

  if (isConsolidated) {
    return (
      <Paper
        p="sm"
        radius="md"
        sx={(theme) => ({
          contain: "layout",
          position: "relative",
          background:
            theme.colorScheme === "dark"
              ? DARK_SHARE_SURFACE
              : "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(16px)",
          borderRadius: 16,
          border: `1px solid ${
            theme.colorScheme === "dark"
              ? `rgba(${hexToRgb(effectiveAccent)}, 0.18)`
              : `rgba(${hexToRgb(effectiveAccent)}, 0.22)`
          }`,
          marginTop: 6,
          boxShadow:
            theme.colorScheme === "dark"
              ? `0 8px 28px rgba(0, 0, 0, 0.26), 0 0 42px rgba(${hexToRgb(effectiveAccent)}, 0.04)`
              : `0 8px 28px rgba(0, 0, 0, 0.08), 0 0 42px rgba(${hexToRgb(effectiveAccent)}, 0.03)`,
        })}
      >
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />

        <Group
          spacing="md"
          noWrap
          sx={(theme) => ({
            minHeight: 74,
            [theme.fn.smallerThan("sm")]: {
              alignItems: "flex-start",
              flexWrap: "wrap",
            },
          })}
        >
          <Box
            sx={(theme) => ({
              width: 62,
              height: 62,
              borderRadius: 12,
              overflow: "hidden",
              flexShrink: 0,
              backgroundColor:
                theme.colorScheme === "dark"
                  ? theme.colors.dark[5]
                  : theme.colors.gray[2],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
            })}
          >
            {metadata?.coverDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={metadata.coverDataUrl}
                alt="Cover art"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <TbMusic size={30} style={{ opacity: 0.3 }} />
            )}
          </Box>

          <Stack spacing={6} sx={{ flex: 1, minWidth: 220 }}>
            <Group position="apart" noWrap align="center">
              <Text weight={600} size="sm" lineClamp={1} sx={{ minWidth: 0 }}>
                {metadata?.title || file.name}
              </Text>
              {showNavigation && (
                <Group spacing={4} noWrap sx={navigationFrameSx}>
                  <ActionIcon
                    size={26}
                    radius="xl"
                    variant="filled"
                    onClick={onPrevious}
                    title="Previous track"
                    sx={{
                      background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                      color: "#fff",
                      "&:hover": {
                        background: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                      },
                    }}
                  >
                    <TbChevronLeft size={15} />
                  </ActionIcon>
                  <Text
                    size="xs"
                    color="gray.3"
                    sx={{
                      minWidth: 42,
                      textAlign: "center",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {currentIndex + 1} / {totalFiles}
                  </Text>
                  <ActionIcon
                    size={26}
                    radius="xl"
                    variant="filled"
                    onClick={onNext}
                    title="Next track"
                    sx={{
                      background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                      color: "#fff",
                      "&:hover": {
                        background: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                      },
                    }}
                  >
                    <TbChevronRight size={15} />
                  </ActionIcon>
                </Group>
              )}
            </Group>

            <Group spacing="sm" noWrap>
              <ActionIcon
                size={38}
                radius="xl"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  togglePlay();
                }}
                style={{
                  background: `linear-gradient(135deg, ${effectiveAccent} 0%, ${effectiveAccent}dd 100%)`,
                  border: "2px solid rgba(255, 255, 255, 0.95)",
                  boxShadow: `0 4px 14px rgba(${hexToRgb(effectiveAccent)}, 0.32)`,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {isPlaying ? (
                  <TbPlayerPause size={20} color="#fff" />
                ) : (
                  <TbPlayerPlay size={20} color="#fff" />
                )}
              </ActionIcon>

              <Stack
                spacing={2}
                sx={(theme) => ({
                  flex: "0 1 520px",
                  minWidth: 180,
                  [theme.fn.smallerThan("sm")]: {
                    flex: "1 1 180px",
                  },
                })}
              >
                <input
                  className={classes.audioRange}
                  type="range"
                  min={0}
                  max={seekMax}
                  step="any"
                  value={currentTime}
                  onChange={handleSeek}
                  style={{
                    ["--slider-fill" as any]: effectiveAccent,
                    ["--slider-progress" as any]: seekProgress,
                    ["--slider-rest" as any]: sliderRestColor,
                  }}
                />
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    {formatDuration(currentTime)}
                  </Text>
                  <Text size="xs" color="dimmed">
                    {formatDuration(duration || metadata?.duration)}
                  </Text>
                </Group>
              </Stack>
            </Group>
          </Stack>

          <Group
            spacing={8}
            noWrap
            sx={(theme) => ({
              flexShrink: 0,
              marginLeft: "auto",
              [theme.fn.smallerThan("sm")]: {
                width: "100%",
                justifyContent: "flex-end",
              },
            })}
          >
            {trackListToggleAction}
            {hasLyrics && lyricsData && (
              <Tooltip
                label={lyricsOpen ? "Hide lyrics" : "Show lyrics"}
                withArrow
                position="top"
              >
                <ActionIcon
                  onClick={onLyricsToggle}
                  className={classes.actionButton}
                  title={lyricsOpen ? "Hide lyrics" : "Show lyrics"}
                  sx={{
                    color: effectiveAccent,
                    borderColor: `rgba(${hexToRgb(effectiveAccent)}, 0.36)`,
                    background: lyricsOpen
                      ? `rgba(${hexToRgb(effectiveAccent)}, 0.22)`
                      : undefined,
                  }}
                >
                  <TbMusic size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {actions}
          </Group>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper
      p={isConsolidated ? "md" : "lg"}
      radius="md"
      sx={(theme) => ({
        contain: "layout",
        position: "relative",
        background:
          theme.colorScheme === "dark"
            ? DARK_SHARE_SURFACE
            : "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(16px)",
        borderRadius: 16,
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.18)`
            : `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.22)`
        }`,
        marginTop: isConsolidated ? 6 : 8,
        boxShadow:
          theme.colorScheme === "dark"
            ? `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 50px rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.05)`
            : `0 8px 32px rgba(0, 0, 0, 0.08), 0 0 50px rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.03)`,
      })}
    >
      {hasLyrics && lyricsData ? (
        <Tooltip
          label={lyricsOpen ? "Hide lyrics" : "Show lyrics"}
          withArrow
          position="left"
        >
          <UnstyledButton
            onClick={onLyricsToggle}
            title={lyricsOpen ? "Hide lyrics" : "Show lyrics"}
            sx={(theme) => ({
              position: "absolute",
              top: "50%",
              right: -40,
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              minWidth: 24,
              height: 108,
              padding: 0,
              borderRadius: 999,
              border: `1px solid rgba(${hexToRgb(effectiveAccent)}, 0.28)`,
              background:
                theme.colorScheme === "dark"
                  ? `linear-gradient(180deg, rgba(${hexToRgb(effectiveAccent)}, 0.2) 0%, rgba(10, 16, 14, 0.96) 100%)`
                  : `linear-gradient(180deg, rgba(${hexToRgb(effectiveAccent)}, 0.16) 0%, rgba(255,255,255,0.98) 100%)`,
              boxShadow:
                theme.colorScheme === "dark"
                  ? `0 8px 24px rgba(${hexToRgb(effectiveAccent)}, 0.12)`
                  : `0 8px 24px rgba(${hexToRgb(effectiveAccent)}, 0.08)`,
              color: effectiveAccent,
              zIndex: 3,
              [theme.fn.smallerThan("sm")]: {
                display: "none",
              },
              "&:hover": {
                background:
                  theme.colorScheme === "dark"
                    ? `linear-gradient(180deg, rgba(${hexToRgb(effectiveAccent)}, 0.28) 0%, rgba(var(--ls-panel-bg-rgb), 0.98) 100%)`
                    : `linear-gradient(180deg, rgba(${hexToRgb(effectiveAccent)}, 0.22) 0%, rgba(255,255,255,1) 100%)`,
              },
              "&:active": {
                transform: "translateY(-50%)",
              },
            })}
          >
            {lyricsOpen ? (
              <TbChevronLeft size={20} />
            ) : (
              <TbChevronRight size={20} />
            )}
          </UnstyledButton>
        </Tooltip>
      ) : null}

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      <Group
        align="flex-start"
        spacing={isConsolidated ? "md" : "lg"}
        noWrap
        sx={{ flexWrap: "wrap" }}
      >
        <Box
          sx={{
            width: isConsolidated ? 82 : 120,
            height: isConsolidated ? 82 : 120,
            borderRadius: isConsolidated ? 10 : 12,
            overflow: "hidden",
            flexShrink: 0,
            backgroundColor:
              theme.colorScheme === "dark"
                ? theme.colors.dark[5]
                : theme.colors.gray[2],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
          }}
        >
          {metadata?.coverDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={metadata.coverDataUrl}
              alt="Cover art"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <TbMusic
              size={isConsolidated ? 34 : 48}
              style={{ opacity: 0.3 }}
            />
          )}
        </Box>

        <Stack spacing="xs" sx={{ flex: 1, minWidth: 200 }}>
          <Group position="apart" noWrap align="flex-start">
            <Stack spacing={4} sx={{ flex: 1, minWidth: 0 }}>
              <Group spacing="sm" noWrap align="center">
                <Text
                  weight={600}
                  size={isConsolidated ? "md" : "lg"}
                  lineClamp={1}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  {metadata?.title || file.name}
                </Text>
              </Group>
              {metadata?.artist && (
                <Text size="sm" color="dimmed" lineClamp={1}>
                  {metadata.artist}
                  {metadata?.album && ` - ${metadata.album}`}
                </Text>
              )}
            </Stack>

            {showNavigation && (
              <Group spacing={4} noWrap ml="sm" sx={navigationFrameSx}>
                <ActionIcon
                  size={28}
                  radius="xl"
                  variant="filled"
                  onClick={onPrevious}
                  title="Previous track"
                  sx={{
                    background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                    color: "#fff",
                    "&:hover": {
                      background: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                    },
                  }}
                >
                  <TbChevronLeft size={16} />
                </ActionIcon>
                <Text
                  size="xs"
                  color="gray.3"
                  sx={{
                    minWidth: 48,
                    textAlign: "center",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {currentIndex + 1} / {totalFiles}
                </Text>
                <ActionIcon
                  size={28}
                  radius="xl"
                  variant="filled"
                  onClick={onNext}
                  title="Next track"
                  sx={{
                    background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                    color: "#fff",
                    "&:hover": {
                      background: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                    },
                  }}
                >
                  <TbChevronRight size={16} />
                </ActionIcon>
              </Group>
            )}
          </Group>

          <Group spacing="sm" mt="xs">
            <ActionIcon
              size={42}
              radius="xl"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                togglePlay();
              }}
              style={{
                background: `linear-gradient(135deg, ${effectiveAccent} 0%, ${effectiveAccent}dd 100%)`,
                border: "2px solid rgba(255, 255, 255, 0.95)",
                boxShadow: `0 4px 16px rgba(${hexToRgb(effectiveAccent)}, 0.35)`,
                color: "#fff",
              }}
            >
              {isPlaying ? (
                <TbPlayerPause size={22} color="#fff" />
              ) : (
                <TbPlayerPlay size={22} color="#fff" />
              )}
            </ActionIcon>

            <Stack spacing={2} sx={{ flex: 1 }}>
              <input
                className={classes.audioRange}
                type="range"
                min={0}
                max={seekMax}
                step="any"
                value={currentTime}
                onChange={handleSeek}
                style={{
                  ["--slider-fill" as any]: effectiveAccent,
                  ["--slider-progress" as any]: seekProgress,
                  ["--slider-rest" as any]: sliderRestColor,
                }}
              />
              <Group position="apart" mt={6}>
                <Text size="xs" color="dimmed">
                  {formatDuration(currentTime)}
                </Text>
                <Text size="xs" color="dimmed">
                  {formatDuration(duration || metadata?.duration)}
                </Text>
              </Group>
            </Stack>
          </Group>

          {isConsolidated ? (
            <Group spacing={8} mt={2} position="right" noWrap>
              {hasLyrics && lyricsData && (
                <Tooltip
                  label={lyricsOpen ? "Hide lyrics" : "Show lyrics"}
                  withArrow
                  position="top"
                >
                  <ActionIcon
                    onClick={onLyricsToggle}
                    className={classes.actionButton}
                    title={lyricsOpen ? "Hide lyrics" : "Show lyrics"}
                    sx={{
                      color: effectiveAccent,
                      borderColor: `rgba(${hexToRgb(effectiveAccent)}, 0.36)`,
                      background: lyricsOpen
                        ? `rgba(${hexToRgb(effectiveAccent)}, 0.22)`
                        : undefined,
                    }}
                  >
                    <TbMusic size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              {actions}
            </Group>
          ) : (
            <Group
              spacing="sm"
              mt={4}
              align="center"
              noWrap
              sx={(theme) => ({
                justifyContent: "space-between",
                [theme.fn.smallerThan("sm")]: {
                  alignItems: "center",
                },
              })}
            >
              <Group
                spacing={8}
                sx={{ flex: 1, minWidth: 0, touchAction: "manipulation" }}
                noWrap
              >
                <ActionIcon
                  size={32}
                  radius="xl"
                  variant="subtle"
                  onClick={toggleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                  sx={{ touchAction: "manipulation", flexShrink: 0 }}
                >
                  {isMuted || volume === 0 ? (
                    <TbVolume3 size={18} style={{ opacity: 0.5 }} />
                  ) : (
                    <TbVolume size={18} />
                  )}
                </ActionIcon>
                <input
                  className={classes.audioRange}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  style={{
                    width: 100,
                    touchAction: "manipulation",
                    flexShrink: 1,
                    ["--slider-fill" as any]: effectiveAccent,
                    ["--slider-progress" as any]: volumeProgress,
                    ["--slider-rest" as any]: sliderRestColor,
                  }}
                />
                <Text
                  size="xs"
                  color="dimmed"
                  sx={{ minWidth: 32, flexShrink: 0 }}
                >
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </Text>
              </Group>

              {actions && (
                <Group
                  spacing={8}
                  noWrap
                  sx={(theme) => ({
                    flexShrink: 0,
                    marginLeft: "auto",
                    paddingRight: 8,
                    [theme.fn.smallerThan("sm")]: {
                      display: "none",
                    },
                  })}
                >
                  {trackListToggleAction}
                  {actions}
                </Group>
              )}
            </Group>
          )}
        </Stack>

        {!isConsolidated && (
          <Stack
          spacing={4}
          sx={(theme) => ({
            minWidth: 160,
            flexShrink: 0,
            [theme.fn.smallerThan("sm")]: {
              minWidth: 0,
              width: "100%",
              marginTop: theme.spacing.xs,
            },
          })}
        >
          <Group position="apart" align="flex-start" noWrap mb={4}>
            <Text size="xs" color="dimmed" weight={600} transform="uppercase">
              File Info
            </Text>
            {actions && (
              <Group
                spacing={8}
                noWrap
                sx={(theme) => ({
                  display: "none",
                  [theme.fn.smallerThan("sm")]: {
                    display: "inline-flex",
                    marginLeft: "auto",
                    flexShrink: 0,
                  },
                })}
              >
                {trackListToggleAction}
                {hasLyrics && lyricsData && (
                  <Tooltip
                    label={lyricsOpen ? "Hide lyrics" : "Show lyrics"}
                    withArrow
                    position="top"
                  >
                    <ActionIcon
                      onClick={onLyricsToggle}
                      className={classes.actionButton}
                      title={lyricsOpen ? "Hide lyrics" : "Show lyrics"}
                      sx={{
                        color: effectiveAccent,
                        borderColor: `rgba(${hexToRgb(effectiveAccent)}, 0.36)`,
                        background: lyricsOpen
                          ? `rgba(${hexToRgb(effectiveAccent)}, 0.22)`
                          : undefined,
                      }}
                    >
                      <TbMusic size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {actions}
              </Group>
            )}
          </Group>

          {getDisplayAudioFormat(file.name, metadata?.format) && (
            <Text size="xs">
              <Text component="span" color="dimmed">
                Format:
              </Text>{" "}
              {getDisplayAudioFormat(file.name, metadata?.format)}
            </Text>
          )}

          {metadata?.bitrate && (
            <Text size="xs">
              <Text component="span" color="dimmed">
                Bitrate:
              </Text>{" "}
              {Math.round(metadata.bitrate / 1000)} kbps
            </Text>
          )}

          {metadata?.sampleRate && (
            <Text size="xs">
              <Text component="span" color="dimmed">
                Sample Rate:
              </Text>{" "}
              {(metadata.sampleRate / 1000).toFixed(1)} kHz
            </Text>
          )}

          <Text size="xs">
            <Text component="span" color="dimmed">
              Size:
            </Text>{" "}
            {byteToHumanSizeString(parseInt(file.size))}
          </Text>

          {metadata?.genre && metadata.genre.length > 0 && (
            <Text size="xs">
              <Text component="span" color="dimmed">
                Genre:
              </Text>{" "}
              {metadata.genre.join(", ")}
            </Text>
          )}

          {metadata?.year && (
            <Text size="xs">
              <Text component="span" color="dimmed">
                Year:
              </Text>{" "}
              {metadata.year}
            </Text>
          )}

          {metadata?.encodedBy && (
            <Text size="xs">
              <Text component="span" color="dimmed">
                Encoded by:
              </Text>{" "}
              {metadata.encodedBy}
            </Text>
          )}

          {metadata?.originalCreateDate &&
            shouldShowAudioCreatedDate(file.name) && (
              <Text size="xs">
                <Text component="span" color="dimmed">
                  Created:
                </Text>{" "}
                {new Date(metadata.originalCreateDate).toString() !==
                "Invalid Date"
                  ? new Date(metadata.originalCreateDate).toLocaleString()
                  : metadata.originalCreateDate}
              </Text>
            )}
          </Stack>
        )}
      </Group>
    </Paper>
  );
};

const VideoPlayerCard = ({
  files,
  shareId,
  actions,
  currentIndex = 0,
  onPrevious,
  onNext,
  onSelect,
  accentColor = "#00ff5a",
  variant = "full",
  onOpenPreview,
}: {
  files: FileMetaData[];
  shareId: string;
  actions?: React.ReactNode;
  currentIndex?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onSelect: IndexSelect;
  accentColor?: string;
  variant?: PreviewStyle;
  onOpenPreview?: (_file: FileMetaData, _type: MediaPreviewType) => void;
}) => {
  const theme = useMantineTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const effectiveAccent = getEffectiveAccent(theme.colorScheme, accentColor);
  const { classes } = useStyles({ accentColor: effectiveAccent });
  const file = files[currentIndex];
  const format = (file.name.split(".").pop() || "VIDEO").toUpperCase();
  const isConsolidated = variant === "consolidated";

  const originalVideoUrl = `/api/shares/${shareId}/files/${file.id}?download=false&preview=1`;
  const [previewStatus, setPreviewStatus] = useState<{
    status: string;
    qualities: string[];
    error?: string | null;
  }>({
    status: "not_started",
    qualities: [],
  });
  const [isPlayerLoaded, setIsPlayerLoaded] = useState(true);
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const hlsRef = useRef<Hls | null>(null);
  const generatedQualities = previewStatus.qualities || [];
  const isAdaptiveReady =
    previewStatus.status === "ready" && generatedQualities.length > 0;
  const isAdaptivePending = ["not_started", "queued", "processing"].includes(
    previewStatus.status,
  );
  const shouldShowAllThumbnails = files.length <= 30 || isAdaptiveReady;
  const selectedHlsUrl =
    selectedQuality === "auto"
      ? `/api/shares/${shareId}/files/${file.id}/hls/master.m3u8`
      : `/api/shares/${shareId}/files/${file.id}/hls/${selectedQuality}/index.m3u8`;
  const qualityOptions = [
    { value: "auto", label: "Auto", disabled: !isAdaptiveReady },
    ...generatedQualities.map((quality) => ({
      value: quality,
      label: quality,
      disabled: !isAdaptiveReady,
    })),
    { value: "original", label: "Original", disabled: false },
  ];
  const fallBackToOriginalVideo = useCallback(() => {
    if (selectedQuality === "original") return;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setSelectedQuality("original");
  }, [selectedQuality]);
  const navigationFrameSx = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 36,
    padding: "2px 8px",
    borderRadius: 999,
    background:
      theme.colorScheme === "dark"
        ? `linear-gradient(135deg, rgba(${hexToRgb(effectiveAccent)}, 0.24) 0%, rgba(10, 16, 14, 0.82) 100%)`
        : `rgba(${hexToRgb(effectiveAccent)}, 0.12)`,
    border: `1px solid rgba(${hexToRgb(effectiveAccent)}, ${theme.colorScheme === "dark" ? 0.4 : 0.25})`,
    boxShadow:
      theme.colorScheme === "dark"
        ? `0 10px 26px rgba(${hexToRgb(effectiveAccent)}, 0.18)`
        : `0 8px 20px rgba(${hexToRgb(effectiveAccent)}, 0.08)`,
  } as const;
  const compactPreviewAction = onOpenPreview ? (
    <Tooltip label="Open full preview" withArrow position="top" withinPortal>
      <ActionIcon
        className={classes.actionButton}
        onClick={() => onOpenPreview(file, "video")}
        title="Open full preview"
        sx={{
          color: effectiveAccent,
          borderColor: `rgba(${hexToRgb(effectiveAccent)}, 0.34)`,
          background: `rgba(${hexToRgb(effectiveAccent)}, 0.1)`,
        }}
      >
        <TbMaximize size={18} />
      </ActionIcon>
    </Tooltip>
  ) : null;

  useEffect(() => {
    setSelectedQuality("auto");
    setPreviewStatus({ status: "not_started", qualities: [] });
    setIsPlayerLoaded(true);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [file.id]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const loadStatus = async () => {
      if (!isPlayerLoaded) return;

      try {
        const response = await fetch(
          `/api/shares/${shareId}/files/${file.id}/video-preview`,
        );
        if (!response.ok)
          throw new Error("Failed to load adaptive preview status");
        const data = await response.json();
        if (cancelled) return;

        setPreviewStatus({
          status: data.status || "not_started",
          qualities: Array.isArray(data.qualities) ? data.qualities : [],
          error: data.error,
        });

        if (["queued", "processing", "not_started"].includes(data.status)) {
          pollTimer = setTimeout(loadStatus, 5000);
        }
      } catch {
        if (!cancelled) {
          setPreviewStatus({
            status: "failed",
            qualities: [],
            error: "Adaptive preview unavailable",
          });
        }
      }
    };

    loadStatus();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [file.id, isPlayerLoaded, shareId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (!isPlayerLoaded) {
      video.removeAttribute("src");
      video.load();
      return;
    }

    const useAdaptiveStream = isAdaptiveReady && selectedQuality !== "original";

    if (!useAdaptiveStream) {
      video.src = originalVideoUrl;
      video.load();
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = selectedHlsUrl;
      video.load();
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data?.fatal) {
          fallBackToOriginalVideo();
        }
      });
      hls.loadSource(selectedHlsUrl);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    video.src = originalVideoUrl;
    video.load();
  }, [
    fallBackToOriginalVideo,
    isAdaptiveReady,
    isPlayerLoaded,
    originalVideoUrl,
    selectedHlsUrl,
    selectedQuality,
  ]);

  if (isConsolidated) {
    return (
      <Paper
        p="sm"
        radius="md"
        sx={(theme) => ({
          contain: "layout paint",
          background:
            theme.colorScheme === "dark"
              ? DARK_SHARE_SURFACE
              : "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(16px)",
          borderRadius: 16,
          border: `1px solid ${
            theme.colorScheme === "dark"
              ? `rgba(${hexToRgb(effectiveAccent)}, 0.18)`
              : `rgba(${hexToRgb(effectiveAccent)}, 0.22)`
          }`,
          marginTop: theme.spacing.xs,
          boxShadow:
            theme.colorScheme === "dark"
              ? `0 8px 28px rgba(0, 0, 0, 0.26), 0 0 42px rgba(${hexToRgb(effectiveAccent)}, 0.04)`
              : `0 8px 28px rgba(0, 0, 0, 0.08), 0 0 42px rgba(${hexToRgb(effectiveAccent)}, 0.03)`,
        })}
      >
        <Group
          position="apart"
          align="center"
          spacing="md"
          noWrap
          sx={(theme) => ({
            minHeight: 66,
            [theme.fn.smallerThan("sm")]: {
              alignItems: "flex-start",
              flexWrap: "wrap",
            },
          })}
        >
          <Group spacing="md" noWrap sx={{ flex: 1, minWidth: 0 }}>
            <Box
              onClick={() => onOpenPreview?.(file, "video")}
              sx={(theme) => ({
                width: 74,
                height: 48,
                borderRadius: 12,
                overflow: "hidden",
                flexShrink: 0,
                cursor: onOpenPreview ? "pointer" : "default",
                backgroundColor:
                  theme.colorScheme === "dark"
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.05)",
                border: `1px solid rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
              })}
            >
              <img
                src={`/api/shares/${shareId}/files/${file.id}/thumbnail`}
                alt={file.name}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </Box>
            <Group spacing="xs" noWrap sx={{ minWidth: 0, flex: 1 }}>
              <TbVideo
                size={18}
                style={{
                  opacity: 0.78,
                  flexShrink: 0,
                  color: effectiveAccent,
                }}
              />
              <Text weight={600} size="sm" lineClamp={1} sx={{ minWidth: 0 }}>
                {file.name}
              </Text>
            </Group>
          </Group>

          <Group spacing={8} noWrap sx={{ flexShrink: 0, marginLeft: "auto" }}>
            {files.length > 1 && (
              <Group spacing={4} noWrap sx={navigationFrameSx}>
                <ActionIcon
                  size={26}
                  radius="xl"
                  variant="filled"
                  onClick={onPrevious}
                  title="Previous video"
                  sx={{
                    background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                    color: "#fff",
                    "&:hover": {
                      background: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                    },
                  }}
                >
                  <TbChevronLeft size={15} />
                </ActionIcon>
                <Text
                  size="xs"
                  color="gray.3"
                  sx={{
                    minWidth: 42,
                    textAlign: "center",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {currentIndex + 1} / {files.length}
                </Text>
                <ActionIcon
                  size={26}
                  radius="xl"
                  variant="filled"
                  onClick={onNext}
                  title="Next video"
                  sx={{
                    background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                    color: "#fff",
                    "&:hover": {
                      background: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                    },
                  }}
                >
                  <TbChevronRight size={15} />
                </ActionIcon>
              </Group>
            )}
            {compactPreviewAction}
            {actions}
          </Group>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper
      p={isConsolidated ? "md" : "lg"}
      radius="md"
      sx={(theme) => ({
        contain: "layout paint",
        background:
          theme.colorScheme === "dark"
            ? DARK_SHARE_SURFACE
            : "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(16px)",
        borderRadius: 16,
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.18)`
            : `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.22)`
        }`,
        marginTop: isConsolidated ? theme.spacing.xs : theme.spacing.md,
        boxShadow:
          theme.colorScheme === "dark"
            ? `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 50px rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.05)`
            : `0 8px 32px rgba(0, 0, 0, 0.08), 0 0 50px rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.03)`,
      })}
    >
      <Stack spacing="sm">
        <Group position="apart" noWrap align="flex-start">
          <Group spacing="xs" noWrap sx={{ flex: 1, minWidth: 0 }}>
            <TbVideo
              size={20}
              style={{
                opacity: 0.7,
                flexShrink: 0,
                color: getEffectiveAccent(theme.colorScheme, accentColor),
              }}
            />
            <Text weight={600} size="md" lineClamp={1}>
              {file.name}
            </Text>
          </Group>

          <Group spacing="sm" noWrap align="center">
            {actions && (
              <Group spacing={8} noWrap sx={{ flexShrink: 0 }}>
                {actions}
              </Group>
            )}
            {files.length > 1 && (
              <Group spacing={4} noWrap sx={navigationFrameSx}>
                <ActionIcon
                  size={28}
                  radius="xl"
                  variant="filled"
                  onClick={onPrevious}
                  title="Previous video"
                  sx={{
                    background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                    color: "#fff",
                    "&:hover": {
                      background: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                    },
                  }}
                >
                  <TbChevronLeft size={16} />
                </ActionIcon>
                <Text
                  size="xs"
                  color="gray.3"
                  sx={{
                    minWidth: 48,
                    textAlign: "center",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {currentIndex + 1} / {files.length}
                </Text>
                <ActionIcon
                  size={28}
                  radius="xl"
                  variant="filled"
                  onClick={onNext}
                  title="Next video"
                  sx={{
                    background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                    color: "#fff",
                    "&:hover": {
                      background: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                    },
                  }}
                >
                  <TbChevronRight size={16} />
                </ActionIcon>
              </Group>
            )}
          </Group>
        </Group>

        <Box
          sx={{
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: "#000",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
          }}
        >
          <video
            ref={videoRef}
            controls
            onError={fallBackToOriginalVideo}
            style={{
              width: "100%",
              maxHeight: isConsolidated ? 280 : 400,
              display: "block",
            }}
            preload="metadata"
          />
        </Box>

        {!isConsolidated && (
          <Group
          position="apart"
          align="center"
          spacing="xs"
          sx={(theme) => ({
            padding: "10px 12px",
            borderRadius: 12,
            background:
              theme.colorScheme === "dark"
                ? "rgba(255, 255, 255, 0.035)"
                : "rgba(0, 0, 0, 0.035)",
            border: `1px solid rgba(${hexToRgb(effectiveAccent)}, ${theme.colorScheme === "dark" ? 0.14 : 0.2})`,
            [theme.fn.smallerThan("sm")]: {
              alignItems: "stretch",
              flexDirection: "column",
            },
          })}
        >
          <Stack spacing={2}>
            <Text size="xs" color="dimmed" weight={700} transform="uppercase">
              Playback quality
            </Text>
            <Text size="xs" color="dimmed">
              {isAdaptiveReady
                ? "Adaptive previews are stored separately; original stays untouched."
                : isAdaptivePending
                  ? "Adaptive preview is processing. Playing original quality for now."
                  : "Adaptive preview unavailable. Playing original quality."}
            </Text>
          </Stack>
          <Group spacing={6} noWrap={false}>
            {qualityOptions.map((option) => (
              <Button
                key={option.value}
                size="xs"
                compact
                disabled={option.disabled}
                variant={selectedQuality === option.value ? "filled" : "subtle"}
                onClick={() => setSelectedQuality(option.value)}
                sx={(theme) => ({
                  borderRadius: 999,
                  color:
                    selectedQuality === option.value
                      ? theme.black
                      : getEffectiveAccent(theme.colorScheme, accentColor),
                  background:
                    selectedQuality === option.value
                      ? getEffectiveAccent(theme.colorScheme, accentColor)
                      : `rgba(${hexToRgb(effectiveAccent)}, 0.08)`,
                  border: `1px solid rgba(${hexToRgb(effectiveAccent)}, 0.22)`,
                  "&:hover": {
                    background:
                      selectedQuality === option.value
                        ? getEffectiveAccent(theme.colorScheme, accentColor)
                        : `rgba(${hexToRgb(effectiveAccent)}, 0.16)`,
                  },
                  "&:disabled": {
                    opacity: 0.45,
                    color:
                      theme.colorScheme === "dark"
                        ? theme.colors.gray[5]
                        : theme.colors.gray[6],
                  },
                })}
              >
                {option.label}
              </Button>
            ))}
          </Group>
          </Group>
        )}

        <Group
          position="apart"
          align="flex-start"
          noWrap={false}
          sx={(theme) => ({
            [theme.fn.smallerThan("sm")]: {
              flexDirection: "column",
              alignItems: "stretch",
              gap: theme.spacing.sm,
            },
          })}
        >
          {files.length > 1 ? (
            <ScrollArea
              type="hover"
              offsetScrollbars
              sx={{ flex: 1, minWidth: 0 }}
            >
              <Group spacing={8} noWrap py={4}>
                {files.map((video, idx) => (
                  <Box
                    key={video.id}
                    onClick={() => onSelect(idx)}
                    sx={{
                      width: 84,
                      height: 52,
                      borderRadius: 10,
                      overflow: "hidden",
                      cursor: "pointer",
                      border:
                        idx === currentIndex
                          ? `2px solid ${accentColor}`
                          : "2px solid transparent",
                      opacity: idx === currentIndex ? 1 : 0.72,
                      transition: "all 0.2s ease",
                      flexShrink: 0,
                      backgroundColor:
                        theme.colorScheme === "dark"
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.05)",
                      "&:hover": {
                        opacity: 1,
                        borderColor: `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.5)`,
                      },
                    }}
                  >
                    {shouldShowAllThumbnails ||
                    Math.abs(idx - currentIndex) <= 1 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/shares/${shareId}/files/${video.id}/thumbnail`}
                        alt={video.name}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <TbVideo size={20} style={{ opacity: 0.55 }} />
                      </Box>
                    )}
                  </Box>
                ))}
              </Group>
            </ScrollArea>
          ) : (
            <Box />
          )}

          {!isConsolidated && (
            <Stack
            spacing={4}
            sx={(theme) => ({
              minWidth: 160,
              flexShrink: 0,
              [theme.fn.smallerThan("sm")]: {
                minWidth: 0,
                width: "100%",
              },
            })}
          >
            <Group position="apart" align="center" noWrap mb={4}>
              <Text size="xs" color="dimmed" weight={600} transform="uppercase">
                File Info
              </Text>
            </Group>
            <Text size="xs">
              <Text component="span" color="dimmed">
                Format:
              </Text>{" "}
              {format}
            </Text>
            <Text size="xs">
              <Text component="span" color="dimmed">
                Size:
              </Text>{" "}
              {byteToHumanSizeString(parseInt(file.size))}
            </Text>
            </Stack>
          )}
        </Group>
      </Stack>
    </Paper>
  );
};

const ImageGalleryCard = ({
  files,
  shareId,
  actions,
  currentIndex,
  onPrevious,
  onNext,
  onSelect,
  accentColor = "#00ff5a",
  variant = "full",
  onOpenPreview,
}: {
  files: FileMetaData[];
  shareId: string;
  actions?: React.ReactNode;
  currentIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: IndexSelect;
  accentColor?: string;
  variant?: PreviewStyle;
  onOpenPreview?: (_file: FileMetaData, _type: MediaPreviewType) => void;
}) => {
  const theme = useMantineTheme();
  const effectiveAccent = getEffectiveAccent(theme.colorScheme, accentColor);
  const { classes } = useStyles({ accentColor: effectiveAccent });
  const currentImage = files[currentIndex];
  const isConsolidated = variant === "consolidated";
  const previewActionsFrameSx = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: 6,
    borderRadius: 14,
    background:
      theme.colorScheme === "dark"
        ? "rgba(10, 16, 14, 0.72)"
        : "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(10px)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.08)"
    }`,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 10px 24px rgba(0,0,0,0.22)"
        : "0 10px 24px rgba(0,0,0,0.08)",
  } as const;
  const navigationFrameSx = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 36,
    padding: "2px 8px",
    borderRadius: 999,
    background:
      theme.colorScheme === "dark"
        ? `linear-gradient(135deg, rgba(${hexToRgb(effectiveAccent)}, 0.24) 0%, rgba(10, 16, 14, 0.82) 100%)`
        : `rgba(${hexToRgb(effectiveAccent)}, 0.12)`,
    border: `1px solid rgba(${hexToRgb(effectiveAccent)}, ${theme.colorScheme === "dark" ? 0.4 : 0.25})`,
    boxShadow:
      theme.colorScheme === "dark"
        ? `0 10px 26px rgba(${hexToRgb(effectiveAccent)}, 0.18)`
        : `0 8px 20px rgba(${hexToRgb(effectiveAccent)}, 0.08)`,
  } as const;

  if (!currentImage) return null;

  if (isConsolidated) {
    return (
      <Paper
        p="sm"
        radius="md"
        sx={(theme) => ({
          contain: "layout paint",
          background:
            theme.colorScheme === "dark"
              ? DARK_SHARE_SURFACE
              : "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(16px)",
          borderRadius: 16,
          border: `1px solid ${
            theme.colorScheme === "dark"
              ? `rgba(${hexToRgb(effectiveAccent)}, 0.18)`
              : `rgba(${hexToRgb(effectiveAccent)}, 0.22)`
          }`,
          marginTop: theme.spacing.xs,
          boxShadow:
            theme.colorScheme === "dark"
              ? `0 8px 28px rgba(0, 0, 0, 0.26), 0 0 42px rgba(${hexToRgb(effectiveAccent)}, 0.04)`
              : `0 8px 28px rgba(0, 0, 0, 0.08), 0 0 42px rgba(${hexToRgb(effectiveAccent)}, 0.03)`,
        })}
      >
        <Group
          position="apart"
          align="center"
          spacing="md"
          noWrap
          sx={(theme) => ({
            minHeight: 66,
            [theme.fn.smallerThan("sm")]: {
              alignItems: "flex-start",
              flexWrap: "wrap",
            },
          })}
        >
          <Group spacing="md" noWrap sx={{ flex: 1, minWidth: 0 }}>
            <Box
              onClick={() => onOpenPreview?.(currentImage, "image")}
              sx={(theme) => ({
                width: 74,
                height: 48,
                borderRadius: 12,
                overflow: "hidden",
                flexShrink: 0,
                cursor: onOpenPreview ? "pointer" : "default",
                backgroundColor:
                  theme.colorScheme === "dark"
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.05)",
                border: `1px solid rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
              })}
            >
              <img
                src={imagePreviewSrc(shareId, currentImage)}
                alt={currentImage.name}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </Box>
            <Group spacing="xs" noWrap sx={{ minWidth: 0, flex: 1 }}>
              <TbPhoto
                size={18}
                style={{
                  opacity: 0.78,
                  flexShrink: 0,
                  color: effectiveAccent,
                }}
              />
              <Text weight={600} size="sm" lineClamp={1} sx={{ minWidth: 0 }}>
                {currentImage.name}
              </Text>
            </Group>
          </Group>

          <Group spacing={8} noWrap sx={{ flexShrink: 0, marginLeft: "auto" }}>
            {files.length > 1 && (
              <Group spacing={4} noWrap sx={navigationFrameSx}>
                <ActionIcon
                  size={26}
                  radius="xl"
                  onClick={onPrevious}
                  variant="filled"
                  sx={{
                    background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                    color: "#fff",
                    "&:hover": {
                      backgroundColor: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                    },
                  }}
                >
                  <TbChevronLeft size={15} />
                </ActionIcon>
                <Text
                  size="xs"
                  color="gray.3"
                  sx={{
                    minWidth: 42,
                    textAlign: "center",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {currentIndex + 1} / {files.length}
                </Text>
                <ActionIcon
                  size={26}
                  radius="xl"
                  onClick={onNext}
                  variant="filled"
                  sx={{
                    background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                    color: "#fff",
                    "&:hover": {
                      backgroundColor: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                    },
                  }}
                >
                  <TbChevronRight size={15} />
                </ActionIcon>
              </Group>
            )}
            <Tooltip label="Open full preview" withArrow position="top" withinPortal>
              <ActionIcon
                className={classes.actionButton}
                onClick={() => onOpenPreview?.(currentImage, "image")}
                title="Open full preview"
                sx={{
                  color: effectiveAccent,
                  borderColor: `rgba(${hexToRgb(effectiveAccent)}, 0.34)`,
                  background: `rgba(${hexToRgb(effectiveAccent)}, 0.1)`,
                }}
              >
                <TbMaximize size={18} />
              </ActionIcon>
            </Tooltip>
            {actions}
          </Group>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper
      p={isConsolidated ? "md" : "lg"}
      radius="md"
      sx={{
        contain: "layout paint",
        background:
          theme.colorScheme === "dark"
            ? DARK_SHARE_SURFACE
            : "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(16px)",
        borderRadius: 16,
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.18)`
            : `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.22)`
        }`,
        marginTop: isConsolidated ? theme.spacing.xs : theme.spacing.md,
        boxShadow:
          theme.colorScheme === "dark"
            ? `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 50px rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.05)`
            : `0 8px 32px rgba(0, 0, 0, 0.08), 0 0 50px rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.03)`,
      }}
    >
      <Stack spacing="md">
        <Group position="apart" align="flex-start">
          <Group spacing="sm" noWrap sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.15)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TbPhoto
                size={20}
                style={{
                  color: getEffectiveAccent(theme.colorScheme, accentColor),
                }}
              />
            </Box>
            <Box>
              <Text
                size="sm"
                weight={600}
                lineClamp={1}
                style={{ maxWidth: 300 }}
              >
                {currentImage.name}
              </Text>
              {!isConsolidated && (
                <Text size="xs" color="dimmed">
                  {byteToHumanSizeString(parseInt(currentImage.size))}
                </Text>
              )}
            </Box>
          </Group>

          <Group spacing="sm" noWrap align="center">
            {actions && <Box sx={previewActionsFrameSx}>{actions}</Box>}
            {files.length > 1 && (
              <Group spacing="xs" sx={navigationFrameSx}>
                <ActionIcon
                  size={28}
                  radius="xl"
                  onClick={onPrevious}
                  variant="filled"
                  sx={{
                    background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                    color: "#fff",
                    "&:hover": {
                      backgroundColor: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                    },
                  }}
                >
                  <TbChevronLeft size={16} />
                </ActionIcon>
                <Text
                  size="xs"
                  color="gray.3"
                  sx={{
                    minWidth: 48,
                    textAlign: "center",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {currentIndex + 1} / {files.length}
                </Text>
                <ActionIcon
                  size={28}
                  radius="xl"
                  onClick={onNext}
                  variant="filled"
                  sx={{
                    background: `rgba(${hexToRgb(effectiveAccent)}, 0.18)`,
                    color: "#fff",
                    "&:hover": {
                      backgroundColor: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
                    },
                  }}
                >
                  <TbChevronRight size={16} />
                </ActionIcon>
              </Group>
            )}
          </Group>
        </Group>

        <Box
          sx={{
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor:
              theme.colorScheme === "dark"
                ? "rgba(0, 0, 0, 0.3)"
                : "rgba(0, 0, 0, 0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: isConsolidated ? 140 : 200,
            maxHeight: isConsolidated ? 340 : 500,
          }}
        >
          <img
            src={imagePreviewSrc(shareId, currentImage)}
            alt={currentImage.name}
            style={{
              maxWidth: "100%",
              maxHeight: isConsolidated ? 340 : 500,
              objectFit: "contain",
              display: "block",
            }}
          />
        </Box>

        {files.length > 1 && (
          <ScrollArea type="hover" offsetScrollbars>
            <Group spacing={8} noWrap py={4}>
              {files.map((img, idx) => (
                <Box
                  key={img.id}
                  onClick={() => onSelect(idx)}
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "pointer",
                    border:
                      idx === currentIndex
                        ? `2px solid ${accentColor}`
                        : "2px solid transparent",
                    opacity: idx === currentIndex ? 1 : 0.6,
                    transition: "all 0.2s ease",
                    flexShrink: 0,
                    "&:hover": {
                      opacity: 1,
                      borderColor: `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.5)`,
                    },
                  }}
                >
                  <img
                    src={`/api/shares/${shareId}/files/${img.id}/thumbnail`}
                    alt={img.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </Box>
              ))}
            </Group>
          </ScrollArea>
        )}
      </Stack>
    </Paper>
  );
};

export type ShareLyricsPanelData = {
  fileName: string;
  title?: string | null;
  artist?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  text: string;
};

const FileList = ({
  files,
  setShare,
  share,
  isLoading,
  accentColor = "#00ff5a",
  lyricsPanelOpen = false,
  onLyricsPanelOpenChange,
  onLyricsAvailabilityChange,
  onLyricsDataChange,
}: {
  files?: FileMetaData[];
  setShare: Dispatch<SetStateAction<Share | undefined>>;
  share: Share;
  isLoading: boolean;
  accentColor?: string;
  lyricsPanelOpen?: boolean;
  onLyricsPanelOpenChange?: (_open: boolean) => void;
  onLyricsAvailabilityChange?: (_available: boolean) => void;
  onLyricsDataChange?: (_data: ShareLyricsPanelData | null) => void;
}) => {
  const theme = useMantineTheme();
  const clipboard = useClipboard();
  const modals = useModals();
  const t = useTranslate();
  const previewStyle: PreviewStyle =
    share?.previewStyle === "consolidated" ? "consolidated" : "full";

  const [sort, setSort] = useState<TableSort>({
    property: "name",
    direction: "desc",
  });

  const [infoOpened, setInfoOpened] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoMetadata, setInfoMetadata] = useState<any | null>(null);

  const [spectrumOpened, setSpectrumOpened] = useState(false);
  const [spectrumLoading, setSpectrumLoading] = useState(false);
  const [spectrumUrl, setSpectrumUrl] = useState<string | null>(null);
  const [spectrumFileName, setSpectrumFileName] = useState<string>("");
  const [spectrumDuration, setSpectrumDuration] = useState<number>(0);
  const [spectrumSampleRate, setSpectrumSampleRate] = useState<number>(44100);

  const [zipPreviewOpened, setZipPreviewOpened] = useState(false);
  const [zipPreviewLoading, setZipPreviewLoading] = useState(false);
  const [zipContents, setZipContents] = useState<any[] | null>(null);
  const [zipFileName, setZipFileName] = useState<string>("");
  const [zipFileId, setZipFileId] = useState<string>("");
  const [selectedArchivePaths, setSelectedArchivePaths] = useState<string[]>(
    [],
  );
  const [archiveDownloadLoading, setArchiveDownloadLoading] = useState(false);

  const [audioMetadataByFileId, setAudioMetadataByFileId] = useState<
    Record<string, any>
  >({});
  const [audioMetadataLoadingByFileId, setAudioMetadataLoadingByFileId] =
    useState<Record<string, boolean>>({});
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [openLyricsFileId, setOpenLyricsFileId] = useState<string | null>(null);
  const [audioTrackListOpen, setAudioTrackListOpen] = useState(false);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [pdfOpened, setPdfOpened] = useState(false);
  const [pdfFile, setPdfFile] = useState<FileMetaData | null>(null);

  const [mediaPreviewOpened, setMediaPreviewOpened] = useState(false);
  const [mediaPreviewFile, setMediaPreviewFile] = useState<FileMetaData | null>(
    null,
  );
  const [mediaPreviewType, setMediaPreviewType] =
    useState<MediaPreviewType>("image");
  const [mediaPreviewStatus, setMediaPreviewStatus] = useState<{
    status: string;
    qualities: string[];
    error?: string | null;
  }>({
    status: "not_started",
    qualities: [],
  });
  const [mediaPreviewQuality, setMediaPreviewQuality] = useState("auto");
  const mediaPreviewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaPreviewHlsRef = useRef<Hls | null>(null);

  const [viewMode, setViewMode] = useState<"list" | "folder">("list");

  const hasRelativePaths = useMemo(() => {
    return (
      files?.some(
        (f) => (f as any).relativePath && (f as any).relativePath !== f.name,
      ) || false
    );
  }, [files]);

  const inlinePreviewFiles = useMemo(
    () => files?.filter((f) => isInlinePreviewFile(f.name)) || [],
    [files],
  );

  const listFiles = useMemo(
    () =>
      inlinePreviewFiles.length > 0
        ? files?.filter((f) => !isInlinePreviewFile(f.name)) || []
        : files || [],
    [files, inlinePreviewFiles],
  );

  const sortedListFiles = useMemo(() => {
    if (!listFiles || !sort.property) return listFiles;

    return [...listFiles].sort((a: any, b: any) => {
      if (sort.direction === "asc") {
        return b[sort.property!].localeCompare(a[sort.property!], undefined, {
          numeric: true,
        });
      }

      return a[sort.property!].localeCompare(b[sort.property!], undefined, {
        numeric: true,
      });
    });
  }, [listFiles, sort]);

  const hasListFiles = listFiles.length > 0;

  const folderTree = useMemo(() => {
    if (!listFiles || !hasRelativePaths) return null;

    interface FolderNode {
      name: string;
      path: string;
      files: FileMetaData[];
      subfolders: Map<string, FolderNode>;
      totalSize: number;
    }

    const root: FolderNode = {
      name: "",
      path: "",
      files: [],
      subfolders: new Map(),
      totalSize: 0,
    };

    listFiles.forEach((file) => {
      const relativePath = (file as any).relativePath || file.name;
      const parts = relativePath.split("/").filter((p: string) => p);

      let currentNode = root;

      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        const folderPath = parts.slice(0, i + 1).join("/");

        if (!currentNode.subfolders.has(folderName)) {
          currentNode.subfolders.set(folderName, {
            name: folderName,
            path: folderPath,
            files: [],
            subfolders: new Map(),
            totalSize: 0,
          });
        }
        currentNode = currentNode.subfolders.get(folderName)!;
      }

      currentNode.files.push(file);

      const fileSize = parseInt(file.size) || 0;
      root.totalSize += fileSize;

      let sizeNode = root;
      for (let i = 0; i < parts.length - 1; i++) {
        sizeNode = sizeNode.subfolders.get(parts[i])!;
        sizeNode.totalSize += fileSize;
      }
    });

    return root;
  }, [listFiles, hasRelativePaths]);

  React.useEffect(() => {
    if (hasRelativePaths) {
      setViewMode("folder");
    }
  }, [hasRelativePaths]);

  const getInlinePreviewType = (
    file: FileMetaData,
  ): "audio" | "video" | "image" | null => {
    if (isAudioFile(file.name)) return "audio";
    if (isVideoFile(file.name)) return "video";
    if (isImageFile(file.name)) return "image";
    return null;
  };

  const renderPreviewHeader = (
    file?: FileMetaData | null,
    isFirstPreviewHeader = false,
  ) => {
    const previewHeader = String(file?.previewHeader || "").trim();
    if (!previewHeader) return null;

    return (
      <Box
        className={`${classes.previewHeader} ${
          isFirstPreviewHeader ? classes.firstPreviewHeader : ""
        }`}
      >
        <Text className={classes.previewHeaderText}>{previewHeader}</Text>
        <Box className={classes.previewHeaderAccent} />
      </Box>
    );
  };

  const groupedPreviewFiles = inlinePreviewFiles.filter(
    (file) => file.previewGroup !== false,
  );

  const audioFiles = groupedPreviewFiles.filter((f) => isAudioFile(f.name));
  const videoFiles = groupedPreviewFiles.filter((f) => isVideoFile(f.name));
  const imageFiles = groupedPreviewFiles.filter((f) => isImageFile(f.name));
  type PreviewRenderItem =
    | { key: string; type: "audio-group" | "video-group" | "image-group" }
    | {
        key: string;
        type: "audio-single" | "video-single" | "image-single";
        file: FileMetaData;
      };

  const previewRenderItems = useMemo<PreviewRenderItem[]>(() => {
    const seenGroupedTypes = new Set<"audio" | "video" | "image">();
    const items: PreviewRenderItem[] = [];

    inlinePreviewFiles.forEach((file) => {
      const type = getInlinePreviewType(file);
      if (!type) return;

      if (file.previewGroup === false) {
        items.push({
          key: `${type}-${file.id}`,
          type: `${type}-single` as const,
          file,
        });
        return;
      }

      if (seenGroupedTypes.has(type)) {
        return;
      }

      seenGroupedTypes.add(type);
      items.push({ key: `${type}-group`, type: `${type}-group` as const });
    });

    return items;
  }, [inlinePreviewFiles]);

  const hasAudioFiles = audioFiles.length > 0;
  const hasVideoFiles = videoFiles.length > 0;
  const hasImageFiles = imageFiles.length > 0;
  const currentAudioFile = audioFiles[currentAudioIndex] || null;
  const currentVideoFile = videoFiles[currentVideoIndex] || null;
  const currentImageFile = imageFiles[currentImageIndex] || null;

  const loadAudioMetadata = useCallback(
    (file?: FileMetaData | null) => {
      if (!file?.id || !share?.id) return;
      if (
        audioMetadataByFileId[file.id] ||
        audioMetadataLoadingByFileId[file.id]
      ) {
        return;
      }

      setAudioMetadataLoadingByFileId((prev) => ({
        ...prev,
        [file.id]: true,
      }));

      fetch(`/api/shares/${share.id}/files/${file.id}/metadata`)
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to load metadata");
          }
          return res.json();
        })
        .then((data) => {
          setAudioMetadataByFileId((prev) => ({
            ...prev,
            [file.id]: data,
          }));
        })
        .catch(() => {
          setAudioMetadataByFileId((prev) => ({
            ...prev,
            [file.id]: null,
          }));
        })
        .finally(() => {
          setAudioMetadataLoadingByFileId((prev) => ({
            ...prev,
            [file.id]: false,
          }));
        });
    },
    [audioMetadataByFileId, audioMetadataLoadingByFileId, share?.id],
  );

  const getLyricsData = (
    file: FileMetaData,
    metadata: any,
  ): ShareLyricsPanelData | null => {
    const lyricsText = String(metadata?.lyricsText || "").trim();
    if (!lyricsText) return null;

    return {
      fileName: file.name,
      title: metadata?.title || file.name,
      artist: metadata?.artist || "Lyrics",
      source: metadata?.lyricsSource || null,
      sourceUrl: metadata?.lyricsSourceUrl || null,
      text: lyricsText,
    };
  };

  const visibleAudioPreviewFiles = useMemo(() => {
    const audioPreviewFiles: FileMetaData[] = [];
    if (currentAudioFile) {
      audioPreviewFiles.push(currentAudioFile);
    }

    previewRenderItems.forEach((item) => {
      if (item.type === "audio-single" && item.file) {
        audioPreviewFiles.push(item.file);
      }
    });

    return audioPreviewFiles;
  }, [currentAudioFile, previewRenderItems]);

  useEffect(() => {
    visibleAudioPreviewFiles.forEach((file) => loadAudioMetadata(file));
  }, [loadAudioMetadata, visibleAudioPreviewFiles]);

  const openLyricsData = useMemo(() => {
    if (!openLyricsFileId) return null;
    const file = visibleAudioPreviewFiles.find(
      (audioFile) => audioFile.id === openLyricsFileId,
    );
    if (!file) return null;

    return getLyricsData(file, audioMetadataByFileId[file.id]);
  }, [audioMetadataByFileId, openLyricsFileId, visibleAudioPreviewFiles]);

  useEffect(() => {
    if (openLyricsFileId && openLyricsData) {
      onLyricsAvailabilityChange?.(true);
      onLyricsDataChange?.(openLyricsData);
      onLyricsPanelOpenChange?.(true);
      return;
    }

    onLyricsAvailabilityChange?.(false);
    onLyricsDataChange?.(null);
    onLyricsPanelOpenChange?.(false);
  }, [
    openLyricsData,
    openLyricsFileId,
    onLyricsAvailabilityChange,
    onLyricsDataChange,
    onLyricsPanelOpenChange,
  ]);

  const goToPreviousAudio = () => {
    setCurrentAudioIndex((prev) =>
      prev > 0 ? prev - 1 : audioFiles.length - 1,
    );
  };

  const goToNextAudio = () => {
    setCurrentAudioIndex((prev) =>
      prev < audioFiles.length - 1 ? prev + 1 : 0,
    );
  };

  const goToPreviousVideo = () => {
    setCurrentVideoIndex((prev) =>
      prev > 0 ? prev - 1 : videoFiles.length - 1,
    );
  };

  const goToNextVideo = () => {
    setCurrentVideoIndex((prev) =>
      prev < videoFiles.length - 1 ? prev + 1 : 0,
    );
  };

  const goToPreviousImage = () => {
    setCurrentImageIndex((prev) =>
      prev > 0 ? prev - 1 : imageFiles.length - 1,
    );
  };

  const goToNextImage = () => {
    setCurrentImageIndex((prev) =>
      prev < imageFiles.length - 1 ? prev + 1 : 0,
    );
  };

  const openPdfViewer = (file: FileMetaData) => {
    setPdfFile(file);
    setPdfOpened(true);
  };

  useEffect(() => {
    if (!hasAudioFiles) {
      setOpenLyricsFileId(null);
      setAudioTrackListOpen(false);
    }
  }, [hasAudioFiles]);

  useEffect(() => {
    loadAudioMetadata(currentAudioFile);
  }, [currentAudioFile, loadAudioMetadata]);

  useEffect(() => {
    if (!audioTrackListOpen) return;
    audioFiles.forEach((file) => loadAudioMetadata(file));
  }, [audioFiles, audioTrackListOpen, loadAudioMetadata]);

  const copyFileLink = (file: FileMetaData) => {
    const link = `${window.location.origin}/api/shares/${
      share.id
    }/files/${file.id}`;

    if (window.isSecureContext) {
      clipboard.copy(link);
      toast.success(t("common.notify.copied-link"));
    } else {
      modals.openModal({
        title: t("share.modal.file-link"),
        children: (
          <Stack align="stretch">
            <TextInput variant="filled" value={link} />
          </Stack>
        ),
      });
    }
  };

  const getFileEmbedUrl = (file: FileMetaData) =>
    `${window.location.origin}/embed/share/${share.id}?file=${encodeURIComponent(file.id)}`;

  const getFileEmbedCode = (file: FileMetaData) =>
    `<iframe src="${getFileEmbedUrl(file)}" width="720" height="300" loading="lazy" allow="fullscreen; clipboard-write" style="border:0;border-radius:24px;max-width:100%;"></iframe>`;

  const openFileEmbedModal = (file: FileMetaData) => {
    const embedUrl = getFileEmbedUrl(file);
    const embedCode = getFileEmbedCode(file);

    modals.openModal({
      title: "Embed preview",
      children: (
        <Stack align="stretch" spacing="md">
          <Text size="sm" color="dimmed">
            Paste this iframe into another site to show a preview card
            for this file.
          </Text>
          <TextInput
            label="Preview URL"
            variant="filled"
            value={embedUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <TextInput
            label="Embed code"
            variant="filled"
            value={embedCode}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <Group position="right">
            <Button
              variant="default"
              leftIcon={<TbExternalLink size={16} />}
              component="a"
              href={embedUrl}
              target="_blank"
              rel="noreferrer"
            >
              Preview
            </Button>
            <Button
              leftIcon={<TbCopy size={16} />}
              onClick={() => {
                clipboard.copy(embedCode);
                toast.success("Embed code copied");
              }}
            >
              Copy embed
            </Button>
          </Group>
        </Stack>
      ),
    });
  };

  const openFileInfo = async (file: FileMetaData) => {
    setInfoOpened(true);
    setInfoLoading(true);
    setInfoMetadata(null);

    try {
      const res = await fetch(
        `/api/shares/${share.id}/files/${file.id}/metadata`,
      );

      if (!res.ok) {
        throw new Error(
          await getResponseErrorMessage(res, "Failed to load metadata"),
        );
      }

      const data = await res.json();
      setInfoMetadata(data);
    } catch (e) {
      setInfoMetadata(null);
      toast.error(
        getStorageAwareErrorMessage(
          e instanceof Error ? e.message : "",
          "Failed to load file info.",
        ),
      );
    } finally {
      setInfoLoading(false);
    }
  };

  const openSpectrum = async (file: FileMetaData) => {
    setSpectrumOpened(true);
    setSpectrumLoading(true);
    setSpectrumUrl(null);
    setSpectrumFileName(file.name);
    setSpectrumDuration(0);
    setSpectrumSampleRate(44100);

    try {
      const metaRes = await fetch(
        `/api/shares/${share.id}/files/${file.id}/metadata`,
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (meta.duration) {
          setSpectrumDuration(meta.duration);
        }
        if (meta.sampleRate) {
          setSpectrumSampleRate(meta.sampleRate);
        }
      }

      const url = `/api/shares/${share.id}/files/${file.id}/spectrum`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          await getResponseErrorMessage(res, "Failed to generate spectrum"),
        );
      }
      setSpectrumUrl(url);
    } catch (e) {
      toast.error(
        getStorageAwareErrorMessage(
          e instanceof Error ? e.message : "",
          "Failed to generate spectrum. Please try again.",
        ),
      );
      setSpectrumOpened(false);
    } finally {
      setSpectrumLoading(false);
    }
  };

  const openZipPreview = async (file: FileMetaData) => {
    setZipPreviewOpened(true);
    setZipPreviewLoading(true);
    setZipContents(null);
    setZipFileName(file.name);
    setZipFileId(file.id);
    setSelectedArchivePaths([]);

    try {
      const res = await fetch(
        `/api/shares/${share.id}/files/${file.id}/zip-contents`,
      );

      if (!res.ok) {
        throw new Error("Failed to load archive contents");
      }

      const data = await res.json();
      setZipContents(Array.isArray(data) ? data : data.contents || []);
    } catch (e) {
      setZipContents(null);
      toast.error("Failed to load archive contents.");
    } finally {
      setZipPreviewLoading(false);
    }
  };

  const openMediaPreview = (
    file: FileMetaData,
    previewType: MediaPreviewType,
  ) => {
    setMediaPreviewFile(file);
    setMediaPreviewType(previewType);
    setMediaPreviewQuality("auto");
    setMediaPreviewStatus({ status: "not_started", qualities: [] });
    setMediaPreviewOpened(true);
  };

  const mediaPreviewQualities = mediaPreviewStatus.qualities || [];
  const isMediaPreviewAdaptiveReady =
    mediaPreviewStatus.status === "ready" && mediaPreviewQualities.length > 0;
  const isMediaPreviewAdaptivePending = [
    "not_started",
    "queued",
    "processing",
  ].includes(mediaPreviewStatus.status);
  const shareId = share?.id;
  const mediaPreviewOriginalUrl = mediaPreviewFile && shareId
    ? `/api/shares/${shareId}/files/${mediaPreviewFile.id}?download=false&preview=1`
    : "";
  const mediaPreviewHlsUrl =
    mediaPreviewFile && shareId && mediaPreviewQuality === "auto"
      ? `/api/shares/${shareId}/files/${mediaPreviewFile.id}/hls/master.m3u8`
      : mediaPreviewFile && shareId
        ? `/api/shares/${shareId}/files/${mediaPreviewFile.id}/hls/${mediaPreviewQuality}/index.m3u8`
        : "";
  const mediaPreviewQualityOptions = [
    {
      value: "auto",
      label: "Auto",
      disabled: !isMediaPreviewAdaptiveReady,
    },
    ...mediaPreviewQualities.map((quality) => ({
      value: quality,
      label: quality,
      disabled: !isMediaPreviewAdaptiveReady,
    })),
    { value: "original", label: "Original", disabled: false },
  ];
  const fallBackMediaPreviewToOriginal = useCallback(() => {
    if (mediaPreviewQuality === "original") return;
    mediaPreviewHlsRef.current?.destroy();
    mediaPreviewHlsRef.current = null;
    setMediaPreviewQuality("original");
  }, [mediaPreviewQuality]);

  useEffect(() => {
    if (
      !mediaPreviewOpened ||
      mediaPreviewType !== "video" ||
      !mediaPreviewFile ||
      !shareId
    ) {
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const loadStatus = async () => {
      try {
        const response = await fetch(
          `/api/shares/${shareId}/files/${mediaPreviewFile.id}/video-preview`,
        );
        if (!response.ok) {
          throw new Error("Failed to load adaptive preview status");
        }

        const data = await response.json();
        if (cancelled) return;

        setMediaPreviewStatus({
          status: data.status || "not_started",
          qualities: Array.isArray(data.qualities) ? data.qualities : [],
          error: data.error,
        });

        if (["queued", "processing", "not_started"].includes(data.status)) {
          pollTimer = setTimeout(loadStatus, 5000);
        }
      } catch {
        if (!cancelled) {
          setMediaPreviewStatus({
            status: "failed",
            qualities: [],
            error: "Adaptive preview unavailable",
          });
        }
      }
    };

    loadStatus();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [mediaPreviewFile, mediaPreviewOpened, mediaPreviewType, shareId]);

  useEffect(() => {
    const video = mediaPreviewVideoRef.current;

    mediaPreviewHlsRef.current?.destroy();
    mediaPreviewHlsRef.current = null;

    if (
      !video ||
      !mediaPreviewOpened ||
      mediaPreviewType !== "video" ||
      !mediaPreviewFile ||
      !shareId
    ) {
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
      return;
    }

    const useAdaptiveStream =
      isMediaPreviewAdaptiveReady && mediaPreviewQuality !== "original";

    if (!useAdaptiveStream) {
      video.src = mediaPreviewOriginalUrl;
      video.load();
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = mediaPreviewHlsUrl;
      video.load();
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      mediaPreviewHlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data?.fatal) {
          fallBackMediaPreviewToOriginal();
        }
      });
      hls.loadSource(mediaPreviewHlsUrl);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
        mediaPreviewHlsRef.current = null;
      };
    }

    video.src = mediaPreviewOriginalUrl;
    video.load();
  }, [
    fallBackMediaPreviewToOriginal,
    isMediaPreviewAdaptiveReady,
    mediaPreviewFile,
    mediaPreviewHlsUrl,
    mediaPreviewOpened,
    mediaPreviewOriginalUrl,
    mediaPreviewQuality,
    mediaPreviewType,
  ]);

  const toggleArchivePath = (archivePath: string) => {
    setSelectedArchivePaths((prev) =>
      prev.includes(archivePath)
        ? prev.filter((item) => item !== archivePath)
        : [...prev, archivePath],
    );
  };

  const downloadSelectedArchiveEntries = async () => {
    if (!zipFileId || selectedArchivePaths.length === 0) {
      return;
    }

    setArchiveDownloadLoading(true);
    try {
      await shareService.downloadSelectedArchiveEntries(
        share.id,
        zipFileId,
        selectedArchivePaths,
        `${zipFileName.replace(/\.[^.]+$/, "")}-selected.zip`,
      );
    } catch {
      toast.error("Failed to download selected archive files.");
    } finally {
      setArchiveDownloadLoading(false);
    }
  };

  const { classes } = useStyles({ accentColor });

  const renderPreviewActions = (file: FileMetaData) => (
    <Group spacing={8} className={classes.actionsGroup}>
      {isArchiveFile(file.name) && (
        <>
          <Tooltip label="View archive contents" withArrow position="top" withinPortal>
            <ActionIcon
              onClick={() => openZipPreview(file)}
              className={classes.actionButton}
            >
              <TbFileZip size={18} />
            </ActionIcon>
          </Tooltip>
        </>
      )}
      {isPdfFile(file.name) && (
        <Tooltip label="View PDF" withArrow position="top" withinPortal>
          <ActionIcon
            onClick={() => openPdfViewer(file)}
            className={classes.actionButton}
          >
            <TbFileTypePdf size={18} />
          </ActionIcon>
        </Tooltip>
      )}
      {isAudioFile(file.name) && (
        <Tooltip label="Spectrum analyzer" withArrow position="top" withinPortal>
          <ActionIcon
            onClick={() => openSpectrum(file)}
            className={classes.actionButton}
          >
            <TbWaveSquare size={18} />
          </ActionIcon>
        </Tooltip>
      )}
      <Tooltip label="File info" withArrow position="top" withinPortal>
        <ActionIcon
          onClick={() => openFileInfo(file)}
          className={classes.actionButton}
        >
          <TbFileInfo size={18} />
        </ActionIcon>
      </Tooltip>
      {!share.hasPassword && (
        <Menu
          trigger="hover"
          openDelay={80}
          closeDelay={180}
          withinPortal
          position="bottom-end"
          shadow="xl"
        >
          <Menu.Target>
            <ActionIcon className={classes.actionButton}>
              <TbExternalLink size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              icon={<TbCopy size={16} />}
              onClick={() => copyFileLink(file)}
            >
              Copy link
            </Menu.Item>
            <Menu.Item
              icon={<TbCode size={16} />}
              onClick={() => openFileEmbedModal(file)}
            >
              Embed
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
      <Tooltip label="Download" withArrow position="top" withinPortal>
        <ActionIcon
          className={classes.downloadButton}
          disabled={["scanning", "infected"].includes(
            file.virusScanStatus || "",
          )}
          onClick={async () => {
            if (file.virusScanStatus === "scanning") {
              toast.error("File scan is still running.");
              return;
            }
            if (file.virusScanStatus === "infected") {
              toast.error(
                "File download is blocked because a threat was detected.",
              );
              return;
            }
            if (file.virusScanStatus === "too_large") {
              toast.warning(
                "This file is above the scanner max and could not be scanned. Download at your own risk.",
              );
            }
            setShare((prev: any) =>
              prev ? { ...prev, downloads: (prev.downloads ?? 0) + 1 } : prev,
            );
            await shareService.downloadFile(share.id, file.id);
          }}
        >
          <TbDownload size={18} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );

  const renderFileRow = (file: FileMetaData, depth: number = 0) => {
    const displayName = (file as any).relativePath
      ? (file as any).relativePath.split("/").pop() || file.name
      : file.name;

    return (
      <tr key={file.id || file.name}>
        <td>
          <Group spacing={8} style={{ paddingLeft: depth * 20 }}>
            <TbFile
              size={16}
              style={{
                color: getEffectiveAccent(theme.colorScheme, accentColor),
                opacity: 0.7,
              }}
            />
            <span className={classes.fileName}>{displayName}</span>
          </Group>
        </td>
        <td>
          <span className={classes.fileSize}>
            {byteToHumanSizeString(parseInt(file.size))}
          </span>
        </td>
        <td>
          <Group position="right" spacing={8}>
            {renderPreviewActions(file)}
          </Group>
        </td>
      </tr>
    );
  };

  const FolderRow = ({
    node,
    depth,
  }: {
    node: {
      name: string;
      path: string;
      files: FileMetaData[];
      subfolders: Map<string, any>;
      totalSize: number;
    };
    depth: number;
  }) => {
    const [expanded, setExpanded] = useState(depth < 2);

    const subfolders = Array.from(node.subfolders.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const sortedFiles = [...node.files].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const totalFiles =
      node.files.length +
      subfolders.reduce((acc, sf) => acc + sf.files.length, 0);

    return (
      <>
        {node.name && (
          <tr
            style={{
              backgroundColor: `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.03)`,
              cursor: "pointer",
            }}
            onClick={() => setExpanded(!expanded)}
          >
            <td colSpan={3}>
              <Group spacing={8} style={{ paddingLeft: depth * 20 }}>
                <TbChevronDown
                  size={14}
                  style={{
                    transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
                {expanded ? (
                  <TbFolderOpen
                    size={18}
                    style={{
                      color: getEffectiveAccent(theme.colorScheme, accentColor),
                    }}
                  />
                ) : (
                  <TbFolder
                    size={18}
                    style={{
                      color: getEffectiveAccent(theme.colorScheme, accentColor),
                    }}
                  />
                )}
                <Text size="sm" weight={500}>
                  {node.name}
                </Text>
                <Text size="xs" color="dimmed">
                  ({totalFiles} file{totalFiles !== 1 ? "s" : ""},{" "}
                  {byteToHumanSizeString(node.totalSize)})
                </Text>
              </Group>
            </td>
          </tr>
        )}

        {(expanded || !node.name) && (
          <>
            {subfolders.map((subfolder) => (
              <FolderRow
                key={subfolder.path}
                node={subfolder}
                depth={node.name ? depth + 1 : depth}
              />
            ))}
            {sortedFiles.map((file) =>
              renderFileRow(file, node.name ? depth + 1 : depth),
            )}
          </>
        )}
      </>
    );
  };

  return (
    <>
      <Box
        sx={(_theme) => ({
          display: "block",
        })}
      >
        <Box
          sx={{
            minWidth: 0,
            transition: "all 0.24s ease",
          }}
        >
          {hasRelativePaths && (
            <Group spacing={8} mb="md">
              <ActionIcon
                variant={viewMode === "list" ? "filled" : "subtle"}
                onClick={() => setViewMode("list")}
                sx={{
                  backgroundColor:
                    viewMode === "list"
                      ? `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.2)`
                      : "transparent",
                  color: viewMode === "list" ? accentColor : undefined,
                  "&:hover": {
                    backgroundColor: `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.15)`,
                  },
                }}
              >
                <TbFile size={18} />
              </ActionIcon>
              <ActionIcon
                variant={viewMode === "folder" ? "filled" : "subtle"}
                onClick={() => setViewMode("folder")}
                sx={{
                  backgroundColor:
                    viewMode === "folder"
                      ? `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.2)`
                      : "transparent",
                  color: viewMode === "folder" ? accentColor : undefined,
                  "&:hover": {
                    backgroundColor: `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.15)`,
                  },
                }}
              >
                <TbFolder size={18} />
              </ActionIcon>
              <Text size="xs" color="dimmed">
                {viewMode === "folder" ? "Folder View" : "List View"}
              </Text>
            </Group>
          )}

          {hasListFiles && (
            <Box className={classes.tableWrapper}>
              <Table className={classes.table}>
                <thead>
                  <tr>
                    <th>
                      <Group spacing="xs">
                        <FormattedMessage id="share.table.name" />
                        {viewMode === "list" && (
                          <TableSortIcon
                            sort={sort}
                            setSort={setSort}
                            property="name"
                          />
                        )}
                      </Group>
                    </th>
                    <th>
                      <Group spacing="xs">
                        <FormattedMessage id="share.table.size" />
                        {viewMode === "list" && (
                          <TableSortIcon
                            sort={sort}
                            setSort={setSort}
                            property="size"
                          />
                        )}
                      </Group>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    skeletonRows
                  ) : viewMode === "folder" && folderTree ? (
                    <FolderRow node={folderTree} depth={0} />
                  ) : (
                    sortedListFiles.map((file) => renderFileRow(file, 0))
                  )}
                </tbody>
              </Table>
            </Box>
          )}

          {share?.id &&
            previewRenderItems.map((item, itemIndex) => {
              const isFirstPreviewHeader = itemIndex === 0;
              if (
                item.type === "audio-group" &&
                hasAudioFiles &&
                currentAudioFile
              ) {
                const metadata = audioMetadataByFileId[currentAudioFile.id];
                const lyricsData = getLyricsData(currentAudioFile, metadata);
                const lyricsOpen =
                  lyricsPanelOpen && openLyricsFileId === currentAudioFile.id;

                return (
                  <Stack key={item.key} spacing={0}>
                    {renderPreviewHeader(audioFiles[0], isFirstPreviewHeader)}
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <AudioPlayerCard
                          key={currentAudioFile.id}
                          file={currentAudioFile}
                          shareId={share.id}
                          actions={renderPreviewActions(currentAudioFile)}
                          metadata={metadata}
                          isLoading={
                            audioMetadataLoadingByFileId[currentAudioFile.id] ||
                            false
                          }
                          lyricsData={lyricsData}
                          lyricsOpen={lyricsOpen}
                          onLyricsToggle={() => {
                            if (lyricsOpen) {
                              setOpenLyricsFileId(null);
                              return;
                            }

                            setOpenLyricsFileId(currentAudioFile.id);
                            if (lyricsData) {
                              onLyricsAvailabilityChange?.(true);
                              onLyricsDataChange?.(lyricsData);
                              onLyricsPanelOpenChange?.(true);
                            }
                          }}
                          showNavigation={audioFiles.length > 1}
                          currentIndex={currentAudioIndex}
                          totalFiles={audioFiles.length}
                          onPrevious={goToPreviousAudio}
                          onNext={goToNextAudio}
                          accentColor={accentColor}
                          variant={previewStyle}
                          showTrackListToggle={audioFiles.length > 1}
                          trackListOpen={audioTrackListOpen}
                          onTrackListToggle={() =>
                            setAudioTrackListOpen((open) => !open)
                          }
                        />
                        {audioFiles.length > 1 && (
                          <Collapse in={audioTrackListOpen}>
                            <AudioGroupTrackList
                              files={audioFiles}
                              metadataByFileId={audioMetadataByFileId}
                              loadingByFileId={audioMetadataLoadingByFileId}
                              currentIndex={currentAudioIndex}
                              onSelect={(index) => {
                                setCurrentAudioIndex(index);
                                loadAudioMetadata(audioFiles[index]);
                              }}
                              accentColor={accentColor}
                            />
                          </Collapse>
                        )}
                      </Box>
                    </Box>
                  </Stack>
                );
              }

              if (item.type === "audio-single" && item.file) {
                const metadata = audioMetadataByFileId[item.file.id];
                const lyricsData = getLyricsData(item.file, metadata);
                const lyricsOpen =
                  lyricsPanelOpen && openLyricsFileId === item.file.id;

                return (
                  <Stack key={item.key} spacing={0}>
                    {renderPreviewHeader(item.file, isFirstPreviewHeader)}
                    <AudioPlayerCard
                      file={item.file}
                      shareId={share.id}
                      actions={renderPreviewActions(item.file)}
                      metadata={metadata}
                      isLoading={
                        audioMetadataLoadingByFileId[item.file.id] || false
                      }
                      lyricsData={lyricsData}
                      lyricsOpen={lyricsOpen}
                      onLyricsToggle={() => {
                        if (lyricsOpen) {
                          setOpenLyricsFileId(null);
                          return;
                        }

                        setOpenLyricsFileId(item.file.id);
                        if (lyricsData) {
                          onLyricsAvailabilityChange?.(true);
                          onLyricsDataChange?.(lyricsData);
                          onLyricsPanelOpenChange?.(true);
                        }
                      }}
                      accentColor={accentColor}
                      variant={previewStyle}
                    />
                  </Stack>
                );
              }

              if (
                item.type === "video-group" &&
                hasVideoFiles &&
                currentVideoFile
              ) {
                return (
                  <Stack key={item.key} spacing={0}>
                    {renderPreviewHeader(videoFiles[0], isFirstPreviewHeader)}
                    <VideoPlayerCard
                      files={videoFiles}
                      shareId={share.id}
                      actions={renderPreviewActions(currentVideoFile)}
                      currentIndex={currentVideoIndex}
                      onPrevious={goToPreviousVideo}
                      onNext={goToNextVideo}
                      onSelect={setCurrentVideoIndex}
                      accentColor={accentColor}
                      variant={previewStyle}
                      onOpenPreview={openMediaPreview}
                    />
                  </Stack>
                );
              }

              if (item.type === "video-single" && item.file) {
                return (
                  <Stack key={item.key} spacing={0}>
                    {renderPreviewHeader(item.file, isFirstPreviewHeader)}
                    <VideoPlayerCard
                      files={[item.file]}
                      shareId={share.id}
                      actions={renderPreviewActions(item.file)}
                      currentIndex={0}
                      onPrevious={() => undefined}
                      onNext={() => undefined}
                      onSelect={() => undefined}
                      accentColor={accentColor}
                      variant={previewStyle}
                      onOpenPreview={openMediaPreview}
                    />
                  </Stack>
                );
              }

              if (
                item.type === "image-group" &&
                hasImageFiles &&
                currentImageFile
              ) {
                return (
                  <Stack key={item.key} spacing={0}>
                    {renderPreviewHeader(imageFiles[0], isFirstPreviewHeader)}
                    <ImageGalleryCard
                      files={imageFiles}
                      shareId={share.id}
                      actions={renderPreviewActions(currentImageFile)}
                      currentIndex={currentImageIndex}
                      onPrevious={goToPreviousImage}
                      onNext={goToNextImage}
                      onSelect={setCurrentImageIndex}
                      accentColor={accentColor}
                      variant={previewStyle}
                      onOpenPreview={openMediaPreview}
                    />
                  </Stack>
                );
              }

              if (item.type === "image-single" && item.file) {
                return (
                  <Stack key={item.key} spacing={0}>
                    {renderPreviewHeader(item.file, isFirstPreviewHeader)}
                    <ImageGalleryCard
                      files={[item.file]}
                      shareId={share.id}
                      actions={renderPreviewActions(item.file)}
                      currentIndex={0}
                      onPrevious={() => undefined}
                      onNext={() => undefined}
                      onSelect={() => undefined}
                      accentColor={accentColor}
                      variant={previewStyle}
                      onOpenPreview={openMediaPreview}
                    />
                  </Stack>
                );
              }

              return null;
            })}
        </Box>
      </Box>

      <Modal
        opened={zipPreviewOpened}
        onClose={() => {
          setZipPreviewOpened(false);
          setSelectedArchivePaths([]);
          setZipFileId("");
        }}
        title={`Contents: ${zipFileName}`}
        centered
        size="xl"
        styles={{
          content: {
            maxWidth: 800,
          },
          title: {
            fontWeight: 600,
          },
        }}
      >
        {zipPreviewLoading && (
          <Stack align="center" py="xl">
            <Text size="sm">Loading archive contents…</Text>
          </Stack>
        )}

        {!zipPreviewLoading && !zipContents && (
          <Text size="sm" color="red">
            Failed to load archive contents.
          </Text>
        )}

        {!zipPreviewLoading && zipContents && zipContents.length === 0 && (
          <Text size="sm" color="dimmed">
            This archive appears to be empty.
          </Text>
        )}

        {!zipPreviewLoading && zipContents && zipContents.length > 0 && (
          <Stack spacing="md">
            <Group position="apart" align="center">
              <Text size="sm" color="dimmed">
                Select the files you want to download from this archive.
              </Text>
              <Button
                size="sm"
                leftIcon={<TbDownload size={16} />}
                disabled={selectedArchivePaths.length === 0}
                loading={archiveDownloadLoading}
                onClick={downloadSelectedArchiveEntries}
              >
                Download selected files
              </Button>
            </Group>

            <ScrollArea style={{ height: 500 }}>
              <ZipTreeView
                contents={zipContents}
                selectedPaths={new Set(selectedArchivePaths)}
                onToggle={toggleArchivePath}
              />
            </ScrollArea>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={mediaPreviewOpened}
        onClose={() => setMediaPreviewOpened(false)}
        title={mediaPreviewFile?.name || "Preview"}
        centered
        size="xl"
        overlayProps={{
          blur: 8,
          opacity: 0.68,
        }}
        styles={(theme) => ({
          modal: {
            overflow: "hidden",
          },
          content: {
            maxWidth: 980,
            borderRadius: 22,
            background:
              theme.colorScheme === "dark"
                ? `linear-gradient(135deg, rgba(22, 26, 32, 0.78) 0%, rgba(10, 14, 19, 0.92) 100%)`
                : "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(245,250,247,0.96) 100%)",
            border: `1px solid rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, ${
              theme.colorScheme === "dark" ? 0.34 : 0.28
            })`,
            boxShadow:
              theme.colorScheme === "dark"
                ? `0 28px 90px rgba(0,0,0,0.58), 0 0 70px rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.16)`
                : `0 28px 90px rgba(15,23,42,0.2), 0 0 70px rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.14)`,
            backdropFilter: "blur(22px)",
          },
          title: {
            color: theme.colorScheme === "dark" ? theme.colors.gray[2] : theme.colors.dark[7],
            fontWeight: 800,
            fontSize: 20,
            lineHeight: 1.2,
            paddingRight: theme.spacing.md,
          },
          header: {
            background: "transparent",
            padding: `${theme.spacing.lg}px ${theme.spacing.xl}px ${theme.spacing.sm}px`,
          },
          close: {
            color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
            borderRadius: 10,
            "&:hover": {
              background: `rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.12)`,
            },
          },
          body: {
            padding: `0 ${theme.spacing.xl}px ${theme.spacing.xl}px`,
          },
        })}
      >
        {mediaPreviewFile && mediaPreviewType === "image" && (
          <Box
            sx={(theme) => ({
              borderRadius: 18,
              overflow: "hidden",
              background:
                theme.colorScheme === "dark"
                  ? "rgba(0,0,0,0.34)"
                  : "rgba(0,0,0,0.05)",
              border: `1px solid rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.2)`,
              boxShadow:
                theme.colorScheme === "dark"
                  ? "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 44px rgba(0,0,0,0.32)"
                  : "0 18px 44px rgba(15,23,42,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              maxHeight: "75vh",
            })}
          >
            <img
              src={imagePreviewSrc(share.id, mediaPreviewFile)}
              alt={mediaPreviewFile.name}
              style={{
                maxWidth: "100%",
                maxHeight: "75vh",
                objectFit: "contain",
                display: "block",
              }}
            />
          </Box>
        )}

        {mediaPreviewFile && mediaPreviewType === "video" && (
          <Stack spacing="sm">
            <Box
              sx={(theme) => ({
                borderRadius: 18,
                overflow: "hidden",
                background: "#000",
                border: `1px solid rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, 0.24)`,
                boxShadow:
                  theme.colorScheme === "dark"
                    ? "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 44px rgba(0,0,0,0.34)"
                    : "0 18px 44px rgba(15,23,42,0.12)",
              })}
            >
              <video
                ref={mediaPreviewVideoRef}
                controls
                autoPlay
                onError={fallBackMediaPreviewToOriginal}
                style={{
                  width: "100%",
                  maxHeight: "72vh",
                  display: "block",
                }}
              />
            </Box>

            <Group
              position="apart"
              align="center"
              spacing="xs"
              sx={(theme) => ({
                padding: "10px 12px",
                borderRadius: 14,
                background:
                  theme.colorScheme === "dark"
                    ? "rgba(255, 255, 255, 0.035)"
                    : "rgba(0, 0, 0, 0.035)",
                border: `1px solid rgba(${hexToRgb(getEffectiveAccent(theme.colorScheme, accentColor))}, ${
                  theme.colorScheme === "dark" ? 0.14 : 0.2
                })`,
                [theme.fn.smallerThan("sm")]: {
                  alignItems: "stretch",
                  flexDirection: "column",
                },
              })}
            >
              <Stack spacing={2}>
                <Text
                  size="xs"
                  color="dimmed"
                  weight={700}
                  transform="uppercase"
                >
                  Playback quality
                </Text>
                <Text size="xs" color="dimmed">
                  {isMediaPreviewAdaptiveReady
                    ? "Adaptive previews are stored separately; original stays untouched."
                    : isMediaPreviewAdaptivePending
                      ? "Adaptive preview is processing. Playing original quality for now."
                      : "Adaptive preview unavailable. Playing original quality."}
                </Text>
              </Stack>
              <Group spacing={6} noWrap={false}>
                {mediaPreviewQualityOptions.map((option) => (
                  <Button
                    key={option.value}
                    size="xs"
                    compact
                    disabled={option.disabled}
                    variant={
                      mediaPreviewQuality === option.value ? "filled" : "subtle"
                    }
                    onClick={() => setMediaPreviewQuality(option.value)}
                    sx={(theme) => {
                      const effectiveAccent = getEffectiveAccent(
                        theme.colorScheme,
                        accentColor,
                      );

                      return {
                        borderRadius: 999,
                        color:
                          mediaPreviewQuality === option.value
                            ? theme.black
                            : effectiveAccent,
                        background:
                          mediaPreviewQuality === option.value
                            ? effectiveAccent
                            : `rgba(${hexToRgb(effectiveAccent)}, 0.08)`,
                        border: `1px solid rgba(${hexToRgb(effectiveAccent)}, 0.22)`,
                        "&:hover": {
                          background:
                            mediaPreviewQuality === option.value
                              ? effectiveAccent
                              : `rgba(${hexToRgb(effectiveAccent)}, 0.16)`,
                        },
                        "&:disabled": {
                          opacity: 0.45,
                          color:
                            theme.colorScheme === "dark"
                              ? theme.colors.gray[5]
                              : theme.colors.gray[6],
                        },
                      };
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={infoOpened}
        onClose={() => setInfoOpened(false)}
        title="File info"
        centered
      >
        {infoLoading && <Text size="sm">Analyzing file…</Text>}

        {!infoLoading && !infoMetadata && (
          <Text size="sm">No metadata available.</Text>
        )}

        {!infoLoading && infoMetadata && (
          <Stack spacing="xs">
            <Text size="sm">
              <b>Name:</b> {infoMetadata.name}
            </Text>
            <Text size="sm">
              <b>Size:</b>{" "}
              {byteToHumanSizeString(
                typeof infoMetadata.size === "number"
                  ? infoMetadata.size
                  : parseInt(infoMetadata.size || "0"),
              )}
            </Text>
            {infoMetadata.mimeType && (
              <Text size="sm">
                <b>Type:</b> {infoMetadata.mimeType}
              </Text>
            )}
            {infoMetadata.createdAt && (
              <Text size="sm">
                <b>Uploaded:</b>{" "}
                {new Date(infoMetadata.createdAt).toLocaleString()}
              </Text>
            )}

            {infoMetadata.type === "audio" && (
              <>
                <Text size="sm" mt="sm">
                  <b>Title:</b> {infoMetadata.title || "Unknown"}
                </Text>
                <Text size="sm">
                  <b>Artist:</b> {infoMetadata.artist || "Unknown"}
                </Text>
                <Text size="sm">
                  <b>Album:</b> {infoMetadata.album || "Unknown"}
                </Text>
                {infoMetadata.bitrate != null && (
                  <Text size="sm">
                    <b>Bitrate:</b> {Math.round(infoMetadata.bitrate / 1000)}{" "}
                    kbps
                  </Text>
                )}
                {infoMetadata.genre && infoMetadata.genre.length > 0 && (
                  <Text size="sm">
                    <b>Genre:</b> {infoMetadata.genre.join(", ")}
                  </Text>
                )}
                {infoMetadata.sampleRate && (
                  <Text size="sm">
                    <b>Sample Rate:</b>{" "}
                    {(infoMetadata.sampleRate / 1000).toFixed(1)} kHz
                  </Text>
                )}
                {infoMetadata.encodedBy && (
                  <Text size="sm">
                    <b>Encoded by:</b> {infoMetadata.encodedBy}
                  </Text>
                )}
                {infoMetadata.originalCreateDate &&
                  shouldShowAudioCreatedDate(infoMetadata.name) && (
                    <Text size="sm">
                      <b>Created:</b>{" "}
                      {new Date(infoMetadata.originalCreateDate).toString() !==
                      "Invalid Date"
                        ? new Date(
                            infoMetadata.originalCreateDate,
                          ).toLocaleString()
                        : infoMetadata.originalCreateDate}
                    </Text>
                  )}
                {infoMetadata.hasEmbeddedCover && infoMetadata.coverDataUrl && (
                  <Stack spacing={4} mt="sm">
                    <Text size="sm">
                      <b>Cover art:</b>
                    </Text>
                    <Box
                      sx={{
                        borderRadius: 8,
                        overflow: "hidden",
                        maxWidth: 200,
                      }}
                    >
                      <img
                        src={infoMetadata.coverDataUrl}
                        alt="Cover art"
                        style={{
                          display: "block",
                          width: "100%",
                          height: "auto",
                        }}
                      />
                    </Box>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        )}
      </Modal>

      <Modal
        opened={spectrumOpened}
        onClose={() => setSpectrumOpened(false)}
        title={`Spectrum: ${spectrumFileName}`}
        centered
        size="auto"
        styles={{
          content: {
            width: "min(92vw, 1180px)",
            maxHeight: "90vh",
            backgroundColor: "rgba(10, 15, 14, 0.98)",
          },
          body: {
            padding: "12px 18px 18px",
          },
          header: {
            backgroundColor: "transparent",
            padding: "14px 18px",
          },
          title: {
            fontWeight: 600,
            fontSize: 16,
          },
        }}
      >
        {spectrumLoading && (
          <Stack align="center" justify="center" spacing="md" py="xl">
            <Text size="sm">Generating spectrum…</Text>
            <Text size="xs" color="dimmed">
              This may take a few seconds for longer files
            </Text>
          </Stack>
        )}

        {!spectrumLoading && spectrumUrl && (
          <Box>
            <Box sx={{ display: "flex", gap: 0 }}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  paddingRight: 8,
                  paddingTop: 0,
                  paddingBottom: 0,
                  minWidth: 40,
                }}
              >
                {(() => {
                  const nyquist = Math.floor(spectrumSampleRate / 2000);
                  const step = nyquist <= 24 ? 2 : 4;
                  const labels = [];
                  for (let freq = nyquist; freq >= 0; freq -= step) {
                    labels.push(freq);
                  }
                  if (labels[labels.length - 1] !== 0) labels.push(0);
                  return labels.map((freq) => (
                    <Text
                      key={freq}
                      size={11}
                      color="dimmed"
                      sx={{
                        textAlign: "right",
                        lineHeight: 1,
                        fontSize: "clamp(9px, 1vw, 11px)",
                      }}
                    >
                      {freq} kHz
                    </Text>
                  ));
                })()}
              </Box>

              <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Box
                  sx={{
                    backgroundColor: "#000",
                    borderRadius: 4,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    maxHeight: "60vh",
                  }}
                >
                  <img
                    src={spectrumUrl}
                    alt="Audio spectrum"
                    style={{
                      width: "100%",
                      maxHeight: "60vh",
                      objectFit: "contain",
                      height: "auto",
                      display: "block",
                    }}
                  />
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 6,
                    paddingLeft: 0,
                    paddingRight: 0,
                  }}
                >
                  {spectrumDuration > 0 ? (
                    Array.from({ length: 7 }, (_, i) => {
                      const time = (spectrumDuration / 6) * i;
                      const mins = Math.floor(time / 60);
                      const secs = Math.floor(time % 60);
                      return (
                        <Text
                          key={i}
                          size={11}
                          color="dimmed"
                          sx={{ lineHeight: 1 }}
                        >
                          {mins}:{secs.toString().padStart(2, "0")}
                        </Text>
                      );
                    })
                  ) : (
                    <>
                      <Text size={11} color="dimmed">
                        0:00
                      </Text>
                      <Text size={11} color="dimmed">
                        -
                      </Text>
                      <Text size={11} color="dimmed">
                        End
                      </Text>
                    </>
                  )}
                </Box>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  paddingLeft: 8,
                  minWidth: 40,
                }}
              >
                <Text
                  size={11}
                  color="dimmed"
                  sx={{ lineHeight: 1, marginBottom: 4 }}
                >
                  0 dB
                </Text>
                <Box
                  sx={{
                    width: 12,
                    flex: 1,
                    borderRadius: 2,
                    background:
                      "linear-gradient(to bottom, #ffffff, #ffff00, #ff8800, #ff0088, #8800ff, #000044)",
                    minHeight: 160,
                  }}
                />
                <Text
                  size={11}
                  color="dimmed"
                  sx={{ lineHeight: 1, marginTop: 4 }}
                >
                  -120 dB
                </Text>
              </Box>
            </Box>

            <Box
              sx={{
                marginTop: 16,
                padding: "12px 16px",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <Text
                size="xs"
                weight={600}
                color="dimmed"
                mb={8}
                sx={{ textAlign: "center" }}
              >
                Bitrate Reference (frequency cutoff)
              </Text>
              <Group position="center" spacing="md" sx={{ flexWrap: "wrap" }}>
                <Text size="xs">
                  <Text component="span" weight={600} sx={{ color: "#22c55e" }}>
                    Lossless
                  </Text>
                  <Text component="span" color="dimmed">
                    {" "}
                    Full range
                  </Text>
                </Text>
                <Text size="xs">
                  <Text component="span" weight={600} sx={{ color: "#3b82f6" }}>
                    320k
                  </Text>
                  <Text component="span" color="dimmed">
                    {" "}
                    20kHz
                  </Text>
                </Text>
                <Text size="xs">
                  <Text component="span" weight={600} sx={{ color: "#8b5cf6" }}>
                    256k
                  </Text>
                  <Text component="span" color="dimmed">
                    {" "}
                    19kHz
                  </Text>
                </Text>
                <Text size="xs">
                  <Text component="span" weight={600} sx={{ color: "#f59e0b" }}>
                    192k
                  </Text>
                  <Text component="span" color="dimmed">
                    {" "}
                    18kHz
                  </Text>
                </Text>
                <Text size="xs">
                  <Text component="span" weight={600} sx={{ color: "#ef4444" }}>
                    128k
                  </Text>
                  <Text component="span" color="dimmed">
                    {" "}
                    16kHz
                  </Text>
                </Text>
                <Text size="xs">
                  <Text component="span" weight={600} sx={{ color: "#6b7280" }}>
                    64k
                  </Text>
                  <Text component="span" color="dimmed">
                    {" "}
                    11kHz
                  </Text>
                </Text>
              </Group>
            </Box>
          </Box>
        )}

        {!spectrumLoading && !spectrumUrl && (
          <Stack align="center" justify="center" py="xl">
            <Text size="sm" color="red">
              Failed to generate spectrum. Please try again.
            </Text>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={pdfOpened}
        onClose={() => setPdfOpened(false)}
        title={pdfFile?.name || "PDF Viewer"}
        fullScreen
        styles={{
          content: {
            backgroundColor: "rgba(10, 15, 14, 0.98)",
          },
          header: {
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            padding: "12px 20px",
          },
          title: {
            fontWeight: 600,
            color: "white",
          },
          body: {
            padding: 0,
            height: "calc(100vh - 60px)",
          },
        }}
      >
        {pdfFile && (
          <iframe
            src={`/api/shares/${share.id}/files/${pdfFile.id}?download=false&preview=1`}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
            title={pdfFile.name}
          />
        )}
      </Modal>
    </>
  );
};

const skeletonRows = [...Array(5)].map((c, i) => (
  <tr key={i}>
    <td>
      <Skeleton height={30} width={30} />
    </td>
    <td>
      <Skeleton height={14} />
    </td>
    <td>
      <Skeleton height={14} />
    </td>
    <td>
      <Skeleton height={25} width={25} />
    </td>
  </tr>
));

export default FileList;
