import { View, Text, StyleSheet } from 'react-native';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>BranchSuite SuperAdmin</Text>
      <Text style={styles.subtitle}>Login page setup successful</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#6950C8',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 12,
    color: '#52637A',
    textAlign: 'center',
  },
});