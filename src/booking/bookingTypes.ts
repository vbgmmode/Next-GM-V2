import type { GameScreen } from "../game/migration";
import type { GameState, Segment, SegmentType } from "../game/types";

export type BookingScreenProps = {
  focusSegmentId?: string;
  game: GameState;
  isQaHarness?: boolean;
  onBuildTitleMatch: (segmentId: string, championshipId: string) => void;
  onConsumeFocusSegment: () => void;
  onAddSegment: (type: SegmentType, segmentId?: string) => void;
  onNavigate: (screen: GameScreen) => void;
  onOpenProfile: (wrestlerId: string) => void;
  onRemoveSegment: (id: string) => void;
  onReplaceCurrentShow: (segments: Segment[]) => void;
  onRunShow: () => void;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  onSetSegmentStipulation: (segmentId: string, stipulationId: string) => void;
  onSetSegmentRivalry: (segmentId: string, rivalryId: string) => void;
  onToggleParticipant: (segmentId: string, wrestlerId: string) => void;
  onUpdateSegment: (segmentId: string, updates: Partial<Segment>) => void;
};