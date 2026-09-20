import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, initials } from '@/lib/theme';

type Message = {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  profiles: { display_name: string; avatar_color: string } | null;
};

const SELECT = 'id, user_id, content, created_at, profiles(display_name, avatar_color)';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;

    supabase
      .from('messages')
      .select(SELECT)
      .eq('plan_id', id)
      .order('created_at')
      .then(({ data }) => {
        if (active) setMessages((data ?? []) as unknown as Message[]);
      });

    // Realtime gives us the bare row, so re-fetch the one message with its
    // profile join rather than rendering an author-less bubble.
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `plan_id=eq.${id}` },
        async ({ new: row }) => {
          const { data } = await supabase.from('messages').select(SELECT).eq('id', (row as any).id).single();
          if (data && active) {
            setMessages((prev) =>
              prev.some((m) => m.id === (data as any).id) ? prev : [...prev, data as unknown as Message],
            );
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function send() {
    const content = draft.trim();
    if (!content || !session) return;
    setDraft('');
    await supabase.from('messages').insert({ plan_id: id, user_id: session.user.id, content });
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say something.</Text>}
        renderItem={({ item }) => {
          // A null author is the AI confirmation message (PRD §6a.3).
          if (!item.user_id) {
            return (
              <View style={styles.systemBubble}>
                <Text style={styles.systemText}>{item.content}</Text>
              </View>
            );
          }
          const mine = item.user_id === session?.user.id;
          return (
            <View style={[styles.row, mine && styles.rowMine]}>
              {!mine && (
                <View style={[styles.avatar, { backgroundColor: item.profiles?.avatar_color ?? colors.muted }]}>
                  <Text style={styles.avatarText}>{initials(item.profiles?.display_name ?? '?')}</Text>
                </View>
              )}
              <View style={[styles.bubble, mine && styles.bubbleMine]}>
                {!mine && <Text style={styles.author}>{item.profiles?.display_name}</Text>}
                <Text style={[styles.text, mine && styles.textMine]}>{item.content}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor={colors.muted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable style={styles.send} onPress={send}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bubble: { maxWidth: '78%', backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleMine: { backgroundColor: colors.accent },
  author: { fontSize: 11, color: colors.muted, marginBottom: 2 },
  text: { fontSize: 15, color: colors.text },
  textMine: { color: '#fff' },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '90%',
  },
  systemText: { color: colors.accent, fontSize: 14, textAlign: 'center', fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  send: { paddingHorizontal: 14, paddingVertical: 10 },
  sendText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
});
