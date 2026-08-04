import { NativeSelect, NumberInput, Text } from "@mantine/core";
import { useState } from "react";

const multipliers = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

const units = (["B", "KB", "MB", "GB", "TB"] as const).map((unit) => ({
  label: unit,
  value: unit,
}));

function getLargestApplicableUnit(value: number) {
  return (
    units.findLast((unit) => value % multipliers[unit.value] === 0) || units[0]
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const FileSizeInput = ({
  label,
  value,
  onChange,
  maxSize,
  ...restProps
}: {
  label?: string;
  value: number;
  onChange: (_number: number) => void;
  maxSize?: number;
  [key: string]: any;
}) => {
  const [unit, setUnit] = useState(getLargestApplicableUnit(value).value);
  const [inputValue, setInputValue] = useState(value / multipliers[unit]);

  const maxInputValue = maxSize 
    ? Math.floor(maxSize / multipliers[unit])
    : 999999;

  const unitSelect = (
    <NativeSelect
      data={units}
      value={unit}
      rightSectionWidth={28}
      styles={{
        input: {
          fontWeight: 500,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          width: 76,
          marginRight: -2,
        },
      }}
      onChange={(event) => {
        const newUnit = event.currentTarget
          .value as (typeof units)[number]["value"];
        setUnit(newUnit);
        
        let newBytes = multipliers[newUnit] * inputValue;
        
        if (maxSize && newBytes > maxSize) {
          newBytes = maxSize;
          setInputValue(Math.floor(maxSize / multipliers[newUnit]));
        }
        
        onChange(newBytes);
      }}
    />
  );

  return (
    <>
      <NumberInput
        label={label}
        value={inputValue}
        min={1}
        max={maxInputValue}
        precision={0}
        rightSection={unitSelect}
        rightSectionWidth={76}
        onChange={(value) => {
          const inputVal = value || 0;
          let bytes = multipliers[unit] * inputVal;
          
          if (maxSize && bytes > maxSize) {
            bytes = maxSize;
            setInputValue(Math.floor(maxSize / multipliers[unit]));
          } else {
            setInputValue(inputVal);
          }
          
          onChange(bytes);
        }}
        {...restProps}
      />
      {maxSize && (
        <Text size="xs" color="dimmed" mt={4}>
          Maximum: {formatBytes(maxSize)}
        </Text>
      )}
    </>
  );
};

export default FileSizeInput;
