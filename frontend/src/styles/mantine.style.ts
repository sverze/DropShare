import { MantineThemeOverride } from "@mantine/core";

export default <MantineThemeOverride>{
  fontFamily:
    "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headings: {
    fontFamily:
      "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },

  colors: {
    victoria: [
      "#E2E1F1",
      "#C2C0E7",
      "#A19DE4",
      "#7D76E8",
      "#544AF4",
      "#4940DE",
      "#4239C8",
      "#463FA8",
      "#47428E",
      "#464379",
    ],

    brand: [
      "#e5ffe9",
      "#caffd4",
      "#a9ffbb",
      "#7aff9a",
      "#45ff75",
      "#00ff5a",
      "#00e651",
      "#00cc48",
      "#00b33f",
      "#009a36",
    ],
  },

  primaryColor: "brand",

  components: {
    Modal: {
      styles: (theme) => ({
        title: {
          fontSize: theme.fontSizes.lg,
          fontWeight: 700,
        },
      }),
    },
    Button: {
      styles: (theme) => {
        const isLight = theme.colorScheme === "light";
        const lightBrand = theme.colors.brand[7];
        const lightBrandHover = theme.colors.brand[8];

        return {
          root: {
            "&[data-variant='filled']": isLight
              ? {
                  background: `linear-gradient(135deg, ${theme.colors.brand[6]} 0%, ${lightBrand} 100%)`,
                  color: "#fff",
                  boxShadow: `0 10px 24px ${theme.fn.rgba(theme.colors.brand[7], 0.18)}`,
                  "&:hover": {
                    background: `linear-gradient(135deg, ${theme.colors.brand[7]} 0%, ${lightBrandHover} 100%)`,
                  },
                }
              : {},

            "&[data-variant='light']": isLight
              ? {
                  backgroundColor: theme.fn.rgba(theme.colors.brand[7], 0.12),
                  color: theme.colors.brand[9],
                  "&:hover": {
                    backgroundColor: theme.fn.rgba(theme.colors.brand[7], 0.18),
                  },
                }
              : {},

            "&[data-variant='outline']": isLight
              ? {
                  borderColor: theme.fn.rgba(theme.colors.brand[7], 0.4),
                  color: theme.colors.brand[8],
                  "&:hover": {
                    backgroundColor: theme.fn.rgba(theme.colors.brand[7], 0.06),
                  },
                }
              : {},

            "&[data-variant='subtle']": isLight
              ? {
                  color: theme.colors.brand[8],
                  "&:hover": {
                    backgroundColor: theme.fn.rgba(theme.colors.brand[7], 0.08),
                  },
                }
              : {},
          },
        };
      },
    },
    ActionIcon: {
      styles: (theme) => ({
        root: {
          color:
            theme.colorScheme === "light" ? theme.colors.dark[7] : theme.white,
          "&:hover": {
            backgroundColor:
              theme.colorScheme === "light"
                ? theme.fn.rgba(theme.colors.brand[7], 0.1)
                : theme.fn.rgba(theme.colors.brand[5], 0.1),
          },
        },
      }),
    },
    Input: {
      styles: (theme) => ({
        input: {
          borderColor:
            theme.colorScheme === "light"
              ? theme.fn.rgba(theme.colors.brand[7], 0.25)
              : undefined,
          backgroundColor:
            theme.colorScheme === "light"
              ? "rgba(255, 255, 255, 0.78)"
              : undefined,
          "&:focus, &:focus-within": {
            borderColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
            boxShadow:
              theme.colorScheme === "light"
                ? `0 0 0 3px ${theme.fn.rgba(theme.colors.brand[6], 0.14)}`
                : undefined,
          },
        },
      }),
    },
    TextInput: {
      styles: (theme) => ({
        input: {
          "&:focus, &:focus-within": {
            borderColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
          },
        },
      }),
    },
    Textarea: {
      styles: (theme) => ({
        input: {
          "&:focus": {
            borderColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
          },
        },
      }),
    },
    PasswordInput: {
      styles: (theme) => ({
        input: {
          "&:focus": {
            borderColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
          },
        },
      }),
    },
    NumberInput: {
      styles: (theme) => ({
        input: {
          "&:focus": {
            borderColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
          },
        },
      }),
    },
    Select: {
      styles: (theme) => ({
        input: {
          "&:focus, &:focus-within": {
            borderColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
          },
        },
      }),
    },
    MultiSelect: {
      styles: (theme) => ({
        input: {
          "&:focus, &:focus-within": {
            borderColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
          },
        },
      }),
    },
    Avatar: {
      styles: (theme) => ({
        root: {
          borderColor:
            theme.colorScheme === "light"
              ? theme.colors.brand[7]
              : theme.colors.brand[5],
        },
      }),
    },
    Menu: {
      styles: (theme) => ({
        item: {
          "&[data-hovered]": {
            backgroundColor:
              theme.colorScheme === "light"
                ? theme.fn.rgba(theme.colors.brand[7], 0.1)
                : undefined,
            color:
              theme.colorScheme === "light" ? theme.colors.brand[9] : undefined,
          },
        },
      }),
    },
    Checkbox: {
      styles: (theme) => ({
        input: {
          "&:checked": {
            backgroundColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
            borderColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
          },
        },
      }),
    },
    Switch: {
      styles: (theme) => ({
        track: {
          "&[data-checked]": {
            backgroundColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
            borderColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
          },
        },
      }),
    },
    Tabs: {
      styles: (theme) => ({
        tab: {
          "&[data-active]": {
            color:
              theme.colorScheme === "light"
                ? theme.colors.brand[8]
                : theme.colors.brand[5],
            borderColor:
              theme.colorScheme === "light"
                ? theme.colors.brand[7]
                : theme.colors.brand[5],
          },
          "&:hover": {
            backgroundColor:
              theme.colorScheme === "light"
                ? theme.fn.rgba(theme.colors.brand[7], 0.05)
                : undefined,
          },
        },
      }),
    },
    Anchor: {
      defaultProps: {
        color: "brand",
      },
      styles: (theme) => ({
        root: {
          color:
            theme.colorScheme === "light"
              ? theme.colors.brand[8]
              : theme.colors.brand[5],
          "&:hover": {
            color:
              theme.colorScheme === "light"
                ? theme.colors.brand[9]
                : theme.colors.brand[4],
          },
        },
      }),
    },
    Badge: {
      styles: (theme) => ({
        root: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          verticalAlign: "middle",
          lineHeight: 1,
          "&[data-variant='light']": {
            backgroundColor:
              theme.colorScheme === "light"
                ? theme.fn.rgba(theme.colors.brand[7], 0.1)
                : undefined,
            color:
              theme.colorScheme === "light" ? theme.colors.brand[9] : undefined,
          },
        },
        inner: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        },
        leftSection: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,

          "& svg": {
            display: "block",
          },
        },
      }),
    },
  },
};
