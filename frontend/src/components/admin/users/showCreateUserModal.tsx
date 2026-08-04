import {
  Button,
  Group,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import { FormattedMessage } from "react-intl";
import { useState } from "react";
import * as yup from "yup";
import useTranslate from "../../../hooks/useTranslate.hook";
import useUser from "../../../hooks/user.hook";
import userService from "../../../services/user.service";
import { AccessLevel } from "../../../types/user.type";
import toast from "../../../utils/toast.util";

const parseSizeToBytes = (value: number | null, unit: string): string | null => {
  if (value === null || value === undefined || value === 0) return null;
  const multipliers: Record<string, number> = {
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  return String(Math.round(value * multipliers[unit]));
};

const showCreateUserModal = (
  modals: ModalsContextProps,
  smtpEnabled: boolean,
  getUsers: () => void,
) => {
  return modals.openModal({
    title: "Create user",
    children: (
      <Body modals={modals} smtpEnabled={smtpEnabled} getUsers={getUsers} />
    ),
  });
};

const Body = ({
  modals,
  smtpEnabled,
  getUsers,
}: {
  modals: ModalsContextProps;
  smtpEnabled: boolean;
  getUsers: () => void;
}) => {
  const t = useTranslate();
  const { user: currentUser } = useUser();
  const [shareLimitValue, setShareLimitValue] = useState<number | null>(null);
  const [shareLimitUnit, setShareLimitUnit] = useState<string>("GB");

  const form = useForm({
    initialValues: {
      username: "",
      email: "",
      password: undefined,
      role: "user",
      setPasswordManually: false,
    },
    validate: yupResolver(
      yup.object().shape({
        email: yup.string().email(t("common.error.invalid-email")),
        username: yup
          .string()
          .min(3, t("common.error.too-short", { length: 3 })),
        password: yup
          .string()
          .min(8, t("common.error.too-short", { length: 8 }))
          .optional(),
      }),
    ),
  });

  return (
    <Stack>
      <form
        onSubmit={form.onSubmit(async (values) => {
          const maxFileSizeOverride = parseSizeToBytes(shareLimitValue, shareLimitUnit);
          userService
            .create({
              ...values,
              role: values.role as AccessLevel,
              maxFileSizeOverride,
            })
            .then(() => {
              getUsers();
              modals.closeAll();
            })
            .catch(toast.axiosError);
        })}
      >
        <Stack>
          <TextInput
            label={t("admin.users.modal.create.username")}
            {...form.getInputProps("username")}
          />
          <TextInput
            label={t("admin.users.modal.create.email")}
            {...form.getInputProps("email")}
          />
          {smtpEnabled && (
            <Switch
              mt="xs"
              labelPosition="left"
              label={t("admin.users.modal.create.manual-password")}
              description={t(
                "admin.users.modal.create.manual-password.description",
              )}
              {...form.getInputProps("setPasswordManually", {
                type: "checkbox",
              })}
            />
          )}
          {(form.values.setPasswordManually || !smtpEnabled) && (
            <PasswordInput
              label={t("admin.users.modal.create.password")}
              {...form.getInputProps("password")}
            />
          )}
          {currentUser?.isAdmin && (
            <Select
              mt="xs"
              label="Access level"
              description="Admin = full access. Manager = only granted capabilities. Basic User = no admin access."
              data={[
                { value: "admin", label: "Admin" },
                { value: "manager", label: "Manager" },
                { value: "user", label: "Basic User" },
              ]}
              {...form.getInputProps("role")}
            />
          )}
          
          <Text size="sm" weight={500} mt="md">
            Max Share Size
          </Text>
          <Text size="xs" color="dimmed" mb="xs">
            Custom limit for this user. Leave empty to use the shared default from admin configuration.
          </Text>
          <Group spacing="xs" grow>
            <NumberInput
              placeholder="Use default"
              min={0}
              precision={2}
              value={shareLimitValue ?? ""}
              onChange={(val) => setShareLimitValue(val === "" ? null : Number(val))}
            />
            <Select
              data={[
                { value: "MB", label: "MB" },
                { value: "GB", label: "GB" },
                { value: "TB", label: "TB" },
              ]}
              value={shareLimitUnit}
              onChange={(val) => setShareLimitUnit(val || "GB")}
              sx={{ maxWidth: 80 }}
            />
          </Group>

          <Group position="right" mt="md">
            <Button type="submit">
              <FormattedMessage id="common.button.create" />
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
};

export default showCreateUserModal;
