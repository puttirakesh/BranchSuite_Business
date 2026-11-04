import React from 'react';
import { View } from 'react-native';
import { isAppError } from '../../core/api/api-error';
import { AppText } from './AppText';
import { Button } from './AppButton';
import { Icon } from './Icon';
import { stateStyles as styles } from './EmptyState';

/** Explains what failed (no backend, pending endpoint, role, network…) and offers a retry when useful. */
export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const kind = isAppError(error) ? error.kind : 'unknown';
  const title =
    kind === 'not_configured' ? 'No backend connected'
    : kind === 'pending_integration' ? 'Waiting for backend support'
    : kind === 'forbidden' ? 'Not available for your role'
    : kind === 'not_found' ? 'Record not found'
    : kind === 'network' ? 'Connection problem'
    : 'Could not load this';
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const endpoint = isAppError(error) ? error.detail?.endpoint : undefined;
  const retryable = kind === 'network' || kind === 'server' || kind === 'unknown';
  return (
    <View style={[styles.box, compact ? styles.compact : null]} accessibilityRole="alert">
      <View style={[styles.icon, styles.errorIcon]}><Icon name="info" size={20} color="#A42F43" /></View>
      <AppText variant="h3" style={styles.center}>{title}</AppText>
      <AppText variant="small" style={styles.center}>{message}</AppText>
      {kind === 'pending_integration' && endpoint ? <AppText variant="tiny" style={styles.center}>Needs: {endpoint}</AppText> : null}
      {onRetry && retryable ? <Button label="Try again" variant="secondary" small icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}
