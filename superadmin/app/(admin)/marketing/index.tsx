import { View, Text, StyleSheet } from 'react-native';

export default function PlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>BranchSuite SuperAdmin</Text>
      <Text style={styles.subtitle}>marketing page is under development.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F6F8FC',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6950C8',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#52637A',
    marginTop: 12,
  },
});
