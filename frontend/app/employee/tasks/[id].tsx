
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

import { colors } from '../../../src/features/employee/data';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const TOKEN_KEY = 'branchsuite_access_token';

type TaskStatus =
    | 'TODO'
    | 'IN_PROGRESS'
    | 'ON_HOLD'
    | 'COMPLETED'
    | 'CANCELLED';

type TaskPriority =
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'URGENT';

type TaskComment = {
    id: string;
    message: string;
    createdAt: string;
    user: {
        id: string;
        name: string;
    };
};

type TaskDetails = {
    id: string;
    title: string;
    description: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: string | null;
    createdAt: string;
    completedAt: string | null;
    assignedToId: string;
    assignedTo?: {
        id: string;
        name: string;
    };
    createdBy?: {
        id: string;
        name: string;
    };
    comments: TaskComment[];
};

const statuses: Array<{
    value: TaskStatus;
    label: string;
}> = [
        { value: 'TODO', label: 'To Do' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'ON_HOLD', label: 'On Hold' },
        { value: 'COMPLETED', label: 'Completed' },
    ];

function statusLabel(status: TaskStatus): string {
    if (status === 'CANCELLED') return 'Cancelled';

    return statuses.find((item) => item.value === status)?.label ?? status;
}

function dateLabel(value: string | null | undefined): string {
    if (!value) return 'Not set';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function dateTimeLabel(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 'Invalid date'
        : date.toLocaleString('en-IN');
}

function errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;

        if (Array.isArray(message)) return message.join(', ');
        if (typeof message === 'string') return message;

        if (error.response?.status === 401) {
            return 'Your login has expired. Please sign in again.';
        }

        if (error.response?.status === 403) {
            return 'You do not have permission to access this task.';
        }

        if (error.response?.status === 404) {
            return 'Task not found.';
        }

        if (!error.response) {
            return 'Cannot connect to the backend. Check the server and network.';
        }
    }

    return error instanceof Error
        ? error.message
        : 'Something went wrong. Please retry.';
}

async function getToken(): Promise<string> {
    let token: string | null = null;

    if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
            token = window.sessionStorage.getItem(TOKEN_KEY);
        }
    } else {
        token = await SecureStore.getItemAsync(TOKEN_KEY);
    }

    if (!token) {
        throw new Error('Login required. Please sign in again.');
    }

    return token;
}

async function taskRequest<T>(
    method: 'GET' | 'PATCH' | 'POST',
    path: string,
    data?: unknown,
): Promise<T> {
    if (!API_URL) {
        throw new Error(
            'EXPO_PUBLIC_API_URL is not configured in the frontend.',
        );
    }

    const token = await getToken();

    const response = await axios.request<T>({
        method,
        url: `${API_URL}${path}`,
        data,
        headers: {
            Authorization: `Bearer ${token}`,
        },
        timeout: 15000,
    });

    return response.data;
}

export default function EmployeeTaskDetailsScreen() {
    const router = useRouter();

    const { id } = useLocalSearchParams<{ id: string }>();

    const [task, setTask] = useState<TaskDetails | null>(null);
    const [selectedStatus, setSelectedStatus] =
        useState<TaskStatus>('TODO');
    const [comment, setComment] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [notice, setNotice] = useState('');
    const [reload, setReload] = useState(0);

    const savingRef = useRef(false);

    const loadTask = useCallback(async () => {
        if (!id) throw new Error('Task ID is missing.');

        return taskRequest<TaskDetails>(
            'GET',
            `/tasks/${encodeURIComponent(id)}`,
        );
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            let active = true;

            async function load() {
                setLoading(true);
                setError('');

                try {
                    const result = await loadTask();

                    if (!active) return;

                    setTask(result);
                    setSelectedStatus(result.status);
                    setComment('');
                } catch (reason) {
                    if (active) setError(errorMessage(reason));
                } finally {
                    if (active) setLoading(false);
                }
            }

            void load();

            return () => {
                active = false;
            };
        }, [loadTask, reload]),
    );

    const statusChanged =
        task !== null && selectedStatus !== task.status;

    const hasComment = comment.trim().length > 0;

    const isCancelled = task?.status === 'CANCELLED';

    const canSave =
        !loading &&
        !saving &&
        !!task &&
        !isCancelled &&
        (statusChanged || hasComment);

    async function saveProgress() {
        if (!task || !id || !canSave || savingRef.current) return;

        savingRef.current = true;
        setSaving(true);
        setSaveError('');
        setNotice('');

        let savedStatus = false;

        try {
            if (statusChanged) {
                await taskRequest(
                    'PATCH',
                    `/tasks/${encodeURIComponent(id)}/status`,
                    { status: selectedStatus },
                );

                savedStatus = true;
            }

            if (hasComment) {
                await taskRequest(
                    'POST',
                    `/tasks/${encodeURIComponent(id)}/comments`,
                    { message: comment.trim() },
                );
            }

            const updated = await loadTask();

            setTask(updated);
            setSelectedStatus(updated.status);
            setComment('');

            setNotice(
                statusChanged && hasComment
                    ? 'Status and progress comment saved.'
                    : statusChanged
                        ? 'Task status updated.'
                        : 'Progress comment added.',
            );
        } catch (reason) {
            if (savedStatus) {
                try {
                    const latest = await loadTask();
                    setTask(latest);
                    setSelectedStatus(latest.status);
                } catch {
                    // Keep the original error.
                }
            }

            setSaveError(
                savedStatus && hasComment
                    ? `Status saved, but the comment may not have been saved. ${errorMessage(reason)}`
                    : errorMessage(reason),
            );
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Pressable
                            onPress={() => router.back()}
                            accessibilityRole="button"
                            style={styles.back}
                        >
                            <Text style={styles.backText}>‹ Back to Tasks</Text>
                        </Pressable>

                        <Text style={styles.heading}>Task Details</Text>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.content}
                        keyboardShouldPersistTaps="handled"
                    >
                        {loading ? (
                            <View style={styles.center}>
                                <ActivityIndicator color={colors.primary} size="large" />
                                <Text style={styles.muted}>Loading task...</Text>
                            </View>
                        ) : error ? (
                            <View style={styles.card}>
                                <Text style={styles.error}>{error}</Text>

                                <Pressable
                                    onPress={() => setReload((value) => value + 1)}
                                    style={styles.action}
                                >
                                    <Text style={styles.actionText}>Retry</Text>
                                </Pressable>
                            </View>
                        ) : task ? (
                            <>
                                <View style={styles.card}>
                                    <Text style={styles.taskTitle}>{task.title}</Text>

                                    <Text style={styles.statusText}>
                                        {statusLabel(task.status)} · {task.priority} priority
                                    </Text>

                                    <View style={styles.divider} />

                                    <Text style={styles.label}>Assigned By</Text>
                                    <Text style={styles.value}>
                                        {task.createdBy?.name ?? 'Administrator'}
                                    </Text>

                                    <Text style={styles.label}>Due Date</Text>
                                    <Text style={styles.value}>
                                        {dateLabel(task.dueDate)}
                                    </Text>

                                    <Text style={styles.label}>Created On</Text>
                                    <Text style={styles.value}>
                                        {dateLabel(task.createdAt)}
                                    </Text>

                                    <Text style={styles.label}>Instructions</Text>
                                    <Text style={styles.description}>
                                        {task.description?.trim() ||
                                            'No additional instructions.'}
                                    </Text>
                                </View>

                                <View style={styles.card}>
                                    <Text style={styles.sectionTitle}>Update Progress</Text>

                                    {isCancelled ? (
                                        <Text style={styles.muted}>
                                            This task has been cancelled by an administrator.
                                        </Text>
                                    ) : (
                                        <>
                                            <Text style={styles.label}>Task Status</Text>

                                            <View style={styles.statusOptions}>
                                                {statuses.map((option) => (
                                                    <Pressable
                                                        key={option.value}
                                                        accessibilityRole="button"
                                                        accessibilityState={{
                                                            selected: selectedStatus === option.value,
                                                        }}
                                                        onPress={() => {
                                                            setSelectedStatus(option.value);
                                                            setSaveError('');
                                                            setNotice('');
                                                        }}
                                                        disabled={saving}
                                                        style={[
                                                            styles.statusOption,
                                                            selectedStatus === option.value &&
                                                            styles.statusOptionSelected,
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.statusOptionText,
                                                                selectedStatus === option.value &&
                                                                styles.statusOptionTextSelected,
                                                            ]}
                                                        >
                                                            {option.label}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </View>

                                            <Text style={styles.label}>
                                                Progress / Completion Comment
                                            </Text>

                                            <TextInput
                                                value={comment}
                                                onChangeText={(value) => {
                                                    setComment(value);
                                                    setSaveError('');
                                                    setNotice('');
                                                }}
                                                multiline
                                                maxLength={2000}
                                                editable={!saving}
                                                placeholder="Describe the progress or completed work"
                                                placeholderTextColor="#8a98ae"
                                                style={styles.commentInput}
                                            />

                                            {!!saveError && (
                                                <Text style={styles.error}>{saveError}</Text>
                                            )}

                                            {!!notice && (
                                                <Text style={styles.notice}>{notice}</Text>
                                            )}

                                            <Pressable
                                                accessibilityRole="button"
                                                disabled={!canSave}
                                                onPress={() => void saveProgress()}
                                                style={[
                                                    styles.action,
                                                    !canSave && styles.disabled,
                                                ]}
                                            >
                                                {saving ? (
                                                    <ActivityIndicator color="#ffffff" />
                                                ) : (
                                                    <Text style={styles.actionText}>
                                                        Save Progress
                                                    </Text>
                                                )}
                                            </Pressable>
                                        </>
                                    )}
                                </View>

                                <Text style={styles.sectionTitle}>Progress Comments</Text>

                                {task.comments.length === 0 ? (
                                    <View style={styles.card}>
                                        <Text style={styles.muted}>
                                            No progress comments yet.
                                        </Text>
                                    </View>
                                ) : (
                                    task.comments.map((item) => (
                                        <View key={item.id} style={styles.commentCard}>
                                            <Text style={styles.commentAuthor}>
                                                {item.user?.name ?? 'Team member'}
                                            </Text>

                                            <Text style={styles.commentDate}>
                                                {dateTimeLabel(item.createdAt)}
                                            </Text>

                                            <Text style={styles.commentMessage}>
                                                {item.message}
                                            </Text>
                                        </View>
                                    ))
                                )}
                            </>
                        ) : (
                            <Text style={styles.error}>Task not available.</Text>
                        )}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f6f8fd' },
    flex: { flex: 1 },
    container: {
        flex: 1,
        width: '100%',
        maxWidth: 640,
        alignSelf: 'center',
    },
    header: {
        padding: 18,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e4eaf5',
    },
    back: { minHeight: 36, justifyContent: 'center' },
    backText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
    heading: {
        fontSize: 24,
        fontWeight: '800',
        color: '#20334f',
        marginTop: 8,
    },
    content: { padding: 16, paddingBottom: 32 },
    center: { alignItems: 'center', padding: 30, gap: 12 },
    muted: { fontSize: 12, lineHeight: 19, color: '#71829c' },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e4eaf5',
        marginBottom: 16,
    },
    taskTitle: { fontSize: 21, fontWeight: '800', color: '#20334f' },
    statusText: { fontSize: 12, color: colors.primary, marginTop: 8 },
    divider: {
        height: 1,
        backgroundColor: '#edf1f8',
        marginVertical: 16,
    },
    label: {
        marginTop: 15,
        marginBottom: 5,
        fontSize: 11,
        fontWeight: '700',
        color: '#71829c',
    },
    value: { fontSize: 14, color: '#20334f' },
    description: {
        marginTop: 4,
        fontSize: 13,
        color: '#405573',
        lineHeight: 21,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#20334f',
        marginBottom: 10,
    },
    statusOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    statusOption: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#f1f4fa',
        borderWidth: 1,
        borderColor: '#e4eaf5',
    },
    statusOptionSelected: {
        backgroundColor: '#eaf0ff',
        borderColor: colors.primary,
    },
    statusOptionText: {
        color: '#405573',
        fontSize: 12,
        fontWeight: '600',
    },
    statusOptionTextSelected: {
        color: colors.primary,
    },
    commentInput: {
        minHeight: 110,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dce5f3',
        backgroundColor: '#fcfdff',
        color: '#20334f',
        fontSize: 13,
        textAlignVertical: 'top',
        marginTop: 6,
    },
    action: {
        minHeight: 46,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        marginTop: 16,
    },
    actionText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 13,
    },
    disabled: { opacity: 0.5 },
    error: {
        fontSize: 12,
        color: '#b94d61',
        lineHeight: 19,
        marginTop: 10,
    },
    notice: {
        fontSize: 12,
        color: '#34856c',
        marginTop: 10,
    },
    commentCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e4eaf5',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
    },
    commentAuthor: {
        fontSize: 13,
        fontWeight: '700',
        color: '#20334f',
    },
    commentDate: {
        fontSize: 10,
        color: '#8192ad',
        marginTop: 4,
    },
    commentMessage: {
        fontSize: 12,
        color: '#405573',
        lineHeight: 19,
        marginTop: 12,
    },
});
