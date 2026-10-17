import { AppIcon } from "../../../src/ui/AppIcon";

import React, { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";

import { useFocusEffect } from "expo-router";

import { api } from "../../../src/core/api/client";
import { useEmployeeStyles } from "../../../src/features/employee/styles";

type PayrollComponent = {
  id: string;
  name: string;
  kind: "EARNING" | "DEDUCTION";
  amount: number;
};

type EmployeePayslip = {
  id: string;
  currency: string;
  basicAmount: number;
  grossAmount: number;
  deductionsAmount: number;
  netAmount: number;
  runStatus: "APPROVED" | "PAID";
  month: number;
  year: number;
  components: PayrollComponent[];
  paymentDate: string | null;
  paymentRecorded: boolean;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asAmount(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const amount = Number(value);

  return Number.isFinite(amount) ? amount : null;
}

function formatMoney(
  amount: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}

function periodLabel(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(
    "en-IN",
    {
      month: "long",
      year: "numeric",
    },
  );
}

function paymentDateLabel(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Payment date unavailable";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(error: unknown): string {
  if (isObject(error) && isObject(error.response)) {
    const response = error.response;

    if (response.status === 401) {
      return "Your login session has expired. Please sign in again.";
    }

    if (response.status === 403) {
      return "You do not have permission to view these payslips.";
    }

    if (isObject(response.data)) {
      const message = response.data.message;

      if (typeof message === "string") {
        return message;
      }

      if (Array.isArray(message)) {
        return message.map(String).join(", ");
      }
    }
  }

  return error instanceof Error
    ? error.message
    : "Unable to retrieve your payslips.";
}

function normalizePayslip(
  value: unknown,
): EmployeePayslip {
  if (!isObject(value)) {
    throw new Error("Invalid payroll entry received.");
  }

  const run = value.run;

  if (!isObject(run) || !isObject(run.period)) {
    throw new Error("Payroll period information is missing.");
  }

  const period = run.period;

  const id = asString(value.id);
  const month = asAmount(period.month);
  const year = asAmount(period.year);

  // Actual Prisma PayrollEntry field names.
  const basicAmount = asAmount(value.basicAmount);
  const grossAmount = asAmount(value.grossAmount);
  const deductionsAmount = asAmount(
    value.deductionsAmount,
  );
  const netAmount = asAmount(value.netAmount);

  const runStatus = asString(run.status);

  if (
    !id ||
    month === null ||
    year === null ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    basicAmount === null ||
    grossAmount === null ||
    deductionsAmount === null ||
    netAmount === null ||
    (runStatus !== "APPROVED" &&
      runStatus !== "PAID")
  ) {
    throw new Error(
      "The backend returned incomplete payroll information.",
    );
  }

  const rawComponents = value.components;

  if (!Array.isArray(rawComponents)) {
    throw new Error(
      "Payroll component details are missing.",
    );
  }

  const components: PayrollComponent[] =
    rawComponents.map((component) => {
      if (!isObject(component)) {
        throw new Error("Invalid salary component.");
      }

      const amount = asAmount(component.amount);
      const kind = asString(component.kind);

      if (
        !asString(component.id) ||
        !asString(component.name) ||
        amount === null ||
        (kind !== "EARNING" &&
          kind !== "DEDUCTION")
      ) {
        throw new Error(
          "Invalid salary component details.",
        );
      }

      return {
        id: asString(component.id),
        name: asString(component.name),
        kind,
        amount,
      };
    });

  // PayrollPayment is recorded separately.
  // Its createdAt timestamp is used when provided.
  const payment = isObject(value.payment)
    ? value.payment
    : null;

  const paymentDate =
    payment
      ? asString(payment.paidAt) ||
        asString(payment.createdAt) ||
        null
      : null;

  return {
    id,
    currency: asString(value.currency) || "INR",
    basicAmount,
    grossAmount,
    deductionsAmount,
    netAmount,
    runStatus,
    month,
    year,
    components,
    paymentDate,
    paymentRecorded: payment !== null,
  };
}

export default function PayslipsScreen() {
  const s = useEmployeeStyles();
  const [payslips, setPayslips] =
    useState<EmployeePayslip[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadPayslips() {
        setLoading(true);
        setError("");

        try {
          const response = await api.get<unknown>(
            "/payroll/my-payslips",
          );

          // PayrollService.myPayslips() returns
          // a direct array of PayrollEntry objects.
          if (!Array.isArray(response.data)) {
            throw new Error(
              "Unexpected payslip API response.",
            );
          }

          const records = response.data
            .map(normalizePayslip)
            .sort(
              (a, b) =>
                b.year - a.year ||
                b.month - a.month,
            );

          if (active) {
            setPayslips(records);
          }
        } catch (reason) {
          if (active) {
            setError(getErrorMessage(reason));
            setPayslips([]);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadPayslips();

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  return (
    <View style={s.column}>
      <View
        style={[
          s.between,
          {
            alignItems: "center",
            marginBottom: 12,
          },
        ]}
      >
        <View style={s.flex}>
          <Text style={s.small}>
            Approved and paid salary records
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh payslips"
          disabled={loading}
          onPress={() =>
            setRefresh((value) => value + 1)
          }
          style={({ pressed }) => [
            {
              backgroundColor: "#E6F4EF",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
            },
            (pressed || loading) && {
              opacity: 0.65,
            },
          ]}
        >
          <Text
            style={{
              color: "#11786D",
              fontWeight: "700",
            }}
          >
            Refresh
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View
          style={[
            s.card,
            {
              alignItems: "center",
              paddingVertical: 32,
              gap: 12,
            },
          ]}
        >
          <ActivityIndicator
            size="large"
            color="#11786D"
          />

          <Text style={s.small}>
            Loading your payslips...
          </Text>
        </View>
      ) : error ? (
        <View style={[s.card, { gap: 12 }]}>
          <Text style={s.cardTitle}>
            Payslips unavailable
          </Text>

          <Text
            accessibilityRole="alert"
            style={s.error}
          >
            {error}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setRefresh((value) => value + 1)
            }
          >
            <Text
              style={{
                color: "#11786D",
                fontWeight: "700",
              }}
            >
              Try again
            </Text>
          </Pressable>
        </View>
      ) : payslips.length === 0 ? (
        <View style={[s.card, { gap: 10 }]}>
          <Text style={s.cardTitle}>
            No published payslips yet
          </Text>

          <Text style={s.small}>
            Your approved payroll will appear
            here when available.
          </Text>
        </View>
      ) : (
        payslips.map((payslip) => {
          const earnings = payslip.components.filter(
            (item) => item.kind === "EARNING",
          );

          const deductions = payslip.components.filter(
            (item) => item.kind === "DEDUCTION",
          );

          return (
            <View
              key={payslip.id}
              style={[s.card, { gap: 12 }]}
            >
              <View style={s.between}>
                <View style={s.flex}>
                  <Text style={s.cardTitle}>
                    {periodLabel(
                      payslip.month,
                      payslip.year,
                    )}
                  </Text>

                  <Text style={s.small}>
                    Payroll status:{" "}
                    {payslip.runStatus}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: "#E6F4EF",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                  }}
                >
                  <Text
                    style={{
                      color: "#11786D",
                      fontWeight: "700",
                      fontSize: 11,
                    }}
                  >
                    {payslip.runStatus}
                  </Text>
                </View>
              </View>

              {/* NET SALARY */}

              <View>
                <Text style={s.small}>
                  Net take-home pay
                </Text>

                <Text style={s.payValue}>
                  {formatMoney(
                    payslip.netAmount,
                    payslip.currency,
                  )}
                </Text>
              </View>

              {/* EARNINGS */}

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#E0E7F0",
                  paddingTop: 12,
                  gap: 8,
                }}
              >
                <Text style={s.cardTitle}>
                  Earnings
                </Text>

                {earnings.map((item) => (
                  <View
                    key={item.id}
                    style={s.between}
                  >
                    <Text style={s.small}>
                      {item.name}
                    </Text>

                    <Text style={s.small}>
                      {formatMoney(
                        item.amount,
                        payslip.currency,
                      )}
                    </Text>
                  </View>
                ))}

                <View style={s.between}>
                  <Text style={s.cardTitle}>
                    Gross earnings
                  </Text>

                  <Text style={s.cardTitle}>
                    {formatMoney(
                      payslip.grossAmount,
                      payslip.currency,
                    )}
                  </Text>
                </View>
              </View>

              {/* DEDUCTIONS */}

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#E0E7F0",
                  paddingTop: 12,
                  gap: 8,
                }}
              >
                <Text style={s.cardTitle}>
                  Deductions
                </Text>

                {deductions.length ? (
                  deductions.map((item) => (
                    <View
                      key={item.id}
                      style={s.between}
                    >
                      <Text style={s.small}>
                        {item.name}
                      </Text>

                      <Text style={s.small}>
                        {formatMoney(
                          item.amount,
                          payslip.currency,
                        )}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={s.small}>
                    No deductions
                  </Text>
                )}

                <View style={s.between}>
                  <Text style={s.cardTitle}>
                    Total deductions
                  </Text>

                  <Text style={s.cardTitle}>
                    {formatMoney(
                      payslip.deductionsAmount,
                      payslip.currency,
                    )}
                  </Text>
                </View>
              </View>

              {/* PAYMENT STATUS */}

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#E0E7F0",
                  paddingTop: 12,
                }}
              >
                <Text style={s.small}>
                  {payslip.paymentRecorded
                    ? payslip.paymentDate
                      ? `Payment recorded: ${paymentDateLabel(
                          payslip.paymentDate,
                        )}`
                      : "Payment recorded"
                    : "Payment not yet recorded"}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
