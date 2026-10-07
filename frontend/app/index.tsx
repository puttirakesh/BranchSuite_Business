import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>BranchSuite Business</Text>
      <Text style={styles.subtitle}>Development starter is ready.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F6F8FC',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2457D6',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#52637A',
  },
});
