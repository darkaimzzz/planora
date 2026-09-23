import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'tamagui';
import { deleteOwnAccount, fetchDeletionImpact, type DeletionImpact } from '@/lib/account';
import { brand } from '@/lib/theme';
import { Card, Heading, Muted, PushButton, Tappable } from '@/components/ui';

/**
 * Permanent account deletion, required by both app stores.
 *
 * Two steps on purpose, and the second one spells out what disappears for
 * other people, deleting a creator deletes their plans for everyone in them,
 * which is not something to discover afterwards. No native Alert: it behaves
 * differently across platforms and can't be styled or tested.
 */
export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    setConfirming(true);
    try {
      setImpact(await fetchDeletionImpact());
    } catch {
      // The warning is a courtesy; not being able to count shouldn't block the
      // right to delete.
      setImpact(null);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await deleteOwnAccount();
      // The auth listener sees the sign-out and the root layout routes to
      // sign-in, so there is nothing to navigate to here.
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Tappable onPress={open}>
        <View alignItems="center" paddingVertical={14}>
          <Text color={brand.inkSoft} fontSize={14} fontWeight="600">
            Delete my account
          </Text>
        </View>
      </Tappable>
    );
  }

  return (
    <Card borderColor={brand.danger} gap={12}>
      <View flexDirection="row" alignItems="center" gap={8}>
        <Ionicons name="warning-outline" size={18} color={String(brand.danger)} />
        <Heading color={brand.danger}>Delete your account?</Heading>
      </View>

      <Muted fontSize={14}>This cannot be undone.</Muted>

      {impact && (
        <View gap={4}>
          {impact.plansCreated > 0 && (
            <Text fontSize={14} color={brand.ink}>
              •{' '}
              <Text fontWeight="800">
                {impact.plansCreated} plan{impact.plansCreated === 1 ? '' : 's'} you created
              </Text>{' '}
              will be deleted for everyone in them
            </Text>
          )}
          {impact.plansJoined > 0 && (
            <Text fontSize={14} color={brand.ink}>
              • You'll be removed from {impact.plansJoined} plan
              {impact.plansJoined === 1 ? '' : 's'} you joined
            </Text>
          )}
          {impact.messagesSent > 0 && (
            <Text fontSize={14} color={brand.ink}>
              • {impact.messagesSent} message{impact.messagesSent === 1 ? '' : 's'} you sent will be
              deleted
            </Text>
          )}
          <Text fontSize={14} color={brand.ink}>
            • Your profile and sign-in are removed permanently
          </Text>
        </View>
      )}

      {error && (
        <Text color={brand.danger} fontSize={14} fontWeight="600">
          {error}
        </Text>
      )}

      <PushButton label="Yes, delete everything" tone="danger" onPress={confirm} busy={busy} />
      <Tappable onPress={() => setConfirming(false)} disabled={busy}>
        <View alignItems="center" paddingVertical={10}>
          <Text color={brand.inkSoft} fontSize={15} fontWeight="700">
            Keep my account
          </Text>
        </View>
      </Tappable>
    </Card>
  );
}
