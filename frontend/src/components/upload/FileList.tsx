import { 
  ActionIcon, 
  Badge,
  Checkbox,
  Table, 
  Box, 
  Group, 
  Text, 
  TextInput,
  createStyles,
  UnstyledButton,
} from "@mantine/core";
import { TbTrash, TbGripVertical, TbFolder, TbFolderOpen, TbFile, TbChevronRight, TbFileText } from "react-icons/tb";
import { GrUndo } from "react-icons/gr";
import { FileListItem, LyricsAttachment } from "../../types/File.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import UploadProgressIndicator from "./UploadProgressIndicator";
import { FormattedMessage } from "react-intl";
import React, { useState, useMemo } from "react";
import LyricsModal from "./LyricsModal";

const useStyles = createStyles((theme) => ({
  tableWrapper: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
    overflow: "hidden",
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(var(--ls-accent-rgb), 0.03)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },
  table: {
    "& thead tr th": {
      backgroundColor: theme.colorScheme === "dark" 
        ? "rgba(var(--ls-accent-rgb), 0.06)" 
        : "rgba(var(--ls-accent-rgb), 0.05)",
      borderBottom: `1px solid ${theme.colorScheme === "dark" 
        ? "rgba(var(--ls-accent-rgb), 0.12)" 
        : "rgba(var(--ls-accent-rgb), 0.1)"}`,
      padding: "14px 16px",
      fontWeight: 600,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    "& tbody tr td": {
      padding: "10px 16px",
      verticalAlign: "middle",
      borderBottom: `1px solid ${theme.colorScheme === "dark" 
        ? "rgba(255, 255, 255, 0.05)" 
        : "rgba(0, 0, 0, 0.05)"}`,
    },
    "& tbody tr:last-of-type td": {
      borderBottom: "none",
    },
  },
  draggableRow: {
    cursor: "grab",
    transition: "background-color 0.15s ease",
    "&:hover": {
      backgroundColor: theme.colorScheme === "dark" 
        ? "rgba(var(--ls-accent-rgb), 0.06)" 
        : "rgba(var(--ls-accent-rgb), 0.04)",
    },
  },
  dragging: {
    backgroundColor: theme.colorScheme === "dark" 
      ? "rgba(var(--ls-accent-rgb), 0.12)" 
      : "rgba(var(--ls-accent-rgb), 0.08)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
    cursor: "grabbing",
  },
  dragOver: {
    borderTop: "2px solid var(--ls-accent)",
  },
  gripHandle: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[6] : theme.colors.gray[5],
    cursor: "grab",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    "&:hover": {
      color: "var(--ls-accent)",
    },
  },
  folderRow: {
    backgroundColor: theme.colorScheme === "dark" 
      ? "rgba(var(--ls-accent-rgb), 0.03)" 
      : "rgba(var(--ls-accent-rgb), 0.02)",
  },
  folderButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 8px",
    borderRadius: 8,
    transition: "background-color 0.15s ease",
    "&:hover": {
      backgroundColor: theme.colorScheme === "dark" 
        ? "rgba(255, 255, 255, 0.05)" 
        : "rgba(0, 0, 0, 0.03)",
    },
  },
  chevron: {
    transition: "transform 0.2s ease",
  },
  chevronOpen: {
    transform: "rotate(90deg)",
  },
  folderIcon: {
    color: "var(--ls-accent)",
  },
  fileIcon: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
    flexShrink: 0,
  },
  rowNameGroup: {
    alignItems: "center",
    minHeight: 36,
  },
  rowActionCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 36,
    gap: 10,
    minWidth: 86,
  },
  viewToggle: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  toggleButton: {
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${theme.colorScheme === "dark" 
      ? "rgba(255, 255, 255, 0.1)" 
      : "rgba(0, 0, 0, 0.1)"}`,
    backgroundColor: "transparent",
    color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[7],
    cursor: "pointer",
    transition: "all 0.2s ease",
    "&:hover": {
      borderColor: "rgba(var(--ls-accent-rgb), 0.3)",
    },
  },
  toggleButtonActive: {
    backgroundColor: "rgba(var(--ls-accent-rgb), 0.15)",
    borderColor: "rgba(var(--ls-accent-rgb), 0.4)",
    color: "var(--ls-accent)",
  },
  previewOrderCard: {
    padding: 16,
    borderRadius: 18,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(var(--ls-accent-rgb), 0.18)"
        : "rgba(22, 163, 74, 0.18)"
    }`,
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(135deg, rgba(9, 26, 18, 0.78) 0%, rgba(13, 16, 22, 0.92) 100%)"
        : "linear-gradient(135deg, rgba(240, 253, 244, 0.88) 0%, rgba(255, 255, 255, 0.94) 100%)",
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 18px 42px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04)"
        : "0 16px 34px rgba(15, 23, 42, 0.08)",
    backdropFilter: "blur(16px)",
  },
  previewOrderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 14,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(15, 23, 42, 0.08)"
    }`,
    background:
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.045)"
        : "rgba(255, 255, 255, 0.72)",
    cursor: "grab",
    transition: "transform 0.16s ease, border-color 0.16s ease, background 0.16s ease",

    "&:hover": {
      transform: "translateY(-1px)",
      borderColor:
        theme.colorScheme === "dark"
          ? "rgba(var(--ls-accent-rgb), 0.28)"
          : "rgba(22, 163, 74, 0.28)",
      background:
        theme.colorScheme === "dark"
          ? "rgba(var(--ls-accent-rgb), 0.08)"
          : "rgba(236, 253, 245, 0.92)",
    },
  },
  previewOrderRowDragging: {
    opacity: 0.55,
    cursor: "grabbing",
    transform: "scale(0.99)",
  },
  previewOrderRowOver: {
    borderColor: "rgba(var(--ls-accent-rgb), 0.58)",
    boxShadow: "0 0 0 1px rgba(var(--ls-accent-rgb), 0.22)",
  },
}));

interface FolderNode {
  name: string;
  path: string;
  files: { file: FileListItem; index: number }[];
  subfolders: Map<string, FolderNode>;
  totalSize: number;
  fileCount: number;
}

type FileIndexHandler = (..._args: [number]) => void;
type FileRenameHandler = (..._args: [number, string]) => void;
type NameHandler = (..._args: [string]) => void;

type FileWithPath = FileListItem & {
  relativePath?: string | null;
  webkitRelativePath?: string;
  path?: string;
  editableName?: string;
  relativePathOverride?: string | null;
  lyrics?: LyricsAttachment | null;
  previewGroup?: boolean;
};

const getLyricsAttachment = (file: FileWithPath): LyricsAttachment | null => {
  if (file.lyrics) return file.lyrics;

  if ("lyricsText" in file && file.lyricsText) {
    return {
      text: file.lyricsText,
      source:
        file.lyricsSource === "text-file" ||
        file.lyricsSource === "genius-link" ||
        file.lyricsSource === "genius-search"
          ? file.lyricsSource
          : "manual",
      sourceUrl: file.lyricsSourceUrl || null,
      sourceLabel: file.lyricsSource || null,
      syncEnabled: file.lyricsSyncEnabled ?? false,
      syncedAt: file.lyricsSyncedAt || null,
      syncStatus: file.lyricsSyncStatus || null,
      syncError: file.lyricsSyncError || null,
    };
  }

  return null;
};

const isAudioUploadFile = (file: FileListItem) => {
  const lowerName = String(file.name || "").toLowerCase();

  return [
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
  ].some((ext) => lowerName.endsWith(ext));
};

const isDeletedFileItem = (file: FileListItem) =>
  "deleted" in file && file.deleted === true;

const getEffectiveRelativePath = (file: FileWithPath, fallbackIndex?: number) => {
  return (
    file.relativePathOverride ||
    file.relativePath ||
    file.webkitRelativePath ||
    file.path ||
    file.name ||
    `file-${fallbackIndex ?? 0}`
  );
};

const getDisplayName = (file: FileWithPath, fallbackIndex?: number) => {
  if (file.editableName) return file.editableName;
  const relativePath = getEffectiveRelativePath(file, fallbackIndex);
  return relativePath.split("/").pop() || file.name;
};

const getFileSizeValue = (file: FileListItem) => {
  const nextSize = Number((file as FileWithPath).size);
  return Number.isFinite(nextSize) ? nextSize : 0;
};

const replaceLeafName = (relativePath: string, fileName: string) => {
  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length === 0) return fileName;
  parts[parts.length - 1] = fileName;
  return parts.join("/");
};

const buildFolderTree = (files: FileListItem[]): { tree: FolderNode; hasStructure: boolean } => {
  const root: FolderNode = {
    name: "",
    path: "",
    files: [],
    subfolders: new Map(),
    totalSize: 0,
    fileCount: 0,
  };

  let hasStructure = false;

  files.forEach((file, index) => {
    const fileWithPath = file as FileWithPath;
    
    let relativePath = getEffectiveRelativePath(fileWithPath, index);

    if (!relativePath || typeof relativePath !== "string") {
      relativePath = file.name || `file-${index}`;
    }

    const parts = relativePath.split("/").filter((p: string) => p);
    const normalizedParts = parts.length > 0 ? parts : [file.name || `file-${index}`];

    if (normalizedParts.length > 1) {
      hasStructure = true;
    }

    let currentNode = root;
    
    for (let i = 0; i < normalizedParts.length - 1; i++) {
      const folderName = normalizedParts[i];
      const folderPath = normalizedParts.slice(0, i + 1).join("/");
      
      if (!currentNode.subfolders.has(folderName)) {
        currentNode.subfolders.set(folderName, {
          name: folderName,
          path: folderPath,
          files: [],
          subfolders: new Map(),
          totalSize: 0,
          fileCount: 0,
        });
      }
      currentNode = currentNode.subfolders.get(folderName)!;
    }

    currentNode.files.push({ file, index });
    
    const fileSize = +file.size;
    root.totalSize += fileSize;
    root.fileCount += 1;
    
    let sizeNode = root;
    for (let i = 0; i < normalizedParts.length - 1; i++) {
      sizeNode = sizeNode.subfolders.get(normalizedParts[i])!;
      sizeNode.totalSize += fileSize;
      sizeNode.fileCount += 1;
    }
  });

  return { tree: root, hasStructure };
};

const countFilesInNode = (node: FolderNode): number => {
  let count = node.files.length;
  node.subfolders.forEach((subfolder) => {
    count += countFilesInNode(subfolder);
  });
  return count;
};

const FolderTreeRow = ({
  node,
  depth,
  onRemove,
  onRestore,
  onRename,
  onEditLyrics,
  allowRename,
  allowRemove,
  showPreviewGroupingControls,
  onPreviewGroupChange,
}: {
  node: FolderNode;
  depth: number;
  onRemove: FileIndexHandler;
  onRestore: FileIndexHandler;
  onRename: FileRenameHandler;
  onEditLyrics: FileIndexHandler;
  allowRename: boolean;
  allowRemove: boolean;
  showPreviewGroupingControls: boolean;
  onPreviewGroupChange: (_index: number, _grouped: boolean) => void;
}) => {
  const { classes, cx } = useStyles();
  const [expanded, setExpanded] = useState(depth < 2);

  const subfolders = Array.from(node.subfolders.values()).sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  const sortedFiles = [...node.files].sort((a, b) => 
    a.file.name.localeCompare(b.file.name)
  );

  const totalFiles = countFilesInNode(node);

  return (
    <>
      {node.name && (
        <tr className={classes.folderRow}>
          <td colSpan={showPreviewGroupingControls ? 4 : 3}>
            <UnstyledButton 
              className={classes.folderButton}
              onClick={() => setExpanded(!expanded)}
              style={{ marginLeft: depth * 20 }}
            >
              <TbChevronRight 
                size={14} 
                className={cx(classes.chevron, expanded && classes.chevronOpen)} 
              />
              {expanded ? (
                <TbFolderOpen size={18} className={classes.folderIcon} />
              ) : (
                <TbFolder size={18} className={classes.folderIcon} />
              )}
              <Text size="sm" weight={500}>{node.name}</Text>
              <Text size="xs" color="dimmed">
                ({totalFiles} file{totalFiles !== 1 ? "s" : ""}, {byteToHumanSizeString(node.totalSize)})
              </Text>
            </UnstyledButton>
          </td>
        </tr>
      )}

      {(expanded || !node.name) && (
        <>
          {subfolders.map((subfolder) => (
            <FolderTreeRow
              key={subfolder.path}
              node={subfolder}
              depth={node.name ? depth + 1 : depth}
              onRemove={onRemove}
              onRestore={onRestore}
              onRename={onRename}
              onEditLyrics={onEditLyrics}
              allowRename={allowRename}
              allowRemove={allowRemove}
              showPreviewGroupingControls={showPreviewGroupingControls}
              onPreviewGroupChange={onPreviewGroupChange}
            />
          ))}

          {sortedFiles.map(({ file, index }) => (
            <FileListRowSimple
              key={index}
              file={file}
              depth={node.name ? depth + 1 : depth}
              onRemove={allowRemove ? () => onRemove(index) : undefined}
              onRestore={() => onRestore(index)}
              onRename={
                allowRename ? (name) => onRename(index, name) : undefined
              }
              onEditLyrics={
                isAudioUploadFile(file)
                  ? () => onEditLyrics(index)
                  : undefined
              }
              showPreviewGroupingControls={showPreviewGroupingControls}
              previewGrouped={(file as FileWithPath).previewGroup !== false}
              onPreviewGroupChange={(grouped) => onPreviewGroupChange(index, grouped)}
            />
          ))}
        </>
      )}
    </>
  );
};

const FileListRowSimple = ({
  file,
  depth,
  onRemove,
  onRestore,
  onRename,
  onEditLyrics,
  showPreviewGroupingControls = false,
  previewGrouped = true,
  onPreviewGroupChange,
}: {
  file: FileListItem;
  depth: number;
  onRemove?: () => void;
  onRestore?: () => void;
  onRename?: NameHandler;
  onEditLyrics?: () => void;
  showPreviewGroupingControls?: boolean;
  previewGrouped?: boolean;
  onPreviewGroupChange?: (_grouped: boolean) => void;
}) => {
  const { classes } = useStyles();
  const uploadable = "uploadingProgress" in file;
  const uploading = uploadable && file.uploadingProgress !== 0;
  const removable = uploadable ? file.uploadingProgress === 0 : onRemove && !file.deleted;
  const restorable = onRestore && !uploadable && !!file.deleted;
  const deleted = !uploadable && !!file.deleted;
  const hasLyrics = !!getLyricsAttachment(file as FileWithPath)?.text;

  const displayName = getDisplayName(file as FileWithPath);

  return (
    <tr
      style={{
        color: deleted ? "rgba(120, 120, 120, 0.5)" : "inherit",
        textDecoration: deleted ? "line-through" : "none",
      }}
    >
      <td>
        <Group spacing={8} className={classes.rowNameGroup} style={{ marginLeft: depth * 20 }}>
          <TbFile size={16} className={classes.fileIcon} />
          {onRename ? (
            <TextInput
              size="xs"
              value={displayName}
              onChange={(event) => onRename(event.currentTarget.value)}
              styles={{
                input: {
                  minWidth: 220,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.08)",
                },
              }}
            />
          ) : (
            <Group spacing={8}>
              <Text size="sm">{displayName}</Text>
              {hasLyrics && (
                <Badge size="xs" variant="light" color="green">
                  Lyrics
                </Badge>
              )}
            </Group>
          )}
        </Group>
      </td>
      <td>
        <Text size="sm" color="dimmed">{byteToHumanSizeString(getFileSizeValue(file))}</Text>
      </td>
      {showPreviewGroupingControls && (
        <td>
          <Checkbox
            checked={previewGrouped}
            disabled={uploading}
            onChange={(event) => onPreviewGroupChange?.(event.currentTarget.checked)}
            title="Group this file with the same preview type"
          />
        </td>
      )}
      <td>
        <Box className={classes.rowActionCell}>
          {isAudioUploadFile(file) && onEditLyrics && (
            <ActionIcon
              color={hasLyrics ? "green" : "blue"}
              variant="light"
              size={25}
              onClick={onEditLyrics}
              title={hasLyrics ? "Edit lyrics" : "Add lyrics"}
            >
              <TbFileText />
            </ActionIcon>
          )}
          {removable && (
            <ActionIcon color="red" variant="light" size={25} onClick={onRemove}>
              <TbTrash />
            </ActionIcon>
          )}
          {uploading && <UploadProgressIndicator progress={file.uploadingProgress} />}
          {restorable && (
            <ActionIcon color="primary" variant="light" size={25} onClick={onRestore}>
              <GrUndo />
            </ActionIcon>
          )}
        </Box>
      </td>
    </tr>
  );
};

const DraggableFileRow = ({
  file,
  index,
  onRemove,
  onRestore,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragging,
  isDragOver,
  onRename,
  onEditLyrics,
  showPreviewGroupingControls = false,
  previewGrouped = true,
  onPreviewGroupChange,
}: {
  file: FileListItem;
  index: number;
  onRemove?: () => void;
  onRestore?: () => void;
  onDragStart: FileIndexHandler;
  onDragOver: FileIndexHandler;
  onDragEnd: () => void;
  onDrop: FileIndexHandler;
  isDragging: boolean;
  isDragOver: boolean;
  onRename?: NameHandler;
  onEditLyrics?: () => void;
  showPreviewGroupingControls?: boolean;
  previewGrouped?: boolean;
  onPreviewGroupChange?: (_grouped: boolean) => void;
}) => {
  const { classes, cx } = useStyles();
  const uploadable = "uploadingProgress" in file;
  const uploading = uploadable && file.uploadingProgress !== 0;
  const removable = uploadable ? file.uploadingProgress === 0 : onRemove && !file.deleted;
  const restorable = onRestore && !uploadable && !!file.deleted;
  const deleted = !uploadable && !!file.deleted;
  const hasLyrics = !!getLyricsAttachment(file as FileWithPath)?.text;

  return (
    <tr
      draggable={!uploading}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
      className={cx(
        classes.draggableRow,
        isDragging && classes.dragging,
        isDragOver && classes.dragOver
      )}
      style={{
        color: deleted ? "rgba(120, 120, 120, 0.5)" : "inherit",
        textDecoration: deleted ? "line-through" : "none",
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <td>
        <Group spacing={8} noWrap className={classes.rowNameGroup}>
          <Box className={classes.gripHandle}>
            <TbGripVertical size={16} />
          </Box>
          <TbFile size={16} className={classes.fileIcon} />
          {onRename ? (
            <TextInput
              size="xs"
              value={getDisplayName(file as FileWithPath, index)}
              onChange={(event) => onRename(event.currentTarget.value)}
              styles={{
                input: {
                  minWidth: 240,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.08)",
                },
              }}
            />
          ) : (
            <Group spacing={8}>
              <Text size="sm">{getDisplayName(file as FileWithPath, index)}</Text>
              {hasLyrics && (
                <Badge size="xs" variant="light" color="green">
                  Lyrics
                </Badge>
              )}
            </Group>
          )}
        </Group>
      </td>
      <td>
        <Text size="sm" color="dimmed">{byteToHumanSizeString(getFileSizeValue(file))}</Text>
      </td>
      {showPreviewGroupingControls && (
        <td>
          <Checkbox
            checked={previewGrouped}
            disabled={uploading}
            onChange={(event) => onPreviewGroupChange?.(event.currentTarget.checked)}
            title="Group this file with the same preview type"
          />
        </td>
      )}
      <td>
        <Box className={classes.rowActionCell}>
          {isAudioUploadFile(file) && onEditLyrics && (
            <ActionIcon
              color={hasLyrics ? "green" : "blue"}
              variant="light"
              size={25}
              onClick={onEditLyrics}
              title={hasLyrics ? "Edit lyrics" : "Add lyrics"}
            >
              <TbFileText />
            </ActionIcon>
          )}
          {removable && (
            <ActionIcon color="red" variant="light" size={25} onClick={onRemove}>
              <TbTrash />
            </ActionIcon>
          )}
          {uploading && <UploadProgressIndicator progress={file.uploadingProgress} />}
          {restorable && (
            <ActionIcon color="primary" variant="light" size={25} onClick={onRestore}>
              <GrUndo />
            </ActionIcon>
          )}
        </Box>
      </td>
    </tr>
  );
};

const FileList = <T extends FileListItem = FileListItem>({
  files,
  setFiles,
  allowRename = true,
  allowReorder = true,
  allowRemove = true,
  showPreviewGroupingControls = false,
}: {
  files: T[];
  setFiles: (_files: T[]) => void;
  allowRename?: boolean;
  allowReorder?: boolean;
  allowRemove?: boolean;
  showPreviewGroupingControls?: boolean;
}) => {
  const { classes, cx } = useStyles();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [lyricsIndex, setLyricsIndex] = useState<number | null>(null);

  const audioFileCount = useMemo(
    () => files.filter((file) => isAudioUploadFile(file) && !isDeletedFileItem(file)).length,
    [files],
  );

  const { tree, hasStructure } = useMemo(() => buildFolderTree(files), [files]);

  React.useEffect(() => {
    if (hasStructure) {
      setViewMode("tree");
    }
  }, [hasStructure]);

  const remove = (index: number) => {
    const file = files[index];

    if ("uploadingProgress" in file) {
      files.splice(index, 1);
    } else {
      files[index] = { ...file, deleted: true } as T;
    }

    setFiles([...files]);
  };

  const restore = (index: number) => {
    const file = files[index];

    if ("uploadingProgress" in file) {
      return;
    } else {
      files[index] = { ...file, deleted: false } as T;
    }

    setFiles([...files]);
  };

  const rename = (index: number, name: string) => {
    const nextName = name.trim();
    if (!nextName) return;

    const file = files[index] as FileWithPath;
    const currentRelativePath = getEffectiveRelativePath(file, index);
    const nextRelativePath = replaceLeafName(currentRelativePath, nextName);

    (files[index] as FileWithPath).editableName = nextName;
    (files[index] as FileWithPath).relativePathOverride = nextRelativePath;

    setFiles([...files]);
  };

  const editLyrics = (index: number) => {
    setLyricsIndex(index);
  };

  const saveLyrics = (index: number, lyrics: LyricsAttachment | null) => {
    const nextFiles = [...files];
    (nextFiles[index] as FileWithPath).lyrics = lyrics;
    setFiles(nextFiles);
  };

  const saveLyricsToAllAudioFiles = (lyrics: LyricsAttachment | null) => {
    const nextFiles = [...files];

    nextFiles.forEach((file, index) => {
      if (isAudioUploadFile(file) && !isDeletedFileItem(file)) {
        (nextFiles[index] as FileWithPath).lyrics = lyrics;
      }
    });

    setFiles(nextFiles);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    const newFiles = [...files];
    const [draggedFile] = newFiles.splice(dragIndex, 1);
    newFiles.splice(dropIndex, 0, draggedFile);
    setFiles(newFiles);
    handleDragEnd();
  };

  const setPreviewGrouped = (index: number, grouped: boolean) => {
    const nextFiles = [...files];
    (nextFiles[index] as FileWithPath).previewGroup = grouped;
    setFiles(nextFiles);
  };

  const renderTable = (
    tableFiles: { file: T; index: number }[],
    options?: { showHeader?: boolean },
  ) => (
    <Table className={classes.table}>
      {options?.showHeader !== false && (
        <thead>
          <tr>
            <th>
              <FormattedMessage id="upload.filelist.name" />
            </th>
            <th>
              <FormattedMessage id="upload.filelist.size" />
            </th>
            {showPreviewGroupingControls && (
              <th style={{ width: 110 }}>Grouped</th>
            )}
            <th style={{ width: 96 }}></th>
          </tr>
        </thead>
      )}
      <tbody>
        {tableFiles.map(({ file, index }) =>
          allowReorder ? (
            <DraggableFileRow
              key={index}
              file={file}
              index={index}
              onRemove={allowRemove ? () => remove(index) : undefined}
              onRestore={() => restore(index)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              isDragging={dragIndex === index}
              isDragOver={dragOverIndex === index}
              onRename={allowRename ? (name) => rename(index, name) : undefined}
              onEditLyrics={
                isAudioUploadFile(file)
                  ? () => editLyrics(index)
                  : undefined
              }
              showPreviewGroupingControls={showPreviewGroupingControls}
              previewGrouped={(file as FileWithPath).previewGroup !== false}
              onPreviewGroupChange={(grouped) => setPreviewGrouped(index, grouped)}
            />
          ) : (
            <FileListRowSimple
              key={index}
              file={file}
              depth={0}
              onRemove={allowRemove ? () => remove(index) : undefined}
              onRestore={() => restore(index)}
              onRename={allowRename ? (name) => rename(index, name) : undefined}
              onEditLyrics={
                isAudioUploadFile(file)
                  ? () => editLyrics(index)
                  : undefined
              }
              showPreviewGroupingControls={showPreviewGroupingControls}
              previewGrouped={(file as FileWithPath).previewGroup !== false}
              onPreviewGroupChange={(grouped) => setPreviewGrouped(index, grouped)}
            />
          ),
        )}
      </tbody>
    </Table>
  );

  if (files.length === 0) {
    return null;
  }

  return (
    <Box>
      {hasStructure && (
        <Box className={classes.viewToggle}>
          <button
            className={cx(classes.toggleButton, viewMode === "list" && classes.toggleButtonActive)}
            onClick={() => setViewMode("list")}
          >
            List View
          </button>
          <button
            className={cx(classes.toggleButton, viewMode === "tree" && classes.toggleButtonActive)}
            onClick={() => setViewMode("tree")}
          >
            Folder View
          </button>
        </Box>
      )}

      <Box className={classes.tableWrapper}>
        {viewMode === "tree" && hasStructure ? (
          <Table className={classes.table}>
            <thead>
              <tr>
                <th>
                  <FormattedMessage id="upload.filelist.name" />
                </th>
                <th>
                  <FormattedMessage id="upload.filelist.size" />
                </th>
                {showPreviewGroupingControls && (
                  <th style={{ width: 110 }}>Grouped</th>
                )}
                <th style={{ width: 96 }}></th>
              </tr>
            </thead>
            <tbody>
            <FolderTreeRow
              node={tree}
              depth={0}
              onRemove={remove}
              onRestore={restore}
              onRename={rename}
              onEditLyrics={editLyrics}
              allowRename={allowRename}
              allowRemove={allowRemove}
              showPreviewGroupingControls={showPreviewGroupingControls}
              onPreviewGroupChange={setPreviewGrouped}
            />
            </tbody>
          </Table>
        ) : (
          renderTable(files.map((file, index) => ({ file, index })))
        )}
      </Box>

      <Group position="apart" mt="sm" px="xs">
        <Text size="xs" color="dimmed">
          {files.length} file{files.length !== 1 ? "s" : ""}
          {hasStructure && tree.subfolders.size > 0 && (
            <> in {tree.subfolders.size} folder{tree.subfolders.size !== 1 ? "s" : ""}</>
          )}
        </Text>
        <Text size="xs" color="dimmed">
          Total: {byteToHumanSizeString(files.reduce((acc, f) => acc + getFileSizeValue(f), 0))}
        </Text>
      </Group>

      <LyricsModal
        opened={lyricsIndex !== null}
        fileName={
          lyricsIndex !== null
            ? getDisplayName(files[lyricsIndex] as FileWithPath, lyricsIndex)
            : "Audio file"
        }
        initialLyrics={
          lyricsIndex !== null
            ? getLyricsAttachment(files[lyricsIndex] as FileWithPath)
            : null
        }
        audioFileCount={audioFileCount}
        onClose={() => setLyricsIndex(null)}
        onSave={(lyrics) => {
          if (lyricsIndex !== null) {
            saveLyrics(lyricsIndex, lyrics);
          }
        }}
        onSaveAllAudio={saveLyricsToAllAudioFiles}
      />
    </Box>
  );
};

export default FileList;
