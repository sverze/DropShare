import moment from "moment";
import { Timespan } from "../types/timespan.type";

export const getExpirationPreview = (
  messages: {
    neverExpires: string;
    expiresOn: string;
  },
  form: {
    values: {
      never_expires?: boolean;
      expiration_num: number;
      expiration_unit: string;
    };
  },
) => {
  const expirationNum =
    typeof form.values.expiration_num === "number" &&
    Number.isFinite(form.values.expiration_num)
      ? form.values.expiration_num
      : 1;
  const expirationUnit =
    typeof form.values.expiration_unit === "string" &&
    form.values.expiration_unit.length > 0
      ? form.values.expiration_unit
      : "-days";
  const value = form.values.never_expires ? "never" : `${expirationNum}${expirationUnit}`;
  if (value === "never") return messages.neverExpires;

  const [amount = "1", unit = "days"] = value.split("-");
  const expirationDate = moment()
    .add(amount, unit as moment.unitOfTime.DurationConstructor)
    .toDate();

  return messages.expiresOn.replace(
    "{expiration}",
    moment(expirationDate).format("LLL"),
  );
};

export const timespanToString = (timespan: Timespan) => {
  return `${timespan.value} ${timespan.unit}`;
};

export const stringToTimespan = (value: string): Timespan => {
  return {
    value: parseInt(value.split(" ")[0]),
    unit: value.split(" ")[1],
  } as Timespan;
};
