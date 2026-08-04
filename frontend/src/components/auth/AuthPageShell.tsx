import { Box, createStyles } from "@mantine/core";
import { ReactNode } from "react";

const useStyles = createStyles(() => ({
  authPage: {
    minHeight: "100dvh",
    margin: 0,
    padding: "72px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at 20% 12%, rgba(var(--ls-accent-rgb), 0.28), transparent 34%), radial-gradient(circle at 78% 20%, rgba(var(--ls-accent-rgb), 0.14), transparent 32%), var(--ls-page-base)",
  },
}));

const AuthPageShell = ({ children }: { children: ReactNode }) => {
  const { classes } = useStyles();
  return <Box className={classes.authPage}>{children}</Box>;
};

export default AuthPageShell;
