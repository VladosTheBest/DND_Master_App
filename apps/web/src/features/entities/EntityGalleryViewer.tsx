import { GalleryLightbox, type GalleryViewerState } from "../../media";

type EntityGalleryViewerProps = {
  onClose: () => void;
  onCopyLink: (url: string) => Promise<void>;
  onSelect: (index: number) => void;
  viewer: GalleryViewerState | null;
};

export function EntityGalleryViewer({
  onClose,
  onCopyLink,
  onSelect,
  viewer
}: EntityGalleryViewerProps) {
  if (!viewer) {
    return null;
  }

  return (
    <GalleryLightbox
      onClose={onClose}
      onCopyLink={onCopyLink}
      onSelect={onSelect}
      viewer={viewer}
    />
  );
}
