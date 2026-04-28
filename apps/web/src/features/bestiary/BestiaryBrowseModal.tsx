import type { GalleryImage } from "@shadow-edge/shared-types";
import type { BestiaryMonsterDetail, BestiaryMonsterSummary } from "@shadow-edge/shared-types";
import { buildEntityGalleryAlbum } from "../../app-shared";
import { CombatEntityStatSheet, RewardSection } from "../../combat-ui";
import { splitBestiaryContent } from "./bestiary.utils";

type BestiaryBrowseModalProps = {
  imported: boolean;
  importing: boolean;
  monster: BestiaryMonsterDetail;
  onBack: () => void;
  onImport: () => void;
  onOpenGalleryAlbum: (ownerId: string, ownerTitle: string, items: GalleryImage[], index: number) => void;
  onOpenSource: () => void;
  summary: BestiaryMonsterSummary | null;
};

export function BestiaryBrowseModal({
  imported,
  importing,
  monster,
  onBack,
  onImport,
  onOpenGalleryAlbum,
  onOpenSource,
  summary
}: BestiaryBrowseModalProps) {
  const album = buildEntityGalleryAlbum(monster.monster);
  const openAlbum = () => {
    if (!album.length) {
      return;
    }

    onOpenGalleryAlbum(monster.monster.id, monster.monster.title, album, 0);
  };

  return (
    <div className="stack wide">
      <CombatEntityStatSheet
        action={
          <div className="npc-sheet-toolbar">
            <button className="ghost" onClick={onBack} type="button">
              К каталогу
            </button>
            {album.length ? (
              <button className="ghost" onClick={openAlbum} type="button">
                Альбом ({album.length})
              </button>
            ) : null}
            <button className="ghost" onClick={onOpenSource} type="button">
              Открыть dnd.su
            </button>
            <button className="primary" disabled={importing} onClick={onImport} type="button">
              {importing ? "Импорт..." : imported ? "Импортировать ещё раз" : "Импортировать в кампанию"}
            </button>
          </div>
        }
        defaultCollapsed={false}
        entity={monster.monster}
        expandSections
        onOpenPortraitGallery={album.length ? openAlbum : undefined}
        portraitOverride={
          album[0]
            ? {
                alt: album[0].caption ?? album[0].title,
                caption: album[0].caption,
                url: album[0].url
              }
            : summary?.imageUrl
              ? {
                  alt: monster.monster.title,
                  caption: monster.monster.summary,
                  url: summary.imageUrl
                }
              : undefined
        }
      />

      <RewardSection kind="monster" rewardProfile={monster.monster.rewardProfile} />

      <article className="card section-card">
        <div className="row muted">
          <span>Описание</span>
          <span>Подтянуто из официальной карточки dnd.su</span>
        </div>
        <div className="rich">
          {splitBestiaryContent(monster.monster.content).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
