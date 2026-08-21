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
	if err := surveyTemplateV2.Execute(&output, surveyPageData(token)); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output.String(), `const t="`+token+`",prefix=`) {
		t.Fatal("survey template did not embed the exact token as a JavaScript string")
	}
}

func TestRotateSurveyInviteReplacesPreviousCampaignToken(t *testing.T) {
	store := &campaignStore{
		path: filepath.Join(t.TempDir(), "store.json"),
		data: storageState{
			Campaigns:     []campaignData{{ID: "campaign-one"}, {ID: "campaign-two"}},
			SurveyInvites: []surveyInvite{{Token: "old-token", CampaignID: "campaign-one"}, {Token: "other-token", CampaignID: "campaign-two"}},
		},
	}

	token, err := store.rotateSurveyInvite("campaign-one")
	if err != nil {
		t.Fatal(err)
	}
	if token == "" || token == "old-token" {
		t.Fatalf("expected a fresh token, got %q", token)
	}
	if len(store.data.SurveyInvites) != 2 {
		t.Fatalf("invite count = %d, want 2", len(store.data.SurveyInvites))
	}
	if store.data.SurveyInvites[0].Token != "other-token" {
		t.Fatal("invite for the other campaign was not preserved")
	}
	if store.data.SurveyInvites[1].Token != token || store.data.SurveyInvites[1].CampaignID != "campaign-one" {
		t.Fatal("fresh invite was not stored for the selected campaign")
	}
}
