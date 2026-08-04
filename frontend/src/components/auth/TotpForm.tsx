import {
  Button,
  Container,
  Group,
  Paper,
  PinInput,
  Text,
  Title,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { useRouter } from "next/router";
import { useState } from "react";
import * as yup from "yup";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import authService from "../../services/auth.service";
import { safeRedirectPath } from "../../utils/router.util";
import toast from "../../utils/toast.util";
import AuthPageShell from "./AuthPageShell";

function TotpForm({ redirectPath }: { redirectPath: string }) {
  const t = useTranslate();
  const router = useRouter();
  const { refreshUser } = useUser();

  const [loading, setLoading] = useState(false);

  const validationSchema = yup.object().shape({
    code: yup
      .string()
      .min(6, t("common.error.too-short", { length: 6 }))
      .required(t("common.error.field-required")),
  });

  const form = useForm({
    initialValues: {
      code: "",
    },
    validate: yupResolver(validationSchema),
  });

  const handlePostSignInRedirect = async (targetPath: string) => {
    router.replace(safeRedirectPath(targetPath));
  };

  const onSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await authService.signInTotp(
        form.values.code,
        router.query.loginToken as string,
      );
      await refreshUser();
      await handlePostSignInRedirect(redirectPath);
    } catch (e) {
      toast.axiosError(e);
      form.setFieldError("code", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell>
    <Container size={420} my={40}>
      <Title order={2} align="center" weight={900}>
        Two-Factor Authentication
      </Title>
      <Text color="dimmed" size="sm" align="center" mt={5}>
        Enter the 6-digit code from your authenticator app
      </Text>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(onSubmit)}>
          <Group position="center">
            <PinInput
              length={6}
              oneTimeCode
              aria-label="2FA code"
              autoFocus={true}
              onComplete={onSubmit}
              {...form.getInputProps("code")}
            />
            <Button mt="md" type="submit" loading={loading}>
              Verify
            </Button>
          </Group>
        </form>
      </Paper>
    </Container>
    </AuthPageShell>
  );
}

export default TotpForm;
