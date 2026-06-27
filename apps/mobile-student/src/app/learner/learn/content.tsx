// Content viewer — a FLAT single-segment route (direct child of the learn Stack),
// taking spaceId + storyPointId as QUERY params rather than nested path segments.
// Deeply-nested routes (learn/[spaceId]/content/[storyPointId]) render outside the
// navigator on Android bridgeless + react-native-screens and throw "Couldn't find a
// navigation context"; a flat route behaves like SpaceDetail/settings (which work).
// Mirrors the existing checkout pattern (store/checkout?spaceId=…). The screen reads
// both ids via useLocalSearchParams, so no screen change is needed.
export { ContentViewerScreen as default } from "../../../lib/screens";
