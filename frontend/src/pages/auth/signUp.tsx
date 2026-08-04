import SignUpForm from "../../components/auth/SignUpForm";
import Meta from "../../components/Meta";
import useTranslate from "../../hooks/useTranslate.hook";
import { useRouter } from "next/router";
import {
  getAuthClient,
  getAuthClientFromRedirect,
} from "../../utils/auth-client.util";

const SignUp = () => {
  const t = useTranslate();
  const router = useRouter();
  const explicitClient = router.query.client;
  const rawRedirect = router.query.redirect || router.query.returnUrl;
  const redirect = Array.isArray(rawRedirect) ? rawRedirect[0] : rawRedirect;
  const authClient = explicitClient
    ? getAuthClient(explicitClient)
    : getAuthClientFromRedirect(redirect || "/upload");

  return (
    <>
      <Meta title={t("signup.title")} />
      <SignUpForm authClient={authClient} />
    </>
  );
};
export default SignUp;
