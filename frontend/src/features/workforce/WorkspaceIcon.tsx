import { Text, View } from 'react-native';

export default function WorkspaceIcon({ name, color = '#657C98', size = 28 }: { name: string; color?: string; size?: number }) {
  const line = { borderColor: color, borderWidth: 2 };
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={false}><View style={{ width: 28, height: 28, transform: [{ scale: size / 28 }] }}>
    {name === 'Search' ? <><View style={[line, { position: 'absolute', width: 17, height: 17, borderRadius: 10, top: 2, left: 2 }]} /><View style={{ position: 'absolute', width: 11, height: 2, backgroundColor: color, top: 20, left: 16, transform: [{ rotate: '45deg' }] }} /></>
      : name === 'People' ? <><View style={[line, { width: 10, height: 10, borderRadius: 6, marginLeft: 5 }]} /><View style={[line, { position: 'absolute', width: 19, height: 11, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomWidth: 0, top: 14 }]} /><Text style={{ color, position: 'absolute', right: -2, top: 2, fontSize: 21 }}>+</Text></>
      : name === 'Home' ? <><View style={[line, { position: 'absolute', width: 15, height: 15, left: 6, top: 2, transform: [{ rotate: '45deg' }], borderRightWidth: 0, borderBottomWidth: 0 }]} /><View style={[line, { position: 'absolute', width: 19, height: 17, left: 4, top: 9, borderTopWidth: 0 }]} /><View style={[line, { position: 'absolute', width: 6, height: 10, left: 10, top: 16, borderBottomWidth: 0 }]} /></>
      : name === 'Payroll' ? <><View style={[line, { marginTop: 4, height: 20, borderRadius: 2 }]} /><View style={{ position: 'absolute', height: 2, backgroundColor: color, top: 10, width: 26, left: 1 }} /><View style={{ position: 'absolute', height: 2, backgroundColor: color, top: 17, width: 6, left: 5 }} /></>
      : name === 'CRM' ? <><View style={[line, { width: 25, height: 24, borderTopWidth: 0, borderRightWidth: 0 }]} /><Text style={{ position: 'absolute', left: 5, top: -6, fontSize: 29, color }}>↗</Text></>
      : <Text style={{ color, fontSize: 26, lineHeight: 24, textAlign: 'center' }}>···</Text>}
  </View></View>;
}
