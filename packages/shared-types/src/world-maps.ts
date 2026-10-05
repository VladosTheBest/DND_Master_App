export interface WorldMapLabel {
  role?: "major" | "region" | "settlement" | "site";
  curve?: number;
  span?: number;
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  font: "serif" | "sans-serif" | "monospace";
  color: string;
  outline: string;
  bold: boolean;
  italic: boolean;
}
export interface WorldMapDocument {
  sourceMapId?: string;
  sourceRevision?: number;
  scale?: "auto" | "world" | "region" | "island" | "city" | "site";
	context?: {includeCampaign: boolean; locationId?: string};
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
  referenceUrl?: string;
  labels: WorldMapLabel[];
  width: number;
  height: number;
  revision: number;
  provider: string;
  createdAt: string;
}
