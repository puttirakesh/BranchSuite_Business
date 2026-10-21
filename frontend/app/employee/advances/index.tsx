import { apiErrorMessage } from '../../../src/core/admin/http';
import { AppIcon } from "../../../src/ui/AppIcon";

import React, {
  useCallback,
  useState,
  useRef,
} from "react";

import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";

import { useFocusEffect } from "expo-router";

import { api } from "../../../src/core/api/client";

import {
  Button,
  Badge,
  Field,
} from "../../../src/features/employee/components";

import {
  money,
} from "../../../src/features/employee/data";

import {
  useEmployeeStyles,
} from "../../../src/features/employee/styles";

// =====================================================
// TYPES
// =====================================================

type AdvanceStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

type EmployeeContext = {
  id: string;
  companyId: string;
  branchId: string;
  employeeCode: string;
  company: {
    name: string;
  };
  branch: {
    name: string;
  };
};

type AdvanceRequest = {
  id: string;
  companyId: string;
  branchId: string;
  amount: string;
  reason: string;
  status: AdvanceStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  company?: {
    name: string;
  };
  branch?: {
    name: string;
  };
};

// =====================================================
// HELPERS
// =====================================================

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(
  status: AdvanceStatus,
): string {
  switch (status) {
    case "PENDING":
      return "Pending";

    case "APPROVED":
      return "Approved";

    case "REJECTED":
      return "Rejected";

    case "CANCELLED":
      return "Cancelled";

    default:
      return status;
  }
}

function getErrorMessage(error: unknown): string {
  return apiErrorMessage(error, "Something went wrong. Please try again.");
}

function isValidAmount(value: string): boolean {
  const trimmed = value.trim();

  if (
    !/^\d{1,12}(\.\d{1,2})?$/.test(trimmed)
  ) {
    return false;
  }

  const amount = Number(trimmed);

  return (
    Number.isFinite(amount) &&
    amount > 0
  );
}

// =====================================================
// EMPLOYEE ADVANCES SCREEN
// =====================================================

export default function AdvancesScreen() {
  const s = useEmployeeStyles();
  // Employee work contexts
  const [
    contexts,
    setContexts,
  ] = useState<EmployeeContext[]>([]);

  const [
    selectedContext,
    setSelectedContext,
  ] = useState<EmployeeContext | null>(null);

  // Backend request history
  const [
    advances,
    setAdvances,
  ] = useState<AdvanceRequest[]>([]);

  // Form state
  const [
    advanceAmount,
    setAdvanceAmount,
  ] = useState("");

  const [
    advanceReason,
    setAdvanceReason,
  ] = useState("");

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] =
    useState(false);

  const [cancellingId, setCancellingId] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [formError, setFormError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [refreshKey, setRefreshKey] =
    useState(0);
  const [cancelRequest, setCancelRequest] = useState<AdvanceRequest | null>(null);
  const [cancelError, setCancelError] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const busy = useRef(false);

  // ===================================================
  // FETCH EMPLOYEE CONTEXTS + ADVANCE HISTORY
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadData() {
        setLoading(true);
        setError("");

        try {
          const [
            contextsResponse,
            advancesResponse,
          ] = await Promise.all([
            api.get<EmployeeContext[]>(
              "/advances/my-contexts",
            ),

            api.get<AdvanceRequest[]>(
              "/advances/my",
            ),
          ]);

          if (
            !Array.isArray(
              contextsResponse.data,
            ) ||
            !Array.isArray(
              advancesResponse.data,
            )
          ) {
            throw new Error(
              "Unexpected salary advances API response.",
            );
          }

          if (!active) return;

          const availableContexts =
            contextsResponse.data;

          setContexts(availableContexts);

          setSelectedContext((current) => {
            if (current) {
              const stillAvailable =
                availableContexts.find(
                  (context) =>
                    context.id === current.id,
                );

              if (stillAvailable) {
                return stillAvailable;
              }
            }

            return availableContexts[0] ?? null;
          });

          setAdvances(
            advancesResponse.data,
          );
        } catch (reason) {
          if (active) {
            setContexts([]);
            setSelectedContext(null);
            setAdvances([]);
            setError(getErrorMessage(reason));
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadData();

      return () => {
        active = false;
      };
    }, [refreshKey]),
  );

  // ===================================================
  // REFRESH
  // ===================================================

  function refreshData() {
    setRefreshKey(
      (current) => current + 1,
    );
  }

  // ===================================================
  // SUBMIT ADVANCE
  // ===================================================

  async function submitAdvance() {
    if (busy.current || submitting || loading || cancellingId) return;

    setFormError("");
    setMessage("");

    if (!selectedContext) {
      setFormError(
        "No active employee company or branch assignment is available.",
      );
      return;
    }

    if (!isValidAmount(advanceAmount)) {
      setFormError(
        "Enter a positive amount with up to two decimal places.",
      );
      return;
    }

    const reason = advanceReason.trim();

    if (
      reason.length < 3 ||
      reason.length > 1000
    ) {
      setFormError(
        "Enter a reason between 3 and 1000 characters.",
      );
      return;
    }

    busy.current = true;
    setSubmitting(true);

    try {
      await api.post(
        "/advances",
        {
          companyId:
            selectedContext.companyId,

          branchId:
            selectedContext.branchId,

          amount:
            advanceAmount.trim(),

          reason,
        },
      );

      setAdvanceAmount("");
      setAdvanceReason("");
      setAmountTouched(false);
      setFormError("");

      setMessage(
        "Salary advance request submitted successfully.",
      );

      refreshData();
    } catch (reason) {
      setFormError(
        getErrorMessage(reason),
      );
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  // ===================================================
  // CANCEL REQUEST
  // ===================================================

  async function cancelAdvance(
    advance: AdvanceRequest,
  ) {
    if (
      busy.current || cancellingId ||
      advance.status !== "PENDING"
    ) {
      return;
    }

    busy.current = true;
    setCancellingId(advance.id);
    setCancelError('');
    setError("");
    setMessage("");

    try {
      await api.patch(
        `/advances/${advance.id}/cancel`,
        {},
      );

      setMessage(
        "Advance request cancelled.",
      );
      setCancelRequest(null);

      refreshData();
    } catch (reason) {
      setCancelError(getErrorMessage(reason));
    } finally {
      busy.current = false;
      setCancellingId(null);
    }
  }

  function confirmCancel(
    advance: AdvanceRequest,
  ) {
    setCancelError('');
    setCancelRequest(advance);
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <View style={s.column}>
      {/* HEADING */}
      <Modal transparent visible={!!cancelRequest} animationType="fade" onRequestClose={() => { if (!cancellingId) setCancelRequest(null); }}>
        <View style={s.overlay}><View accessibilityViewIsModal style={[s.modal, { gap: 12 }]}>
          <Text accessibilityRole="header" style={s.sectionTitle}>Cancel advance request?</Text>
          <Text style={s.body}>Cancel your pending request for {cancelRequest ? money(Number(cancelRequest.amount)) : ''}?</Text>
          {!!cancelError && <Text accessibilityRole="alert" style={s.error}>{cancelError}</Text>}
          <Button label="Keep request" secondary disabled={!!cancellingId} onPress={() => setCancelRequest(null)} />
          <Button label={cancellingId ? 'Cancelling…' : 'Confirm cancellation'} disabled={!!cancellingId} onPress={() => { if (cancelRequest) void cancelAdvance(cancelRequest); }} />
        </View></View>
      </Modal>

      <View style={[s.between, { justifyContent: "flex-end" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh advance requests"
          disabled={
            loading ||
            submitting ||
            cancellingId !== null
          }
          onPress={refreshData}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              color: "#345CF2",
              fontWeight: "700",
            }}
          >
            Refresh
          </Text>
        </Pressable>
      </View>

      {/* LOADING */}

      {loading ? (
        <View
          style={[
            s.card,
            {
              alignItems: "center",
              gap: 12,
              paddingVertical: 24,
            },
          ]}
        >
          <ActivityIndicator
            color="#345CF2"
          />

          <Text style={s.small}>
            Loading salary advances...
          </Text>
        </View>
      ) : error ? (
        <View style={[s.card, { gap: 10 }]}>
          <Text style={s.cardTitle}>
            Unable to load requests
          </Text>

          <Text
            accessibilityRole="alert"
            style={s.error}
          >
            {error}
          </Text>

          <Button
            label="Try again"
            onPress={refreshData}
          />
        </View>
      ) : (
        <>
          {/* SUCCESS MESSAGE */}

          {!!message && (
            <View
              style={[
                s.card,
                {
                  backgroundColor:
                    "#E8F7EF",
                },
              ]}
            >
              <Text
                style={{
                  color: "#157347",
                  fontWeight: "600",
                }}
              >
                {message}
              </Text>
            </View>
          )}

          {/* ADVANCE REQUEST FORM */}

          <View
            style={[
              s.card,
              {
                gap: 12,
              },
            ]}
          >
            <Text style={s.sectionTitle}>
              Request an advance
            </Text>

            <Text style={s.small}>
              Requests are submitted to
              your company's administrator
              for review.
            </Text>

            {/* EMPLOYEE CONTEXT */}

            {selectedContext ? (
              <View
                style={{
                  gap: 8,
                  padding: 12,
                  backgroundColor:
                    "#F5F7FC",
                  borderRadius: 10,
                }}
              >
                <Text style={s.cardTitle}>
                  Company and branch
                </Text>

                <Text style={s.body}>
                  {
                    selectedContext.company
                      .name
                  }
                </Text>

                <Text style={s.small}>
                  {
                    selectedContext.branch
                      .name
                  }
                </Text>

                <Text style={s.small}>
                  Employee code:{" "}
                  {
                    selectedContext.employeeCode
                  }
                </Text>
              </View>
            ) : (
              <Text
                style={s.error}
              >
                No active employee assignment
                found. Contact your company
                administrator.
              </Text>
            )}

            {/* MULTIPLE COMPANY CONTEXTS */}

            {contexts.length > 1 && (
              <View style={{ gap: 8 }}>
                <Text style={s.cardTitle}>
                  Select work assignment
                </Text>

                {contexts.map(
                  (context) => {
                    const selected =
                      selectedContext?.id ===
                      context.id;

                    return (
                      <Pressable
                        key={context.id}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected,
                        }}
                        disabled={submitting}
                        onPress={() =>
                          setSelectedContext(
                            context,
                          )
                        }
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor:
                            selected
                              ? "#345CF2"
                              : "#DCE3EF",
                          backgroundColor:
                            selected
                              ? "#EEF2FF"
                              : "#FFFFFF",
                        }}
                      >
                        <Text style={s.body}>
                          {context.company.name}
                        </Text>

                        <Text style={s.small}>
                          {context.branch.name}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            )}

            {/* AMOUNT */}

            <Field validation={{ required: true, min: 0.01 }}
              label="Amount (INR)"
              value={advanceAmount}
              onChange={(value) => {
                setAdvanceAmount(value);
                setFormError("");
              }}
              keyboardType="decimal-pad"
              inputMode="decimal"
              maxLength={15}
              editable={!submitting && !cancellingId}
              onBlur={() => setAmountTouched(true)}
              error={amountTouched && !isValidAmount(advanceAmount) ? 'Enter a positive amount with up to two decimal places.' : ''}
              hint="Use numbers only, for example 2500 or 2500.50."
            />
            <View style={[s.row, { flexWrap: 'wrap' }]}>{['1000', '2500', '5000'].map(amount => <Pressable key={amount} accessibilityRole="button" accessibilityLabel={`Set advance amount to ${amount} rupees`} disabled={submitting || !!cancellingId} onPress={() => { setAdvanceAmount(amount); setFormError(''); }} style={s.secondary}><Text style={s.body}>{money(Number(amount))}</Text></Pressable>)}</View>

            {/* REASON */}

            <Field validation={{ required: true, minLength: 3 }}
              label="Reason"
              value={advanceReason}
              onChange={(value) => {
                setAdvanceReason(value);
                setFormError("");
              }}
              multiline
              editable={!submitting && !cancellingId}
              maxLength={1000}
              hint={`${advanceReason.trim().length}/1000 characters · at least 3 characters`}
            />

            {/* VALIDATION MESSAGE */}

            {!!formError && (
              <Text
                accessibilityRole="alert"
                style={s.error}
              >
                {formError}
              </Text>
            )}

            {/* SUBMIT */}

            <Button
              label={
                submitting
                  ? "Submitting..."
                  : "Request advance"
              }
              disabled={
                !selectedContext ||
                submitting ||
                cancellingId !== null
              }
              onPress={() => {
                void submitAdvance();
              }}
            />
          </View>

          {/* REQUEST HISTORY */}

          <Text style={s.sectionTitle}>
            Request history
          </Text>

          {advances.map(
            (advance) => (
              <View
                key={advance.id}
                style={[
                  s.card,
                  {
                    gap: 10,
                  },
                ]}
              >
                <View style={s.between}>
                  <Text style={s.cardTitle}>
                    {money(
                      Number(
                        advance.amount,
                      ),
                    )}
                  </Text>

                  <Badge
                    label={statusLabel(
                      advance.status,
                    )}
                  />
                </View>

                <Text style={s.body}>
                  {advance.reason}
                </Text>

                <Text style={s.small}>
                  Requested:{" "}
                  {formatDate(
                    advance.createdAt,
                  )}
                </Text>

                {advance.company && (
                  <Text style={s.small}>
                    Company:{" "}
                    {advance.company.name}
                  </Text>
                )}

                {advance.branch && (
                  <Text style={s.small}>
                    Branch:{" "}
                    {advance.branch.name}
                  </Text>
                )}

                {!!advance.reviewNote && (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor:
                        "#F5F7FC",
                      gap: 4,
                    }}
                  >
                    <Text style={s.small}>
                      Review note
                    </Text>

                    <Text style={s.body}>
                      {advance.reviewNote}
                    </Text>
                  </View>
                )}

                {advance.reviewedAt && (
                  <Text style={s.small}>
                    Reviewed:{" "}
                    {formatDate(
                      advance.reviewedAt,
                    )}
                  </Text>
                )}

                {/* CANCEL PENDING REQUEST */}

                {advance.status ===
                  "PENDING" && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel pending advance request"
                    disabled={
                      cancellingId !== null ||
                      submitting
                    }
                    onPress={() =>
                      confirmCancel(
                        advance,
                      )
                    }
                    style={{
                      alignSelf:
                        "flex-start",
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: "#B94D61",
                        fontWeight: "700",
                      }}
                    >
                      {cancellingId ===
                      advance.id
                        ? "Cancelling..."
                        : "Cancel request"}
                    </Text>
                  </Pressable>
                )}
              </View>
            ),
          )}

          {advances.length === 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>
                No salary advance requests yet
              </Text>

              <Text style={s.small}>
                Your submitted requests
                and their approval status
                will appear here.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}
