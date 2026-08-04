import {
  Anchor,
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

function EmailCodeForm({
  redirectPath,
  emailHint,
}: {
  redirectPath: string;
  emailHint?: string;
}) {
  const t = useTranslate();
  const router = useRouter();
  const { refreshUser } = useUser();

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const validationSchema = yup.object().shape({
    code: yup
      .string()
      .min(6, t("common.error.too-short", { length: 6 }))
      .required(t("common.error.field-required")),
  });

  const form = useForm({
    initialValues: { code: "" },
    validate: yupResolver(validationSchema),
  });

  const handlePostSignInRedirect = async (targetPath: string) => {
    router.replace(safeRedirectPath(targetPath));
  };

  const restartIfExpired = (e: unknown): boolean => {
    if ((e as { response?: { status?: number } })?.response?.status === 401) {
      toast.error("That sign-in code expired. Please sign in again.");
      router.replace(
        `/auth/signIn?redirect=${encodeURIComponent(redirectPath)}`,
      );
      return true;
    }
    return false;
  };

  const onSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await authService.signInEmailCode(
        form.values.code,
        router.query.loginToken as string,
      );
      await refreshUser();
      await handlePostSignInRedirect(redirectPath);
    } catch (e) {
      if (!restartIfExpired(e)) {
        toast.axiosError(e);
        form.setFieldError("code", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await authService.resendEmailCode(router.query.loginToken as string);
      toast.success("We sent a new code to your email.");
      form.setFieldValue("code", "");
    } catch (e) {
      if (!restartIfExpired(e)) toast.axiosError(e);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthPageShell>
    <Container size={420} my={40}>
      <Title order={2} align="center" weight={900}>
        Check your email
      </Title>
      <Text color="dimmed" size="sm" align="center" mt={5}>
        Enter the 6-digit code we sent
        {emailHint ? ` to ${emailHint}` : ""}. It expires in 10 minutes.
      </Text>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(onSubmit)}>
          <Group position="center">
            <PinInput
              length={6}
              oneTimeCode
              type="number"
              aria-label="Email verification code"
              autoFocus={true}
              onComplete={onSubmit}
              {...form.getInputProps("code")}
            />
            <Button mt="md" type="submit" loading={loading}>
              Verify
            </Button>
          </Group>
        </form>
        <Group position="center" mt="lg" spacing={6}>
          <Text size="xs" color="dimmed">
            Didn&apos;t get it?
          </Text>
          <Anchor
            size="xs"
            component="button"
            type="button"
            onClick={onResend}
            disabled={resending}
          >
            {resending ? "Sending…" : "Resend code"}
          </Anchor>
        </Group>
      </Paper>
    </Container>
    </AuthPageShell>
  );
}

export default EmailCodeForm;
