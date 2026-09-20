import { Text, View } from 'tamagui';
import { brand, tint } from '@/lib/theme';

/**
 * The calendar-with-a-tick from the logo, drawn in views so there is no asset
 * to ship and it recolours with the theme.
 */
export function Logo({ size = 72 }: { size?: number }) {
  const stroke = Math.max(3, size * 0.045);
  return (
    <View width={size} height={size} alignItems="center" justifyContent="center">
      {/* hanging rings */}
      <View
        position="absolute"
        top={0}
        left={size * 0.26}
        width={stroke}
        height={size * 0.18}
        borderRadius={stroke}
        backgroundColor={brand.primary}
      />
      <View
        position="absolute"
        top={0}
        right={size * 0.26}
        width={stroke}
        height={size * 0.18}
        borderRadius={stroke}
        backgroundColor={brand.primary}
      />
      {/* body */}
      <View
        position="absolute"
        top={size * 0.11}
        width={size}
        height={size * 0.89}
        borderRadius={size * 0.22}
        borderWidth={stroke}
        borderColor={brand.primary}
        backgroundColor={brand.surface}
        overflow="hidden"
      >
        <View height={size * 0.17} borderBottomWidth={stroke} borderBottomColor={brand.primary} />
        <View flex={1} alignItems="center" justifyContent="center">
          <Text color={tint(brand.primary as unknown as string)} fontSize={size * 0.42} fontWeight="800" marginTop={-size * 0.04}>
            ✓
          </Text>
        </View>
      </View>
    </View>
  );
}
