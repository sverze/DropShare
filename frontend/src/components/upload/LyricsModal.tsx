import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { type MouseEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { TbBold, TbFileText, TbItalic, TbLink, TbSearch, TbTextSize, TbUnderline, TbUpload } from "react-icons/tb";
import lyricsService, { GeniusSearchResult } from "../../services/lyrics.service";
import { LyricsAttachment } from "../../types/File.type";
import { sanitizeLyricsHtml, wrapLyricsSelection } from "../../utils/lyricsRichText.util";
import toast from "../../utils/toast.util";

const MAX_LYRICS_LENGTH = 50000;

/** Lyrics sources fetched from a provider, as opposed to typed or uploaded. */
type ImportedLyricsSource = "genius-link" | "genius-search" | "lrclib";

const LyricsModal = ({
  opened,
  fileName,
  initialLyrics,
  audioFileCount = 1,
  onClose,
  onSave,
  onSaveAllAudio,
}: {
  opened: boolean;
  fileName: string;
  initialLyrics?: LyricsAttachment | null;
  audioFileCount?: number;
  onClose: () => void;
  onSave: (_lyrics: LyricsAttachment | null) => void;
  onSaveAllAudio?: (_lyrics: LyricsAttachment | null) => void;
}) => {
  const [activeTab, setActiveTab] = useState<string>("paste");
  const [lyricsText, setLyricsText] = useState("");
  const [source, setSource] = useState<LyricsAttachment["source"]>("manual");
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [sourceLabel, setSourceLabel] = useState<string>("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [geniusUrlInput, setGeniusUrlInput] = useState("");
  const [geniusQuery, setGeniusQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeniusSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fontSize, setFontSize] = useState<number | "">(18);
  const lyricsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lyricsSelectionRef = useRef({ start: 0, end: 0 });

  useEffect(() => {
    if (!opened) return;

    setLyricsText(initialLyrics?.text || "");
    setSource(initialLyrics?.source || "manual");
    setSourceUrl(initialLyrics?.sourceUrl || "");
    setSourceLabel(initialLyrics?.sourceLabel || "");
    setSyncEnabled(initialLyrics?.syncEnabled ?? false);
    setSyncedAt(initialLyrics?.syncedAt || null);
    setGeniusUrlInput(initialLyrics?.sourceUrl || "");
    setGeniusQuery("");
    setSearchResults([]);
    lyricsSelectionRef.current = { start: 0, end: 0 };

    if (initialLyrics?.source === "genius-link" || initialLyrics?.source === "genius-search") {
      setActiveTab("genius");
    } else if (initialLyrics?.source === "text-file") {
      setActiveTab("file");
    } else {
      setActiveTab("paste");
    }
  }, [opened, initialLyrics]);

  const remainingChars = useMemo(
    () => MAX_LYRICS_LENGTH - lyricsText.length,
    [lyricsText.length],
  );

  const handleTextFile = async (file: File) => {
    try {
      const text = await file.text();
      setLyricsText(text.slice(0, MAX_LYRICS_LENGTH));
      setSource("text-file");
      setSourceUrl("");
      setSourceLabel(file.name);
      setSyncEnabled(false);
      setSyncedAt(null);
      setActiveTab("file");
      toast.success("Lyrics loaded from text file.");
    } catch {
      toast.error("Unable to read that text file.");
    }
  };

  // Sources that came from an external lookup rather than being typed in.
  // Declared as a type predicate so callers narrow correctly when passing the
  // source on to importFromGenius, which only accepts these three.
  const isImportedSource = (
    value: LyricsAttachment["source"],
  ): value is ImportedLyricsSource =>
    value === "genius-link" || value === "genius-search" || value === "lrclib";

  const isGeniusSource = isImportedSource;

  const markLyricsEditedLocally = (
    fallbackSource: LyricsAttachment["source"] = "manual",
    fallbackLabel = "Rich text lyrics",
  ) => {
    setSyncEnabled(false);

    if (isImportedSource(source) && sourceUrl) {
      setSourceLabel(
        source === "lrclib" ? "Edited LRCLIB lyrics" : "Edited Genius lyrics",
      );
      return;
    }

    setSource(fallbackSource);
    if (fallbackSource !== "genius-link" && fallbackSource !== "genius-search") {
      setSourceUrl("");
      setSyncedAt(null);
    }
    setSourceLabel(fallbackLabel);
  };

  const importFromGenius = async (
    url: string,
    importSource: ImportedLyricsSource,
    label?: string,
    successMessage = "Lyrics imported from Genius.",
  ) => {
    if (!url.trim()) {
      toast.error("Enter a Genius link first.");
      return;
    }

    setImporting(true);

    try {
      const imported = await lyricsService.importFromGenius(url);
      setLyricsText(imported.lyricsText.slice(0, MAX_LYRICS_LENGTH));
      setSource(importSource);
      setSourceUrl(imported.url);
      setSourceLabel(
        label ||
          imported.title ||
          (importSource === "lrclib"
            ? "Imported from LRCLIB"
            : "Imported from Genius"),
      );
      setSyncEnabled(true);
      setSyncedAt(new Date().toISOString());
      setGeniusUrlInput(imported.url);
      setActiveTab("genius");
      toast.success(successMessage);
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setImporting(false);
    }
  };

  const handleSearch = async () => {
    if (!geniusQuery.trim()) {
      toast.error("Enter a song title or artist to search.");
      return;
    }

    setSearching(true);

    try {
      const results = await lyricsService.searchGenius(geniusQuery);
      setSearchResults(results);
      if (results.length === 0) {
        toast.error("No lyrics found for that search.");
      }
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setSearching(false);
    }
  };

  const buildLyricsPayload = (): LyricsAttachment | null => {
    const trimmed = lyricsText.trim();

    if (!trimmed) {
      return null;
    }

    return {
      text: trimmed,
      source,
      sourceUrl: sourceUrl || null,
      sourceLabel: sourceLabel || null,
      syncEnabled,
      syncedAt,
    };
  };

  const handleSave = () => {
    onSave(buildLyricsPayload());
    onClose();
  };

  const handleSaveAllAudio = () => {
    onSaveAllAudio?.(buildLyricsPayload());
    onClose();
  };

  const rememberLyricsSelection = () => {
    const textarea = lyricsTextareaRef.current;

    if (!textarea) return;

    lyricsSelectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  };

  const applyFormat = (before: string, after: string) => {
    const textarea = lyricsTextareaRef.current;
    const savedSelection = lyricsSelectionRef.current;
    const hasSavedSelection = savedSelection.start !== savedSelection.end;
    const activeSelection = textarea
      ? {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      }
      : null;
    const selection = hasSavedSelection ? savedSelection : activeSelection;
    const start = Math.max(0, Math.min(selection?.start ?? lyricsText.length, lyricsText.length));
    const end = Math.max(start, Math.min(selection?.end ?? lyricsText.length, lyricsText.length));
    const next = wrapLyricsSelection(lyricsText, start, end, before, after);

    setLyricsText(next.text.slice(0, MAX_LYRICS_LENGTH));
    lyricsSelectionRef.current = {
      start: next.selectionStart,
      end: next.selectionEnd,
    };
    markLyricsEditedLocally("manual", "Rich text lyrics");

    window.setTimeout(() => {
      lyricsTextareaRef.current?.focus();
      lyricsTextareaRef.current?.setSelectionRange(next.selectionStart, next.selectionEnd);
    }, 0);
  };

  const applyFontSize = () => {
    const size = Number(fontSize);

    if (!Number.isFinite(size) || size < 8 || size > 64) {
      toast.error("Choose a lyric text size between 8 and 64.");
      return;
    }

    applyFormat(`<span style="font-size: ${Math.round(size)}px">`, "</span>");
  };

  const applyFormatFromToolbar = (
    event: MouseEvent | PointerEvent,
    before: string,
    after: string,
  ) => {
    event.preventDefault();
    applyFormat(before, after);
  };

  const applyFontSizeFromToolbar = (event: MouseEvent | PointerEvent) => {
    event.preventDefault();
    applyFontSize();
  };

  const lyricsEditor = (
    label: string,
    options?: {
      minRows?: number;
      maxRows?: number;
      onTextChange?: () => void;
    },
  ) => (
    <Stack spacing="xs">
      <Group spacing={8} align="center">
        <Tooltip label="Bold">
          <ActionIcon
            size={38}
            variant="light"
            onPointerDown={(event) => applyFormatFromToolbar(event, "<b>", "</b>")}
            onClick={(event) => {
              if (event.detail === 0) applyFormatFromToolbar(event, "<b>", "</b>");
            }}
          >
            <TbBold size={20} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Italic">
          <ActionIcon
            size={38}
            variant="light"
            onPointerDown={(event) => applyFormatFromToolbar(event, "<i>", "</i>")}
            onClick={(event) => {
              if (event.detail === 0) applyFormatFromToolbar(event, "<i>", "</i>");
            }}
          >
            <TbItalic size={20} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Underline">
          <ActionIcon
            size={38}
            variant="light"
            onPointerDown={(event) => applyFormatFromToolbar(event, "<u>", "</u>")}
            onClick={(event) => {
              if (event.detail === 0) applyFormatFromToolbar(event, "<u>", "</u>");
            }}
          >
            <TbUnderline size={20} />
          </ActionIcon>
        </Tooltip>
        <NumberInput
          size="xs"
          w={92}
          min={8}
          max={64}
          value={fontSize}
          onChange={setFontSize}
          placeholder="18"
          rightSection={<Text size="xs" color="dimmed">px</Text>}
          styles={{
            input: {
              textAlign: "center",
            },
          }}
        />
        <Tooltip label="Apply text size">
          <ActionIcon
            size={38}
            variant="light"
            onPointerDown={applyFontSizeFromToolbar}
            onClick={(event) => {
              if (event.detail === 0) applyFontSizeFromToolbar(event);
            }}
          >
            <TbTextSize size={20} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Textarea
        ref={lyricsTextareaRef}
        label={label}
        placeholder="Paste lyrics here. Tags like <b>, <i>, <u>, and font-size spans update in the live preview below."
        minRows={options?.minRows || 12}
        maxRows={options?.maxRows || 18}
        autosize
        value={lyricsText}
        onClick={rememberLyricsSelection}
        onChange={(event) => {
          setLyricsText(event.currentTarget.value.slice(0, MAX_LYRICS_LENGTH));
          lyricsSelectionRef.current = {
            start: event.currentTarget.selectionStart,
            end: event.currentTarget.selectionEnd,
          };
          options?.onTextChange?.();
        }}
        onKeyUp={rememberLyricsSelection}
        onMouseUp={rememberLyricsSelection}
        onSelect={rememberLyricsSelection}
      />

      {lyricsText.trim() && (
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" color="dimmed" mb={6}>
            Live formatted preview
          </Text>
          <Box
            sx={(theme) => ({
              maxHeight: 180,
              overflow: "auto",
              lineHeight: 1.7,
              color: theme.colorScheme === "dark" ? theme.colors.gray[2] : theme.colors.dark[7],
            })}
            dangerouslySetInnerHTML={{ __html: sanitizeLyricsHtml(lyricsText) }}
          />
        </Paper>
      )}
    </Stack>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Lyrics for ${fileName}`}
      centered
      size="lg"
    >
      <Stack spacing="md">
        <Tabs
          value={activeTab}
          onTabChange={(value) => setActiveTab(value || "paste")}
          keepMounted={false}
        >
          <Tabs.List>
            <Tabs.Tab value="paste" icon={<TbFileText size={16} />}>
              Paste
            </Tabs.Tab>
            <Tabs.Tab value="file" icon={<TbUpload size={16} />}>
              TXT file
            </Tabs.Tab>
            <Tabs.Tab value="genius" icon={<TbLink size={16} />}>
              Genius
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="paste" pt="md">
            {lyricsEditor("Lyrics", {
              minRows: 14,
              maxRows: 20,
              onTextChange: () => {
                markLyricsEditedLocally("manual", "Pasted lyrics");
              },
            })}
          </Tabs.Panel>

          <Tabs.Panel value="file" pt="md">
            <Stack spacing="sm">
              <Dropzone
                accept={["text/plain"]}
                multiple={false}
                onDrop={(files) => {
                  if (files[0]) {
                    void handleTextFile(files[0]);
                  }
                }}
              >
                <Stack align="center" py="md" spacing={6}>
                  <TbUpload size={28} />
                  <Text size="sm" weight={600}>
                    Drop a `.txt` file here
                  </Text>
                  <Text size="xs" color="dimmed">
                    You can also click to browse for a text file.
                  </Text>
                </Stack>
              </Dropzone>
              {source === "text-file" && sourceLabel && (
                <Badge variant="light" color="green" w="fit-content">
                  Loaded from {sourceLabel}
                </Badge>
              )}
              <Divider label="Edit imported lyrics" labelPosition="center" />
              {lyricsEditor("Imported lyrics", {
                onTextChange: () => {
                  markLyricsEditedLocally("text-file", sourceLabel || "Text file lyrics");
                },
              })}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="genius" pt="md">
            <Stack spacing="md">
              <Group align="flex-end" grow>
                <TextInput
                  label="Genius link"
                  placeholder="https://genius.com/..."
                  value={geniusUrlInput}
                  onChange={(event) => setGeniusUrlInput(event.currentTarget.value)}
                />
                <Button
                  leftIcon={<TbLink size={16} />}
                  onClick={() => void importFromGenius(geniusUrlInput, "genius-link")}
                  loading={importing}
                >
                  Import link
                </Button>
                {sourceUrl && isGeniusSource(source) && (
                  <Button
                    variant="light"
                    leftIcon={<TbLink size={16} />}
                    onClick={() =>
                      void importFromGenius(
                        sourceUrl,
                        source,
                        sourceLabel || undefined,
                        source === "lrclib"
                          ? "Lyrics synced with LRCLIB."
                          : "Lyrics synced with Genius.",
                      )
                    }
                    loading={importing}
                  >
                    Sync with Genius
                  </Button>
                )}
              </Group>

              <Group align="flex-end" grow>
                <TextInput
                  label="Search Genius"
                  placeholder="Artist - Song title"
                  value={geniusQuery}
                  onChange={(event) => setGeniusQuery(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSearch();
                    }
                  }}
                />
                <Button
                  variant="light"
                  leftIcon={<TbSearch size={16} />}
                  onClick={() => void handleSearch()}
                  loading={searching}
                >
                  Search
                </Button>
              </Group>

              {(searching || searchResults.length > 0) && (
                <Paper withBorder p="sm" radius="md">
                  <Stack spacing="xs">
                    <Group position="apart">
                      <Text size="sm" weight={600}>
                        Genius results
                      </Text>
                      {searching && <Loader size="sm" />}
                    </Group>
                    {!searching && (
                      <ScrollArea
                        h={240}
                        type="always"
                        offsetScrollbars
                        scrollbarSize={8}
                      >
                        <Stack spacing="xs">
                          {searchResults.map((result) => (
                            <Paper key={result.url} withBorder p="sm" radius="md">
                              <Group position="apart" align="flex-start" noWrap>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Text weight={600} size="sm" lineClamp={1}>
                                    {result.title}
                                  </Text>
                                  <Text size="xs" color="dimmed" lineClamp={1}>
                                    {result.artist}
                                  </Text>
                                  {result.provider === "lrclib" ? (
                                    // LRCLIB has no per-song page to link to.
                                    <Text size="xs" color="dimmed">
                                      via LRCLIB
                                    </Text>
                                  ) : (
                                    <Anchor
                                      href={result.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      size="xs"
                                    >
                                      Open on Genius
                                    </Anchor>
                                  )}
                                </Box>
                                <Button
                                  size="xs"
                                  onClick={() =>
                                    void importFromGenius(
                                      result.url,
                                      result.provider === "lrclib"
                                        ? "lrclib"
                                        : "genius-search",
                                      `${result.artist} - ${result.title}`,
                                      result.provider === "lrclib"
                                        ? "Lyrics imported from LRCLIB."
                                        : "Lyrics imported from Genius.",
                                    )
                                  }
                                  loading={importing}
                                >
                                  Import
                                </Button>
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                      </ScrollArea>
                    )}
                  </Stack>
                </Paper>
              )}

              {lyricsEditor("Imported lyrics", {
                onTextChange: () => {
                  markLyricsEditedLocally("manual", "Edited lyrics");
                },
              })}
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Group position="apart" align="center">
          <Stack spacing={2}>
            <Text size="xs" color="dimmed">
              {lyricsText.trim()
                ? `Ready to attach lyrics to ${fileName}`
                : "Leave empty to remove lyrics from this file."}
            </Text>
            <Text size="xs" color={remainingChars < 0 ? "red" : "dimmed"}>
              {remainingChars} characters remaining
            </Text>
          </Stack>
          <Group spacing="sm">
            <Button variant="subtle" color="gray" onClick={onClose}>
              Cancel
            </Button>
            {onSaveAllAudio && audioFileCount > 1 && (
              <Button variant="light" onClick={handleSaveAllAudio}>
                Apply to all {audioFileCount} audio files
              </Button>
            )}
            <Button onClick={handleSave}>Save lyrics</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};

export default LyricsModal;
