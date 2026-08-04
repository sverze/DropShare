import { Button, Group, Stack, Text, Box, CopyButton } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import moment from "moment";
import { useRouter } from "next/router";
import { FormattedMessage } from "react-intl";
import { TbCopy, TbCheck, TbExternalLink } from "react-icons/tb";
import useTranslate, {
  translateOutsideContext,
} from "../../../hooks/useTranslate.hook";
import { CompletedShare } from "../../../types/share.type";

const showCompletedUploadModal = (
  modals: ModalsContextProps,
  share: CompletedShare,
) => {
  const t = translateOutsideContext();
  return modals.openModal({
    closeOnClickOutside: false,
    withCloseButton: false,
    closeOnEscape: false,
    centered: true,
    zIndex: 320,
    title: t("upload.modal.completed.share-ready"),
    styles: (theme) => ({
      inner: {
        paddingTop: 96,
        paddingBottom: 48,
      },
      modal: {
        background: theme.colorScheme === "dark" ? "#1a1a1a" : "#fff",
        borderRadius: 20,
        border: "1px solid var(--ls-accent)",
        boxShadow: "0 0 30px rgba(var(--ls-accent-rgb), 0.15), 0 25px 50px -12px rgba(0,0,0,0.5)",
      },
      header: {
        borderBottom: `1px solid ${theme.colorScheme === "dark" ? "#2a2a2a" : "#e0e0e0"}`,
        paddingBottom: 16,
        marginBottom: 16,
      },
      title: {
        fontWeight: 600,
        fontSize: 18,
      },
    }),
    children: <Body share={share} />,
  });
};

const Body = ({ share }: { share: CompletedShare }) => {
  const modals = useModals();
  const router = useRouter();
  const t = useTranslate();

  const isReverseShare = !!router.query["reverseShareToken"];

  const link = `${window.location.origin}/s/${share.id}`;

  const handleOpenLink = () => {
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <Stack align="stretch">
      <Box
        sx={(theme) => ({
          padding: "14px 16px",
          background: theme.colorScheme === "dark" ? "#111" : "#fafafa",
          border: `1px solid ${theme.colorScheme === "dark" ? "#2a2a2a" : "#e0e0e0"}`,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
        })}
      >
        <Text
          sx={{
            flex: 1,
            color: "var(--ls-accent)",
            fontFamily: "monospace",
            fontSize: 14,
            wordBreak: "break-all",
            lineHeight: 1.4,
          }}
        >
          {link}
        </Text>
      </Box>

      <Group spacing={10} grow>
        <CopyButton value={link}>
          {({ copied, copy }) => (
            <Button
              variant={copied ? "filled" : "outline"}
              radius={12}
              leftIcon={copied ? <TbCheck size={18} /> : <TbCopy size={18} />}
              onClick={copy}
              sx={{
                border: "1px solid var(--ls-accent)",
                color: copied ? "#000" : "var(--ls-accent)",
                background: copied ? "var(--ls-accent)" : "transparent",
                transition: "all 0.2s",
                "&:hover": {
                  background: copied
                    ? "var(--ls-accent)"
                    : "rgba(var(--ls-accent-rgb), 0.1)",
                },
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </CopyButton>
        <Button
          variant="outline"
          radius={12}
          leftIcon={<TbExternalLink size={18} />}
          onClick={handleOpenLink}
          sx={{
            border: "1px solid var(--ls-accent)",
            color: "var(--ls-accent)",
            "&:hover": {
              background: "rgba(var(--ls-accent-rgb), 0.1)",
            },
          }}
        >
          Open
        </Button>
      </Group>

      {share.notifyReverseShareCreator === true && (
        <Text
          size="sm"
          sx={(theme) => ({
            color:
              theme.colorScheme === "dark"
                ? theme.colors.gray[3]
                : theme.colors.dark[4],
          })}
        >
          {t("upload.modal.completed.notified-reverse-share-creator")}
        </Text>
      )}
      <Text
        size="xs"
        sx={(theme) => ({
          color: theme.colors.gray[6],
        })}
      >
        {moment(share.expiration).unix() === 0
          ? t("upload.modal.completed.never-expires")
          : t("upload.modal.completed.expires-on", {
              expiration: moment(share.expiration).format("LLL"),
            })}
      </Text>

      <Button
        radius={14}
        sx={{
          background: "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
          boxShadow: "0 0 20px rgba(var(--ls-accent-rgb), 0.3)",
          "&:hover": {
            boxShadow: "0 0 30px rgba(var(--ls-accent-rgb), 0.4)",
          },
        }}
        onClick={() => {
          modals.closeAll();
          if (isReverseShare) {
            router.reload();
          } else {
            router.push("/upload");
          }
        }}
      >
        <FormattedMessage id="common.button.done" />
      </Button>
    </Stack>
  );
};

export default showCompletedUploadModal;
