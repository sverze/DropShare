import {
  Accordion,
  Alert,
  Box,
  Button,
  Checkbox,
  Col,
  Grid,
  Group,
  MultiSelect,
  NumberInput,
  PasswordInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { useModals } from "@mantine/modals";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import moment from "moment";
import React, { useEffect, useRef, useState } from "react";
import { TbAlertCircle, TbInfoCircle } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import * as yup from "yup";
import useTranslate, {
  translateOutsideContext,
} from "../../../hooks/useTranslate.hook";import userService from "../../../services/user.service";
import { FileUpload } from "../../../types/File.type";
import { CreateShare } from "../../../types/share.type";
import { getExpirationPreview } from "../../../utils/date.util";
import { generateAvailableLink, generateShareId } from "../../../utils/share-link.util";
import { getUserGroupMemberships } from "../../../utils/group-memberships.util";
import toast from "../../../utils/toast.util";
import { Timespan } from "../../../types/timespan.type";
import { defaultShareAccent } from "../../../theme/theme.util";
import useSiteTheme from "../../../theme/useSiteTheme";
import { getModalStyles } from "../../../utils/modalStyles.util";
import ThemeColorPicker from "../../share/ThemeColorPicker";
import useUser from "../../../hooks/user.hook";
import { CurrentUser } from "../../../types/user.type";
import BulkShareSettingsModal from "../bulk/BulkShareSettingsModal";
import { BulkShareOptions } from "../bulk/bulkUpload.util";

type UploadCallback = (..._args: [CreateShare, FileUpload[]]) => void;

type BulkModeProps = {
  defaultOptions: BulkShareOptions;
  groupName?: string | null;
  groupOptions: { value: string; label: string }[];
  onSubmit: (_options: BulkShareOptions) => void;
};

const getDefaultExpirationValues = (maxExpiration: Timespan) => {
  if (maxExpiration.value > 0) {
    return {
      expiration_num: Math.max(1, maxExpiration.value),
      expiration_unit: `-${maxExpiration.unit}`,
      never_expires: false,
    };
  }

  return {
    expiration_num: 5,
    expiration_unit: "-days",
    never_expires: false,
  };
};

const getDefaultExpirationString = (maxExpiration: Timespan) => {
  if (maxExpiration.value === 0) return "never";
  return `${Math.max(1, maxExpiration.value)}-${maxExpiration.unit}`;
};

const getModalPipeStyles = () => ({
  position: "relative" as const,
  borderRadius: 24,
});

const showCreateUploadModal = (
  modals: ModalsContextProps,
  options: {
    isUserSignedIn: boolean;
    isReverseShare: boolean;
    allowUnauthenticatedShares: boolean;
    enableEmailRecepients: boolean;
    maxExpiration: Timespan;
    shareIdLength: number;
    simplified: boolean;
    isDark: boolean;
    isLimitedRegisteredUser?: boolean;
  },
  files: FileUpload[],
  uploadCallback: UploadCallback,
  bulk?: BulkModeProps,
) => {
  const t = translateOutsideContext();

  if (options.simplified) {
    return modals.openModal({
      title: t("upload.modal.title"),
      size: "md",
      centered: true,
      styles: getModalStyles(options.isDark),
      children: (
        <SimplifiedCreateUploadModalModal
          options={options}
          files={files}
          uploadCallback={uploadCallback}
        />
      ),
    });
  }

  return modals.openModal({
    title: t("upload.modal.title"),
    size: "md",
    centered: true,
    styles: getModalStyles(options.isDark),
    children: bulk ? (
      <CreateUploadModalWithMode
        options={options}
        files={files}
        uploadCallback={uploadCallback}
        bulk={bulk}
      />
    ) : (
      <CreateUploadModalBody
        options={options}
        files={files}
        uploadCallback={uploadCallback}
      />
    ),
  });
};

const BULK_TOGGLE_NOTE =
  "Standard bundles every file into one share behind a single link. Bulk creates a separate share, and a separate link, for each file, then downloads a text file listing them all.";

const CreateUploadModalWithMode = ({
  uploadCallback,
  files,
  options,
  bulk,
}: {
  files: FileUpload[];
  uploadCallback: UploadCallback;
  options: {
    isUserSignedIn: boolean;
    isReverseShare: boolean;
    allowUnauthenticatedShares: boolean;
    enableEmailRecepients: boolean;
    maxExpiration: Timespan;
    shareIdLength: number;
    isLimitedRegisteredUser?: boolean;
  };
  bulk: BulkModeProps;
}) => {
  const [mode, setMode] = useState<"standard" | "bulk">("standard");

  return (
    <Box sx={getModalPipeStyles()}>
      <Group position="apart" align="center" mb="md" noWrap>
        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as "standard" | "bulk")}
          data={[
            { label: "Standard", value: "standard" },
            { label: "Bulk", value: "bulk" },
          ]}
        />
        <Tooltip
          label={BULK_TOGGLE_NOTE}
          multiline
          width={260}
          withArrow
          position="bottom-end"
          events={{ hover: true, focus: true, touch: true }}
        >
          <ThemeIcon variant="light" radius="xl" color="gray" size="md">
            <TbInfoCircle size={16} />
          </ThemeIcon>
        </Tooltip>
      </Group>
      {mode === "standard" ? (
        <CreateUploadModalBody
          options={options}
          files={files}
          uploadCallback={uploadCallback}
        />
      ) : (
        <BulkShareSettingsModal
          defaultOptions={bulk.defaultOptions}
          enableEmailRecepients={options.enableEmailRecepients}
          isUserSignedIn={options.isUserSignedIn}
          groupName={bulk.groupName}
          groupOptions={bulk.groupOptions}
          maxExpiration={options.maxExpiration}
          onSubmit={bulk.onSubmit}
          showBulkNote
        />
      )}
    </Box>
  );
};

const CreateUploadModalBody = ({
  uploadCallback,
  files,
  options,
}: {
  files: FileUpload[];
  uploadCallback: UploadCallback;
  options: {
    isUserSignedIn: boolean;
    isReverseShare: boolean;
    allowUnauthenticatedShares: boolean;
    enableEmailRecepients: boolean;
    maxExpiration: Timespan;
    shareIdLength: number;
    isLimitedRegisteredUser?: boolean;
  };
}) => {
  const modals = useModals();
  const t = useTranslate();
  const { user, refreshUser } = useUser();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(user);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const { presets } = useSiteTheme();
  const defaultAccentColor = defaultShareAccent(presets, isDark);
  const groupMemberships = getUserGroupMemberships(currentUser);
  const groupOptions = groupMemberships.map((membership) => ({
    value: membership.group.id,
    label: membership.group.name,
  }));
  const defaultGroupId = groupMemberships[0]?.group.id || null;

  const generatedLink = generateShareId(options.shareIdLength);
  const defaultExpiration = getDefaultExpirationValues(options.maxExpiration);

  const [showNotSignedInAlert, setShowNotSignedInAlert] = useState(true);

  const validationSchema = yup.object().shape({
    link: yup
      .string()
      .required(t("common.error.field-required"))
      .min(3, t("common.error.too-short", { length: 3 }))
      .max(50, t("common.error.too-long", { length: 50 }))
      .matches(new RegExp("^[a-zA-Z0-9_-]*$"), {
        message: t("upload.modal.link.error.invalid"),
      }),
    name: yup
      .string()
      .transform((value) => value || undefined)
      .min(3, t("common.error.too-short", { length: 3 })),
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
      name: undefined,
      link: generatedLink,
      recipients: [] as string[],
      password: undefined,
      maxViews: undefined,
      description: undefined,
      expiration_num: defaultExpiration.expiration_num,
      expiration_unit: defaultExpiration.expiration_unit,
      never_expires: defaultExpiration.never_expires,
      accentColor: defaultAccentColor,
      previewStyle: "full" as "full" | "consolidated",
      shareWithGroup: getUserGroupMemberships(user).length > 0,
      groupId: getUserGroupMemberships(user)[0]?.group.id || null,
    },
    validate: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!options.isUserSignedIn) return;

    refreshUser()
      .then((freshUser) => {
        if (freshUser) {
          setCurrentUser(freshUser);
        }
      })
      .catch(() => null);
  }, [options.isUserSignedIn, refreshUser]);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  useEffect(() => {
    if (!options.isUserSignedIn) {
      setCurrentUser(null);
      return;
    }

    userService
      .getCurrentUser()
      .then((freshUser) => {
        if (freshUser) {
          setCurrentUser(freshUser);
          const memberships = getUserGroupMemberships(freshUser);
          if (memberships.length > 0) {
            form.setFieldValue("shareWithGroup", true);
            form.setFieldValue("groupId", form.values.groupId || memberships[0].group.id);
          }
        }
      })
      .catch(() => null);
  }, [options.isUserSignedIn]);

  const onSubmit = form.onSubmit(async (values) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    const expirationString = form.values.never_expires
      ? "never"
      : form.values.expiration_num + form.values.expiration_unit;

    const expirationDate = moment().add(
      form.values.expiration_num,
      form.values.expiration_unit.replace(
        "-",
        "",
      ) as moment.unitOfTime.DurationConstructor,
    );

    if (
      options.maxExpiration.value != 0 &&
      (form.values.never_expires ||
        expirationDate.isAfter(
          moment().add(
            options.maxExpiration.value,
            options.maxExpiration.unit,
          ),
        ))
    ) {
      form.setFieldError(
        "expiration_num",
        t("upload.modal.expires.error.too-long", {
          max: moment
            .duration(options.maxExpiration.value, options.maxExpiration.unit)
            .humanize(),
        }),
      );
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }

    uploadCallback(
      {
        id: values.link,
        name: values.name,
        expiration: expirationString,
        recipients: values.recipients,
        description: values.description,
        accentColor: values.accentColor,
        previewStyle: values.previewStyle,
        shareWithGroup: options.isReverseShare ? false : values.shareWithGroup,
        groupId:
          options.isReverseShare || !values.shareWithGroup
            ? null
            : values.groupId || defaultGroupId,
        security: {
          password: values.password || undefined,
          maxViews: values.maxViews || undefined,
        },
      },
      files,
    );
    modals.closeAll();
  });

  return (
    <Box sx={getModalPipeStyles()}>
      {showNotSignedInAlert && !options.isUserSignedIn && (
        <Alert
          withCloseButton
          onClose={() => setShowNotSignedInAlert(false)}
          icon={<TbAlertCircle size={16} />}
          title={t("upload.modal.not-signed-in")}
          color="yellow"
        >
          <FormattedMessage id="upload.modal.not-signed-in-description" />
        </Alert>
      )}
      <form onSubmit={onSubmit}>
        <Stack align="stretch" spacing="md">
          <Group align={form.errors.link ? "center" : "flex-end"}>
            <TextInput
              style={{ flex: "1" }}
              variant="filled"
              label={t("upload.modal.link.label")}
              placeholder="myAwesomeShare"
              {...form.getInputProps("link")}
            />
            <Button
              style={{ flex: "0 0 auto" }}
              variant="outline"
              onClick={() =>
                form.setFieldValue(
                  "link",
                  generateShareId(options.shareIdLength),
                )
              }
            >
              <FormattedMessage id="common.button.generate" />
            </Button>
          </Group>

          <Text
            truncate
            italic
            size="xs"
            sx={(theme) => ({
              color: theme.colors.gray[6],
            })}
          >
            {`${window.location.origin}/s/${form.values.link}`}
          </Text>
          {!options.isReverseShare && (
            <>
              <Grid align={form.errors.expiration_num ? "center" : "flex-end"}>
                <Col xs={6}>
                  <NumberInput
                    min={1}
                    max={99999}
                    precision={0}
                    variant="filled"
                    label={t("upload.modal.expires.label")}
                    disabled={form.values.never_expires}
                    {...form.getInputProps("expiration_num")}
                  />
                </Col>
                <Col xs={6}>
                  <Select
                    disabled={form.values.never_expires}
                    {...form.getInputProps("expiration_unit")}
                    data={[
                      {
                        value: "-minutes",
                        label:
                          form.values.expiration_num == 1
                            ? t("upload.modal.expires.minute-singular")
                            : t("upload.modal.expires.minute-plural"),
                      },
                      {
                        value: "-hours",
                        label:
                          form.values.expiration_num == 1
                            ? t("upload.modal.expires.hour-singular")
                            : t("upload.modal.expires.hour-plural"),
                      },
                      {
                        value: "-days",
                        label:
                          form.values.expiration_num == 1
                            ? t("upload.modal.expires.day-singular")
                            : t("upload.modal.expires.day-plural"),
                      },
                      {
                        value: "-weeks",
                        label:
                          form.values.expiration_num == 1
                            ? t("upload.modal.expires.week-singular")
                            : t("upload.modal.expires.week-plural"),
                      },
                      {
                        value: "-months",
                        label:
                          form.values.expiration_num == 1
                            ? t("upload.modal.expires.month-singular")
                            : t("upload.modal.expires.month-plural"),
                      },
                      {
                        value: "-years",
                        label:
                          form.values.expiration_num == 1
                            ? t("upload.modal.expires.year-singular")
                            : t("upload.modal.expires.year-plural"),
                      },
                    ]}
                  />
                </Col>
              </Grid>
              {options.maxExpiration.value == 0 && (
                <Stack spacing={6}>
                  <Checkbox
                    label={t("upload.modal.expires.never-long")}
                    {...form.getInputProps("never_expires", { type: "checkbox" })}
                  />
                  {groupOptions.length > 0 ? (
                    <Stack spacing={8}>
                      <Checkbox
                        label="Add to group"
                        {...form.getInputProps("shareWithGroup", { type: "checkbox" })}
                      />
                      {form.values.shareWithGroup ? (
                        <Select
                          label="Group"
                          data={groupOptions}
                          value={form.values.groupId || defaultGroupId}
                          onChange={(value) => form.setFieldValue("groupId", value)}
                          withinPortal
                        />
                      ) : null}
                    </Stack>
                  ) : null}
                </Stack>
              )}
              <Text
                italic
                size="xs"
                sx={(theme) => ({
                  color: theme.colors.gray[6],
                })}
              >
                {getExpirationPreview(
                  {
                    neverExpires: t("upload.modal.completed.never-expires"),
                    expiresOn: t("upload.modal.completed.expires-on"),
                  },
                  form,
                )}
              </Text>
            </>
          )}
          <Accordion>
            <Accordion.Item value="description" sx={{ borderBottom: "none" }}>
              <Accordion.Control>
                <FormattedMessage id="upload.modal.accordion.name-and-description.title" />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack align="stretch">
                  <TextInput
                    variant="filled"
                    placeholder={t(
                      "upload.modal.accordion.name-and-description.name.placeholder",
                    )}
                    {...form.getInputProps("name")}
                  />
                  <Textarea
                    variant="filled"
                    placeholder={t(
                      "upload.modal.accordion.name-and-description.description.placeholder",
                    )}
                    {...form.getInputProps("description")}
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
            {options.enableEmailRecepients && (
              <Accordion.Item value="recipients" sx={{ borderBottom: "none" }}>
                <Accordion.Control>
                  <FormattedMessage id="upload.modal.accordion.email.title" />
                </Accordion.Control>
                <Accordion.Panel>
                  <MultiSelect
                    data={form.values.recipients}
                    placeholder={t("upload.modal.accordion.email.placeholder")}
                    searchable
                    creatable
                    id="recipient-emails"
                    inputMode="email"
                    getCreateLabel={(query) => `+ ${query}`}
                    onCreate={(query) => {
                      if (!query.match(/^\S+@\S+\.\S+$/)) {
                        form.setFieldError(
                          "recipients",
                          t("upload.modal.accordion.email.invalid-email"),
                        );
                      } else {
                        form.setFieldError("recipients", null);
                        form.setFieldValue("recipients", [
                          ...form.values.recipients,
                          query,
                        ]);
                        return query;
                      }
                    }}
                    {...form.getInputProps("recipients")}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter" || e.key === "," || e.key === ";") {
                        e.preventDefault();
                        const inputValue = (
                          e.target as HTMLInputElement
                        ).value.trim();
                        if (inputValue.match(/^\S+@\S+\.\S+$/)) {
                          form.setFieldValue("recipients", [
                            ...form.values.recipients,
                            inputValue,
                          ]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      } else if (e.key === " ") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                </Accordion.Panel>
              </Accordion.Item>
            )}

            <Accordion.Item value="security" sx={{ borderBottom: "none" }}>
              <Accordion.Control>
                <FormattedMessage id="upload.modal.accordion.security.title" />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack align="stretch">
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
                    type="number"
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

            <Accordion.Item value="appearance" sx={{ borderBottom: "none" }}>
              <Accordion.Control>
                Appearance
              </Accordion.Control>
              <Accordion.Panel>
                <Stack spacing="md">
                  <ThemeColorPicker
                    value={form.values.accentColor}
                    onChange={(color) =>
                      form.setFieldValue("accentColor", color || defaultAccentColor)
                    }
                  />
                  {!options.isReverseShare && (
                    <Select
                      label="Preview style"
                      description="Full shows file info on each card. Consolidated keeps cards slimmer and moves details into the info button."
                      data={[
                        { value: "full", label: "Full preview" },
                        { value: "consolidated", label: "Consolidated preview" },
                      ]}
                      {...form.getInputProps("previewStyle")}
                    />
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
            data-autofocus
            styles={() => ({
              root: {
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
                boxShadow: "0 14px 30px rgba(var(--ls-accent-rgb), 0.18)",
                fontWeight: 700,
                fontSize: 16,
              },
            })}
          >
            <FormattedMessage id="common.button.share" />
          </Button>
        </Stack>
      </form>
    </Box>
  );
};

const SimplifiedCreateUploadModalModal = ({
  uploadCallback,
  files,
  options,
}: {
  files: FileUpload[];
  uploadCallback: UploadCallback;
  options: {
    isUserSignedIn: boolean;
    isReverseShare: boolean;
    allowUnauthenticatedShares: boolean;
    enableEmailRecepients: boolean;
    maxExpiration: Timespan;
    shareIdLength: number;
    isLimitedRegisteredUser?: boolean;
  };
}) => {
  const modals = useModals();
  const t = useTranslate();
  const { user, refreshUser } = useUser();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(user);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const { presets } = useSiteTheme();
  const defaultAccentColor = defaultShareAccent(presets, isDark);
  const groupMemberships = getUserGroupMemberships(currentUser);
  const groupOptions = groupMemberships.map((membership) => ({
    value: membership.group.id,
    label: membership.group.name,
  }));
  const defaultGroupId = groupMemberships[0]?.group.id || null;

  const [showNotSignedInAlert, setShowNotSignedInAlert] = useState(true);

  const validationSchema = yup.object().shape({
    name: yup
      .string()
      .transform((value) => value || undefined)
      .min(3, t("common.error.too-short", { length: 3 })),
  });

  const form = useForm({
    initialValues: {
      name: undefined,
      description: undefined,
      previewStyle: "full" as "full" | "consolidated",
      shareWithGroup: getUserGroupMemberships(user).length > 0,
      groupId: getUserGroupMemberships(user)[0]?.group.id || null,
    },
    validate: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!options.isUserSignedIn) {
      setCurrentUser(null);
      return;
    }

    refreshUser()
      .then((freshUser) => {
        if (freshUser) {
          setCurrentUser(freshUser);
          const memberships = getUserGroupMemberships(freshUser);
          if (memberships.length > 0) {
            form.setFieldValue("shareWithGroup", true);
            form.setFieldValue("groupId", form.values.groupId || memberships[0].group.id);
          }
        }
      })
      .catch(() => null);
  }, [options.isUserSignedIn, refreshUser]);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  useEffect(() => {
    if (!options.isUserSignedIn) return;

    userService
      .getCurrentUser()
      .then((freshUser) => {
        if (freshUser) {
          setCurrentUser(freshUser);
          const memberships = getUserGroupMemberships(freshUser);
          if (memberships.length > 0) {
            form.setFieldValue("shareWithGroup", true);
            form.setFieldValue("groupId", form.values.groupId || memberships[0].group.id);
          }
        }
      })
      .catch(() => null);
  }, [options.isUserSignedIn]);

  const onSubmit = form.onSubmit(async (values) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    const link = await generateAvailableLink(options.shareIdLength).catch(
      () => {
        toast.error(t("upload.modal.link.error.taken"));
        return undefined;
      },
    );

    if (!link) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }

    uploadCallback(
      {
        id: link,
        name: values.name,
        expiration: getDefaultExpirationString(options.maxExpiration),
        recipients: [],
        description: values.description,
        accentColor: defaultAccentColor,
        previewStyle: values.previewStyle,
        shareWithGroup: options.isReverseShare ? false : values.shareWithGroup,
        groupId:
          options.isReverseShare || !values.shareWithGroup
            ? null
            : values.groupId || defaultGroupId,
        security: {
          password: undefined,
          maxViews: undefined,
        },
      },
      files,
    );
    modals.closeAll();
  });

  return (
    <Box sx={getModalPipeStyles()}>
      <Stack spacing="md">
      {showNotSignedInAlert && !options.isUserSignedIn && (
        <Alert
          withCloseButton
          onClose={() => setShowNotSignedInAlert(false)}
          icon={<TbAlertCircle size={16} />}
          title={t("upload.modal.not-signed-in")}
          color="yellow"
        >
          <FormattedMessage id="upload.modal.not-signed-in-description" />
        </Alert>
      )}
      <form onSubmit={onSubmit}>
        <Stack align="stretch" spacing="md">
          <Stack align="stretch" spacing="sm">
          <TextInput
            variant="filled"
            placeholder={t(
              "upload.modal.accordion.name-and-description.name.placeholder",
            )}
            {...form.getInputProps("name")}
          />
          {!options.isReverseShare && groupOptions.length > 0 ? (
            <Stack spacing={8}>
              <Checkbox
                label="Add to group"
                {...form.getInputProps("shareWithGroup", { type: "checkbox" })}
              />
              {form.values.shareWithGroup ? (
                <Select
                  label="Group"
                  data={groupOptions}
                  value={form.values.groupId || defaultGroupId}
                  onChange={(value) => form.setFieldValue("groupId", value)}
                  withinPortal
                />
              ) : null}
            </Stack>
          ) : null}
          <Textarea
              variant="filled"
              placeholder={t(
                "upload.modal.accordion.name-and-description.description.placeholder",
              )}
              {...form.getInputProps("description")}
            />
          {!options.isReverseShare && (
            <Select
              label="Preview style"
              description="Full shows file info on each card. Consolidated keeps cards slimmer and moves details into the info button."
              data={[
                { value: "full", label: "Full preview" },
                { value: "consolidated", label: "Consolidated preview" },
              ]}
              {...form.getInputProps("previewStyle")}
            />
          )}
          </Stack>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
            data-autofocus
            styles={() => ({
              root: {
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
                boxShadow: "0 14px 30px rgba(var(--ls-accent-rgb), 0.18)",
                fontWeight: 700,
                fontSize: 16,
              },
            })}
          >
            <FormattedMessage id="common.button.share" />
          </Button>
        </Stack>
      </form>
      </Stack>
    </Box>
  );
};

export default showCreateUploadModal;
