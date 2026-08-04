export const getModalStyles = (isDark: boolean) => ({
  content: {
    position: "relative" as const,
    background:
      "linear-gradient(115deg, var(--ls-ring-outer) 0%, var(--ls-ring-inner) 22%, var(--ls-ring-center) 50%, var(--ls-ring-inner) 78%, var(--ls-ring-outer) 100%)",
    backgroundSize: "220% 220%",
    backgroundPosition: "0% 50%",
    border: "none",
    boxShadow: isDark
      ? "0 24px 80px rgba(0, 0, 0, 0.52), 0 0 24px rgba(var(--ls-ring-outer-rgb), 0.28), 0 0 42px rgba(var(--ls-ring-center-rgb), 0.18)"
      : "0 24px 80px rgba(15, 23, 42, 0.16), 0 0 24px rgba(var(--ls-ring-outer-rgb), 0.12)",
    borderRadius: 30,
    overflow: "hidden" as const,
    padding: 3,
    "@keyframes dropshare-modal-gradient": {
      "0%": {
        backgroundPosition: "0% 50%",
      },
      "50%": {
        backgroundPosition: "100% 50%",
      },
      "100%": {
        backgroundPosition: "0% 50%",
      },
    },
    animation: "dropshare-modal-gradient 8s ease-in-out infinite",
  },
  inner: {
    padding: 24,
  },
  header: {
    background: isDark
      ? "rgba(27, 29, 33, 0.985)"
      : "rgba(250, 250, 250, 0.985)",
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  close: {
    color: "var(--ls-modal-close)",
    "&:hover": {
      background: `rgba(var(--ls-modal-close-hover-rgb), ${isDark ? 0.1 : 0.08})`,
    },
  },
  body: {
    paddingTop: 8,
    background: isDark
      ? "rgba(27, 29, 33, 0.985)"
      : "rgba(250, 250, 250, 0.985)",
    borderBottomLeftRadius: 27,
    borderBottomRightRadius: 27,
  },
});
