export interface FoundryAbility {
  id: string; name: string; description: string; type: string;
  spellId?: string; attackBonus?: number; damage?: string; damageType?: string;
  saveAbility?: string; saveDc?: number; range?: number;
}
export interface FoundryActor {
  name: string; edition: string; abilities: Record<string, number>;
  maxHp: number; armorClass: number; speed: number; proficiencyBonus: number;
  items: FoundryAbility[];
}
export interface SessionMapDocument {
  id: string; title: string; revision: number;
  levels: Array<{
    id: string; name: string; imageUrl: string; roofUrl?: string;
    width: number; height: number;
    walls: import("./index").PlayerDisplayWall[];
    grid?: import("./index").PlayerDisplayGridSettings;
    gridDistance?: number;
    roofZones?: import("./index").PlayerDisplayRoofZone[];
  }>;
}
