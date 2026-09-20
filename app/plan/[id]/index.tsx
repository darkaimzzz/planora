import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { deriveRoadmap } from '@/lib/roadmap';
import { usePlanData } from '@/lib/usePlanData';
import { colors } from '@/lib/theme';

export default function Roadmap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plan, roadmap, loading } = usePlanData(id);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const steps = deriveRoadmap(roadmap);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{plan?.title}</Text>
      <Text style={styles.sub}>{plan?.type}</Text>

      <View style={styles.track}>
        {steps.map((step, i) => (
          <View key={step.stage} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  step.state === 'done' && styles.dotDone,
                  step.state === 'current' && styles.dotCurrent,
                ]}
              />
              {i < steps.length - 1 && (
                <View style={[styles.line, step.state === 'done' && styles.lineDone]} />
              )}
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepText, step.state === 'pending' && styles.stepTextPending]}>
                {step.stage}
              </Text>
              {step.state === 'current' && step.blocker && (
                <Text style={styles.blocker}>{step.blocker}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 4 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, textTransform: 'capitalize', marginBottom: 20 },
  track: { gap: 0 },
  row: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', width: 18 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bg },
  dotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotCurrent: { borderColor: colors.accent, borderWidth: 4 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, minHeight: 34 },
  lineDone: { backgroundColor: colors.accent },
  stepBody: { flex: 1, paddingBottom: 26 },
  stepText: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: -3 },
  stepTextPending: { color: colors.muted, fontWeight: '500' },
  blocker: { fontSize: 13, color: colors.muted, marginTop: 3 },
});
