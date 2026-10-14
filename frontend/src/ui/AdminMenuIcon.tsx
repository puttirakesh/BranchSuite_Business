import React from 'react';
import { StyleSheet, View } from 'react-native';

export type AdminMenuIconName = 'chart' | 'people' | 'wallet' | 'file' | 'lock' | 'building' | 'clock' | 'settings' | 'support' | 'home' | 'more' | 'search' | 'close';

// View-based line icons work on native as well as web, without DOM-only SVGs.
export function AdminMenuIcon({ name, color = '#5c79bd' }: { name: AdminMenuIconName; color?: string }) {
  const styles = createStyles(color);
  return <View accessible={false} style={styles.iconDrawing}>
    {name === 'close' ? <><View style={styles.closeForward} /><View style={styles.closeBackward} /></>
      : name === 'search' ? <><View style={styles.searchCircle} /><View style={styles.searchHandle} /></>
      : name === 'people' ? <><View style={styles.personHead} /><View style={styles.personBody} /></>
      : name === 'clock' ? <View style={styles.clock}><View style={styles.hour} /><View style={styles.minute} /></View>
      : name === 'chart' ? <View style={styles.chart}><View style={[styles.bar, { height: 4 }]} /><View style={[styles.bar, { height: 9 }]} /><View style={[styles.bar, { height: 7 }]} /></View>
      : name === 'lock' ? <><View style={styles.lockHandle} /><View style={styles.lockBody} /></>
      : name === 'home' ? <><View style={styles.roof} /><View style={styles.house} /></>
      : name === 'more' ? <View style={styles.dots}>{[0, 1, 2].map(dot => <View key={dot} style={styles.dot} />)}</View>
      : name === 'support' ? <><View style={styles.headband} /><View style={[styles.ear, { left: 2 }]} /><View style={[styles.ear, { right: 2 }]} /></>
      : name === 'settings' ? <View style={styles.gear}><View style={styles.gearCenter} /></View>
      : <View style={[styles.document, name === 'wallet' && styles.wallet]}>
        {name === 'wallet' ? <View style={styles.walletClasp} /> : [0, 1, 2].map(line => <View key={line} style={styles.documentLine} />)}
      </View>}
  </View>;
}

const createStyles = (stroke: string) => StyleSheet.create({
  closeForward: { position: 'absolute', width: 15, height: 1, backgroundColor: stroke, transform: [{ rotate: '45deg' }] },
  closeBackward: { position: 'absolute', width: 15, height: 1, backgroundColor: stroke, transform: [{ rotate: '-45deg' }] },
  searchCircle: { width: 12, height: 12, borderWidth: 1, borderColor: stroke, borderRadius: 6, marginRight: 3, marginBottom: 3 },
  searchHandle: { position: 'absolute', width: 7, height: 1, right: 1, bottom: 3, backgroundColor: stroke, transform: [{ rotate: '45deg' }] },
  iconDrawing: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }, personHead: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: stroke }, personBody: { width: 12, height: 7, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderColor: stroke, marginTop: 2 }, clock: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: stroke }, hour: { position: 'absolute', width: 1, height: 4, left: 6, top: 2, backgroundColor: stroke }, minute: { position: 'absolute', width: 4, height: 1, left: 6, top: 6, backgroundColor: stroke, transform: [{ rotate: '30deg' }] }, chart: { width: 14, height: 14, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: stroke, flexDirection: 'row', gap: 2, alignItems: 'flex-end', padding: 2 }, bar: { width: 2, backgroundColor: stroke }, document: { width: 11, height: 14, borderWidth: 1, borderColor: stroke, borderRadius: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, documentLine: { width: 5, height: 1, backgroundColor: stroke }, wallet: { width: 14, height: 12, borderRadius: 2 }, walletClasp: { position: 'absolute', right: -1, width: 5, height: 5, borderWidth: 1, borderColor: stroke, backgroundColor: '#eef2ff' }, lockHandle: { width: 7, height: 7, borderWidth: 1, borderColor: stroke, borderTopLeftRadius: 4, borderTopRightRadius: 4 }, lockBody: { width: 11, height: 8, borderWidth: 1, borderRadius: 1, borderColor: stroke, marginTop: -1 }, roof: { width: 10, height: 10, borderLeftWidth: 1, borderTopWidth: 1, borderColor: stroke, transform: [{ rotate: '45deg' }], marginBottom: -5 }, house: { width: 10, height: 9, borderWidth: 1, borderTopWidth: 0, borderColor: stroke }, dots: { flexDirection: 'row', gap: 3 }, dot: { width: 2, height: 2, borderRadius: 1, backgroundColor: '#345cf2' }, headband: { width: 14, height: 14, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderColor: stroke }, ear: { position: 'absolute', top: 9, width: 4, height: 7, borderWidth: 1, borderRadius: 1, borderColor: stroke }, gear: { width: 14, height: 14, borderWidth: 1, borderRadius: 4, borderColor: stroke, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '30deg' }] }, gearCenter: { width: 5, height: 5, borderWidth: 1, borderRadius: 3, borderColor: stroke },
});
