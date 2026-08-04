import {
  Accordion,
  Alert,
  Box,
  Button,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { useModals } from "@mantine/modals";
import moment from "moment";
import { useState } from "react";
import { TbAlertCircle } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import * as yup from "yup";
import useTranslate from "../../../hooks/useTranslate.hook";
import { Timespan } from "../../../types/timespan.type";
import { getExpirationPreview } from "../../../utils/date.util";
import useSiteTheme from "../../../theme/useSiteTheme";
import ThemeColorPicker from "../../share/ThemeColorPicker";
import { BulkShareOptions, BulkSubmitHandler } from "./bulkUpload.util";

export const getBulkModalStyles = (isDark: boolean) => ({
  content: {
    position: "relative" as const,
    background:
      "linear-gradient(115deg, var(--ls-ring-outer) 0%, var(--ls-ring-inner) 22%, var(--ls-ring-center) 50%, var(--ls-ring-inner) 78%, var(--ls-ring-outer) 100%)",
    backgroundSize: "220% 220%",
    backgroundPosition: "0% 50%",
    border: "none",
    boxShadow: isDark
      ? "0 24px 80px rgba(0, 0, 0, 0.52), 0 0 24px rgba(var(--ls-ring-outer-rgb), 0.28), 0 0 42px rgba(var(--ls-accent-rgb), 0.18)"
      : "0 24px 80px rgba(15, 23, 42, 0.16), 0 0 24px rgba(var(--ls-ring-outer-rgb), 0.12)",
    borderRadius: 30,
    overflow: "hidden" as const,
    padding: 3,
    "@keyframes dropshare-mass-modal-gradient": {
      "0%": {
        backgroundPosition: "0% 50%",
      },
      "50%": {
        backgroundPosition: "100% 50%",
      },
      "100%": {
        backgroundPosition: "0% 50%",
      },
    },
    animation: "dropshare-mass-modal-gradient 8s ease-in-out infinite",
  },
  inner: {
    padding: 24,
  },
  header: {
    background: isDark
      ? "rgba(27, 29, 33, 0.985)"
      : "rgba(250, 250, 250, 0.985)",
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  close: {
    color: "var(--ls-bulk-soft)",
    "&:hover": {
      background: isDark
        ? "rgba(var(--ls-bulk-btn-rgb), 0.08)"
        : "rgba(var(--ls-bulk-btn-rgb), 0.08)",
    },
  },
  body: {
    background: isDark
      ? "rgba(27, 29, 33, 0.985)"
      : "rgba(250, 250, 250, 0.985)",
    borderBottomLeftRadius: 27,
    borderBottomRightRadius: 27,
  },
});

const getModalPipeStyles = () => ({
  position: "relative" as const,
  borderRadius: 24,
});

const BulkShareSettingsModal = ({
  defaultOptions,
  enableEmailRecepients,
  isUserSignedIn,
  groupName,
  groupOptions,
  maxExpiration,
  onSubmit,
  showBulkNote = false,
}: {
  defaultOptions: BulkShareOptions;
  enableEmailRecepients: boolean;
  isUserSignedIn: boolean;
  groupName?: string | null;
  groupOptions: { value: string; label: string }[];
  maxExpiration: Timespan;
  onSubmit: BulkSubmitHandler;
  showBulkNote?: boolean;
}) => {
  const t = useTranslate();
  const modals = useModals();
  const [showNotSignedInAlert, setShowNotSignedInAlert] = useState(true);
  const defaultAccentColor = useSiteTheme().presets[0]?.color ?? "#00ff5a";
  const parseExpiration = (value: string) => {
    if (!value || value === "never") {
      return {
        expiration_num: 5,
        expiration_unit: "-days",
        never_expires: value === "never",
      };
    }

    const match = value.match(
      /^(\d+)(-(minutes|hours|days|weeks|months|years))$/,
    );
    if (!match) {
      return {
        expiration_num: 5,
        expiration_unit: "-days",
        never_expires: false,
      };
    }

    return {
      expiration_num: parseInt(match[1], 10),
      expiration_unit: match[2],
      never_expires: false,
    };
  };
  const parsedExpiration = parseExpiration(defaultOptions.expiration);

  const validationSchema = yup.object().shape({
    password: yup
      .string()
      .transform((value) => value || undefined)
      .min(3, t("common.error.too-short", { length: 3 }))
      .max(30, t("common.error.too-long", { length: 30 })),
    maxViews: yup
      .number()
      .transform((value) => value || undefined)
      .min(1),
  });

  const form = useForm({
    initialValues: {
      recipients: defaultOptions.recipients,
      password: defaultOptions.security.password,
      maxViews: defaultOptions.security.maxViews,
      expiration_num: parsedExpiration.expiration_num,
      expiration_unit: parsedExpiration.expiration_unit,
      never_expires: parsedExpiration.never_expires,
      accentColor: defaultOptions.accentColor || defaultAccentColor,
      shareWithGroup: defaultOptions.shareWithGroup ?? false,
      groupId: defaultOptions.groupId || groupOptions[0]?.value || null,
      removeExtensionFromShareName:
        defaultOptions.removeExtensionFromShareName ?? false,
      shareNamePrefix: defaultOptions.shareNamePrefix || "",
    },
    validate: yupResolver(validationSchema),
  });

  const handleSubmit = form.onSubmit((values) => {
    const expirationNum =
      typeof values.expiration_num === "number" &&
      Number.isFinite(values.expiration_num)
        ? values.expiration_num
        : 1;
    const expirationUnit =
      typeof values.expiration_unit === "string" &&
      values.expiration_unit.length > 0
        ? values.expiration_unit
        : "-days";
    const expirationString = values.never_expires
      ? "never"
      : `${expirationNum}${expirationUnit}`;

    const expirationDate = moment().add(
      expirationNum,
      expirationUnit.replace("-", "") as moment.unitOfTime.DurationConstructor,
    );

    if (
      maxExpiration.value !== 0 &&
      (values.never_expires ||
        expirationDate.isAfter(
          moment().add(maxExpiration.value, maxExpiration.unit),
        ))
    ) {
      form.setFieldError(
        "expiration_num",
        t("upload.modal.expires.error.too-long", {
          max: moment
            .duration(maxExpiration.value, maxExpiration.unit)
            .humanize(),
        }),
      );
      return;
    }

    onSubmit({
      expiration: expirationString,
      recipients: values.recipients,
      description: defaultOptions.description,
      accentColor: values.accentColor || defaultAccentColor,
      shareWithGroup: Boolean(values.shareWithGroup),
      groupId: values.shareWithGroup
        ? values.groupId || groupOptions[0]?.value || null
        : null,
      removeExtensionFromShareName: Boolean(values.removeExtensionFromShareName),
      shareNamePrefix: values.shareNamePrefix?.trim() || undefined,
      security: {
        password: values.password || undefined,
        maxViews: values.maxViews || undefined,
      },
    });
    modals.closeAll();
  });

  return (
    <Box sx={getModalPipeStyles()}>
      {showBulkNote ? (
        <Alert
          icon={<TbAlertCircle size={16} />}
          color="cyan"
          mb="sm"
          styles={{ message: { lineHeight: 1.5 } }}
        >
          Bulk mode creates a <strong>separate share link for every file</strong>{" "}
          you dropped, using the settings below for each one. When it finishes,
          a text file listing every file and its link downloads automatically.
        </Alert>
      ) : null}
      {showNotSignedInAlert && !isUserSignedIn ? (
        <Alert
          withCloseButton
          onClose={() => setShowNotSignedInAlert(false)}
          icon={<TbAlertCircle size={16} />}
          title={t("upload.modal.not-signed-in")}
          color="yellow"
        >
          <FormattedMessage id="upload.modal.not-signed-in-description" />
        </Alert>
      ) : null}
      <form onSubmit={handleSubmit}>
        <Stack spacing="md">
          <Group
            align={form.errors.expiration_num ? "center" : "flex-end"}
            grow
          >
            <NumberInput
              min={1}
              max={99999}
              precision={0}
              variant="filled"
              label={t("upload.modal.expires.label")}
              disabled={form.values.never_expires}
              {...form.getInputProps("expiration_num")}
            />
            <Select
              disabled={form.values.never_expires}
              label=" "
              {...form.getInputProps("expiration_unit")}
              data={[
                {
                  value: "-minutes",
                  label:
                    form.values.expiration_num === 1
                      ? t("upload.modal.expires.minute-singular")
                      : t("upload.modal.expires.minute-plural"),
                },
                {
                  value: "-hours",
                  label:
                    form.values.expiration_num === 1
                      ? t("upload.modal.expires.hour-singular")
                      : t("upload.modal.expires.hour-plural"),
                },
                {
                  value: "-days",
                  label:
                    form.values.expiration_num === 1
                      ? t("upload.modal.expires.day-singular")
                      : t("upload.modal.expires.day-plural"),
                },
                {
                  value: "-weeks",
                  label:
                    form.values.expiration_num === 1
                      ? t("upload.modal.expires.week-singular")
                      : t("upload.modal.expires.week-plural"),
                },
                {
                  value: "-months",
                  label:
                    form.values.expiration_num === 1
                      ? t("upload.modal.expires.month-singular")
                      : t("upload.modal.expires.month-plural"),
                },
                {
                  value: "-years",
                  label:
                    form.values.expiration_num === 1
                      ? t("upload.modal.expires.year-singular")
                      : t("upload.modal.expires.year-plural"),
                },
              ]}
            />
          </Group>
          {maxExpiration.value === 0 ? (
            <Stack spacing={6}>
              <Checkbox
                label={t("upload.modal.expires.never-long")}
                {...form.getInputProps("never_expires", { type: "checkbox" })}
              />
              {groupOptions.length > 0 ? (
                <Stack spacing={8}>
                  <Checkbox
                    label={
                      groupName
                        ? `Add each created share to ${groupName}`
                        : "Add each created share to group"
                    }
                    {...form.getInputProps("shareWithGroup", {
                      type: "checkbox",
                    })}
                  />
                  {form.values.shareWithGroup ? (
                    <Select
                      label="Group"
                      data={groupOptions}
                      value={form.values.groupId || groupOptions[0]?.value}
                      onChange={(value) => form.setFieldValue("groupId", value)}
                      withinPortal
                    />
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          ) : null}
          <Text size="xs" italic color="dimmed">
            {getExpirationPreview(
              {
                neverExpires: t("upload.modal.completed.never-expires"),
                expiresOn: t("upload.modal.completed.expires-on"),
              },
              form,
            )}
          </Text>

          <Accordion>
            {enableEmailRecepients ? (
              <Accordion.Item value="email-recipients">
                <Accordion.Control>Email Recipients</Accordion.Control>
                <Accordion.Panel>
                  <MultiSelect
                    data={form.values.recipients}
                    placeholder={t("upload.modal.accordion.email.placeholder")}
                    searchable
                    creatable
                    inputMode="email"
                    getCreateLabel={(query) => `+ ${query}`}
                    onCreate={(query) => {
                      if (!query.match(/^\S+@\S+\.\S+$/)) {
                        form.setFieldError(
                          "recipients",
                          t("upload.modal.accordion.email.invalid-email"),
                        );
                        return null;
                      }
                      form.setFieldError("recipients", null);
                      form.setFieldValue("recipients", [
                        ...form.values.recipients,
                        query,
                      ]);
                      return query;
                    }}
                    {...form.getInputProps("recipients")}
                  />
                </Accordion.Panel>
              </Accordion.Item>
            ) : null}
            <Accordion.Item value="security">
              <Accordion.Control>
                <FormattedMessage id="upload.modal.accordion.security.title" />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack>
                  <PasswordInput
                    variant="filled"
                    placeholder={t(
                      "upload.modal.accordion.security.password.placeholder",
                    )}
                    label={t("upload.modal.accordion.security.password.label")}
                    autoComplete="new-password"
                    {...form.getInputProps("password")}
                  />
                  <NumberInput
                    min={1}
                    variant="filled"
                    placeholder={t(
                      "upload.modal.accordion.security.max-views.placeholder",
                    )}
                    label={t("upload.modal.accordion.security.max-views.label")}
                    {...form.getInputProps("maxViews")}
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="appearance">
              <Accordion.Control>Appearance</Accordion.Control>
              <Accordion.Panel>
                <ThemeColorPicker
                  value={form.values.accentColor}
                  onChange={(color) =>
                    form.setFieldValue("accentColor", color || defaultAccentColor)
                  }
                />
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="share-naming">
              <Accordion.Control>Share Naming</Accordion.Control>
              <Accordion.Panel>
                <Stack spacing="sm">
                  <Checkbox
                    label="Remove file extension from generated share names"
                    {...form.getInputProps("removeExtensionFromShareName", {
                      type: "checkbox",
                    })}
                  />
                  <TextInput
                    label="Share name prefix or template"
                    placeholder="Document - [filename]"
                    description="Use [filename] for the current file name or [basename] for the file name without the extension."
                    {...form.getInputProps("shareNamePrefix")}
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          <Button
            type="submit"
            data-autofocus
            styles={() => ({
              root: {
                height: 48,
                borderRadius: 12,
                background:
                  "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
                boxShadow: "0 14px 30px rgba(var(--ls-accent-rgb), 0.18)",
                fontWeight: 700,
                fontSize: 16,
              },
            })}
          >
            Create Separate Shares
          </Button>
        </Stack>
      </form>
    </Box>
  );
};

export default BulkShareSettingsModal;
