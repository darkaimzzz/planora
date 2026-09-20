// Planora's UI kit. Apple's layout and type discipline, Duolingo's touch feel.
//
// The signature piece is PushButton: a solid slab sitting on a darker edge that
// compresses when pressed, the way Duolingo's buttons do. It is why the app
// feels physical rather than flat, so every real action uses it.
import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { MotiView } from 'moti';
import { Spinner, Text, View, styled } from 'tamagui';
import { PRESS_DEPTH, brand, radius, tint, type } from '@/lib/theme';

export const Screen = styled(View, {
  flex: 1,
  backgroundColor: brand.bg,
});

/** Apple's inset grouped card: generous radius, hairline border, soft lift. */
export const Card = styled(View, {
  backgroundColor: brand.surface,
  borderRadius: radius.lg,
  padding: 16,
  gap: 10,
  borderWidth: 1,
  borderColor: brand.border,
  shadowColor: brand.ink,
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
});

export const LargeTitle = styled(Text, { color: brand.ink, ...type.largeTitle });
export const Title = styled(Text, { color: brand.ink, ...type.title });
export const Heading = styled(Text, { color: brand.ink, ...type.headline });
export const Body = styled(Text, { color: brand.ink, ...type.body });
export const Callout = styled(Text, { color: brand.ink, ...type.callout });
export const Muted = styled(Text, { color: brand.inkSoft, ...type.footnote });

/** All-caps section label, the way iOS groups a list. */
export const SectionLabel = styled(Text, {
  color: brand.inkSoft,
  ...type.caption,
  textTransform: 'uppercase',
});

export type Tone = 'primary' | 'success' | 'accent' | 'danger' | 'neutral';

const TONES: Record<Tone, { face: any; edge: any; label: string }> = {
  primary: { face: brand.primary, edge: brand.primaryDeep, label: '#FFFFFF' },
  success: { face: brand.success, edge: brand.successDeep, label: '#FFFFFF' },
  accent: { face: brand.accent, edge: brand.accentDeep, label: '#3A2A00' },
  danger: { face: brand.danger, edge: brand.dangerDeep, label: '#FFFFFF' },
  neutral: { face: brand.surface, edge: brand.border, label: '#1B2A5E' },
};

/**
 * The chunky press-down button. The face sits `PRESS_DEPTH` above a darker
 * edge; pressing drops it onto the edge, so the travel is visible rather than
 * being just a colour change.
 */
export function PushButton({
  label,
  onPress,
  tone = 'primary',
  busy,
  disabled,
  full = true,
  size = 'lg',
  icon,
}: {
  label: string;
  onPress?: () => void;
  tone?: Tone;
  busy?: boolean;
  disabled?: boolean;
  full?: boolean;
  size?: 'lg' | 'sm';
  icon?: ReactNode;
}) {
  const t = TONES[tone];
  const off = disabled || busy;
  const padV = size === 'lg' ? 16 : 10;
  const padH = size === 'lg' ? 24 : 16;

  return (
    <Pressable onPress={onPress} disabled={off} style={{ alignSelf: full ? 'stretch' : 'flex-start' }}>
      {({ pressed }) => (
        <View
          backgroundColor={t.edge}
          borderRadius={radius.md}
          paddingBottom={pressed || off ? 0 : PRESS_DEPTH}
          opacity={off ? 0.45 : 1}
        >
          <MotiView
            animate={{ translateY: pressed ? PRESS_DEPTH : 0 }}
            transition={{ type: 'timing', duration: 60 }}
          >
            <View
              backgroundColor={t.face}
              borderRadius={radius.md}
              paddingVertical={padV}
              paddingHorizontal={padH}
              alignItems="center"
              justifyContent="center"
              flexDirection="row"
              gap={8}
              borderWidth={tone === 'neutral' ? 1 : 0}
              borderColor={brand.border}
            >
              {busy ? (
                <Spinner color={tint(t.label)} />
              ) : (
                <>
                  {icon}
                  <Text
                    color={tint(t.label)}
                    fontSize={size === 'lg' ? 17 : 15}
                    fontWeight="800"
                    letterSpacing={0.2}
                  >
                    {label}
                  </Text>
                </>
              )}
            </View>
          </MotiView>
        </View>
      )}
    </Pressable>
  );
}

/** The same slab, in the quiet tone — secondary actions. */
export function NeutralButton(props: Omit<Parameters<typeof PushButton>[0], 'tone'>) {
  return <PushButton {...props} tone="neutral" />;
}

/** Scale-on-press wrapper for anything that isn't a button (cards, rows). */
export function Tappable({ children, style, ...rest }: PressableProps & { children: ReactNode }) {
  return (
    <Pressable {...rest}>
      {({ pressed }) => (
        <MotiView
          animate={{ scale: pressed ? 0.975 : 1, opacity: rest.disabled ? 0.5 : 1 }}
          transition={{ type: 'timing', duration: 110 }}
          style={style as object}
        >
          {children}
        </MotiView>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  tone = 'primary',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: Tone;
}) {
  const t = TONES[tone];
  return (
    <Tappable onPress={onPress}>
      <View
        paddingHorizontal={16}
        paddingVertical={10}
        borderRadius={radius.pill}
        borderWidth={2}
        borderColor={active ? t.face : brand.border}
        backgroundColor={active ? t.face : brand.surface}
      >
        <Text
          color={active ? tint(t.label) : brand.inkSoft}
          fontSize={14}
          fontWeight="800"
          textTransform="capitalize"
        >
          {label}
        </Text>
      </View>
    </Tappable>
  );
}

/** Small status pill — "2 voted", "Confirmed", a count. */
export function Badge({ label, tone = 'primary' }: { label: string; tone?: Tone }) {
  const wash =
    tone === 'success' ? brand.successWash : tone === 'accent' ? brand.accentWash : brand.primaryWash;
  const ink =
    tone === 'success' ? brand.successDeep : tone === 'accent' ? brand.accentDeep : brand.primary;
  return (
    <View backgroundColor={wash} paddingHorizontal={10} paddingVertical={4} borderRadius={radius.pill}>
      <Text color={ink} {...type.caption}>
        {label}
      </Text>
    </View>
  );
}

/** Duolingo's lesson bar: rounded, chunky, springs as it fills. */
export function ProgressBar({ value, tone = 'success' }: { value: number; tone?: Tone }) {
  const t = TONES[tone];
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View height={14} backgroundColor={brand.sunken} borderRadius={radius.pill} overflow="hidden">
      <MotiView
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', damping: 18, stiffness: 140 }}
        style={{ height: '100%' }}
      >
        <View flex={1} backgroundColor={t.face} borderRadius={radius.pill} />
      </MotiView>
    </View>
  );
}

export function Avatar({
  name,
  color,
  size = 40,
}: {
  name: string;
  color?: string | null;
  size?: number;
}) {
  return (
    <View
      width={size}
      height={size}
      borderRadius={size / 2}
      alignItems="center"
      justifyContent="center"
      backgroundColor={color ? tint(color) : brand.inkSoft}
      borderWidth={2}
      borderColor={brand.surface}
    >
      <Text color={tint('#FFFFFF')} fontWeight="800" fontSize={size * 0.42}>
        {name.trim().slice(0, 1).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

/** Staggered entrance — items rise into place one after another. */
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 160, delay }}
    >
      {children}
    </MotiView>
  );
}

/** Big friendly nothing-here state, rather than a bare line of grey text. */
export function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View alignItems="center" paddingVertical={44} paddingHorizontal={24} gap={10}>
      <MotiView
        from={{ scale: 0.7, rotate: '-8deg' }}
        animate={{ scale: 1, rotate: '0deg' }}
        transition={{ type: 'spring', damping: 10 }}
      >
        <View
          width={84}
          height={84}
          borderRadius={42}
          backgroundColor={brand.primaryWash}
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize={40}>{emoji}</Text>
        </View>
      </MotiView>
      <Title textAlign="center">{title}</Title>
      {body && (
        <Muted textAlign="center" fontSize={15}>
          {body}
        </Muted>
      )}
      {action}
    </View>
  );
}

/** Shown when a load fails, so a hiccup is recoverable instead of a dead screen. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Screen alignItems="center" justifyContent="center" padding={24} gap={12}>
      <EmptyState
        emoji="😵‍💫"
        title="That didn't load"
        body={message}
        action={
          <View marginTop={8}>
            <PushButton label="Try again" full={false} onPress={onRetry} />
          </View>
        }
      />
    </Screen>
  );
}

export function Loader() {
  return (
    <Screen alignItems="center" justifyContent="center">
      <Spinner size="large" color={brand.primary} />
    </Screen>
  );
}
