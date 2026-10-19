/** Browser APIs that TypeScript's DOM types do not have (vendor prefixes, older APIs, debug hooks). */

interface Window {
  webkitAudioContext?: typeof AudioContext;
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
