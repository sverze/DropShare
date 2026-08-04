import { TbAlertTriangle, TbCircleCheck } from "react-icons/tb";
import { Group, Text, useMantineTheme } from "@mantine/core";

const UploadProgressIndicator = ({ progress }: { progress: number }) => {
  const theme = useMantineTheme();
  const accent = "var(--ls-accent)";

  if (progress < 0) {
    return (
      <Group spacing={6} noWrap>
        <TbAlertTriangle color={theme.colors.red[5]} size={20} />
        <Text size="sm" weight={700} color="red">
          Failed
        </Text>
      </Group>
    );
  }
  
  const safeProgress =
    typeof progress === "number" && !Number.isNaN(progress)
      ? Math.max(0, Math.min(100, progress))
      : 0;

  if (safeProgress < 100) {
    return (
      <div className="uploadBarContainer">
        <div
          className="uploadBarTextured"
          style={{ 
            width: `${safeProgress}%`,
            background:
              "linear-gradient(90deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
          }}
        />
        <div className="uploadBarPercent">
          {safeProgress < 10
            ? `${safeProgress.toFixed(1)}%`
            : `${Math.floor(safeProgress)}%`}
        </div>
      </div>
    );
  }

  return <TbCircleCheck color={accent} size={22} />;
};

export default UploadProgressIndicator;
