// Viewport-specific employee layouts layered over shared styles.
import { formSpacing } from '../../shared/theme/formSpacing';
import { Platform, StyleSheet, useWindowDimensions } from "react-native";
import { s } from './sharedStyles';
import { desktopStyles, liftSmallText } from "../../ui/useDesktopStyles";
import { webWorkspaceStyles } from '../../ui/webWorkspaceStyles';

// Desktop has room for denser controls; native and narrow web keep touch sizing.
const desktopEmployeeStyles = StyleSheet.create({
  ...desktopStyles(s),
  title: { ...s.title, fontSize: 24, fontWeight: "600" },
  hello: { ...s.hello, fontSize: 22, fontWeight: "600" },
  cardTitle: { ...s.cardTitle, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  sectionTitle: { ...s.sectionTitle, fontSize: 17, fontWeight: "600" },
  card: { ...s.card, padding: 20, borderRadius: 12 },
  shiftCard: { ...s.shiftCard, padding: 18, borderRadius: 16 },
  tile: { ...s.tile, minHeight: 64, padding: 12, borderRadius: 12 },
  metric: { ...s.metric, minHeight: 112, padding: 14, borderRadius: 12, alignItems: 'flex-start', justifyContent: 'center', paddingVertical: 14, minWidth: 0 },
  metricValue: { ...s.metricValue, fontSize: 25, fontWeight: "600", textAlign: 'left', flexShrink: 1 },
  time: { ...s.time, fontSize: 20, lineHeight: 26, fontWeight: "600" },
  payValue: { ...s.payValue, fontSize: 30, fontWeight: "600" },
  button: { ...s.button, minHeight: 44, padding: 10, borderRadius: 10 },
  buttonText: { ...s.buttonText, fontSize: 13, fontWeight: "600" },
  input: { ...s.input, minHeight: 44, padding: 10, fontSize: 14, borderRadius: 10 },
  field: { ...s.field, marginBottom: formSpacing.field },
  chip: { ...s.chip, minHeight: 34, paddingVertical: 6 },
  topbar: { ...s.topbar, minHeight: 64, paddingVertical: 10 },
  searchButton: { ...s.searchButton, width: 36, height: 36, borderRadius: 10 },
  avatar: { ...s.avatar, width: 36, height: 36, borderRadius: 11 },
  documentBack: { ...s.documentBack, width: 36, height: 36 },
  leaveTitle: { ...s.leaveTitle, fontSize: 24, lineHeight: 30, fontWeight: "600" },
  leaveRequestsTitle: { ...s.leaveRequestsTitle, fontSize: 18, lineHeight: 25, fontWeight: "600" },
  leaveApply: { ...s.leaveApply, minHeight: 40, borderRadius: 9 },
  leaveCancel: { ...s.leaveCancel, minHeight: 40, padding: 8, borderRadius: 10 },
  documentSheetTitle: { ...s.documentSheetTitle, fontSize: 19, lineHeight: 26, fontWeight: "600" },
  documentSave: { ...s.documentSave, minHeight: 40, padding: 10 },
}) as unknown as typeof s;

const tabletEmployeeStyles = StyleSheet.create({
  ...s,
  title: { ...s.title, fontSize: 24, lineHeight: 30 },
  card: { ...s.card, padding: 20, borderRadius: 14 },
  tile: { ...s.tile, minHeight: 72, padding: 14, borderRadius: 12 },
  topbar: { ...s.topbar, minHeight: 68, paddingHorizontal: 20 },
  content: { ...s.content, padding: 20, paddingBottom: 36 },
  leavePage: { ...s.leavePage, gap: 16 },
}) as unknown as typeof s;

const webDesktopEmployeeStyles = webWorkspaceStyles(desktopEmployeeStyles);
const touchEmployeeStyles = liftSmallText(s);
const readableTabletStyles = liftSmallText(tabletEmployeeStyles);
const webTabletEmployeeStyles = webWorkspaceStyles(readableTabletStyles);
const webMobileEmployeeStyles = webWorkspaceStyles(touchEmployeeStyles);

export function useEmployeeStyles() {
  const { width } = useWindowDimensions();
  if (Platform.OS === 'web') return width >= 1200 ? webDesktopEmployeeStyles : width >= 768 ? webTabletEmployeeStyles : webMobileEmployeeStyles;
  if (width >= 768) return readableTabletStyles;
  return touchEmployeeStyles;
}
