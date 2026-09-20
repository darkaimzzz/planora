import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input, Text, View } from 'tamagui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';
import { Avatar, Muted, Screen, Tappable } from '@/components/ui';

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
      style={{ flex: 1, backgroundColor: brand.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Screen>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View alignItems="center" paddingVertical={60} gap={8}>
              <Ionicons name="chatbubbles-outline" size={40} color={brand.border} />
              <Muted>No messages yet. Say something.</Muted>
            </View>
          }
          renderItem={({ item }) => {
            // A null author is the AI confirmation message.
            if (!item.user_id) {
              return (
                <View
                  alignSelf="center"
                  maxWidth="90%"
                  backgroundColor={brand.primaryWash}
                  borderRadius={16}
                  paddingHorizontal={16}
                  paddingVertical={12}
                >
                  <Text color={brand.primary} fontSize={14} fontWeight="700" textAlign="center">
                    {item.content}
                  </Text>
                </View>
              );
            }
            const mine = item.user_id === session?.user.id;
            return (
              <View flexDirection="row" gap={8} alignItems="flex-end" justifyContent={mine ? 'flex-end' : 'flex-start'}>
                {!mine && <Avatar name={item.profiles?.display_name ?? '?'} color={item.profiles?.avatar_color} size={28} />}
                <View
                  maxWidth="78%"
                  backgroundColor={mine ? brand.primary : brand.surface}
                  borderWidth={mine ? 0 : 1}
                  borderColor={brand.border}
                  borderRadius={18}
                  paddingHorizontal={14}
                  paddingVertical={10}
                >
                  {!mine && <Muted fontSize={11} marginBottom={2}>{item.profiles?.display_name}</Muted>}
                  <Text fontSize={15} color={mine ? '#fff' : brand.ink}>
                    {item.content}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View
          flexDirection="row"
          gap={8}
          padding={12}
          alignItems="center"
          borderTopWidth={1}
          borderTopColor={brand.border}
          backgroundColor={brand.surface}
        >
          <Input
            flex={1}
            size="$4"
            borderRadius={999}
            backgroundColor={brand.sunken}
            borderColor={brand.border}
            focusStyle={{ borderColor: brand.primary }}
            placeholder="Message"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Tappable onPress={send}>
            <View
              width={42}
              height={42}
              borderRadius={21}
              backgroundColor={brand.primary}
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </View>
          </Tappable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
