package httpapi

import (
	"bytes"
	"path/filepath"
	"strings"
	"testing"
)

func TestSurveyTemplateEmbedsTokenWithoutExtraQuotes(t *testing.T) {
	const token = "0123456789abcdef"
	var output bytes.Buffer
	if err := surveyTemplateV2.Execute(&output, surveyPageData(token, "Влад")); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output.String(), `const t="`+token+`",prefix=`) {
		t.Fatal("survey template did not embed the exact token as a JavaScript string")
	}
}

func TestCreateSurveyInvitePreservesPersonalLinks(t *testing.T) {
	store := &campaignStore{
		path: filepath.Join(t.TempDir(), "store.json"),
		data: storageState{
			Campaigns:     []campaignData{{ID: "campaign-one"}, {ID: "campaign-two"}},
			SurveyInvites: []surveyInvite{{Token: "old-token", CampaignID: "campaign-one"}, {Token: "other-token", CampaignID: "campaign-two"}},
		},
	}

	token, err := store.createSurveyInvite("campaign-one", "Влад")
	if err != nil {
		t.Fatal(err)
	}
	if token == "" || token == "old-token" {
		t.Fatalf("expected a fresh token, got %q", token)
	}
	if len(store.data.SurveyInvites) != 3 {
		t.Fatalf("invite count = %d, want 3", len(store.data.SurveyInvites))
	}
	if store.data.SurveyInvites[0].Token != "old-token" || store.data.SurveyInvites[1].Token != "other-token" {
		t.Fatal("existing personal invites were not preserved")
	}
	if store.data.SurveyInvites[2].Token != token || store.data.SurveyInvites[2].CampaignID != "campaign-one" || store.data.SurveyInvites[2].PlayerName != "Влад" {
		t.Fatal("fresh invite was not stored for the selected campaign")
	}
}

func TestDeleteSurveyResponseIsScopedToCampaign(t *testing.T) {
	store := &campaignStore{
		path: filepath.Join(t.TempDir(), "store.json"),
		data: storageState{
			SurveyResponses: []surveyResponse{
				{ID: "response-one", CampaignID: "campaign-one"},
				{ID: "response-two", CampaignID: "campaign-two"},
			},
		},
	}

	if store.deleteSurveyResponse("campaign-two", "response-one") {
		t.Fatal("deleted a response through the wrong campaign")
	}
	if !store.deleteSurveyResponse("campaign-one", "response-one") {
		t.Fatal("did not delete the matching response")
	}
	if len(store.data.SurveyResponses) != 1 || store.data.SurveyResponses[0].ID != "response-two" {
		t.Fatal("unexpected responses after deletion")
	}
}
