import { LoadingOverlay } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { GetServerSidePropsContext } from "next";
import { useEffect, useState } from "react";
import Upload from ".";
import showErrorModal from "../../components/share/showErrorModal";
import shareService from "../../services/share.service";
import useTranslate from "../../hooks/useTranslate.hook";

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { reverseShareToken: context.params!.reverseShareToken },
  };
}

const Share = ({ reverseShareToken }: { reverseShareToken: string }) => {
  const modals = useModals();
  const t = useTranslate();
  const [isLoading, setIsLoading] = useState(true);

  const [maxShareSize, setMaxShareSize] = useState(0);
  const [simplified, setSimplified] = useState(false);

  useEffect(() => {
    shareService
      .setReverseShare(reverseShareToken)
      .then((reverseShareTokenData) => {
        setMaxShareSize(parseInt(reverseShareTokenData.maxShareSize));
        setSimplified(reverseShareTokenData.simplified);
        setIsLoading(false);
      })
      .catch((error) => {
        const reason = error?.response?.data?.reason;
        const key =
          reason === "exhausted"
            ? "exhausted"
            : reason === "expired"
              ? "expired"
              : "invalid";

        showErrorModal(
          modals,
          t(`upload.reverse-share.error.${key}.title`),
          t(`upload.reverse-share.error.${key}.description`),
          "go-home",
        );
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return <LoadingOverlay visible />;

  return (
    <Upload
      isReverseShare
      maxShareSize={maxShareSize}
      simplified={simplified}
    />
  );
};

export default Share;
