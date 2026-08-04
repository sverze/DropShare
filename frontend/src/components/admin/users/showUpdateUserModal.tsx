import {
  Accordion,
  Button,
  Group,
  PasswordInput,
  Stack,
  Switch,
  TextInput,
  NumberInput,
  Select,
  Text,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import { FormattedMessage } from "react-intl";
import { useState } from "react";
import * as yup from "yup";
import useTranslate, {
  translateOutsideContext,
} from "../../../hooks/useTranslate.hook";
import useUser from "../../../hooks/user.hook";
import userService from "../../../services/user.service";
import User from "../../../types/user.type";
import toast from "../../../utils/toast.util";

const showUpdateUserModal = (
  modals: ModalsContextProps,
  user: User,
  getUsers: () => void,
) => {
  const t = translateOutsideContext();
  return modals.openModal({
    title: t("admin.users.edit.update.title", { username: user.username }),
    children: <Body user={user} modals={modals} getUsers={getUsers} />,
  });
};

const parseSizeToBytes = (value: number | null, unit: string): string | null => {
  if (value === null || value === undefined || value === 0) return null;
  const multipliers: Record<string, number> = {
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  return String(Math.round(value * multipliers[unit]));
};

const bytesToDisplay = (bytes: string | null | undefined): { value: number | null; unit: string } => {
  if (!bytes) return { value: null, unit: "GB" };
  const num = Number(bytes);
  if (num >= 1024 ** 4) {
    return { value: num / 1024 ** 4, unit: "TB" };
  }
  if (num >= 1024 ** 3) {
    return { value: num / 1024 ** 3, unit: "GB" };
  }
  return { value: num / 1024 ** 2, unit: "MB" };
};

const Body = ({
  user,
  modals,
  getUsers,
}: {
  modals: ModalsContextProps;
  user: User;
  getUsers: () => void;
}) => {
  const t = useTranslate();
  const { user: currentUser } = useUser();

  const initialUpload = bytesToDisplay(user.maxFileSizeOverride);
  const [shareLimitValue, setShareLimitValue] = useState<number | null>(initialUpload.value);
  const [shareLimitUnit, setShareLimitUnit] = useState<string>(initialUpload.unit);

  const accountForm = useForm({
    initialValues: {
      username: user.username,
      email: user.email,
      role: user.role ?? (user.isAdmin ? "admin" : "user"),
      protected: user.protected ?? false,
    },
    validate: yupResolver(
      yup.object().shape({
        email: yup.string().email(t("common.error.invalid-email")),
        username: yup
          .string()
          .min(3, t("common.error.too-short", { length: 3 })),
      }),
    ),
  });

  const passwordForm = useForm({
    initialValues: {
      password: "",
    },
    validate: yupResolver(
      yup.object().shape({
        password: yup
          .string()
          .min(8, t("common.error.too-short", { length: 8 })),
      }),
    ),
  });

  return (
    <Stack>
      <form
        id="accountForm"
        onSubmit={accountForm.onSubmit(async (values) => {
          const maxFileSizeOverride = parseSizeToBytes(shareLimitValue, shareLimitUnit);
          userService
            .update(user.id, { ...values, maxFileSizeOverride })
            .then(() => {
              getUsers();
              modals.closeAll();
            })
            .catch(toast.axiosError);
        })}
      >
        <Stack>
          <TextInput
            label={t("admin.users.table.username")}
            {...accountForm.getInputProps("username")}
          />
          <TextInput
            label={t("admin.users.table.email")}
            {...accountForm.getInputProps("email")}
          />
          {currentUser?.isAdmin && (
            <Select
              mt="xs"
              label="Access level"
              description="Admin = full access. Manager = only what you grant on Access Levels. Basic User = no admin access."
              data={[
                { value: "admin", label: "Admin" },
                { value: "manager", label: "Manager" },
                { value: "user", label: "Basic User" },
              ]}
              {...accountForm.getInputProps("role")}
            />
          )}
          {currentUser?.protected && (
            <Switch
              mt="xs"
              label="Protected owner account"
              description="Protected accounts can only be changed or removed by another protected admin. Only you (a protected admin) can grant or revoke this."
              checked={accountForm.values.protected}
              {...accountForm.getInputProps("protected", { type: "checkbox" })}
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
        </Stack>
      </form>
      <Accordion>
        <Accordion.Item sx={{ borderBottom: "none" }} value="changePassword">
          <Accordion.Control px={0}>
            <FormattedMessage id="admin.users.edit.update.change-password.title" />
          </Accordion.Control>
          <Accordion.Panel>
            <form
              onSubmit={passwordForm.onSubmit(async (values) => {
                userService
                  .update(user.id, {
                    password: values.password,
                  })
                  .then(() =>
                    toast.success(
                      t("admin.users.edit.update.notify.password.success"),
                    ),
                  )
                  .catch(toast.axiosError);
              })}
            >
              <Stack>
                <PasswordInput
                  label={t("admin.users.edit.update.change-password.field")}
                  {...passwordForm.getInputProps("password")}
                />
                <Button variant="light" type="submit">
                  <FormattedMessage id="admin.users.edit.update.change-password.button" />
                </Button>
              </Stack>
            </form>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <Group position="right">
        <Button type="submit" form="accountForm">
          <FormattedMessage id="common.button.save" />
        </Button>
      </Group>
    </Stack>
  );
};

export default showUpdateUserModal;
