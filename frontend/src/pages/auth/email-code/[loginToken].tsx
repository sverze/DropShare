import { useRouter } from "next/router";
import Meta from "../../../components/Meta";
import EmailCodeForm from "../../../components/auth/EmailCodeForm";

const EmailCode = () => {
  const router = useRouter();

  return (
    <>
      <Meta title="Verify sign-in" />
      <EmailCodeForm
        redirectPath={(router.query.redirect as string) || "/upload"}
        emailHint={(router.query.hint as string) || undefined}
      />
    </>
  );
};

export default EmailCode;
