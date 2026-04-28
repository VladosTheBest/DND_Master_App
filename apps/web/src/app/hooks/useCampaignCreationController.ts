import type {
  CampaignData,
  CampaignSummary,
  CreateCampaignInput
} from "@shadow-edge/shared-types";
import { useState } from "react";
import { api } from "../api";

const createEmptyCampaignForm = (): CreateCampaignInput => ({
  title: "",
  system: "D&D 5e",
  settingName: "",
  inWorldDate: "",
  summary: ""
});

type UseCampaignCreationControllerArgs = {
  setBootError: (value: string) => void;
  setCampaigns: (campaigns: CampaignSummary[]) => void;
  setSaving: (value: boolean) => void;
  onCampaignCreated: (campaign: CampaignData) => void;
};

export function useCampaignCreationController({
  setBootError,
  setCampaigns,
  setSaving,
  onCampaignCreated
}: UseCampaignCreationControllerArgs) {
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState<CreateCampaignInput>(createEmptyCampaignForm);

  const openCampaignModal = () => {
    setCampaignForm(createEmptyCampaignForm());
    setCampaignModalOpen(true);
  };

  const updateCampaignForm = (patch: Partial<CreateCampaignInput>) => {
    setCampaignForm((current) => ({
      ...current,
      ...patch
    }));
  };

  const submitCampaign = async () => {
    try {
      setSaving(true);
      const created = await api.createCampaign(campaignForm);
      const list = await api.listCampaigns();
      setCampaigns(list);
      onCampaignCreated(created);
      setCampaignModalOpen(false);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось создать кампанию.");
    } finally {
      setSaving(false);
    }
  };

  return {
    campaignForm,
    campaignModalOpen,
    openCampaignModal,
    setCampaignModalOpen,
    submitCampaign,
    updateCampaignForm
  };
}
