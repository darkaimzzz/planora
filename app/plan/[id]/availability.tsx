import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { advancePlan } from '@/lib/advance';
import { HOURS, cellKey, cellsToRows, gridDays, rowsToCells, type Cell } from '@/lib/availability';
import { brand } from '@/lib/theme';
import { Loader, PushButton } from '@/components/ui';

const CELL_H = 34;
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

  // Drag state lives in refs: the pan responder is created once, and rebuilding
  // it on every state change would drop the gesture mid-drag.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const paintingRef = useRef(true);
  const gridRef = useRef<View>(null);
  const gridOrigin = useRef({ x: 0, y: 0 });

  /**
   * Where the grid currently sits on screen. It moves whenever either scroll
   * view scrolls, so this is re-run on layout, on scroll, and at the start of
   * each drag — a stale origin would paint the wrong cells.
   */
  const remeasure = useCallback(() => {
    gridRef.current?.measureInWindow?.((x, y) => {
      if (typeof x === 'number' && typeof y === 'number') gridOrigin.current = { x, y };
    });
  }, []);

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

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        remeasure();
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

  async function save() {
    if (!session || !id) return;
    setSaving(true);
    // Replace wholesale: simpler than diffing, and one person's availability
    // for one plan is a handful of rows.
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
      <View style={styles.header}>
        <Text style={styles.hint}>Drag across the times you're free</Text>
        <Text style={styles.count}>
          {selected.size} hour{selected.size === 1 ? '' : 's'} picked
        </Text>
      </View>

      <ScrollView horizontal onScroll={remeasure} scrollEventThrottle={16}>
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

          <ScrollView onScroll={remeasure} scrollEventThrottle={16}>
            <View ref={gridRef} onLayout={remeasure} {...pan.panHandlers}>
              {HOURS.map((hour) => (
                <View key={hour} style={styles.row}>
                  <View style={{ width: LABEL_W }}>
                    <Text style={styles.hourLabel}>{formatHour(hour)}</Text>
                  </View>
                  {days.map((day) => {
                    const on = selected.has(cellKey(day, hour));
                    return <View key={day} style={[styles.cell, { width: COL_W }, on && styles.cellOn]} />;
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PushButton
          label={selected.size ? 'Save availability' : 'Pick at least one hour'}
          onPress={save}
          busy={saving}
          disabled={selected.size === 0}
          tone="success"
        />
      </View>
    </View>
  );
}

function formatHour(hour: number) {
  const suffix = hour < 12 ? 'am' : 'pm';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${suffix}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: brand.bg as unknown as string },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 2 },
  hint: { color: brand.ink as unknown as string, fontSize: 17, fontWeight: '700' },
  count: { color: brand.inkSoft as unknown as string, fontSize: 13, fontWeight: '600' },
  headerRow: { flexDirection: 'row', paddingLeft: 0 },
  headerCell: { alignItems: 'center', paddingBottom: 8 },
  headerDay: { fontSize: 11, color: brand.inkSoft as unknown as string, fontWeight: '700' },
  headerDate: { fontSize: 15, fontWeight: '800', color: brand.ink as unknown as string },
  row: { flexDirection: 'row', height: CELL_H, alignItems: 'stretch' },
  hourLabel: {
    fontSize: 11,
    color: brand.inkSoft as unknown as string,
    fontWeight: '600',
    textAlign: 'right',
    paddingRight: 8,
    marginTop: -6,
  },
  cell: {
    borderWidth: 1,
    borderColor: brand.border as unknown as string,
    backgroundColor: brand.surface as unknown as string,
    borderRadius: 6,
    margin: 1.5,
  },
  cellOn: {
    backgroundColor: brand.success as unknown as string,
    borderColor: brand.successDeep as unknown as string,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: brand.border as unknown as string,
    backgroundColor: brand.surface as unknown as string,
  },
});
