import { KeyboardAwareScrollView as ScrollView } from '../../../src/ui/KeyboardAwareScrollView';
import { formSpacing } from '../../../src/shared/theme/formSpacing';
import { useToastState } from '../../../src/ui/useToastState';
import { apiErrorMessage } from '../../../src/core/admin/http';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { AppIcon } from "../../../src/ui/AppIcon";

import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { api } from '../../../src/core/api/client';

import { colors } from '../../../src/features/employee/data';
import { useDesktopStyles } from '../../../src/ui/useDesktopStyles';


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
        : date.toLocaleString('en-IN').replace(/\b(am|pm)\b/gi, marker => marker.toUpperCase());
}

function errorMessage(error: unknown): string {
  return apiErrorMessage(error, "Something went wrong. Please retry.");
}

async function taskRequest<T>(
    method: 'GET' | 'PATCH' | 'POST',
    path: string,
    data?: unknown,
): Promise<T> {
    const response = await api.request<T>({
        method,
        url: path,
        data,
    });

    return response.data;
}

export default function EmployeeTaskDetailsScreen({ backRoute = '/employee/tasks' }: {
    backRoute?: '/employee/tasks' | '/admin/my-tasks';
} = {}) {
    const styles = useDesktopStyles(baseStyles);
    const router = useRouter();

    const { id } = useLocalSearchParams<{ id: string }>();

    const [task, setTask] = useState<TaskDetails | null>(null);
    const [selectedStatus, setSelectedStatus] =
        useState<TaskStatus>('TODO');
    const [comment, setComment] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useToastState('', 'error');
    const [saveError, setSaveError] = useToastState('', 'error');
    const [notice, setNotice] = useToastState('', 'success');
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
        <SafeAreaView edges={["left", "right"]} style={styles.safe}>
            <View
                style={styles.flex}

            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <AdminPageHeading title="Task details" backDisabled={saving} onBack={() => router.replace(backRoute)} />
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



                                            <TextInput label={"Progress / Completion Comment"}
                                                accessibilityLabel="Progress comment"
                                                value={comment}
                                                onChangeText={(value) => {
                                                    setComment(value);
                                                    setSaveError('');
                                                    setNotice('');
                                                }}
                                                multiline
                                                maxLength={2000}
                                                editable={!saving}
                                                style={styles.commentInput}
                                            />
                                            <Text style={styles.muted}>{comment.length}/2000 characters. A comment is optional when changing status.</Text>

                                            {!!saveError && (
                                                <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text>
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
            </View>
        </SafeAreaView>
    );
}

const baseStyles = StyleSheet.create({
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
    back: { minHeight: 44, justifyContent: 'center' },
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
        minHeight: 44,
        justifyContent: 'center',
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
        marginTop: formSpacing.field,
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
