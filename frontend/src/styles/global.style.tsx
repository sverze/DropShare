import { Global } from "@mantine/core";

interface GlobalStyleProps {
  disableDefaultAtmosphere?: boolean;
}

const GlobalStyle = ({ disableDefaultAtmosphere = false }: GlobalStyleProps) => {
  return (
    <Global
      styles={(theme) => {
        return {
        "@keyframes lightModeRibbonDrift": {
          "0%": { transform: "translate3d(0%, 0%, 0) scale(1)" },
          "25%": { transform: "translate3d(1.5%, 1%, 0) scale(1.02)" },
          "50%": { transform: "translate3d(3%, -0.5%, 0) scale(1.01)" },
          "75%": { transform: "translate3d(1%, 2%, 0) scale(1.02)" },
          "100%": { transform: "translate3d(0%, 0%, 0) scale(1)" },
        },

        "@keyframes darkModeRibbonDrift": {
          "0%": { transform: "translate3d(0%, 0%, 0) scale(1)" },
          "25%": { transform: "translate3d(1.25%, 0.75%, 0) scale(1.02)" },
          "50%": { transform: "translate3d(2.5%, -0.5%, 0) scale(1.01)" },
          "75%": { transform: "translate3d(1%, 1.75%, 0) scale(1.02)" },
          "100%": { transform: "translate3d(0%, 0%, 0) scale(1)" },
        },

        a: {
          color: "inherit",
          textDecoration: "none",
        },

        "table.md, table.md th:nth-of-type(odd), table.md td:nth-of-type(odd)":
          {
            background:
              theme.colorScheme == "dark"
                ? "rgba(50, 50, 50, 0.5)"
                : "rgba(220, 220, 220, 0.5)",
          },

        "table.md td": {
          paddingLeft: "0.5em",
          paddingRight: "0.5em",
        },

        "html, body": {
          background: "var(--ls-page-base)",
          backgroundAttachment: "fixed",
        },

        body: {
          background: "var(--ls-page-base)",
          backgroundAttachment: "fixed",
          margin: 0,
          padding: 0,
          color: "var(--ls-text)",
          position: "relative",
        },

        "#__next": {
          minHeight: "100vh",
          background: "transparent",
          position: "relative",
          zIndex: 1,
          display: "flow-root",
        },

        "body::before": disableDefaultAtmosphere
          ? {
              content: "\"\"",
              display: "none",
            }
          : theme.colorScheme === "dark"
            ? {
              content: "\"\"",
              position: "fixed",
              inset: "-25%",
              pointerEvents: "none",
              zIndex: 0,
              background: `
                linear-gradient(128deg, rgba(var(--ls-ribbon-1-rgb),0.16) 10%, rgba(var(--ls-ribbon-1-rgb),0.1) 18%, rgba(var(--ls-ribbon-1-rgb),0) 34%),
                linear-gradient(112deg, rgba(var(--ls-ribbon-2-rgb),0.12) 12%, rgba(var(--ls-ribbon-2-rgb),0.08) 20%, rgba(var(--ls-ribbon-2-rgb),0) 38%),
                linear-gradient(142deg, rgba(78,134,255,0.09) 8%, rgba(78,134,255,0.05) 16%, rgba(78,134,255,0) 30%),
                linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 24%)
              `,
              backgroundSize: "150% 150%, 148% 148%, 156% 156%, 100% 100%",
              backgroundRepeat: "no-repeat",
              animation: "darkModeRibbonDrift 34s ease-in-out infinite",
              willChange: "transform",
              backfaceVisibility: "hidden",
            }
            : {
              content: "\"\"",
              position: "fixed",
              inset: "-25%",
              pointerEvents: "none",
              zIndex: 0,
              background: `
                linear-gradient(126deg, rgba(var(--ls-ribbon-1-rgb),0.18) 10%, rgba(var(--ls-ribbon-1-rgb),0.12) 18%, rgba(var(--ls-ribbon-1-rgb),0) 34%),
                linear-gradient(110deg, rgba(var(--ls-ribbon-2-rgb),0.14) 12%, rgba(var(--ls-ribbon-2-rgb),0.08) 20%, rgba(var(--ls-ribbon-2-rgb),0) 38%),
                linear-gradient(144deg, rgba(90,183,255,0.12) 8%, rgba(90,183,255,0.06) 16%, rgba(90,183,255,0) 30%),
                linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 24%)
              `,
              backgroundSize: "150% 150%, 148% 148%, 156% 156%, 100% 100%",
              backgroundRepeat: "no-repeat",
              animation: "lightModeRibbonDrift 30s ease-in-out infinite",
              willChange: "transform",
              backfaceVisibility: "hidden",
            },

        "html[data-ls-scrolling] body::before": {
          animationPlayState: "paused",
        },

        "@media (prefers-reduced-motion: reduce)": {
          "body::before": {
            animation: "none",
          },
        },

        "body > *": {
          position: "relative",
          zIndex: 1,
        },

        ".uploadBarContainer": {
          width: "100%",
          minWidth: "180px",
          height: "24px",
          background: theme.colorScheme === "dark" ? "#111" : "#e5e5e5",
          borderRadius: "8px",
          overflow: "hidden",
          marginTop: 0,
          position: "relative",
          display: "flex",
          alignItems: "center",
        },

        ".uploadBarTextured": {
          height: "100%",
          backgroundColor: "var(--ls-accent)",
          backgroundImage:
            theme.colorScheme === "dark"
              ? "radial-gradient(#000 1px, transparent 0), radial-gradient(#000 1px, transparent 0)"
              : "radial-gradient(rgba(0,0,0,0.15) 1px, transparent 0), radial-gradient(rgba(0,0,0,0.15) 1px, transparent 0)",
          backgroundSize: "6px 6px",
          backgroundPosition: "0 0, 3px 3px",
          transition: "width 0.15s ease",
          borderRadius: "8px",
        },

        ".uploadBarPercent": {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: "14px",
          fontWeight: 600,
          pointerEvents: "none",
          textShadow: theme.colorScheme === "dark" 
            ? "0 0 6px #000" 
            : "0 1px 2px rgba(0,0,0,0.5)",
        },
      };
      }}
    />
  );
};

export default GlobalStyle;
