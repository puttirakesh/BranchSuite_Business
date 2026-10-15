
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { api } from "../../../src/core/api/client";

import {
  attendanceApi,
  type AttendanceDto,
} from "../../../src/core/admin/api";

import { call } from "../../../src/core/admin/http";

import {
  getAdminScope,
  type AdminScope,
} from "../../../src/core/admin/scope";

import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { AdminMenuIcon } from "../../../src/ui/AdminMenuIcon";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";

import PersonalLeavePage from "../../../src/features/admin/PersonalLeavePage";

// =====================================================
// TYPES
// =====================================================

type CorrectionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

type CorrectionRequest = {
  id: string;
  companyId: string;
  branchId: string;
  attendanceId: string;
  requestedCheckInAt: string;
  requestedCheckOutAt: string;
  reason: string;
  status: CorrectionStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

// =====================================================
// DATE AND TIME HELPERS
// =====================================================

const utcDate = (value: string): string =>
  value.slice(0, 10);

const todayUTC = (): string =>
  new Date().toISOString().slice(0, 10);

const timeUTC = (
  value: string | null | undefined,
): string =>
  value
    ? new Date(value).toISOString().slice(11, 16)
    : "";

const dateLabel = (value: string): string =>
  value.split("-").reverse().join("/");

function daysAgoUTC(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function niceStatus(
  status: AttendanceDto["status"],
): string {
  switch (status) {
    case "PRESENT":
      return "Present";
    case "ABSENT":
      return "Absent";
    case "HALF_DAY":
      return "Half day";
    case "ON_LEAVE":
      return "On leave";
  }
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function correctionTimes(
  day: string,
  start: string,
  end: string,
) {
  const pattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (
    !pattern.test(start) ||
    !pattern.test(end)
  ) {
    throw new Error(
      "Enter both times in HH:mm (24-hour UTC) format.",
    );
  }

  const checkIn = new Date(
    `${day}T${start}:00.000Z`,
  );

  const checkOut = new Date(
    `${day}T${end}:00.000Z`,
  );

  const minutes =
    (checkOut.getTime() - checkIn.getTime()) /
    60000;

  if (minutes < 1 || minutes > 1440) {
    throw new Error(
      "Check-out must be after check-in (maximum 24 hours).",
    );
  }

  if (checkOut.getTime() > Date.now()) {
    throw new Error(
      "Corrected check-out cannot be in the future.",
    );
  }

  return {
    requestedCheckInAt: checkIn.toISOString(),
    requestedCheckOutAt: checkOut.toISOString(),
  };
}

// =====================================================
// ROUTE ENTRY
// =====================================================

export default function AttendancePage() {
  const { view } =
    useLocalSearchParams<{ view?: string }>();

  return view === "leave"
    ? <PersonalLeavePage />
    : <MyAttendancePage />;
}

// =====================================================
// MY ATTENDANCE
// =====================================================

function MyAttendancePage() {
  const { styles } = useAdminLayout(
    baseStyles,
    "page",
  );

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const savingRef = useRef(false);

  const [scope, setScope] =
    useState<AdminScope | null>(null);

  const [
    selectedBranchId,
    setSelectedBranchId,
  ] = useState("");

  const [records, setRecords] =
    useState<AttendanceDto[]>([]);

  const [requests, setRequests] =
    useState<CorrectionRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [punching, setPunching] = useState(false);

  const [
    branchPickerOpen,
    setBranchPickerOpen,
  ] = useState(false);

  const [
    correctionOpen,
    setCorrectionOpen,
  ] = useState(false);

  const [
    selectedAttendanceId,
    setSelectedAttendanceId,
  ] = useState("");

  const [
    correctCheckIn,
    setCorrectCheckIn,
  ] = useState("09:00");

  const [
    correctCheckOut,
    setCorrectCheckOut,
  ] = useState("18:00");

  const [reason, setReason] = useState("");
  const [requestError, setRequestError] =
    useState("");

  const [saving, setSaving] = useState(false);

  const [cancellingId, setCancellingId] =
    useState<string | null>(null);

  // ===================================================
  // LOAD ATTENDANCE AND CORRECTIONS
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setLoadError("");

      Promise.all([
        getAdminScope(),

        attendanceApi.mine({
          fromDate: daysAgoUTC(120),
          toDate: todayUTC(),
        }),

        call(
          api.get<CorrectionRequest[]>(
            "/attendance/corrections/my",
          ),
        ),
      ])
        .then(
          ([
            loadedScope,
            attendance,
            correctionRequests,
          ]) => {
            if (!active) return;

            setScope(loadedScope);

            setRecords(
              attendance.filter(
                (item) =>
                  item.companyId ===
                  loadedScope.companyId,
              ),
            );

            setRequests(
              correctionRequests.filter(
                (item) =>
                  item.companyId ===
                  loadedScope.companyId,
              ),
            );

            setSelectedBranchId((previous) =>
              loadedScope.branches.some(
                (branch) =>
                  branch.id === previous,
              )
                ? previous
                : loadedScope.branches[0]?.id ??
                  "",
            );
          },
        )
        .catch((error) => {
          if (active) {
            setLoadError(errorText(error));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  // ===================================================
  // SELECTED BRANCH AND RECORDS
  // ===================================================

  const branchNames = useMemo(
    () =>
      new Map(
        (scope?.branches ?? []).map(
          (branch) => [
            branch.id,
            branch.name,
          ],
        ),
      ),
    [scope],
  );

  const branchRecords = useMemo(
    () =>
      records
        .filter(
          (item) =>
            item.branchId === selectedBranchId,
        )
        .sort(
          (a, b) =>
            b.attendanceDate.localeCompare(
              a.attendanceDate,
            ) ||
            b.createdAt.localeCompare(
              a.createdAt,
            ),
        ),
    [records, selectedBranchId],
  );

  const current = branchRecords.find(
    (item) =>
      utcDate(item.attendanceDate) ===
      todayUTC(),
  );

  const eligible = branchRecords.filter(
    (item) => item.status === "PRESENT",
  );

  const selectedRecord = eligible.find(
    (item) =>
      item.id === selectedAttendanceId,
  );

  const visibleRequests = requests
    .filter(
      (item) =>
        item.branchId === selectedBranchId,
    )
    .sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

  const activeBranch = scope?.branches.find(
    (branch) =>
      branch.id === selectedBranchId,
  );

  const pendingIds = new Set(
    requests
      .filter(
        (item) => item.status === "PENDING",
      )
      .map((item) => item.attendanceId),
  );

  // Existing manual or leave records cannot
  // be overwritten by a self check-in.

  const punchAction:
    | "in"
    | "out"
    | null = !current
    ? "in"
    : current.status === "PRESENT" &&
        current.checkInAt &&
        !current.checkOutAt
      ? "out"
      : null;

  // ===================================================
  // CHECK IN / CHECK OUT
  // ===================================================

  async function punch() {
    if (
      !scope ||
      !selectedBranchId ||
      !punchAction ||
      savingRef.current
    ) {
      return;
    }

    savingRef.current = true;
    setPunching(true);
    setNotice("");

    try {
      if (punchAction === "in") {
        await attendanceApi.checkIn(
          scope.companyId,
          selectedBranchId,
        );
      } else {
        await attendanceApi.checkOut(
          scope.companyId,
          selectedBranchId,
        );
      }

      setNotice(
        punchAction === "in"
          ? "Checked in successfully."
          : "Checked out successfully.",
      );

      setRefresh((value) => value + 1);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setPunching(false);
      savingRef.current = false;
    }
  }

  // ===================================================
  // SELECT CORRECTION SHIFT
  // ===================================================

  function chooseCorrectionRecord(
    record: AttendanceDto,
  ) {
    setSelectedAttendanceId(record.id);

    setCorrectCheckIn(
      timeUTC(record.checkInAt) || "09:00",
    );

    setCorrectCheckOut(
      timeUTC(record.checkOutAt) || "18:00",
    );

    setRequestError("");
  }

  function openCorrection(
    record?: AttendanceDto,
  ) {
    const candidate =
      record ??
      eligible.find(
        (item) => !pendingIds.has(item.id),
      );

    if (!candidate) {
      setNotice(
        "No eligible present shift is available for a new correction.",
      );
      return;
    }

    chooseCorrectionRecord(candidate);
    setReason("");
    setRequestError("");
    setCorrectionOpen(true);
  }

  // ===================================================
  // SUBMIT CORRECTION TO BACKEND
  // ===================================================

  async function submitCorrection() {
    if (savingRef.current) return;

    if (!selectedRecord) {
      setRequestError(
        "Select a recorded present shift.",
      );
      return;
    }

    if (pendingIds.has(selectedRecord.id)) {
      setRequestError(
        "A correction for this shift is already pending.",
      );
      return;
    }

    if (!reason.trim()) {
      setRequestError(
        "Enter a reason for the correction.",
      );
      return;
    }

    let times: ReturnType<
      typeof correctionTimes
    >;

    try {
      times = correctionTimes(
        utcDate(
          selectedRecord.attendanceDate,
        ),
        correctCheckIn,
        correctCheckOut,
      );
    } catch (error) {
      setRequestError(errorText(error));
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setRequestError("");

    try {
      await call(
        api.post("/attendance/corrections", {
          attendanceId: selectedRecord.id,
          ...times,
          reason: reason.trim(),
        }),
      );

      setCorrectionOpen(false);

      setNotice(
        "Correction request submitted for review.",
      );

      setRefresh((value) => value + 1);
    } catch (error) {
      setRequestError(errorText(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // ===================================================
  // CANCEL CORRECTION
  // ===================================================

  async function cancelCorrection(id: string) {
    if (cancellingId) return;

    setCancellingId(id);
    setNotice("");

    try {
      await call(
        api.patch(
          `/attendance/corrections/${id}/cancel`,
          {},
        ),
      );

      setNotice(
        "Pending correction cancelled.",
      );

      setRefresh((value) => value + 1);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setCancellingId(null);
    }
  }

  const modalBottom =
    Platform.OS === "web" && width >= 900
      ? 20
      : Math.max(8, insets.bottom);

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.between}>
            <View style={styles.flex}>
              <Text style={styles.companyName}>
                {scope?.companyName ??
                  "Business workspace"}
              </Text>

              <Text style={styles.headerCaption}>
                Attendance / Admin workspace
              </Text>
            </View>

            <AdminMenuIcon
              name="search"
              color="#20334f"
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose branch"
            onPress={() =>
              setBranchPickerOpen(true)
            }
            style={styles.headerFilter}
          >
            <View style={styles.flex}>
              <Text
                style={styles.headerFilterLabel}
              >
                Selected branch
              </Text>

              <Text style={styles.headerBranch}>
                {activeBranch?.name ??
                  "Choose branch"}
              </Text>
            </View>

            <Text style={styles.chevron}>
              ▼
            </Text>
          </Pressable>
        </View>

        {/* MAIN CONTENT */}

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>
            My attendance
          </Text>

          <Text style={styles.subtitle}>
            Your check-ins, shifts and
            correction requests. Attendance
            dates and times are shown in UTC.
          </Text>

          {!!notice && (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.notice}
            >
              {notice}
            </Text>
          )}

          {loading ? (
            <ActivityIndicator
              style={styles.loading}
              color="#345cf2"
              accessibilityLabel="Loading attendance"
            />
          ) : loadError ? (
            <View style={styles.card}>
              <Text style={styles.error}>
                {loadError}
              </Text>

              <Pressable
                onPress={() =>
                  setRefresh(
                    (value) => value + 1,
                  )
                }
                style={styles.linkButton}
              >
                <Text style={styles.link}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* TODAY'S ATTENDANCE */}

              <View style={styles.todayCard}>
                <View style={styles.between}>
                  <Text style={styles.cardTitle}>
                    Today's attendance
                  </Text>

                  <View
                    style={styles.statusBadge}
                  >
                    <Text
                      style={styles.statusText}
                    >
                      {current
                        ? niceStatus(
                            current.status,
                          )
                        : "Not recorded"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.subtitle}>
                  {activeBranch?.name ??
                    "No branch selected"}
                  {" / "}
                  {dateLabel(todayUTC())}
                </Text>

                <View style={styles.times}>
                  <View style={styles.flex}>
                    <Text
                      style={styles.timeLabel}
                    >
                      Check in (UTC)
                    </Text>

                    <Text
                      style={styles.timeValue}
                    >
                      {timeUTC(
                        current?.checkInAt,
                      ) || "--:--"}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.dividerVertical
                    }
                  />

                  <View style={styles.flex}>
                    <Text
                      style={styles.timeLabel}
                    >
                      Check out (UTC)
                    </Text>

                    <Text
                      style={styles.timeValue}
                    >
                      {timeUTC(
                        current?.checkOutAt,
                      ) || "--:--"}
                    </Text>
                  </View>
                </View>

                {punchAction && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      punching || !activeBranch
                    }
                    onPress={() =>
                      void punch()
                    }
                    style={[
                      styles.primaryButton,
                      (punching ||
                        !activeBranch) &&
                        styles.dim,
                    ]}
                  >
                    <Text
                      style={
                        styles.primaryText
                      }
                    >
                      {punching
                        ? "Saving..."
                        : punchAction === "in"
                          ? "Check in"
                          : "Check out"}
                    </Text>
                  </Pressable>
                )}

                {current &&
                  !punchAction && (
                    <Text
                      style={
                        styles.subtitle
                      }
                    >
                      This attendance
                      record has no
                      available self-service
                      punch action.
                    </Text>
                  )}
              </View>

              {/* ACTIONS */}

              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  style={
                    styles.outlineButton
                  }
                  onPress={() =>
                    openCorrection()
                  }
                >
                  <Text style={styles.link}>
                    Request correction
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  style={
                    styles.leaveButton
                  }
                  onPress={() =>
                    router.push({
                      pathname:
                        "/admin/attendance",
                      params: {
                        view: "leave",
                      },
                    })
                  }
                >
                  <Text style={styles.link}>
                    Apply leave
                  </Text>
                </Pressable>
              </View>

              {/* RECORDED SHIFTS */}

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Recorded shifts
              </Text>

              {branchRecords.length === 0 ? (
                <View style={styles.card}>
                  <Text
                    style={styles.subtitle}
                  >
                    No attendance records
                    for this branch.
                  </Text>
                </View>
              ) : (
                branchRecords.map(
                  (record) => (
                    <View
                      key={record.id}
                      style={
                        styles.shiftCard
                      }
                    >
                      <View
                        style={
                          styles.between
                        }
                      >
                        <Text
                          style={
                            styles.shiftDate
                          }
                        >
                          {dateLabel(
                            utcDate(
                              record.attendanceDate,
                            ),
                          )}
                        </Text>

                        <Text
                          style={
                            styles.shiftStatus
                          }
                        >
                          {niceStatus(
                            record.status,
                          )}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.shiftTimes
                        }
                      >
                        In{" "}
                        {timeUTC(
                          record.checkInAt,
                        ) || "--:--"}
                        {" / "}
                        Out{" "}
                        {timeUTC(
                          record.checkOutAt,
                        ) || "--:--"}
                        {" (UTC)"}
                      </Text>

                      <Text
                        style={
                          styles.subtitle
                        }
                      >
                        {branchNames.get(
                          record.branchId,
                        ) ?? "Branch"}
                      </Text>

                      {record.status ===
                        "PRESENT" && (
                        <Pressable
                          accessibilityRole="button"
                          disabled={pendingIds.has(
                            record.id,
                          )}
                          onPress={() =>
                            openCorrection(
                              record,
                            )
                          }
                          style={
                            styles.linkButton
                          }
                        >
                          <Text
                            style={
                              styles.link
                            }
                          >
                            {pendingIds.has(
                              record.id,
                            )
                              ? "Correction pending"
                              : "Request time correction"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ),
                )
              )}

              {/* CORRECTION HISTORY */}

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Correction request history
              </Text>

              {visibleRequests.length === 0 ? (
                <View style={styles.card}>
                  <Text
                    style={styles.subtitle}
                  >
                    No correction requests
                    for this branch.
                  </Text>
                </View>
              ) : (
                visibleRequests.map(
                  (request) => (
                    <View
                      key={request.id}
                      style={
                        styles.shiftCard
                      }
                    >
                      <View
                        style={
                          styles.between
                        }
                      >
                        <Text
                          style={
                            styles.shiftDate
                          }
                        >
                          {dateLabel(
                            utcDate(
                              request.requestedCheckInAt,
                            ),
                          )}
                        </Text>

                        <Text
                          style={
                            styles.shiftStatus
                          }
                        >
                          {request.status}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.shiftTimes
                        }
                      >
                        Requested:{" "}
                        {timeUTC(
                          request.requestedCheckInAt,
                        )}
                        {" - "}
                        {timeUTC(
                          request.requestedCheckOutAt,
                        )}
                        {" UTC"}
                      </Text>

                      <Text
                        style={
                          styles.subtitle
                        }
                      >
                        Reason:{" "}
                        {request.reason}
                      </Text>

                      {!!request.reviewNote && (
                        <Text
                          style={
                            styles.subtitle
                          }
                        >
                          Review:{" "}
                          {request.reviewNote}
                        </Text>
                      )}

                      {request.status ===
                        "PENDING" && (
                        <Pressable
                          accessibilityRole="button"
                          disabled={
                            cancellingId !==
                            null
                          }
                          onPress={() =>
                            void cancelCorrection(
                              request.id,
                            )
                          }
                          style={
                            styles.linkButton
                          }
                        >
                          <Text
                            style={
                              styles.link
                            }
                          >
                            {cancellingId ===
                            request.id
                              ? "Cancelling..."
                              : "Cancel pending request"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ),
                )
              )}
            </>
          )}
        </ScrollView>

        <AdminBottomNavigation />
      </View>

      {/* BRANCH PICKER */}

      <Modal
        visible={branchPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setBranchPickerOpen(false)
        }
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.between}>
              <Text
                style={
                  styles.modalTitle
                }
              >
                Choose branch
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setBranchPickerOpen(false)
                }
                accessibilityLabel="Close branch picker"
              >
                <Text
                  style={
                    styles.chevron
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={
                styles.pickerOptions
              }
            >
              {(scope?.branches ?? []).map(
                (branch) => (
                  <Pressable
                    key={branch.id}
                    style={
                      styles.pickerOption
                    }
                    onPress={() => {
                      setSelectedBranchId(
                        branch.id,
                      );

                      setBranchPickerOpen(
                        false,
                      );

                      setNotice("");
                    }}
                  >
                    <Text
                      style={
                        styles.inputText
                      }
                    >
                      {branch.name}
                      {branch.id ===
                      selectedBranchId
                        ? " (selected)"
                        : ""}
                    </Text>
                  </Pressable>
                ),
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CORRECTION FORM */}

      <Modal
        visible={correctionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) {
            setCorrectionOpen(false);
          }
        }}
      >
        <KeyboardAvoidingView
          style={[
            styles.overlay,
            {
              paddingBottom:
                Platform.OS ===
                  "web" &&
                width >= 900
                  ? 20
                  : Math.max(
                      8,
                      insets.bottom,
                    ),
            },
          ]}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : "height"
          }
        >
          <View style={styles.modal}>
            <View style={styles.between}>
              <Text
                style={
                  styles.modalTitle
                }
              >
                Attendance correction
              </Text>

              <Pressable
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Close correction form"
                onPress={() =>
                  setCorrectionOpen(false)
                }
              >
                <Text
                  style={
                    styles.chevron
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>
                Recorded shift
              </Text>

              <ScrollView
                style={
                  styles.pickerOptions
                }
                nestedScrollEnabled
              >
                {eligible.map(
                  (record) => (
                    <Pressable
                      key={record.id}
                      disabled={
                        saving ||
                        pendingIds.has(
                          record.id,
                        )
                      }
                      style={
                        styles.pickerOption
                      }
                      onPress={() =>
                        chooseCorrectionRecord(
                          record,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.inputText,
                          pendingIds.has(
                            record.id,
                          ) &&
                            styles.dim,
                        ]}
                      >
                        {dateLabel(
                          utcDate(
                            record.attendanceDate,
                          ),
                        )}
                        {" / "}
                        {branchNames.get(
                          record.branchId,
                        ) ?? "Branch"}

                        {record.id ===
                        selectedAttendanceId
                          ? " (selected)"
                          : ""}

                        {pendingIds.has(
                          record.id,
                        )
                          ? " (pending)"
                          : ""}
                      </Text>
                    </Pressable>
                  ),
                )}
              </ScrollView>

              <Text
                style={
                  styles.subtitle
                }
              >
                Enter corrected times
                in UTC to match the
                current backend
                attendance date policy.
              </Text>

              <View
                style={
                  styles.timeFields
                }
              >
                <View style={styles.flex}>
                  <Text
                    style={
                      styles.label
                    }
                  >
                    Check in (HH:mm UTC)
                  </Text>

                  <TextInput
                    style={
                      styles.input
                    }
                    editable={!saving}
                    value={
                      correctCheckIn
                    }
                    onChangeText={
                      setCorrectCheckIn
                    }
                    placeholder="09:00"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.flex}>
                  <Text
                    style={
                      styles.label
                    }
                  >
                    Check out (HH:mm UTC)
                  </Text>

                  <TextInput
                    style={
                      styles.input
                    }
                    editable={!saving}
                    value={
                      correctCheckOut
                    }
                    onChangeText={
                      setCorrectCheckOut
                    }
                    placeholder="18:00"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Text
                style={
                  styles.label
                }
              >
                Reason for correction
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.multiline,
                ]}
                multiline
                editable={!saving}
                maxLength={1000}
                value={reason}
                onChangeText={
                  setReason
                }
                placeholder="Explain why this shift needs a correction"
                accessibilityLabel="Correction reason"
              />

              {!!requestError && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={
                    styles.error
                  }
                >
                  {requestError}
                </Text>
              )}

              <Text
                style={
                  styles.subtitle
                }
              >
                Submission creates
                a pending request
                in PostgreSQL.
                Attendance changes
                only after approval.
              </Text>

              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() =>
                  void submitCorrection()
                }
                style={[
                  styles.primaryButton,
                  saving &&
                    styles.dim,
                ]}
              >
                <Text
                  style={
                    styles.primaryText
                  }
                >
                  {saving
                    ? "Submitting..."
                    : "Submit correction"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F8FD",
  },

  page: {
    flex: 1,
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
  },

  flex: {
    flex: 1,
    minWidth: 0,
  },

  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  header: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E4EAF5",
  },

  companyName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#20334F",
  },

  headerCaption: {
    fontSize: 11,
    color: "#8794AA",
    marginTop: 5,
  },

  headerFilter: {
    marginTop: 14,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#D5DFFF",
    backgroundColor: "#EAF0FF",
    borderRadius: 12,
  },

  headerFilterLabel: {
    fontSize: 10,
    color: "#71829C",
  },

  headerBranch: {
    fontSize: 13,
    fontWeight: "700",
    color: "#20334F",
    marginTop: 3,
  },

  chevron: {
    color: "#607591",
    fontSize: 18,
    fontWeight: "700",
    padding: 8,
  },

  content: {
    padding: 20,
    paddingBottom: 44,
  },

  title: {
    fontSize: 25,
    color: "#20334F",
    fontWeight: "800",
  },

  subtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: "#7A8BA5",
    marginTop: 7,
  },

  loading: {
    marginTop: 30,
  },

  notice: {
    marginTop: 14,
    padding: 13,
    borderRadius: 12,
    color: "#286952",
    backgroundColor: "#E6F4EE",
    fontSize: 12,
  },

  error: {
    color: "#B94D61",
    marginTop: 12,
    fontSize: 12,
  },

  card: {
    padding: 18,
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EAF5",
    borderRadius: 16,
  },

  todayCard: {
    padding: 18,
    marginTop: 20,
    backgroundColor: "#F4FBF8",
    borderWidth: 1,
    borderColor: "#DDEEE7",
    borderRadius: 20,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#20334F",
    flexShrink: 1,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EEE7FA",
  },

  statusText: {
    color: "#8A70AE",
    fontSize: 11,
    fontWeight: "600",
  },

  times: {
    marginTop: 18,
    padding: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E1ECE7",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  timeLabel: {
    fontSize: 11,
    color: "#7A8BA5",
  },

  timeValue: {
    marginTop: 6,
    fontSize: 24,
    color: "#20334F",
    fontWeight: "800",
  },

  dividerVertical: {
    width: 1,
    height: 35,
    backgroundColor: "#E1ECE7",
  },

  primaryButton: {
    marginTop: 18,
    minHeight: 46,
    backgroundColor: "#345CF2",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  primaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  outlineButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE7F5",
    borderRadius: 12,
  },

  leaveButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E1F5EE",
    borderRadius: 12,
  },

  link: {
    color: "#345CF2",
    fontSize: 12,
    fontWeight: "600",
  },

  linkButton: {
    minHeight: 38,
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: 8,
  },

  sectionTitle: {
    marginTop: 25,
    marginBottom: 10,
    fontSize: 17,
    color: "#20334F",
    fontWeight: "800",
  },

  shiftCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EAF5",
    borderRadius: 16,
  },

  shiftDate: {
    color: "#20334F",
    fontSize: 13,
    fontWeight: "700",
  },

  shiftStatus: {
    fontSize: 11,
    fontWeight: "600",
    color: "#405573",
  },

  shiftTimes: {
    fontSize: 13,
    color: "#405573",
    marginTop: 12,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(27,43,68,0.35)",
    padding: 16,
    justifyContent: "center",
  },

  modal: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignSelf: "center",
  },

  modalTitle: {
    flex: 1,
    color: "#20334F",
    fontWeight: "800",
    fontSize: 18,
  },

  pickerOptions: {
    maxHeight: 180,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#DCE5F3",
    borderRadius: 12,
  },

  pickerOption: {
    minHeight: 44,
    padding: 12,
    justifyContent: "center",
    borderBottomColor: "#EDF1F8",
    borderBottomWidth: 1,
  },

  inputText: {
    color: "#20334F",
    fontSize: 13,
  },

  label: {
    marginTop: 16,
    marginBottom: 6,
    color: "#405573",
    fontSize: 12,
    fontWeight: "600",
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: "#DCE5F3",
    backgroundColor: "#FCFDFF",
    padding: 12,
    color: "#20334F",
    fontSize: 14,
  },

  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },

  timeFields: {
    flexDirection: "row",
    gap: 12,
  },

  dim: {
    opacity: 0.5,
  },
});
