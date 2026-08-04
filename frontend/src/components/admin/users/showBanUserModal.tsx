import {
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import { useState } from "react";
import { TbAlertTriangle } from "react-icons/tb";
import userService from "../../../services/user.service";
import User from "../../../types/user.type";
import toast from "../../../utils/toast.util";

const showBanUserModal = (
  modals: ModalsContextProps,
  user: User,
  onDone: () => void,
) => {
  return modals.openModal({
    title: `Ban ${user.username}`,
    children: <Body user={user} modals={modals} onDone={onDone} />,
  });
};

const Body = ({
  user,
  modals,
  onDone,
}: {
  user: User;
  modals: ModalsContextProps;
  onDone: () => void;
}) => {
  const [duration, setDuration] = useState<string>("7d");
  const [customDays, setCustomDays] = useState<number | "">(30);
  const [reason, setReason] = useState("");
  const [banIps, setBanIps] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (duration === "custom" && (!customDays || Number(customDays) < 1)) {
      toast.error("Enter a positive number of days for a custom ban.");
      return;
    }
    setSubmitting(true);
    try {
      const { bannedIpCount } = await userService.banUser(user.id, {
        duration: duration as "7d" | "2w" | "permanent" | "custom",
        customDays: duration === "custom" ? Number(customDays) : undefined,
        reason: reason.trim() || undefined,
        banIps,
      });
      toast.success(
        `${user.username} has been suspended` +
          (banIps
            ? ` and ${bannedIpCount} IP${bannedIpCount === 1 ? "" : "s"} blocked.`
            : "."),
      );
      onDone();
      modals.closeAll();
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack>
      <Text size="sm" color="dimmed">
        The account is signed out everywhere immediately and cannot sign back in
        while suspended.
      </Text>
      <Select
        label="Duration"
        value={duration}
        onChange={(v) => setDuration(v || "7d")}
        data={[
          { value: "7d", label: "7 days" },
          { value: "2w", label: "2 weeks" },
          { value: "permanent", label: "Permanent" },
          { value: "custom", label: "Custom…" },
        ]}
      />
      {duration === "custom" && (
        <NumberInput
          label="Number of days"
          min={1}
          max={3650}
          value={customDays}
          onChange={(v) => setCustomDays(v === "" ? "" : Number(v))}
        />
      )}
      <Textarea
        label="Reason (optional)"
        placeholder="Shown in the audit trail and to the user at sign-in."
        value={reason}
        onChange={(e) => setReason(e.currentTarget.value)}
        maxLength={500}
        autosize
        minRows={2}
      />
      <Checkbox
        label="Also block the IP addresses this account has used"
        checked={banIps}
        onChange={(e) => setBanIps(e.currentTarget.checked)}
      />
      {banIps && (
        <Alert
          icon={<TbAlertTriangle size={16} />}
          color="yellow"
          variant="light"
        >
          Blocks the precise IPs seen on this account since IP tracking began.
          Other people sharing those exact addresses would also be blocked, and
          the blocks lift automatically when the ban ends.
        </Alert>
      )}
      <Group position="right" mt="sm">
        <Button variant="default" onClick={() => modals.closeAll()}>
          Cancel
        </Button>
        <Button color="red" loading={submitting} onClick={submit}>
          Ban user
        </Button>
      </Group>
    </Stack>
  );
};

export default showBanUserModal;
