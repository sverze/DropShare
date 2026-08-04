import { Group, Paper, Switch, Text, useMantineColorScheme } from "@mantine/core";
import { TbMoon, TbSun } from "react-icons/tb";
import userPreferences from "../../utils/userPreferences.util";

const ThemeSwitcher = () => {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  const handleToggle = async () => {
    const newTheme = colorScheme === "dark" ? "light" : "dark";
    
    userPreferences.set("colorScheme", newTheme);
    
    toggleColorScheme(newTheme);
    
    try {
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
        credentials: "include",
      });
    } catch (e) {
      console.error("Failed to save theme to account:", e);
    }
  };

  return (
    <Paper withBorder p="md">
      <Group position="apart">
        <div>
          <Text weight={500} size="sm">
            Theme
          </Text>
          <Text size="xs" color="dimmed" mt={4}>
            Choose your preferred theme (syncs across all sites)
          </Text>
        </div>
        <Group spacing="sm" noWrap>
          <Text 
            size="sm" 
            weight={500} 
            style={{ 
              color: colorScheme === "dark" ? "var(--ls-accent)" : "#888",
              transition: "color 0.2s ease"
            }}
          >
            Dark
          </Text>
          <Switch
            size="lg"
            onLabel={<TbSun size={16} />}
            offLabel={<TbMoon size={16} />}
            checked={colorScheme === "light"}
            onChange={handleToggle}
            styles={() => ({
              root: {
                cursor: "pointer",
              },
              track: {
                cursor: "pointer",
                width: 60,
                height: 32,
                backgroundColor: colorScheme === "dark" 
                  ? "rgba(var(--ls-accent-rgb), 0.15)"
                  : "rgba(var(--ls-accent-rgb), 0.16)",
                borderColor: colorScheme === "dark"
                  ? "rgba(var(--ls-accent-rgb), 0.5)"
                  : "rgba(var(--ls-accent-rgb), 0.55)",
                border: "2px solid",
                transition: "all 0.3s ease",
                "&:hover": {
                  backgroundColor: colorScheme === "dark"
                    ? "rgba(var(--ls-accent-rgb), 0.25)"
                    : "rgba(var(--ls-accent-rgb), 0.26)",
                },
              },
              thumb: {
                width: 24,
                height: 24,
                backgroundColor: "var(--ls-accent)",
                border: "none",
                boxShadow: colorScheme === "dark"
                  ? "0 0 10px rgba(var(--ls-accent-rgb), 0.5)"
                  : "0 0 10px rgba(var(--ls-accent-rgb), 0.5)",
                transition: "all 0.3s ease",
              },
            })}
          />
          <Text 
            size="sm" 
            weight={500}
            style={{ 
              color: colorScheme === "light" ? "var(--ls-accent)" : "#888",
              transition: "color 0.2s ease"
            }}
          >
            Light
          </Text>
        </Group>
      </Group>
    </Paper>
  );
};

export default ThemeSwitcher;
