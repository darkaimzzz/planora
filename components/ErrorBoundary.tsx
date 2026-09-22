import { Component, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Text, View } from 'tamagui';
import { brand } from '@/lib/theme';
import { Card, Heading, Muted, NeutralButton, PushButton, Screen } from '@/components/ui';

/**
 * Catches render errors so the app shows what went wrong instead of vanishing.
 *
 * A React Native release build has no red box: an uncaught render error
 * terminates the process, which looks to the user like the app "just closes".
 * That happened here for a date the device couldn't parse, and left nothing to
 * debug with. Now the error is on screen and copyable.
 */
type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('render error', error, info.componentStack);
  }

  /**
   * A boundary only catches errors thrown while rendering. Anything thrown in
   * an event handler, a timer or an await lands on React Native's global
   * handler, which in a release build simply ends the process — no message,
   * no screen, nothing to report. Route those here too.
   */
  componentDidMount() {
    const utils = (globalThis as { ErrorUtils?: {
      getGlobalHandler?: () => (e: Error, fatal?: boolean) => void;
      setGlobalHandler?: (h: (e: Error, fatal?: boolean) => void) => void;
    } }).ErrorUtils;
    if (!utils?.setGlobalHandler) return;
    const previous = utils.getGlobalHandler?.();
    utils.setGlobalHandler((error, fatal) => {
      this.setState({ error });
      // Still log it, but do not let the default handler tear the app down —
      // the screen below is more useful than a disappearing app.
      console.error('uncaught error', fatal ? '(fatal)' : '', error);
      if (!fatal) previous?.(error, fatal);
    });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const report = `${error.message}\n\n${error.stack ?? ''}`.trim();

    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingTop: 80 }}>
          <Heading>Something broke on this screen</Heading>
          <Muted>
            This is a bug, not something you did. Copying the details and sending them makes it
            fixable.
          </Muted>
          <Card gap={8}>
            <Text fontWeight="800" color={brand.danger}>
              {error.message}
            </Text>
            {!!error.stack && (
              <Text fontSize={11} color={brand.inkSoft} >
                {error.stack.split('\n').slice(0, 8).join('\n')}
              </Text>
            )}
          </Card>
          <PushButton label="Copy the details" onPress={() => Clipboard.setStringAsync(report)} />
          <NeutralButton label="Try again" onPress={() => this.setState({ error: null })} />
        </ScrollView>
      </Screen>
    );
  }
}
