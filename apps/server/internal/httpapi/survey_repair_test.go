package httpapi

import "testing"

func TestRepairOrphanedSurveyInviteForSingleCampaign(t *testing.T) {
	store := &campaignStore{data: storageState{
		Campaigns:     []campaignData{{ID: "campaign-current"}},
		SurveyInvites: []surveyInvite{{Token: "kept-link", CampaignID: "campaign-old"}},
	}}

	if !store.repairOrphanedSurveyInvitesLocked() {
		t.Fatal("expected orphaned invite to be repaired")
	}
	if got := store.data.SurveyInvites[0].CampaignID; got != "campaign-current" {
		t.Fatalf("campaign ID = %q, want campaign-current", got)
	}
}

func TestRepairOrphanedSurveyInviteDoesNotGuessWithMultipleCampaigns(t *testing.T) {
	store := &campaignStore{data: storageState{
		Campaigns:     []campaignData{{ID: "campaign-one"}, {ID: "campaign-two"}},
		SurveyInvites: []surveyInvite{{Token: "ambiguous-link", CampaignID: "campaign-old"}},
	}}

	if store.repairOrphanedSurveyInvitesLocked() {
		t.Fatal("did not expect ambiguous invite to be repaired")
	}
	if got := store.data.SurveyInvites[0].CampaignID; got != "campaign-old" {
		t.Fatalf("campaign ID changed to %q", got)
	}
}
