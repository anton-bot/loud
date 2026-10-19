/** Browser APIs that TypeScript's DOM types do not have (vendor prefixes, older APIs, debug hooks). */

interface Window {
  webkitAudioContext?: typeof AudioContext;
  /** Shows text as if the mic heard it (for trying the overlay from the console). */
  loudSay: (text: string, hero?: string, ...ambient: string[]) => void;
  /** Plays a fake build-up of `seconds` and a drop (for trying the effect from the console). */
  loudDrop: (seconds?: number) => void;
  /** Shows the picture at `url` as a dream frame, then melts it (for trying from the console). */
  loudDream: (url: string) => void;
  /** Section changes, for tuning the detector from the console. */
  loudEvents: { t: number; why: string }[];
}

interface Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  /** Permissions Policy (`featurePolicy` in older Chrome). */
  permissionsPolicy?: { allowsFeature(feature: string): boolean };
  featurePolicy?: { allowsFeature(feature: string): boolean };
}

interface HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}
