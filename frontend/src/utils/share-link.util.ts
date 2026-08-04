import shareService from "../services/share.service";

export const generateShareId = (length: number = 15) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomArray = new Uint8Array(length >= 3 ? length : 3);
  crypto.getRandomValues(randomArray);
  randomArray.forEach((number) => {
    result += chars[number % chars.length];
  });
  return result;
};

export const generateAvailableLink = async (
  shareIdLength: number,
  times: number = 10,
): Promise<string> => {
  if (times <= 0) {
    throw new Error("Could not generate available link");
  }

  const link = generateShareId(shareIdLength);
  if (!(await shareService.isShareIdAvailable(link))) {
    return await generateAvailableLink(shareIdLength, times - 1);
  }

  return link;
};
