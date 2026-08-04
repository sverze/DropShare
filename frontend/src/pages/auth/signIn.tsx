import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Center, Loader, Text } from "@mantine/core";
import Meta from "../../components/Meta";
import SignInForm from "../../components/auth/SignInForm";
import useUser from "../../hooks/user.hook";
import {
  getAuthClient,
  getAuthClientFromRedirect,
} from "../../utils/auth-client.util";
import { safeRedirectPath } from "../../utils/router.util";

const SignIn = () => {
  const router = useRouter();
  const { user } = useUser();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [hasCheckedUser, setHasCheckedUser] = useState(false);

  const explicitClient = router.query.client;
  const rawRedirect = router.query.redirect || router.query.returnUrl;
  const redirect = Array.isArray(rawRedirect) ? rawRedirect[0] : rawRedirect;
  const authClient = explicitClient
    ? getAuthClient(explicitClient)
    : getAuthClientFromRedirect(redirect || "/upload");
  const redirectPath = redirect || "/upload";

  useEffect(() => {
    setHasCheckedUser(true);
  }, []);

  useEffect(() => {
    if (!hasCheckedUser) return;

    if (user) {
      setIsRedirecting(true);
      router.replace(safeRedirectPath(redirectPath));
    }
  }, [user, hasCheckedUser, redirectPath, router]);

  if (isRedirecting) {
    return (
      <Center style={{ height: "50vh" }}>
        <Loader size="lg" />
        <Text ml="md" color="dimmed">
          Redirecting...
        </Text>
      </Center>
    );
  }

  return (
    <>
      <Meta title="Sign In" />
      <SignInForm redirectPath={redirectPath} authClient={authClient} />
    </>
  );
};

export default SignIn;
