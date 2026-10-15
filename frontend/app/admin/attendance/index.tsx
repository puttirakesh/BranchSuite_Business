
import React, { useCallback, useRef, useState } from "react";
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

import AsyncStorage from "../../../src/core/admin/storage";
import {
  checkIn,
  checkOut,
  readMyAttendance,
} from "../../../src/core/admin/attendance";
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { AdminMenuIcon } from "../../../src/ui/AdminMenuIcon";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import PersonalLeavePage from "../../../src/features/admin/PersonalLeavePage";

type Shift = {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  branch?: string;
  shiftStart?: string;
  shiftEnd?: string;
};

type Picker = "date" | "in" | "out" | null;

// Attendance corrections are still device-local.
// Personal leave is handled exclusively by PersonalLeavePage.
const correctionsKey = "branchsuite:my-attendance-requests:v1";

const displayShiftDate = (value: string) =>
  value.split("-").reverse().join("/");

function timeLabel(value: string): string {
  const [hour, minute] = value.split(":").map(Number);

  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}

function shiftTime(
  value?: string,
  fallback = "09:00",
): string {
  const match =
    /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(
      value?.trim() || "",
    );

  if (!match) return fallback;

  let hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    minute > 59 ||
    (match[3]
      ? hour < 1 || hour > 12
      : hour > 23)
  ) {
    return fallback;
  }

  if (match[3]) {
    hour =
      (hour % 12) +
      (match[3].toUpperCase() === "PM" ? 12 : 0);
  }

  return `${String(hour).padStart(2, "0")}:${String(
    minute,
  ).padStart(2, "0")}`;
}

const timeOptions = Array.from(
  { length: 96 },
  (_, index) =>
    `${String(Math.floor(index / 4)).padStart(
      2,
      "0",
    )}:${String((index % 4) * 15).padStart(2, "0")}`,
);

function dateValue(value: string): string | null {
  const match =
    /^(\d{2})([/-])(\d{2})\2(\d{4})$/.exec(
      value.trim(),
    );

  if (!match) return null;

  const year = Number(match[4]);
  const month = Number(match[3]);
  const day = Number(match[1]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${match[4]}-${match[3]}-${match[1]}`;
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function AttendancePage() {
  const { view } =
    useLocalSearchParams<{ view?: string }>();

  // This is the ONLY personal leave page.
  // No offline leave implementation remains here.
  return view === "leave"
    ? <PersonalLeavePage />
    : <MyAttendancePage />;
}

function MyAttendancePage() {
  const { styles } = useAdminLayout(baseStyles, "page");

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const mobileSheet =
    Platform.OS !== "web" || width < 900;

  const scrollRef = useRef<ScrollView>(null);
  const shiftsPosition = useRef(0);
  const savingRef = useRef(false);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [correctionOpen, setCorrectionOpen] =
    useState(false);

  const [startDate, setStartDate] = useState("");
  const [reason, setReason] = useState("");
  const [correctCheckIn, setCorrectCheckIn] =
    useState("09:00");
  const [correctCheckOut, setCorrectCheckOut] =
    useState("18:00");

  const [picker, setPicker] = useState<Picker>(null);
  const [saving, setSaving] = useState(false);
  const [requestError, setRequestError] =
    useState("");

  const [notice, setNotice] = useState("");
  const [punching, setPunching] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError("");

      readMyAttendance()
        .then((records) => {
          if (!active) return;

          setShifts(
            records
              .map((record) => ({
                id: record.id,
                date: record.date,
                checkIn: record.checkIn,
                checkOut: record.checkOut,
                branch: record.branch,
              }))
              .sort((a, b) =>
                b.date.localeCompare(a.date),
              ),
          );
        })
        .catch((cause) => {
          if (active) {
            setError(errorMessage(cause));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [attempt]),
  );

  const todayKey = utcToday();
  const today = shifts.find(
    (shift) => shift.date === todayKey,
  );

  async function punch(kind: "in" | "out") {
    if (savingRef.current) return;

    savingRef.current = true;
    setPunching(true);
    setNotice("");

    try {
      if (kind === "in") {
        await checkIn();
      } else {
        await checkOut();
      }

      setNotice(
        kind === "in"
          ? "Checked in successfully."
          : "Checked out successfully.",
      );

      setAttempt((value) => value + 1);
    } catch (cause) {
      setNotice(errorMessage(cause));
    } finally {
      savingRef.current = false;
      setPunching(false);
    }
  }

  function chooseShift(value: string) {
    const selected = shifts.find(
      (shift) => shift.date === value,
    );

    setStartDate(displayShiftDate(value));
    setCorrectCheckIn(
      shiftTime(selected?.checkIn),
    );
    setCorrectCheckOut(
      shiftTime(selected?.checkOut, "18:00"),
    );
    setPicker(null);
    setRequestError("");
  }

  function openCorrection() {
    if (shifts.length === 0) {
      setNotice(
        "A recorded shift is needed to request a correction.",
      );
      return;
    }

    const latest = shifts[0];

    setStartDate(displayShiftDate(latest.date));
    setCorrectCheckIn(
      shiftTime(latest.checkIn),
    );
    setCorrectCheckOut(
      shiftTime(latest.checkOut, "18:00"),
    );
    setReason("");
    setPicker(null);
    setRequestError("");
    setNotice("");
    setCorrectionOpen(true);
  }

  function closeCorrection() {
    if (savingRef.current) return;

    setCorrectionOpen(false);
    setPicker(null);
  }

  async function saveCorrection() {
    if (savingRef.current) return;

    const date = dateValue(startDate);

    if (!date) {
      setRequestError(
        "Enter a valid shift date.",
      );
      return;
    }

    const selectedShift = shifts.find(
      (shift) => shift.date === date,
    );

    if (!selectedShift) {
      setRequestError(
        "Choose a date with a recorded shift.",
      );
      return;
    }

    if (!reason.trim()) {
      setRequestError(
        "Enter a reason for your correction.",
      );
      return;
    }

    const validTime =
      /^([01]\d|2[0-3]):[0-5]\d$/;

    if (
      !validTime.test(correctCheckIn) ||
      !validTime.test(correctCheckOut) ||
      correctCheckOut <= correctCheckIn
    ) {
      setRequestError(
        "Enter valid times with check-out after check-in.",
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setRequestError("");

    try {
      const stored =
        await AsyncStorage.getItem(correctionsKey);

      const parsed: unknown = stored
        ? JSON.parse(stored)
        : [];

      if (!Array.isArray(parsed)) {
        throw new Error(
          "Saved correction requests could not be read.",
        );
      }

      // Do not remove any older local entries while
      // saving a correction. Personal leave is never
      // written to this storage key.
      const newCorrection = {
        id: `${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2)}`,
        type: "correction" as const,
        startDate: date,
        endDate: date,
        reason: reason.trim(),
        status: "pending" as const,
        createdAt: new Date().toISOString(),
        correctCheckIn,
        correctCheckOut,
        shiftId: selectedShift.id,
        branch: selectedShift.branch,
      };

      await AsyncStorage.setItem(
        correctionsKey,
        JSON.stringify([
          newCorrection,
          ...parsed,
        ]),
      );

      setCorrectionOpen(false);
      setNotice(
        "Correction request saved on this device. Server-side correction approval is not yet available.",
      );
    } catch (cause) {
      setRequestError(errorMessage(cause));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const navigateToLeave = () => {
    router.push({
      pathname: "/admin/attendance",
      params: { view: "leave" },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.between}>
            <View style={styles.flex}>
              <Text style={styles.companyName}>
                Business workspace
              </Text>
              <Text style={styles.headerCaption}>
                Attendance · Admin workspace
              </Text>
            </View>

            <View style={styles.search}>
              <AdminMenuIcon
                name="search"
                color="#20334f"
              />
            </View>
          </View>

          <View style={styles.headerFilters}>
            <View style={styles.headerFilter}>
              <Text style={styles.headerFilterLabel}>
                Company
              </Text>
            </View>

            <View
              style={[
                styles.headerFilter,
                styles.branchFilter,
              ]}
            >
              <Text style={styles.headerFilterLabel}>
                Personal branch
              </Text>

              <Text
                numberOfLines={1}
                style={styles.headerBranch}
              >
                {today?.branch ??
                  shifts[0]?.branch ??
                  "Not available"}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>
            My attendance
          </Text>
          <Text style={styles.subtitle}>
            Your shifts and correction requests.
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
              accessibilityLabel="Loading attendance"
              color="#345CF2"
              style={styles.loading}
            />
          ) : error ? (
            <View style={styles.card}>
              <Text style={styles.error}>
                {error}
              </Text>

              <Pressable
                onPress={() =>
                  setAttempt((value) => value + 1)
                }
                style={styles.retry}
              >
                <Text style={styles.link}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.todayCard}>
                <View style={styles.between}>
                  <View style={styles.todayHeading}>
                    <View style={styles.clockIcon}>
                      <Text style={styles.clockGlyph}>
                        ◷
                      </Text>
                    </View>

                    <Text style={styles.cardTitle}>
                      Today's attendance
                    </Text>
                  </View>

                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {today?.checkOut
                        ? "Shift complete"
                        : today?.checkIn
                          ? "Checked in"
                          : "Not recorded"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.shiftDescription}>
                  {today?.branch ??
                    "No attendance recorded today."}
                </Text>

                <View style={styles.times}>
                  <View style={styles.flex}>
                    <Text style={styles.timeLabel}>
                      Check in
                    </Text>
                    <Text style={styles.timeValue}>
                      {today?.checkIn || "—"}
                    </Text>
                  </View>

                  <View style={styles.timeLine} />

                  <View style={styles.flex}>
                    <Text style={styles.timeLabel}>
                      Check out
                    </Text>
                    <Text style={styles.timeValue}>
                      {today?.checkOut || "—"}
                    </Text>
                  </View>
                </View>

                {!today?.checkOut && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={punching}
                    onPress={() =>
                      void punch(
                        today?.checkIn ? "out" : "in",
                      )
                    }
                    style={[
                      styles.viewButton,
                      {
                        backgroundColor: "#345CF2",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.viewText,
                        { color: "#FFFFFF" },
                      ]}
                    >
                      {punching
                        ? "Saving..."
                        : today?.checkIn
                          ? "Check out"
                          : "Check in"}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    scrollRef.current?.scrollTo({
                      y: shiftsPosition.current,
                      animated: true,
                    })
                  }
                  style={styles.viewButton}
                >
                  <Text style={styles.viewText}>
                    View attendance
                  </Text>
                </Pressable>
              </View>

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={openCorrection}
                  style={styles.correctionButton}
                >
                  <Text style={styles.viewText}>
                    Request correction
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={navigateToLeave}
                  style={styles.leaveButton}
                >
                  <Text style={styles.link}>
                    Apply leave
                  </Text>
                </Pressable>
              </View>

              <View
                onLayout={(event) => {
                  shiftsPosition.current =
                    event.nativeEvent.layout.y;
                }}
              >
                <Text style={styles.sectionTitle}>
                  Recorded shifts
                </Text>

                {shifts.length === 0 ? (
                  <View
                    style={[
                      styles.card,
                      styles.empty,
                    ]}
                  >
                    <Text style={styles.emptyTitle}>
                      No recorded shifts yet
                    </Text>
                    <Text style={styles.subtitle}>
                      Your attendance records
                      will appear here.
                    </Text>
                  </View>
                ) : (
                  shifts.map((shift) => (
                    <View
                      key={shift.id}
                      style={styles.shiftCard}
                    >
                      <View style={styles.between}>
                        <Text style={styles.shiftDate}>
                          {shift.date}
                        </Text>

                        <View style={styles.presentBadge}>
                          <Text style={styles.presentText}>
                            {shift.checkIn
                              ? "Present"
                              : "Not recorded"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.shiftTimes}>
                        In {shift.checkIn || "—"}
                        {" · "}
                        Out {shift.checkOut || "—"}
                      </Text>

                      {!!shift.branch && (
                        <Text style={styles.subtitle}>
                          {shift.branch}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>

        <AdminBottomNavigation />
      </View>

      <Modal
        transparent
        visible={correctionOpen}
        animationType="fade"
        onRequestClose={closeCorrection}
      >
        <KeyboardAvoidingView
          style={[
            styles.overlay,
            mobileSheet && {
              justifyContent: "flex-end",
              paddingHorizontal: 8,
              paddingBottom: Math.max(
                8,
                insets.bottom,
              ),
              paddingTop: Math.max(
                12,
                insets.top,
              ),
            },
          ]}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : "height"
          }
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.modal,
              styles.correctionSheet,
              mobileSheet && {
                maxHeight: "92%",
              },
            ]}
          >
            <View style={styles.handle} />

            <View style={styles.between}>
              <Text style={styles.modalTitle}>
                Attendance correction
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close request"
                disabled={saving}
                onPress={closeCorrection}
                style={styles.sheetClose}
              >
                <AdminMenuIcon
                  name="close"
                  color="#20334F"
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>
                Shift date *
              </Text>

              {Platform.OS === "web" ? (
                React.createElement(
                  "select",
                  {
                    "aria-label": "Shift date",
                    value:
                      dateValue(startDate) || "",
                    disabled:
                      saving || shifts.length === 0,
                    onChange: (
                      event: React.ChangeEvent<HTMLSelectElement>,
                    ) =>
                      chooseShift(
                        event.target.value,
                      ),
                    style: {
                      width: "100%",
                      minHeight: 48,
                      padding: "11px 13px",
                      borderRadius: 13,
                      border:
                        "1px solid #dce5f3",
                      background: "#fcfdff",
                      color: "#20334f",
                      fontSize: 14,
                    },
                  },
                  shifts.map((shift) =>
                    React.createElement(
                      "option",
                      {
                        key: shift.date,
                        value: shift.date,
                      },
                      displayShiftDate(shift.date),
                    ),
                  ),
                )
              ) : (
                <Pressable
                  disabled={saving}
                  onPress={() =>
                    setPicker(
                      picker === "date"
                        ? null
                        : "date",
                    )
                  }
                  style={[
                    styles.input,
                    styles.between,
                  ]}
                >
                  <Text style={styles.inputText}>
                    {startDate ||
                      "Choose shift"}
                  </Text>
                  <Text style={styles.chevron}>
                    ⌄
                  </Text>
                </Pressable>
              )}

              {picker === "date" && (
                <ScrollView
                  style={styles.pickerOptions}
                  nestedScrollEnabled
                >
                  {shifts.map((shift) => (
                    <Pressable
                      key={shift.id}
                      onPress={() =>
                        chooseShift(
                          shift.date,
                        )
                      }
                      style={styles.pickerOption}
                    >
                      <Text style={styles.inputText}>
                        {displayShiftDate(
                          shift.date,
                        )}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View style={styles.timeFields}>
                {(["in", "out"] as const).map(
                  (kind) => {
                    const value =
                      kind === "in"
                        ? correctCheckIn
                        : correctCheckOut;

                    const update =
                      kind === "in"
                        ? setCorrectCheckIn
                        : setCorrectCheckOut;

                    return (
                      <View
                        key={kind}
                        style={styles.flex}
                      >
                        <Text style={styles.label}>
                          {kind === "in"
                            ? "Correct check in *"
                            : "Correct check out *"}
                        </Text>

                        {Platform.OS === "web" ? (
                          React.createElement(
                            "input",
                            {
                              type: "time",
                              value,
                              disabled: saving,
                              onChange: (
                                event: React.ChangeEvent<HTMLInputElement>,
                              ) =>
                                update(
                                  event.target.value,
                                ),
                              style: {
                                width: "100%",
                                minHeight: 48,
                                padding: "11px",
                                borderRadius: 13,
                                border:
                                  "1px solid #dce5f3",
                                background:
                                  "#fcfdff",
                              },
                            },
                          )
                        ) : (
                          <Pressable
                            disabled={saving}
                            onPress={() =>
                              setPicker(
                                picker === kind
                                  ? null
                                  : kind,
                              )
                            }
                            style={[
                              styles.input,
                              styles.between,
                            ]}
                          >
                            <Text
                              style={styles.inputText}
                            >
                              {timeLabel(value)}
                            </Text>
                            <Text
                              style={styles.chevron}
                            >
                              ⌄
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  },
                )}
              </View>

              {(picker === "in" ||
                picker === "out") && (
                <ScrollView
                  style={styles.pickerOptions}
                  nestedScrollEnabled
                >
                  {timeOptions.map(
                    (value) => (
                      <Pressable
                        key={value}
                        onPress={() => {
                          if (picker === "in") {
                            setCorrectCheckIn(
                              value,
                            );
                          } else {
                            setCorrectCheckOut(
                              value,
                            );
                          }
                          setPicker(null);
                        }}
                        style={styles.pickerOption}
                      >
                        <Text
                          style={styles.inputText}
                        >
                          {timeLabel(value)}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </ScrollView>
              )}

              <Text style={styles.label}>
                Reason *
              </Text>

              <TextInput
                accessibilityLabel="Correction reason"
                editable={!saving}
                multiline
                value={reason}
                onChangeText={setReason}
                style={[
                  styles.input,
                  styles.multiline,
                ]}
              />

              {!!requestError && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.error}
                >
                  {requestError}
                </Text>
              )}

              <Text style={styles.subtitle}>
                Corrections are currently saved
                on this device until the
                backend correction API is implemented.
              </Text>
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() =>
                void saveCorrection()
              }
              style={[
                styles.submitButton,
                saving && styles.dim,
              ]}
            >
              <Text style={styles.submitText}>
                {saving
                  ? "Saving..."
                  : "Submit correction"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

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
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  header: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E4EAF5",
  },
  companyName: {
    minHeight: 18,
    fontSize: 14,
    fontWeight: "800",
    color: "#20334F",
  },
  headerCaption: {
    fontSize: 10,
    color: "#8794AA",
    marginTop: 4,
  },
  search: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FC",
  },
  headerFilters: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  headerFilter: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E4EAF7",
    backgroundColor: "#F7F9FF",
  },
  branchFilter: {
    backgroundColor: "#EAF0FF",
    borderColor: "#D5DFFF",
  },
  headerFilterLabel: {
    fontSize: 11,
    color: "#8492A9",
  },
  headerBranch: {
    flex: 1,
    fontSize: 11,
    color: "#405573",
    textAlign: "right",
    marginLeft: 8,
  },
  content: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#20334F",
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 18,
    color: "#7A8BA5",
    marginTop: 6,
  },
  loading: {
    marginTop: 30,
  },
  notice: {
    padding: 14,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "#E6F4EE",
    color: "#34856C",
    fontSize: 12,
  },
  error: {
    fontSize: 12,
    color: "#B94D61",
    marginTop: 10,
  },
  retry: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  link: {
    fontSize: 12,
    fontWeight: "600",
    color: "#345CF2",
  },
  todayCard: {
    padding: 18,
    marginTop: 22,
    backgroundColor: "#F4FBF8",
    borderWidth: 1,
    borderColor: "#DDEEE7",
    borderRadius: 20,
  },
  todayHeading: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  clockIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#E1F5EE",
    alignItems: "center",
    justifyContent: "center",
  },
  clockGlyph: {
    fontSize: 22,
    color: "#348C77",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#20334F",
    flexShrink: 1,
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: "#EEE7FA",
  },
  statusText: {
    fontSize: 10,
    color: "#8A70AE",
    fontWeight: "600",
  },
  shiftDescription: {
    fontSize: 12,
    color: "#7A8BA5",
    marginTop: 14,
  },
  times: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1ECE7",
    padding: 15,
    borderRadius: 15,
    marginTop: 18,
  },
  timeLabel: {
    fontSize: 11,
    color: "#7A8BA5",
  },
  timeValue: {
    fontSize: 25,
    fontWeight: "800",
    color: "#20334F",
    marginTop: 6,
  },
  timeLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#DCE8E3",
  },
  viewButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#DFE7F5",
    marginTop: 18,
  },
  viewText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  correctionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#DFE7F5",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  leaveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: "#E1F5EE",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#20334F",
    marginTop: 26,
    marginBottom: 14,
  },
  card: {
    padding: 20,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E4EAF5",
    backgroundColor: "#FFFFFF",
    marginTop: 16,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 26,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#20334F",
  },
  shiftCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EAF5",
    borderRadius: 17,
  },
  shiftDate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#20334F",
  },
  presentBadge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#E1F3EB",
    borderRadius: 7,
  },
  presentText: {
    fontSize: 10,
    color: "#34856C",
    fontWeight: "600",
  },
  shiftTimes: {
    fontSize: 13,
    color: "#405573",
    marginTop: 14,
  },
  overlay: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "rgba(27,43,68,0.3)",
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    alignSelf: "center",
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  correctionSheet: {
    padding: 22,
    paddingTop: 12,
    borderRadius: 22,
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D8E0ED",
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetClose: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: "#829DFF",
    borderRadius: 16,
    backgroundColor: "#F5F8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#20334F",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    minHeight: 46,
    padding: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#DCE5F3",
    backgroundColor: "#FCFDFF",
    fontSize: 14,
    color: "#20334F",
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  inputText: {
    fontSize: 14,
    color: "#20334F",
  },
  chevron: {
    fontSize: 22,
    color: "#8798B1",
  },
  pickerOptions: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#DCE5F3",
    borderRadius: 12,
    marginTop: 8,
  },
  pickerOption: {
    minHeight: 44,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1F8",
  },
  timeFields: {
    flexDirection: "row",
    gap: 12,
  },
  submitButton: {
    minHeight: 46,
    marginTop: 18,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#345CF2",
  },
  submitText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dim: {
    opacity: 0.6,
  },
});
