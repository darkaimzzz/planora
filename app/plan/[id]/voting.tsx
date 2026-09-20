import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

/** Polls land with the availability + time-poll milestone. */
export default function Voting() {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>Polls appear here once availability is in.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: colors.muted, textAlign: 'center', fontSize: 15 },
});
