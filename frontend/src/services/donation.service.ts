import { DonationIntent, GroupDonationSummary } from "../types/donation.type";
import api from "./api.service";

const getGroupSummary = async (groupId: string): Promise<GroupDonationSummary> => {
  return (await api.get(`/donations/groups/${groupId}/summary`)).data;
};

const createIntent = async (
  groupId: string,
  payload: { amountFiat: number },
): Promise<DonationIntent> => {
  return (await api.post(`/donations/groups/${groupId}/intents`, payload)).data;
};

export default {
  getGroupSummary,
  createIntent,
};
