import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ToastModal } from './Toast';
import { AdminPageHeading } from './AdminPageHeading';
import { FloatingTextInput } from './FloatingTextInput';
import { AppIcon } from './AppIcon';
import { branchesApi } from '../core/admin/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapTiles, project, unproject, type MapLocation, type MapPoint } from '../core/map-coordinates';

const INITIAL: MapPoint = { latitude: 20.5937, longitude: 78.9629 };
export function MapLocationField({ value, legacyAddress = '', onChange, disabled = false }: { value: MapLocation | null; legacyAddress?: string; onChange: (value: MapLocation | null) => void; disabled?: boolean }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false), [center, setCenter] = useState<MapPoint>(INITIAL), [zoom, setZoom] = useState(5);
  const [picked, setPicked] = useState(false), [address, setAddress] = useState(''), [query, setQuery] = useState('');
  const [results, setResults] = useState<MapLocation[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [tileError, setTileError] = useState(false), [size, setSize] = useState({ width: 320, height: 320 });
  const [fallbackTiles, setFallbackTiles] = useState<Set<string>>(() => new Set());
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const request = useRef(0), gesture = useRef({ pageX: 0, pageY: 0, x: 0, y: 0 });
  const close = () => { request.current++; setOpen(false); setBusy(false); };
  const show = () => { setCenter(value ?? INITIAL); setZoom(value ? 16 : 5); setPicked(!!value); setAddress(value?.address ?? ''); setQuery(legacyAddress); setResults([]); setError(''); setTileError(false); setOpen(true); };
  const choose = (point: MapPoint, label = '') => { request.current++; setBusy(false); setCenter(point); setPicked(true); setAddress(label); setResults([]); setError(''); setTileError(false); };
  const search = async () => {
    if (query.trim().length < 3) { setError('Enter at least 3 characters to search for a location.'); return; }
    const token = ++request.current; setBusy(true); setError('');
    try { const items = await branchesApi.searchLocations(query.trim()); if (token === request.current) { setResults(items); if (!items.length) setError('No matching locations. Try a nearby area or choose a pin on the map.'); } }
    catch (reason) { if (token === request.current) setError(reason instanceof Error ? reason.message : 'Could not search locations.'); }
    finally { if (token === request.current) setBusy(false); }
  };
  const confirm = async () => {
    if (!picked || busy) return;
    const token = ++request.current; setBusy(true);
    let label = address;
    if (!label) {
      try { label = (await branchesApi.reverseLocation(center.latitude, center.longitude)).address; }
      catch { label = `${center.latitude.toFixed(6)}, ${center.longitude.toFixed(6)}`; }
    }
    if (token !== request.current) return;
    onChange({ ...center, address: label }); close();
  };
  const tiles = mapTiles(center, zoom, size.width, size.height);
  return <View style={s.field}>
    <Text style={s.label}>Location</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose branch location on map" disabled={disabled} onPress={show} style={s.control}>
      <View style={s.copy}><Text style={s.value}>{value?.address || legacyAddress || 'Select location on map'}</Text>{value && <Text style={s.caption}>{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</Text>}</View>
      <AppIcon name="map-pin" size={18} color="#607591" />
    </Pressable>
    <ToastModal visible={open} animationType="slide" onRequestClose={close}>
      <View style={[s.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.header}><AdminPageHeading title="Branch location" onBack={close} />
          <View style={s.row}><FloatingTextInput style={s.search} label="Search place or address" value={query} onChangeText={setQuery} validation={{ kind: 'search', maxLength: 120 }} returnKeyType="search" onSubmitEditing={search} clearOnSubmit={false} />
            <Pressable accessibilityRole="button" accessibilityLabel="Search map locations" disabled={busy} onPress={search} style={s.button}><Text>Search</Text></Pressable></View>
          <Text style={s.caption}>Search an area, then move the map pin to the branch entrance.</Text>
        </View>
        {busy && <ActivityIndicator accessibilityLabel="Looking up location" />}
        {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        {!!results.length && <ScrollView style={s.results} keyboardShouldPersistTaps="handled">{results.map((item, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Select location ${item.address}`} onPress={() => { choose(item, item.address); setZoom(16); }} style={s.result}><Text style={s.value}>{item.address}</Text></Pressable>)}</ScrollView>}
        <View nativeID="branch-location-map" testID="branch-location-map" accessibilityLabel="Branch location map" style={s.map} onLayout={event => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
          onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
          onResponderGrant={event => { const point = project(center, zoom); gesture.current = { pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY, x: point.x, y: point.y }; }}
          onResponderMove={event => setOffset({ x: event.nativeEvent.pageX - gesture.current.pageX, y: event.nativeEvent.pageY - gesture.current.pageY })}
          onResponderRelease={event => {
            const dx = event.nativeEvent.pageX - gesture.current.pageX, dy = event.nativeEvent.pageY - gesture.current.pageY;
            const moving = Math.abs(dx) + Math.abs(dy) > 5;
            choose(unproject(gesture.current.x + (moving ? -dx : event.nativeEvent.locationX - size.width / 2), gesture.current.y + (moving ? -dy : event.nativeEvent.locationY - size.height / 2), zoom));
            setOffset({ x: 0, y: 0 });
          }} onResponderTerminate={() => setOffset({ x: 0, y: 0 })}>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateX: offset.x }, { translateY: offset.y }] }]}>
            {tiles.map(tile => {
              const fallback = fallbackTiles.has(tile.key);
              const uri = fallback ? tile.fallbackUri : tile.uri;
              return <Image key={tile.key} accessibilityIgnoresInvertColors
                source={Platform.OS === 'web' ? { uri } : { uri, headers: { 'User-Agent': 'BranchSuiteBusiness/0.1 (+https://github.com/puttirakesh/BranchSuite_Business)' } }}
                onError={() => {
                  if (fallback) setTileError(true);
                  else setFallbackTiles(current => new Set(current).add(tile.key));
                }}
                style={{ position: 'absolute', left: tile.left, top: tile.top, width: 256, height: 256 }} />;
            })}
          </View>
          <View pointerEvents="none" style={s.pin}><AppIcon name="map-pin" size={36} color={picked ? '#2563eb' : '#607591'} /></View>
        </View>
        <View style={s.mapActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in map" disabled={zoom >= 19} onPress={() => { setZoom(v => Math.min(19, v + 1)); setTileError(false); }} style={s.button}><Text>＋</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out map" disabled={zoom <= 2} onPress={() => { setZoom(v => Math.max(2, v - 1)); setTileError(false); }} style={s.button}><Text>−</Text></Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel="OpenStreetMap attribution" onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')} style={s.attribution}><Text style={s.caption}>© OpenStreetMap contributors</Text></Pressable>
        </View>
        {tileError && <Text style={s.error}>Map tiles could not load. Check your connection.</Text>}
        <View style={s.footer}><Text style={s.value}>{picked ? address || 'Selected map pin' : 'Tap or drag the map to select a location.'}</Text>
          {picked && <Text style={s.caption}>{center.latitude.toFixed(6)}, {center.longitude.toFixed(6)} · Nearby address may differ from the exact pin.</Text>}
          <View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel="Clear branch location" onPress={() => { onChange(null); close(); }} style={s.button}><Text>Clear</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Use this branch location" disabled={!picked || busy} onPress={confirm} style={[s.primary, (!picked || busy) && s.disabled]}><Text style={s.primaryText}>Use this location</Text></Pressable></View>
        </View>
      </View>
    </ToastModal>
  </View>;
}
const s = StyleSheet.create({
  field: { gap: 8 }, label: { fontSize: 12, lineHeight: 18, color: '#405573' },
  control: { minHeight: 44, borderWidth: 1, borderColor: '#dce3e7', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff' },
  copy: { flex: 1, minWidth: 0, gap: 4 }, value: { fontSize: 14, lineHeight: 20, color: '#20334f' }, caption: { fontSize: 12, lineHeight: 18, color: '#607591' },
  page: { flex: 1, minHeight: 0, backgroundColor: '#fff', paddingTop: 24 }, header: { padding: 12, gap: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' }, search: { flex: 1, minWidth: 0 },
  button: { minHeight: 44, minWidth: 44, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#dce3e7', alignItems: 'center', justifyContent: 'center' },
  results: { maxHeight: 160, flexGrow: 0 }, result: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#e4eaf5', minHeight: 44 },
  map: { flex: 1, minHeight: 120, overflow: 'hidden', backgroundColor: '#e8edf0' },
  pin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -18, marginTop: -36 },
  mapActions: { flexDirection: 'row', gap: 8, padding: 8, alignItems: 'center' }, attribution: { flex: 1, alignItems: 'flex-end', padding: 4 },
  footer: { padding: 12, gap: 8 }, primary: { flex: 1, minHeight: 44, padding: 12, backgroundColor: '#345cf2', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '600' }, disabled: { opacity: 0.5 }, error: { color: '#b94d61', fontSize: 12, paddingHorizontal: 12, lineHeight: 18 },
});
