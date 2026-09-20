import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { advancePlan } from '@/lib/advance';
import {
  HOURS,
  cellKey,
  cellsToRows,
  gridDays,
  rowsToCells,
  type Cell,
} from '@/lib/availability';
import { brand } from '@/lib/theme';
import { GradientButton, Loader } from '@/components/ui';

const CELL_H = 30;
const COL_W = 46;
const LABEL_W = 46;

export default function Availability() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const days = useMemo(() => gridDays(), []);
  const [selected, setSelected] = useState<Set<Cell>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Drag state lives in refs: the pan responder is created once, and re-running
  // it on every state change would drop the gesture mid-drag.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const paintingRef = useRef<boolean>(true);
  const gridOrigin = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!id || !session) return;
    supabase
      .from('availability')
      .select('user_id, day, start_time, end_time')
      .eq('plan_id', id)
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        setSelected(rowsToCells(data ?? []));
        setLoading(false);
      });
  }, [id, session]);

  function cellAt(pageX: number, pageY: number): Cell | null {
    const col = Math.floor((pageX - gridOrigin.current.x - LABEL_W) / COL_W);
    const row = Math.floor((pageY - gridOrigin.current.y) / CELL_H);
    if (col < 0 || col >= days.length || row < 0 || row >= HOURS.length) return null;
    return cellKey(days[col], HOURS[row]);
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const cell = cellAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
        if (!cell) return;
        // The first cell decides whether this drag paints or erases, so
        // dragging back over your own selection clears it.
        paintingRef.current = !selectedRef.current.has(cell);
        applyCell(cell);
      },
      onPanResponderMove: (e) => {
        const cell = cellAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
        if (cell) applyCell(cell);
      },
    }),
  ).current;

  function applyCell(cell: Cell) {
    setSelected((prev) => {
      const has = prev.has(cell);
      if (paintingRef.current === has) return prev; // nothing to change
      const next = new Set(prev);
      if (paintingRef.current) next.add(cell);
      else next.delete(cell);
      return next;
    });
  }

  async function save() {
    if (!session || !id) return;
    setSaving(true);
    // Replace wholesale: simpler than diffing, and a person's availability for
    // one plan is a handful of rows.
    await supabase.from('availability').delete().eq('plan_id', id).eq('user_id', session.user.id);
    const rows = cellsToRows(selected).map((r) => ({ ...r, plan_id: id, user_id: session.user.id }));
    if (rows.length) await supabase.from('availability').insert(rows);
    // Everyone in? Then this save is what opens the time poll.
    await advancePlan(id);
    setSaving(false);
    router.back();
  }

  if (loading) return <Loader />;

  return (
    <View style={styles.flex}>
      <Text style={styles.hint}>Drag across the times you're free.</Text>

      <ScrollView horizontal>
        <View>
          <View style={styles.headerRow}>
            <View style={{ width: LABEL_W }} />
            {days.map((d) => {
              const date = new Date(`${d}T00:00:00`);
              return (
                <View key={d} style={[styles.headerCell, { width: COL_W }]}>
                  <Text style={styles.headerDay}>
                    {date.toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <Text style={styles.headerDate}>{date.getDate()}</Text>
                </View>
              );
            })}
          </View>

          <ScrollView>
            <View
              {...pan.panHandlers}
              onLayout={(e) => {
                e.target.measure?.((_x, _y, _w, _h, pageX, pageY) => {
                  gridOrigin.current = { x: pageX, y: pageY };
                });
              }}
            >
              {HOURS.map((hour) => (
                <View key={hour} style={styles.row}>
                  <View style={{ width: LABEL_W }}>
                    <Text style={styles.hourLabel}>{hour}:00</Text>
                  </View>
                  {days.map((day) => {
                    const on = selected.has(cellKey(day, hour));
                    return (
                      <View
                        key={day}
                        style={[styles.cell, { width: COL_W }, on && styles.cellOn]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <View style={{ padding: 16 }}>
        <GradientButton label="Save availability" onPress={save} busy={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: brand.bg },
  hint: { color: brand.inkSoft, fontSize: 13, padding: 14 },
  headerRow: { flexDirection: 'row' },
  headerCell: { alignItems: 'center', paddingBottom: 6 },
  headerDay: { fontSize: 11, color: brand.inkSoft },
  headerDate: { fontSize: 13, fontWeight: '700', color: brand.ink },
  row: { flexDirection: 'row', height: CELL_H, alignItems: 'stretch' },
  hourLabel: { fontSize: 10, color: brand.inkSoft, textAlign: 'right', paddingRight: 6, marginTop: -5 },
  cell: { borderWidth: StyleSheet.hairlineWidth, borderColor: brand.border, backgroundColor: brand.surface, borderRadius: 3 },
  cellOn: { backgroundColor: brand.primary, borderColor: brand.primary },
});
