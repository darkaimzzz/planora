// Planora's UI kit: a small set of Tamagui primitives every screen shares, so
// the look stays consistent without each screen re-declaring a StyleSheet.
import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Spinner, Text, View, styled } from 'tamagui';
import { brand, tint } from '@/lib/theme';

export const Screen = styled(View, {
  flex: 1,
  backgroundColor: brand.bg,
});

export const Card = styled(View, {
  backgroundColor: brand.surface,
  borderRadius: 20,
  padding: 16,
  gap: 10,
  borderWidth: 1,
  borderColor: brand.border,
  // A soft lift rather than a hard drop shadow.
  shadowColor: brand.ink,
  shadowOpacity: 0.05,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
});

export const Title = styled(Text, {
  color: brand.ink,
  fontWeight: '800',
  fontSize: 28,
  letterSpacing: -0.5,
});

export const Heading = styled(Text, {
  color: brand.ink,
  fontWeight: '700',
  fontSize: 17,
});

export const Body = styled(Text, {
  color: brand.ink,
  fontSize: 15,
});

export const Muted = styled(Text, {
  color: brand.inkSoft,
  fontSize: 13,
});

export const Field = styled(View, {
  backgroundColor: brand.sunken,
  borderWidth: 1,
  borderColor: brand.border,
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 2,
  focusStyle: { borderColor: brand.primary },
});

/** Scale-on-press wrapper — the cheapest thing that makes taps feel alive. */
export function Tappable({
  children,
  style,
  ...rest
}: PressableProps & { children: ReactNode }) {
  return (
    <Pressable {...rest}>
      {({ pressed }) => (
        <MotiView
          animate={{ scale: pressed ? 0.97 : 1, opacity: rest.disabled ? 0.5 : 1 }}
          transition={{ type: 'timing', duration: 120 }}
          style={style as object}
        >
          {children}
        </MotiView>
      )}
    </Pressable>
  );
}

export function GradientButton({
  label,
  onPress,
  busy,
  disabled,
  full = true,
}: {
  label: string;
  onPress?: () => void;
  busy?: boolean;
  disabled?: boolean;
  full?: boolean;
}) {
  return (
    <Tappable onPress={onPress} disabled={disabled || busy} style={{ alignSelf: full ? 'stretch' : 'flex-start' }}>
      <LinearGradient
        colors={brand.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 16,
          paddingVertical: 16,
          paddingHorizontal: 24,
          alignItems: 'center',
        }}
      >
        {busy ? (
          <Spinner color="#fff" />
        ) : (
          <Text color="#fff" fontWeight="700" fontSize={16}>
            {label}
          </Text>
        )}
      </LinearGradient>
    </Tappable>
  );
}

export function GhostButton({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Tappable onPress={onPress} disabled={disabled}>
      <View
        borderWidth={1}
        borderColor={brand.border}
        backgroundColor={brand.surface}
        borderRadius={16}
        paddingVertical={16}
        alignItems="center"
      >
        <Text color={brand.ink} fontWeight="700" fontSize={16}>
          {label}
        </Text>
      </View>
    </Tappable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Tappable onPress={onPress}>
      <View
        paddingHorizontal={16}
        paddingVertical={9}
        borderRadius={999}
        borderWidth={1}
        borderColor={active ? brand.primary : brand.border}
        backgroundColor={active ? brand.primary : brand.surface}
      >
        <Text color={active ? '#fff' : brand.ink} fontWeight={active ? '700' : '500'} fontSize={14} textTransform="capitalize">
          {label}
        </Text>
      </View>
    </Tappable>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color?: string | null; size?: number }) {
  return (
    <View
      width={size}
      height={size}
      borderRadius={size / 2}
      alignItems="center"
      justifyContent="center"
      backgroundColor={color ? tint(color) : brand.inkSoft}
    >
      <Text color="#fff" fontWeight="700" fontSize={size * 0.4}>
        {name.trim().slice(0, 1).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

/** Staggered entrance — list items fade up one after another. */
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 320, delay }}
    >
      {children}
    </MotiView>
  );
}

export function Loader() {
  return (
    <Screen alignItems="center" justifyContent="center">
      <Spinner size="large" color={brand.primary} />
    </Screen>
  );
}
