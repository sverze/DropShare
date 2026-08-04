import {
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { AdminConfig, UpdateConfig } from "../../../types/config.type";
import { stringToTimespan, timespanToString } from "../../../utils/date.util";
import FileSizeInput from "../../core/FileSizeInput";
import TimespanInput from "../../core/TimespanInput";

const AdminConfigInput = ({
  configVariable,
  updateConfigVariable,
}: {
  configVariable: AdminConfig;
  updateConfigVariable: (_: UpdateConfig) => void;
}) => {
  const getResolvedValue = () => {
    const rawValue = configVariable.value ?? configVariable.defaultValue;

    if (
      configVariable.key.startsWith("legal.") &&
      configVariable.type === "text" &&
      typeof rawValue === "string" &&
      rawValue.trim() === ""
    ) {
      return configVariable.defaultValue;
    }

    return rawValue;
  };

  const resolvedValue = getResolvedValue();
  const isLargeLegalTextField =
    configVariable.key.startsWith("legal.") && configVariable.type === "text";

  const form = useForm({
    initialValues: {
      stringValue: resolvedValue,
      textValue: resolvedValue,
      numberValue: parseInt(
        configVariable.value ?? configVariable.defaultValue,
      ),
      booleanValue:
        (configVariable.value ?? configVariable.defaultValue) == "true",
    },
  });

  const onValueChange = (configVariable: AdminConfig, value: any) => {
    form.setFieldValue(`${configVariable.type}Value`, value);
    updateConfigVariable({ key: configVariable.key, value: value });
  };

  return (
    <Stack align="end">
      {configVariable.type == "string" &&
        (configVariable.key === "share.bulkUploadMode" ? (
          <Select
            style={{ width: "100%" }}
            disabled={!configVariable.allowEdit}
            data={[
              {
                value: "page",
                label: "Separate Bulk Upload page (header link)",
              },
              {
                value: "modal",
                label: "Standard / Bulk switch in the upload dialog",
              },
            ]}
            value={form.values.stringValue === "modal" ? "modal" : "page"}
            onChange={(value) => onValueChange(configVariable, value || "page")}
          />
        ) : configVariable.obscured ? (
          <PasswordInput
            autoComplete="new-password"
            style={{
              width: "100%",
            }}
            disabled={!configVariable.allowEdit}
            {...form.getInputProps("stringValue")}
            onChange={(e) => onValueChange(configVariable, e.target.value)}
          />
        ) : (
          <TextInput
            style={{
              width: "100%",
            }}
            disabled={!configVariable.allowEdit}
            {...form.getInputProps("stringValue")}
            placeholder={configVariable.defaultValue}
            onChange={(e) => onValueChange(configVariable, e.target.value)}
          />
        ))}

      {configVariable.type == "text" && (
        <Textarea
          style={{
            width: "100%",
          }}
          disabled={!configVariable.allowEdit}
          autosize={!isLargeLegalTextField}
          minRows={isLargeLegalTextField ? 16 : 4}
          maxRows={isLargeLegalTextField ? 24 : 8}
          styles={{
            input: isLargeLegalTextField
              ? {
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
                  lineHeight: 1.6,
                }
              : undefined,
          }}
          {...form.getInputProps("textValue")}
          placeholder={configVariable.defaultValue}
          onChange={(e) => onValueChange(configVariable, e.target.value)}
        />
      )}
      {configVariable.type == "number" && (
        <NumberInput
          {...form.getInputProps("numberValue")}
          disabled={!configVariable.allowEdit}
          placeholder={configVariable.defaultValue}
          onChange={(number) => onValueChange(configVariable, number)}
          w={201}
        />
      )}
      {configVariable.type == "filesize" && (
        <FileSizeInput
          {...form.getInputProps("numberValue")}
          disabled={!configVariable.allowEdit}
          value={parseInt(configVariable.value ?? configVariable.defaultValue)}
          onChange={(bytes) => onValueChange(configVariable, bytes)}
          w={201}
        />
      )}
      {configVariable.type == "boolean" && (
        <>
          <Switch
            disabled={!configVariable.allowEdit}
            {...form.getInputProps("booleanValue", { type: "checkbox" })}
            onChange={(e) => onValueChange(configVariable, e.target.checked)}
          />
        </>
      )}
      {configVariable.type == "timespan" && (
        <TimespanInput
          value={stringToTimespan(configVariable.value)}
          disabled={!configVariable.allowEdit}
          onChange={(timespan) =>
            onValueChange(configVariable, timespanToString(timespan))
          }
          w={201}
        />
      )}
    </Stack>
  );
};

export default AdminConfigInput;
