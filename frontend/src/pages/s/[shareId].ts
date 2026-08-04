import { GetServerSidePropsContext } from "next";

export function getServerSideProps(context: GetServerSidePropsContext) {
  const { shareId } = context.params!;

  return {
    props: {},
    redirect: {
      permanent: false,
      destination: "/share/" + shareId,
    },
  };
}

export default function ShareAlias() {
  return null;
}
