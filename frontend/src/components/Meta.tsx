import Head from "next/head";
import useConfig from "../hooks/config.hook";

const Meta = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => {
  const config = useConfig();

  const metaTitle = `${title} - ${config.get("general.appName")}`;
  const metaDescription = description ?? "Secure file sharing made simple.";

  return (
    <Head>
      <title>{metaTitle}</title>
      
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      
      <meta name="description" content={metaDescription} />
    </Head>
  );
};

export default Meta;
