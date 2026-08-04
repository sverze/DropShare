import {
    Badge,
  Box,
  Button,
  createStyles,
  Divider,
  Grid,
  Group,
  HoverCard,
  Loader,
  Modal,
  Pagination,
  ScrollArea,
    Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { showNotification } from "@mantine/notifications";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {
  TbBroadcast,
  TbCheck,
  TbCode,
  TbDeviceFloppy,
    TbEye,
  TbHistory,
  TbMail,
  TbMailForward,
  TbRefresh,
  TbSend,
  TbTemplate,
  } from "react-icons/tb";
import Meta from "../../components/Meta";
import useUser from "../../hooks/user.hook";
import useConfig from "../../hooks/config.hook";
import { hasCapability } from "../../utils/capabilities.util";
import api from "../../services/api.service";

const ACCENT = "var(--ls-accent)";
const ACCENT_DARK = "var(--ls-accent-deep)";

const BRAND_COLORS: Record<string, { color: string; label: string }> = {
  dropshare: { color: "var(--ls-accent)", label: "DropShare" },
};

const VARIABLE_HELP: Record<string, string> = {
  creatorName:
    "Username of the person who created the share (or “Someone” if anonymous).",
  creatorEmail:
    "Email address of the share's creator. Empty for anonymous shares.",
  description:
    "The share's description, if the creator added one. Empty otherwise.",
  expiresText:
    "When the share expires, in words (e.g. “in 7 days”), or “Never”.",
  shareUrl: "Full link to the share. Used as the main button's destination.",
  resetUrl: "One-time password-reset link. Expires an hour after it's sent.",
  code: "The 6-digit sign-in code. Valid for 10 minutes, single use.",
  appUrl: "This site's base URL, from General settings.",
  email: "Email address of the invited account.",
  password: "Temporary password generated for the new account.",
  loginUrl: "Link to the sign-in page.",
  username: "The recipient's username.",
  shareCount: "How many shares the recipient still has, as a number.",
  shareLabel: "The share count with its label, e.g. “3 shares”.",
  sizeLabel: "Total size of the recipient's shares (e.g. “1.2 GB”).",
  shareLinksUntil: "Date existing share links stop working.",
  exportUntil: "Date the download/export page closes.",
  exportUrl: "Link to the export page where users download their files.",
  recipientEmail: "The address this test email was sent to.",
};

const BROADCAST_VARIABLES: { name: string; help: string }[] = [
  { name: "username", help: "The recipient's username." },
  { name: "email", help: "The recipient's email address." },
  {
    name: "appName",
    help: "This site's configured name, from General settings.",
  },
  { name: "appUrl", help: "This site's base URL, from General settings." },
];

const AUTH_LOG_TYPES = ["login-code", "password-reset"];

const TYPE_LABELS: Record<string, string> = {
  "password-reset": "Password reset",
  "login-code": "Sign-in code",
  "share-notification": "Share notification",
  "reverse-share": "Reverse share",
  invite: "Account invite",
  "smtp-test": "SMTP test",
  broadcast: "Broadcast",
  "template-test": "Template test",
  "drive-share": "Drive share",
  template: "Template",
};

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

  titleSection: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  subtitle: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[6],
    marginTop: 4,
  },

  table: {
    "& thead th": {
      backgroundColor: "rgba(var(--ls-panel-border-rgb), 0.05)",
      borderBottom: `1px solid rgba(var(--ls-panel-border-rgb), 0.1)`,
    },
    "& tbody td": {
      borderBottom: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.05)"
      }`,
    },
  },

  selectDropdown: {
    background: theme.colorScheme === "dark"
      ? "rgba(8, 16, 14, 0.99)"
      : "rgba(255, 255, 255, 0.99)",
    border: `1px solid rgba(var(--ls-panel-border-rgb), 0.22)`,
    backdropFilter: "none",
    zIndex: 320,
  },

  selectItem: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[1] : theme.colors.dark[7],
    fontWeight: 600,

    "&[data-hovered]": {
      background: `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.12 : 0.08})`,
    },
  },

  pageIcon: {
    color: ACCENT,
    filter: "drop-shadow(0 0 8px rgba(var(--ls-accent-rgb), 0.4))",
  },

  pageTitle: {
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
    fontWeight: 700,
  },

  tabs: {
    "& > .mantine-Tabs-tabsList > .mantine-Tabs-tab": {
      fontWeight: 600,
      transition: "all 0.2s ease",
      "&:hover": {
        background: theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.03)",
      },
      "&[data-active]": {
        color: ACCENT,
        borderColor: ACCENT,
      },
    },
  },

  editorTabs: {
    "& .mantine-Tabs-tab": {
      fontWeight: 600,
    },
    "& .mantine-Tabs-tab[data-active]": {
      color: "#ffffff",
      "& svg": { color: "#ffffff" },
      "&:hover": { color: "#ffffff" },
    },
  },

  templateCard: {
    background: theme.colorScheme === "dark"
      ? "rgba(0, 0, 0, 0.2)"
      : "rgba(255, 255, 255, 0.6)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.08)"
    }`,
    borderRadius: 12,
    padding: 16,
    cursor: "pointer",
    transition: "all 0.2s ease",
    "&:hover": {
      borderColor: "rgba(var(--ls-panel-border-rgb), 0.3)",
      transform: "translateY(-2px)",
    },
  },

  templateCardActive: {
    borderColor: `${ACCENT} !important`,
    boxShadow: `0 0 20px rgba(var(--ls-accent-rgb), 0.15)`,
  },

  editorSection: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
    borderRadius: 16,
    padding: theme.spacing.lg,
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(var(--ls-accent-rgb), 0.05)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  previewFrame: {
    background: "#ffffff",
    borderRadius: 8,
    border: "1px solid #e5e5e5",
    overflow: "hidden",
  },

  previewMeta: {
    background: theme.colorScheme === "dark"
      ? "rgba(0, 0, 0, 0.25)"
      : "rgba(0, 0, 0, 0.03)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.08)"
    }`,
    borderRadius: 10,
    padding: "8px 12px",
    marginBottom: 8,
  },

  previewShell: {
    background: "#ffffff",
    borderRadius: 12,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.12)"
        : "rgba(0, 0, 0, 0.12)"
    }`,
    overflow: "hidden",
    minHeight: 200,
  },

  previewFrameFull: {
    width: "100%",
    height: 560,
    border: "none",
    display: "block",
    background: "#ffffff",
  },

  input: {
    "& input, & textarea": {
      background: theme.colorScheme === "dark"
        ? "rgba(0, 0, 0, 0.2)"
        : "rgba(255, 255, 255, 0.8)",
      border: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(0, 0, 0, 0.1)"
      }`,
      borderRadius: 10,
      "&:focus": {
        borderColor: "rgba(var(--ls-accent-rgb), 0.5)",
      },
    },
  },

  primaryButton: {
    background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
    border: "none",
    color: "#000",
    fontWeight: 600,
    "&:hover": {
      background: `linear-gradient(135deg, var(--ls-accent-hover) 0%, var(--ls-accent-hover-deep) 100%)`,
    },
  },

  secondaryButton: {
    background: theme.colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.05)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.15)"
        : "rgba(0, 0, 0, 0.1)"
    }`,
    color: theme.colorScheme === "dark" ? "#fff" : theme.colors.dark[7],
    fontWeight: 600,
    "&:hover": {
      background: theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.12)"
        : "rgba(0, 0, 0, 0.08)",
    },
  },

  logRow: {
    "&:hover": {
      background: theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.03)"
        : "rgba(0, 0, 0, 0.02)",
    },
  },

  statsCard: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
    borderRadius: 16,
    padding: theme.spacing.lg,
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(var(--ls-accent-rgb), 0.05)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },
}));

interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  variables: string[];
  isSystem: boolean;
  isActive: boolean;
}

interface EmailLog {
  id: string;
  templateId: string | null;
  recipientId: string | null;
  recipient: string;
  subject: string;
  type: string | null;
  status: string;
  error: string | null;
  createdAt: string;
}

export default function AdminEmailsPage() {
  const { classes, cx } = useStyles();
  const theme = useMantineTheme();
  const router = useRouter();
  const { user } = useUser();
  const config = useConfig();
  const appName = (config.get("general.appName") as string) || "This site";

  const [activeTab, setActiveTab] = useState<string | null>("templates");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editSubject, setEditSubject] = useState("");
  const [editHtmlBody, setEditHtmlBody] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const [testModalOpen, { open: openTestModal, close: closeTestModal }] = useDisclosure(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const [previewOpen, { open: openPreview, close: closePreview }] = useDisclosure(false);

  const [editorTab, setEditorTab] = useState<string | null>("html");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewSeq = useRef(0);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const editingInFrame = useRef(false);

  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastHeadline, setBroadcastHeadline] = useState("");
  const [broadcastSubheadline, setBroadcastSubheadline] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastCtaUrl, setBroadcastCtaUrl] = useState("");
  const [broadcastCtaText, setBroadcastCtaText] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const [
    broadcastPreviewOpen,
    { open: openBroadcastPreview, close: closeBroadcastPreview },
  ] = useDisclosure(false);
  const [broadcastPreviewHtml, setBroadcastPreviewHtml] = useState("");
  const [broadcastPreviewSubject, setBroadcastPreviewSubject] = useState("");
  const [broadcastPreviewLoading, setBroadcastPreviewLoading] = useState(false);

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [stats, setStats] = useState({ totalSent: 0, totalFailed: 0, total: 0 });
  const [logTypeFilter, setLogTypeFilter] = useState<string | null>(null);
  const [logStatusFilter, setLogStatusFilter] = useState<string | null>(null);
  const [logSearchInput, setLogSearchInput] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const logsRequestSeq = useRef(0);

  useEffect(() => {
    if (user !== undefined && !hasCapability(user, "emails.view")) {
      router.push("/");
    }
  }, [user, router]);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (activeTab === "logs") {
      loadLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, logsPage, logTypeFilter, logStatusFilter, logSearch]);

  useEffect(() => {
    if (activeTab === "logs") {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = logSearchInput.trim();
      if (trimmed !== logSearch) {
        setLogSearch(trimmed);
        setLogsPage(1);
      }
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logSearchInput, logSearch]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get("/email-templates");
      setTemplates(res.data);
      if (res.data.length > 0 && !selectedTemplate) {
        selectTemplate(res.data[0]);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      showNotification({
        title: "Error",
        message: "Failed to load email templates",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    const seq = ++logsRequestSeq.current;
    try {
      setLogsLoading(true);
      const res = await api.get("/email-templates/logs/all", {
        params: {
          limit: 20,
          offset: (logsPage - 1) * 20,
          type: logTypeFilter || undefined,
          status: logStatusFilter || undefined,
          search: logSearch || undefined,
        },
      });
      if (seq !== logsRequestSeq.current) return;
      setLogs(res.data.logs);
      setLogsTotal(res.data.total);
    } catch (error) {
      console.error("Failed to load logs:", error);
    } finally {
      if (seq === logsRequestSeq.current) setLogsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get("/email-templates/stats/summary");
      setStats(res.data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const loadBroadcastPreview = async () => {
    setBroadcastPreviewLoading(true);
    try {
      const res = await api.post("/email-templates/broadcast/preview", {
        subject: broadcastSubject,
        headline: broadcastHeadline,
        subheadline: broadcastSubheadline,
        bodyHtml: broadcastBody,
        ctaUrl: broadcastCtaUrl,
        ctaText: broadcastCtaText,
      });
      setBroadcastPreviewHtml(res.data.html);
      setBroadcastPreviewSubject(res.data.subject);
      openBroadcastPreview();
    } catch (error: any) {
      showNotification({
        title: "Error",
        message:
          error?.response?.data?.message || "Failed to render broadcast preview",
        color: "red",
      });
    } finally {
      setBroadcastPreviewLoading(false);
    }
  };

  const serializeEditableRegion = (region: HTMLElement): string => {
    const clone = region.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-lsvar]").forEach((chip) => {
      const name = chip.getAttribute("data-lsvar");
      chip.replaceWith(
        clone.ownerDocument.createTextNode(name ? `{{${name}}}` : ""),
      );
    });
    clone.querySelectorAll("[contenteditable]").forEach((el) => {
      el.removeAttribute("contenteditable");
    });
    return clone.innerHTML;
  };

  const attachVisualEditor = () => {
    const doc = previewFrameRef.current?.contentDocument;
    const region = doc?.getElementById("ls-editable");
    if (!doc || !region) return;

    const onInput = () => {
      editingInFrame.current = true;
      setEditHtmlBody(serializeEditableRegion(region));
    };
    region.addEventListener("input", onInput);
    region.addEventListener("paste", (e: Event) => {
      const ev = e as ClipboardEvent;
      ev.preventDefault();
      const text = ev.clipboardData?.getData("text/plain") ?? "";
      doc.execCommand("insertText", false, text);
    });
  };

  useEffect(() => {
    const wantsPreview = editorTab === "preview" || previewOpen;
    if (!wantsPreview || !selectedTemplate) return;
    if (editingInFrame.current) {
      editingInFrame.current = false;
      return;
    }
    const handle = setTimeout(async () => {
      const seq = ++previewSeq.current;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await api.post(
          `/email-templates/${selectedTemplate.slug}/preview`,
          {
            htmlBody: editHtmlBody,
            subject: editSubject,
            editable: editorTab === "preview",
          },
        );
        if (seq !== previewSeq.current) return;
        setPreviewHtml(res.data.html);
        setPreviewSubject(res.data.subject);
      } catch (error: any) {
        if (seq !== previewSeq.current) return;
        setPreviewError(
          error?.response?.data?.message || "Failed to render preview",
        );
      } finally {
        if (seq === previewSeq.current) setPreviewLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorTab, previewOpen, selectedTemplate?.slug, editHtmlBody, editSubject]);

  const selectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEditSubject(template.subject);
    setEditHtmlBody(template.htmlBody);
    setEditIsActive(template.isActive);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setSaving(true);
      await api.patch(`/email-templates/${selectedTemplate.id}`, {
        subject: editSubject,
        htmlBody: editHtmlBody,
        isActive: editIsActive,
      });

      showNotification({
        title: "Saved",
        message: "Template updated successfully",
        color: "green",
        icon: <TbCheck />,
      });

      loadTemplates();
    } catch (error) {
      console.error("Failed to save template:", error);
      showNotification({
        title: "Error",
        message: "Failed to save template",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedTemplate || !testEmail) return;

    try {
      setSendingTest(true);
      await api.post(`/email-templates/${selectedTemplate.slug}/test`, {
        email: testEmail,
      });

      showNotification({
        title: "Test Sent",
        message: `Test email sent to ${testEmail}`,
        color: "green",
        icon: <TbCheck />,
      });

      closeTestModal();
    } catch (error: any) {
      showNotification({
        title: "Error",
        message: error.response?.data?.message || "Failed to send test email",
        color: "red",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastSubject || !broadcastHeadline || !broadcastBody) {
      showNotification({
        title: "Missing Fields",
        message: "Please fill in subject, headline, and body",
        color: "orange",
      });
      return;
    }

    try {
      setSendingBroadcast(true);
      const res = await api.post("/email-templates/broadcast", {
        subject: broadcastSubject,
        brand: "dropshare",
        headline: broadcastHeadline,
        subheadline: broadcastSubheadline,
        bodyHtml: `<p class="text-secondary" style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.6;">${broadcastBody.replace(/\n/g, "<br>")}</p>`,
        ctaUrl: broadcastCtaUrl || undefined,
        ctaText: broadcastCtaText || undefined,
      });

      showNotification({
        title: "Broadcast Sent",
        message: `Sent: ${res.data.sent}, Failed: ${res.data.failed}`,
        color: "green",
        icon: <TbCheck />,
      });

      setBroadcastSubject("");
      setBroadcastHeadline("");
      setBroadcastSubheadline("");
      setBroadcastBody("");
      setBroadcastCtaUrl("");
      setBroadcastCtaText("");
    } catch (error: any) {
      showNotification({
        title: "Error",
        message: error.response?.data?.message || "Failed to send broadcast",
        color: "red",
      });
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (!hasCapability(user, "emails.view")) {
    return (
      <Box className={classes.wrapper} style={{ textAlign: "center", padding: 60 }}>
        <Loader color={ACCENT} />
      </Box>
    );
  }

  const canEditEmails = hasCapability(user, "emails.edit");
  const canSendEmails = hasCapability(user, "emails.send");
  const canSeeAuthLogs = hasCapability(user, "users.view");

  return (
    <>
      <Meta title="Email Center - Admin" />
      <Box className={classes.wrapper}>
          <Box className={classes.headerCard}>
            <div className={classes.titleSection}>
              <TbMail size={32} className={classes.pageIcon} />
              <div>
                <Title order={3} className={classes.pageTitle}>Email Center</Title>
                <Text className={classes.subtitle}>
                  Manage templates, send broadcasts, and review every email the site sends
                </Text>
              </div>
            </div>
          </Box>

          <Tabs
            value={activeTab}
            onTabChange={setActiveTab}
            className={classes.tabs}
            variant="outline"
            radius="md"
          >
              <Tabs.List mb="xl">
                <Tabs.Tab value="templates" icon={<TbTemplate size={18} />}>
                  Templates
                </Tabs.Tab>
                <Tabs.Tab value="broadcast" icon={<TbBroadcast size={18} />}>
                  Broadcast
                </Tabs.Tab>
                <Tabs.Tab value="logs" icon={<TbHistory size={18} />}>
                  Logs
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="templates">
                {loading ? (
                  <Box style={{ textAlign: "center", padding: 40 }}>
                    <Loader color={ACCENT} />
                  </Box>
                ) : (
                  <Grid>
                    <Grid.Col span={12} md={4}>
                      <Text weight={600} mb="md">Templates</Text>
                      <ScrollArea style={{ height: 500 }}>
                        <Stack spacing="sm">
                          {templates.map((template) => (
                            <Box
                              key={template.id}
                              className={cx(classes.templateCard, {
                                [classes.templateCardActive]: selectedTemplate?.id === template.id,
                              })}
                              onClick={() => selectTemplate(template)}
                            >
                              <Group position="apart" mb={4}>
                                <Text weight={600} size="sm">{template.name}</Text>
                                <Badge
                                  size="xs"
                                  variant="dot"
                                  color={template.isActive ? "green" : "gray"}
                                >
                                  {template.isActive ? "Active" : "Disabled"}
                                </Badge>
                              </Group>
                              <Group spacing={8}>
                                <Badge
                                  size="xs"
                                  style={{
                                    background:
                                      (BRAND_COLORS[template.brand] ??
                                        BRAND_COLORS.dropshare).color === "var(--ls-accent)"
                            ? "rgba(var(--ls-accent-rgb), 0.125)"
                            : (BRAND_COLORS[template.brand as keyof typeof BRAND_COLORS] ?? BRAND_COLORS.dropshare).color + "20",
                                    color: (BRAND_COLORS[template.brand] ??
                                      BRAND_COLORS.dropshare).color,
                                  }}
                                >
                                  {appName}
                                </Badge>
                                {template.isSystem && (
                                  <Badge size="xs" color="gray" variant="outline">
                                    System
                                  </Badge>
                                )}
                              </Group>
                              <Text size="xs" color="dimmed" mt={8} lineClamp={2}>
                                {template.description}
                              </Text>
                            </Box>
                          ))}
                        </Stack>
                      </ScrollArea>
                    </Grid.Col>

                    <Grid.Col span={12} md={8}>
                      {selectedTemplate ? (
                        <Box className={classes.editorSection}>
                          <Group position="apart" mb="lg">
                            <div>
                              <Text weight={600} size="lg">{selectedTemplate.name}</Text>
                              <Text size="sm" color="dimmed">Slug: {selectedTemplate.slug}</Text>
                            </div>
                            <Group>
                              <Switch
                                label="Active"
                                checked={editIsActive}
                                onChange={(e) => setEditIsActive(e.currentTarget.checked)}
                              />
                              <Button
                                variant="light"
                                leftIcon={<TbEye size={16} />}
                                onClick={openPreview}
                                className={classes.secondaryButton}
                              >
                                Preview
                              </Button>
                              {canSendEmails && (
                                <Button
                                  variant="light"
                                  leftIcon={<TbMailForward size={16} />}
                                  onClick={() => {
                                    setTestEmail(user?.email || "");
                                    openTestModal();
                                  }}
                                  className={classes.secondaryButton}
                                >
                                  Send Test
                                </Button>
                              )}
                              {canEditEmails && (
                                <Button
                                  leftIcon={<TbDeviceFloppy size={16} />}
                                  onClick={handleSaveTemplate}
                                  loading={saving}
                                  className={classes.primaryButton}
                                >
                                  Save
                                </Button>
                              )}
                            </Group>
                          </Group>

                          <Stack spacing="md">
                            <TextInput
                              label="Subject"
                              value={editSubject}
                              onChange={(e) => setEditSubject(e.currentTarget.value)}
                              className={classes.input}
                            />

                            {selectedTemplate.variables.length > 0 && (
                              <Box>
                                <Text size="sm" weight={500} mb={4}>Available Variables</Text>
                                <Text size="xs" color="dimmed" mb={8}>
                                  Hover a variable to see what it inserts. Paste it into the
                                  subject or body and it&apos;s replaced when the email sends.
                                </Text>
                                <Group spacing={8}>
                                  {selectedTemplate.variables.map((v) => (
                                    <HoverCard
                                      key={v}
                                      width={260}
                                      shadow="md"
                                      withinPortal
                                      openDelay={120}
                                      position="top"
                                      withArrow
                                    >
                                      <HoverCard.Target>
                                        <Badge
                                          size="sm"
                                          variant="outline"
                                          color="green"
                                          style={{ cursor: "help", textTransform: "none" }}
                                        >
                                          {`{{${v}}}`}
                                        </Badge>
                                      </HoverCard.Target>
                                      <HoverCard.Dropdown>
                                        <Text size="xs" weight={600} mb={4}>
                                          {`{{${v}}}`}
                                        </Text>
                                        <Text size="xs" color="dimmed">
                                          {VARIABLE_HELP[v] ??
                                            "Replaced with this template's value for " +
                                              `${v} when the email is sent.`}
                                        </Text>
                                      </HoverCard.Dropdown>
                                    </HoverCard>
                                  ))}
                                </Group>
                              </Box>
                            )}

                            <Box>
                              <Tabs
                                value={editorTab}
                                onTabChange={setEditorTab}
                                variant="pills"
                                radius="md"
                                className={classes.editorTabs}
                              >
                                <Tabs.List mb="sm">
                                  <Tabs.Tab
                                    value="html"
                                    icon={<TbCode size={14} />}
                                  >
                                    Raw HTML
                                  </Tabs.Tab>
                                  <Tabs.Tab
                                    value="preview"
                                    icon={<TbEye size={14} />}
                                  >
                                    Live Preview
                                  </Tabs.Tab>
                                </Tabs.List>

                                <Tabs.Panel value="html">
                                  <Textarea
                                    value={editHtmlBody}
                                    onChange={(e) =>
                                      setEditHtmlBody(e.currentTarget.value)
                                    }
                                    minRows={15}
                                    maxRows={25}
                                    className={classes.input}
                                    styles={{
                                      input: {
                                        fontFamily: "monospace",
                                        fontSize: 12,
                                      },
                                    }}
                                  />
                                </Tabs.Panel>

                                <Tabs.Panel value="preview">
                                  <TextInput
                                    label="Subject"
                                    value={editSubject}
                                    onChange={(e) =>
                                      setEditSubject(e.currentTarget.value)
                                    }
                                    className={classes.input}
                                    mb="xs"
                                  />
                                  <Group spacing={6} mb={6}>
                                    {[
                                      { cmd: "bold", label: "Bold" },
                                      { cmd: "italic", label: "Italic" },
                                      { cmd: "underline", label: "Underline" },
                                    ].map((b) => (
                                      <Button
                                        key={b.cmd}
                                        size="xs"
                                        variant="default"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() =>
                                          previewFrameRef.current?.contentDocument?.execCommand(
                                            b.cmd,
                                          )
                                        }
                                      >
                                        {b.label}
                                      </Button>
                                    ))}
                                    <Text size="xs" color="dimmed" ml="xs">
                                      Click into the email below and type. Green
                                      chips are variables - they move and delete
                                      as one piece.
                                    </Text>
                                  </Group>
                                  <Box className={classes.previewShell}>
                                    {previewLoading && !previewHtml ? (
                                      <Group position="center" py="xl">
                                        <Loader size="sm" color={ACCENT} />
                                        <Text size="sm" color="dimmed">
                                          Rendering preview…
                                        </Text>
                                      </Group>
                                    ) : previewError ? (
                                      <Text size="sm" color="red" p="md">
                                        {previewError}
                                      </Text>
                                    ) : (
                                      <iframe
                                        title="Email preview"
                                        ref={previewFrameRef}
                                        srcDoc={previewHtml}
                                        sandbox="allow-same-origin"
                                        onLoad={attachVisualEditor}
                                        className={classes.previewFrameFull}
                                      />
                                    )}
                                  </Box>
                                  <Text size="xs" color="dimmed" mt={6}>
                                    Edits here update the template as you type -
                                    press <strong>Save</strong> to keep them.
                                    Sample values are shown for each variable.
                                  </Text>
                                </Tabs.Panel>
                              </Tabs>
                            </Box>
                          </Stack>
                        </Box>
                      ) : (
                        <Box style={{ textAlign: "center", padding: 60 }}>
                          <Text color="dimmed">Select a template to edit</Text>
                        </Box>
                      )}
                    </Grid.Col>
                  </Grid>
                )}
              </Tabs.Panel>

              <Tabs.Panel value="broadcast">
                <Grid>
                  <Grid.Col span={12} md={7}>
                    <Box className={classes.editorSection}>
                      <Text weight={600} size="lg" mb="lg">Compose Broadcast</Text>

                      <Stack spacing="md">
                        <TextInput
                          label="Email Subject"
                          placeholder="Important announcement"
                          value={broadcastSubject}
                          onChange={(e) => setBroadcastSubject(e.currentTarget.value)}
                          className={classes.input}
                        />

                        <TextInput
                          label="Headline"
                          placeholder="Big News!"
                          value={broadcastHeadline}
                          onChange={(e) => setBroadcastHeadline(e.currentTarget.value)}
                          className={classes.input}
                        />

                        <TextInput
                          label="Subheadline"
                          placeholder="We have something exciting to share"
                          value={broadcastSubheadline}
                          onChange={(e) => setBroadcastSubheadline(e.currentTarget.value)}
                          className={classes.input}
                        />

                        <Textarea
                          label="Body Text"
                          description="Line breaks are kept. Basic HTML is allowed - if you use block tags like <p> it's passed through as-is."
                          placeholder="Write your message here..."
                          value={broadcastBody}
                          onChange={(e) => setBroadcastBody(e.currentTarget.value)}
                          minRows={5}
                          className={classes.input}
                        />

                        <Grid>
                          <Grid.Col span={12} sm={8}>
                            <TextInput
                              label="Button URL (optional)"
                              placeholder="https://<your-domain>/upload"
                              value={broadcastCtaUrl}
                              onChange={(e) => setBroadcastCtaUrl(e.currentTarget.value)}
                              className={classes.input}
                            />
                          </Grid.Col>
                          <Grid.Col span={12} sm={4}>
                            <TextInput
                              label="Button Text"
                              placeholder="Learn More"
                              value={broadcastCtaText}
                              onChange={(e) => setBroadcastCtaText(e.currentTarget.value)}
                              className={classes.input}
                            />
                          </Grid.Col>
                        </Grid>

                        <Divider my="sm" />

                        <Group position="right">
                          <Button
                            leftIcon={<TbEye size={18} />}
                            variant="light"
                            size="md"
                            className={classes.secondaryButton}
                            onClick={loadBroadcastPreview}
                            loading={broadcastPreviewLoading}
                          >
                            Live Preview
                          </Button>
                          {canSendEmails && (
                            <Button
                              leftIcon={<TbSend size={18} />}
                              onClick={handleSendBroadcast}
                              loading={sendingBroadcast}
                              className={classes.primaryButton}
                              size="md"
                            >
                              Send to All Users
                            </Button>
                          )}
                        </Group>
                      </Stack>
                    </Box>
                  </Grid.Col>

                  <Grid.Col span={12} md={5}>
                    <Box className={classes.editorSection}>
                      <Text weight={600} size="lg" mb={4}>
                        Available Variables
                      </Text>
                      <Text size="xs" color="dimmed" mb="md">
                        Paste any of these into the subject, headline,
                        subheadline, body, or button - each is replaced per
                        recipient when the broadcast sends. Hover for details.
                      </Text>
                      <Group spacing={8}>
                        {BROADCAST_VARIABLES.map((v) => (
                          <HoverCard
                            key={v.name}
                            width={260}
                            shadow="md"
                            withinPortal
                            openDelay={120}
                            position="top"
                            withArrow
                          >
                            <HoverCard.Target>
                              <Badge
                                size="sm"
                                variant="outline"
                                color="green"
                                style={{ cursor: "help", textTransform: "none" }}
                              >
                                {`{{${v.name}}}`}
                              </Badge>
                            </HoverCard.Target>
                            <HoverCard.Dropdown>
                              <Text size="xs" weight={600} mb={4}>
                                {`{{${v.name}}}`}
                              </Text>
                              <Text size="xs" color="dimmed">
                                {v.help}
                              </Text>
                            </HoverCard.Dropdown>
                          </HoverCard>
                        ))}
                      </Group>
                    </Box>
                  </Grid.Col>
                </Grid>
              </Tabs.Panel>

              <Tabs.Panel value="logs">
                <Grid mb="xl">
                  <Grid.Col span={6} sm={4}>
                    <Box className={classes.statsCard}>
                      <Text size="xl" weight={700} style={{ color: ACCENT }}>
                        {stats.totalSent}
                      </Text>
                      <Text size="sm" color="dimmed">Emails Sent</Text>
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={6} sm={4}>
                    <Box className={classes.statsCard} style={{
                      background: theme.colorScheme === "dark" ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.08)",
                      borderColor: "rgba(239, 68, 68, 0.2)",
                    }}>
                      <Text size="xl" weight={700} style={{ color: "#ef4444" }}>
                        {stats.totalFailed}
                      </Text>
                      <Text size="sm" color="dimmed">Failed</Text>
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={6} sm={4}>
                    <Box className={classes.statsCard} style={{
                      background: theme.colorScheme === "dark" ? "rgba(96, 165, 250, 0.08)" : "rgba(96, 165, 250, 0.08)",
                      borderColor: "rgba(96, 165, 250, 0.2)",
                    }}>
                      <Text size="xl" weight={700} style={{ color: "#60a5fa" }}>
                        {stats.total}
                      </Text>
                      <Text size="sm" color="dimmed">Total</Text>
                    </Box>
                  </Grid.Col>
                </Grid>

                <Box className={classes.editorSection}>
                  <Group position="apart" mb="md">
                    <div>
                      <Text weight={600}>All Emails</Text>
                      <Text size="xs" color="dimmed">
                        Every email the site sends - password resets, sign-in codes,
                        share notifications, invites, and broadcasts.
                      </Text>
                    </div>
                    <Button
                      variant="subtle"
                      size="xs"
                      leftIcon={<TbRefresh size={14} />}
                      onClick={loadLogs}
                      loading={logsLoading}
                    >
                      Refresh
                    </Button>
                  </Group>

                  <Group spacing="sm" mb="md" align="flex-end">
                    <TextInput
                      placeholder="Search recipient or subject..."
                      value={logSearchInput}
                      onChange={(e) => setLogSearchInput(e.currentTarget.value)}
                      className={classes.input}
                      style={{ flex: "1 1 240px", minWidth: 220 }}
                    />
                    <Select
                      placeholder="All types"
                      value={logTypeFilter}
                      onChange={(v) => {
                        setLogTypeFilter(v);
                        setLogsPage(1);
                      }}
                      clearable
                      className={classes.input}
                      style={{ width: 200 }}
                      withinPortal
                      dropdownPosition="bottom"
                      classNames={{
                        dropdown: classes.selectDropdown,
                        item: classes.selectItem,
                      }}
                      data={Object.entries(TYPE_LABELS)
                        .filter(
                          ([value]) =>
                            canSeeAuthLogs ||
                            !AUTH_LOG_TYPES.includes(value),
                        )
                        .map(([value, label]) => ({ value, label }))}
                    />
                    <Select
                      placeholder="All statuses"
                      value={logStatusFilter}
                      onChange={(v) => {
                        setLogStatusFilter(v);
                        setLogsPage(1);
                      }}
                      clearable
                      className={classes.input}
                      style={{ width: 160 }}
                      withinPortal
                      dropdownPosition="bottom"
                      classNames={{
                        dropdown: classes.selectDropdown,
                        item: classes.selectItem,
                      }}
                      data={[
                        { value: "sent", label: "Sent" },
                        { value: "failed", label: "Failed" },
                      ]}
                    />
                  </Group>

                  <ScrollArea>
                    <Table striped highlightOnHover className={classes.table}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Recipient</th>
                          <th>Type</th>
                          <th>Subject</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} className={classes.logRow}>
                            <td>
                              <Text size="sm">
                                {new Date(log.createdAt).toLocaleDateString()}{" "}
                                {new Date(log.createdAt).toLocaleTimeString()}
                              </Text>
                            </td>
                            <td>
                              <Text size="sm" style={{ maxWidth: 200 }} lineClamp={1}>
                                {log.recipient}
                              </Text>
                            </td>
                            <td>
                              {log.type ? (
                                <Badge size="sm" variant="light" color="gray">
                                  {TYPE_LABELS[log.type] ?? log.type}
                                </Badge>
                              ) : (
                                <Text size="xs" color="dimmed">
                                  -
                                </Text>
                              )}
                            </td>
                            <td>
                              <Text size="sm" style={{ maxWidth: 300 }} lineClamp={1}>
                                {log.subject}
                              </Text>
                            </td>
                            <td>
                              <Badge
                                color={log.status === "sent" ? "green" : "red"}
                                variant="light"
                              >
                                {log.status}
                              </Badge>
                              {log.error && (
                                <Tooltip label={log.error}>
                                  <Text size="xs" color="red" style={{ cursor: "help", textTransform: "none" }}>
                                    (hover for error)
                                  </Text>
                                </Tooltip>
                              )}
                            </td>
                          </tr>
                        ))}
                        {logs.length === 0 && (
                          <tr>
                            <td colSpan={5}>
                              <Text color="dimmed" align="center" py="xl">
                                {logSearch || logTypeFilter || logStatusFilter
                                  ? "No emails match these filters"
                                  : "No emails sent yet"}
                              </Text>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </ScrollArea>

                  {logsTotal > 20 && (
                    <Group position="center" mt="lg">
                      <Pagination
                        total={Math.ceil(logsTotal / 20)}
                        value={logsPage}
                        onChange={setLogsPage}
                      />
                    </Group>
                  )}
                </Box>
              </Tabs.Panel>
            </Tabs>
      </Box>

      <Modal
        opened={testModalOpen}
        onClose={closeTestModal}
        title="Send Test Email"
        centered
      >
        <Stack>
          <Text size="sm" color="dimmed">
            Send a test email for "{selectedTemplate?.name}" template.
          </Text>
          <TextInput
            label="Email Address"
            placeholder="you@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.currentTarget.value)}
          />
          <Group position="right" mt="md">
            <Button variant="subtle" onClick={closeTestModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSendTest}
              loading={sendingTest}
              className={classes.primaryButton}
            >
              Send Test
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={broadcastPreviewOpen}
        onClose={closeBroadcastPreview}
        title="Broadcast Preview"
        size="xl"
        centered
      >
        <Box className={classes.previewMeta}>
          <Text size="xs" color="dimmed">
            Subject
          </Text>
          <Text size="sm" weight={600}>
            {broadcastPreviewSubject || "-"}
          </Text>
        </Box>
        <Box className={classes.previewFrame}>
          <iframe
            srcDoc={broadcastPreviewHtml}
            sandbox=""
            referrerPolicy="no-referrer"
            style={{
              width: "100%",
              height: 520,
              border: "none",
              background: "#ffffff",
            }}
            title="Broadcast Preview"
          />
        </Box>
        <Text size="xs" color="dimmed" mt={8}>
          Shown with sample recipient values. Each recipient gets their own
          values substituted when the broadcast sends.
        </Text>
      </Modal>

      <Modal
        opened={previewOpen}
        onClose={closePreview}
        title="Email Preview"
        size="xl"
        centered
      >
        <Box className={classes.previewMeta}>
          <Text size="xs" color="dimmed">
            Subject
          </Text>
          <Text size="sm" weight={600}>
            {previewSubject || "-"}
          </Text>
        </Box>
        <Box className={classes.previewFrame}>
          <iframe
            srcDoc={previewHtml}
            sandbox=""
            referrerPolicy="no-referrer"
            style={{
              width: "100%",
              height: 500,
              border: "none",
              background: "#ffffff",
            }}
            title="Email Preview"
          />
        </Box>
      </Modal>
    </>
  );
}
