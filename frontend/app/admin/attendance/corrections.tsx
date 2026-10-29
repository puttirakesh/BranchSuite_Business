import { KeyboardAwareScrollView as ScrollView } from '../../../src/ui/KeyboardAwareScrollView';
import { useToastState } from '../../../src/ui/useToastState';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { AdminPageHeading } from "../../../src/ui/AdminPageHeading";

import React, {
  useCallback,
  useState,
} from 'react';

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  useRouter,
} from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';

import {
  attendanceCorrectionsApi,
  type AttendanceCorrectionDto,
} from '../../../src/core/admin/api';

import {
  getAdminScope,
  useAdminScope,
} from '../../../src/core/admin/scope';

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Request failed. Please retry.';
}

function utcLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 16)
    .replace('T', ' ') + ' UTC';
}

export default function AttendanceCorrectionsPage() {
  const { styles } = useAdminLayout(baseStyles);

  const router = useRouter();
  const selectedScope = useAdminScope();

  const [requests, setRequests] =
    useState<AttendanceCorrectionDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState('', 'error');
  const [notice, setNotice] = useToastState('', 'success');

  const [refresh, setRefresh] = useState(0);
  const [busyId, setBusyId] =
    useState<string | null>(null);

  const [notes, setNotes] =
    useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError('');

      getAdminScope()
        .then(scope =>
          attendanceCorrectionsApi.list({
            companyId: scope.companyId,
            ...(scope.branchId ? { branchId: scope.branchId } : {}),
            status: 'PENDING',
          }),
        )
        .then(data => {
          if (active) setRequests(data);
        })
        .catch(cause => {
          if (active) {
            setError(errorText(cause));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [refresh, selectedScope?.companyId, selectedScope?.branchId]),
  );

  async function review(
    item: AttendanceCorrectionDto,
    action: 'approve' | 'reject',
  ) {
    if (busyId !== null) return;

    const note = (notes[item.id] ?? '').trim();

    if (action === 'reject' && !note) {
      setError(
        'Enter a rejection reason before rejecting.',
      );
      return;
    }

    setBusyId(item.id);
    setError('');
    setNotice('');

    try {
      if (action === 'approve') {
        await attendanceCorrectionsApi.approve(
          item.id,
          note || undefined,
        );
      } else {
        await attendanceCorrectionsApi.reject(
          item.id,
          note,
        );
      }

      setNotice(
        action === 'approve'
          ? 'Correction approved.'
          : 'Correction rejected.',
      );
      setNotes(current => { const next = { ...current }; delete next[item.id]; return next; });

      setRefresh(value => value + 1);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AdminPageHeading title="Attendance corrections" onRefresh={() => setRefresh(value => value + 1)} refreshing={loading} />

        {!!notice && (
          <Text style={styles.notice}>
            {notice}
          </Text>
        )}

        {!!error && (
          <View style={styles.card}>
            <Text style={styles.error}>
              {error}
            </Text>

            <Pressable
              onPress={() =>
                setRefresh(value => value + 1)
              }
              style={styles.action}
            >
              <Text style={styles.link}>
                Retry / Refresh
              </Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            style={styles.loading}
          />
        ) : requests.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.subtitle}>
              No pending attendance corrections
              are available for review.
            </Text>
          </View>
        ) : (
          requests.map(item => (
            <View
              key={item.id}
              style={styles.card}
            >
              <Text style={styles.name}>
                {item.requestedBy?.name ??
                  'Employee'}
              </Text>

              <Text style={styles.subtitle}>
                Status: {item.status}
              </Text>

              <Text style={styles.label}>
                Recorded attendance
              </Text>

              <Text style={styles.details}>
                In: {item.attendance?.checkInAt
                  ? utcLabel(
                      item.attendance.checkInAt,
                    )
                  : 'Not recorded'}
              </Text>

              <Text style={styles.details}>
                Out: {item.attendance?.checkOutAt
                  ? utcLabel(
                      item.attendance.checkOutAt,
                    )
                  : 'Not recorded'}
              </Text>

              <Text style={styles.label}>
                Requested correction
              </Text>

              <Text style={styles.details}>
                In: {utcLabel(
                  item.requestedCheckInAt,
                )}
              </Text>

              <Text style={styles.details}>
                Out: {utcLabel(
                  item.requestedCheckOutAt,
                )}
              </Text>

              <Text style={styles.label}>
                Employee reason
              </Text>

              <Text style={styles.details}>
                {item.reason}
              </Text>

              <TextInput
                multiline
                editable={busyId === null}
                maxLength={1000}
                accessibilityLabel="Review note"
                value={notes[item.id] ?? ''}
                onChangeText={value =>
                  setNotes(previous => ({
                    ...previous,
                    [item.id]: value,
                  }))
                }
                style={styles.input}
              />

              <View style={styles.actions}>
                <Pressable
                  disabled={busyId !== null}
                  accessibilityRole="button"
                  onPress={() =>
                    void review(item, 'approve')
                  }
                  style={[
                    styles.button,
                    styles.approve,
                  ]}
                >
                  <Text style={styles.buttonText}>
                    {busyId === item.id
                      ? 'Processing...'
                      : 'Approve'}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={busyId !== null}
                  accessibilityRole="button"
                  onPress={() =>
                    void review(item, 'reject')
                  }
                  style={[
                    styles.button,
                    styles.reject,
                  ]}
                >
                  <Text style={styles.buttonText}>
                    Reject
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F6F8FD',
  },
  content: {
    width: '100%',
    maxWidth: 850,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  back: {
    minHeight: 44,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#20334F',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#72819B',
    marginTop: 8,
  },
  loading: {
    marginTop: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E9F4',
    padding: 18,
    marginTop: 16,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: '#20334F',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 5,
    color: '#405573',
  },
  details: {
    fontSize: 13,
    color: '#405573',
    lineHeight: 21,
  },
  input: {
    minHeight: 80,
    padding: 12,
    marginTop: 18,
    backgroundColor: '#FCFDFF',
    borderRadius: 12,
    borderColor: '#DCE5F3',
    borderWidth: 1,
    textAlignVertical: 'top',
    color: '#20334F',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approve: {
    backgroundColor: '#23876A',
  },
  reject: {
    backgroundColor: '#B94D61',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  link: {
    color: '#345CF2',
    fontWeight: '700',
  },
  error: {
    color: '#B94D61',
    fontSize: 12,
  },
  notice: {
    color: '#23876A',
    fontSize: 12,
  },
});
