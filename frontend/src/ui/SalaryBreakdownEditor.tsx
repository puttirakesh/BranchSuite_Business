import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  suggestedIndianSalaryComponents,
  type SalaryComponentInput,
} from "../core/payroll-structure";
import { payrollApi, type SalaryBreakdownDto } from "../core/admin/api";
import { apiErrorMessage } from "../core/admin/http";
import {
  breakdownRequestComponents,
  displayComponentName,
  estimateSalaryBreakdown,
  formatInr,
  isStatutoryComponent,
  isValidGross,
} from "../core/salary-breakdown";
import { FloatingTextInput as TextInput } from "./FloatingTextInput";

export type BreakdownState = {
  state: "idle" | "loading" | "ready" | "error";
  error?: string;
  breakdown?: SalaryBreakdownDto;
};

type Props = {
  companyId: string | undefined;
  grossAmount: string;
  onGrossAmountChange: (value: string) => void;
  /** Allowance and deduction amounts. Existing (legacy or saved) components are preserved; none can be added or removed here. */
  components: SalaryComponentInput[];
  onComponentsChange: (components: SalaryComponentInput[]) => void;
  /** Receives the calculated basic salary ('' while unavailable) so callers keep their existing payload shape. */
  onBasicAmountChange: (value: string) => void;
  onStatusChange?: (status: BreakdownState) => void;
  showCard?: boolean;
  suggestIndianDefaults?: boolean;
  disabled?: boolean;
};

/**
 * Payroll editing uses the backend preview; onboarding calculates the same estimate locally so
 * typing does not depend on preview-service availability. The save endpoint validates the structure.
 */
export function SalaryBreakdownEditor({
  companyId,
  grossAmount,
  onGrossAmountChange,
  components,
  onComponentsChange,
  onBasicAmountChange,
  onStatusChange,
  showCard = true,
  suggestIndianDefaults = false,
  disabled = false,
}: Props) {
  const [status, setStatus] = useState<BreakdownState>({ state: "idle" });
  const sequence = useRef(0);
  const manuallyEdited = useRef(new Set<string>());
  const callbacks = useRef({ onBasicAmountChange, onStatusChange });
  callbacks.current = { onBasicAmountChange, onStatusChange };
  const requestKey = JSON.stringify([
    companyId,
    grossAmount.trim(),
    breakdownRequestComponents(components),
  ]);

  useEffect(() => {
    const id = ++sequence.current;
    const publish = (next: BreakdownState, basic: string) => {
      setStatus(next);
      callbacks.current.onBasicAmountChange(basic);
      callbacks.current.onStatusChange?.(next);
    };
    if (!companyId || !isValidGross(grossAmount)) {
      publish({ state: "idle" }, "");
      return;
    }
    if (suggestIndianDefaults) {
      try {
        const estimate = estimateSalaryBreakdown(grossAmount, components);
        let nextComponents = components;
        if (!manuallyEdited.current.has("PROVIDENT_FUND")) {
          const suggestedPf = suggestedIndianSalaryComponents(
            estimate.monthlyGross,
            estimate.basicAmount,
          )?.PROVIDENT_FUND;
          const currentPf = components.find(
            (component) => component.code === "PROVIDENT_FUND",
          );
          if (
            suggestedPf !== undefined &&
            currentPf &&
            currentPf.amount !== suggestedPf
          ) {
            nextComponents = components.map((component) =>
              component.code === "PROVIDENT_FUND"
                ? { ...component, amount: suggestedPf }
                : component,
            );
            onComponentsChange(nextComponents);
          }
        }
        const finalEstimate =
          nextComponents === components
            ? estimate
            : estimateSalaryBreakdown(grossAmount, nextComponents);
        publish(
          { state: "ready", breakdown: finalEstimate },
          finalEstimate.basicAmount,
        );
      } catch (error) {
        publish(
          {
            state: "error",
            error:
              error instanceof Error
                ? error.message
                : "Enter valid salary amounts.",
          },
          "",
        );
      }
      return;
    }
    // Block saving while a response is pending so a stale basic salary is never submitted.
    const pending: BreakdownState = { state: "loading" };
    setStatus(pending);
    callbacks.current.onBasicAmountChange("");
    callbacks.current.onStatusChange?.(pending);
    const timer = setTimeout(() => {
      payrollApi
        .previewSalaryBreakdown({
          companyId,
          monthlyGross: grossAmount.trim(),
          components: breakdownRequestComponents(components),
        })
        .then((breakdown) => {
          if (id === sequence.current)
            publish({ state: "ready", breakdown }, breakdown.basicAmount);
        })
        .catch((error) => {
          if (id === sequence.current)
            publish(
              {
                state: "error",
                error: apiErrorMessage(
                  error,
                  "Could not calculate the salary breakdown.",
                ),
              },
              "",
            );
        });
    }, 350);
    return () => clearTimeout(timer);
    // requestKey captures every input that affects the calculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const update = (index: number, amount: string) => {
    const component = components[index];
    if (component?.code) manuallyEdited.current.add(component.code);
    onComponentsChange(
      components.map((item, itemIndex) =>
        itemIndex === index ? { ...item, amount } : item,
      ),
    );
  };
  const changeGross = (amount: string) => {
    onGrossAmountChange(amount);
    if (!suggestIndianDefaults) return;
    const suggested = suggestedIndianSalaryComponents(amount);
    if (!suggested) return;
    onComponentsChange(
      components.map((component) => {
        const code = component.code ?? "";
        return suggested[code] !== undefined &&
          !manuallyEdited.current.has(code)
          ? { ...component, amount: suggested[code] }
          : component;
      }),
    );
  };
  const indexed = components.map((item, index) => ({ item, index }));
  const allowances = indexed.filter(({ item }) => item.kind === "EARNING");
  const statutory = indexed.filter(({ item }) => isStatutoryComponent(item));
  const otherDeductions = indexed.filter(
    ({ item }) => item.kind === "DEDUCTION" && !isStatutoryComponent(item),
  );
  const breakdown = status.breakdown;
  const busy = status.state === "loading";
  const value = (read: (b: SalaryBreakdownDto) => string) =>
    busy
      ? "Calculating…"
      : breakdown && status.state === "ready"
        ? formatInr(read(breakdown))
        : "—";

  const amountInput = (
    { item, index }: { item: SalaryComponentInput; index: number },
    label: string,
  ) => (
    <TextInput
      key={`${item.kind}-${item.code ?? item.name}-${index}`}
      label={label}
      accessibilityLabel={`${label} amount`}
      value={item.amount}
      onChangeText={(amount) => update(index, amount)}
      editable={!disabled}
      keyboardType="decimal-pad"
      validation={{ kind: "decimal", fractionDigits: 2, maxLength: 15 }}
      style={styles.input}
    />
  );

  return (
    <View style={styles.container} testID="salary-breakdown">
      <TextInput
        label="Monthly gross salary (₹)"
        accessibilityLabel="Monthly gross salary"
        value={grossAmount}
        onChangeText={changeGross}
        editable={!disabled}
        keyboardType="decimal-pad"
        validation={{ kind: "decimal", fractionDigits: 2, maxLength: 15 }}
        style={styles.input}
      />
      {status.state === "error" && (
        <Text accessibilityRole="alert" style={styles.error}>
          {status.error}
        </Text>
      )}

      <View style={showCard ? styles.card : styles.flat}>
        {allowances.map((entry) =>
          amountInput(entry, displayComponentName(entry.item.name)),
        )}
        <Line
          label="Allowances total"
          value={value((b) => b.allowancesTotal)}
        />

        {suggestIndianDefaults && statutory.length > 0 && (
          <Text style={styles.group}>Statutory deductions</Text>
        )}
        {statutory.map((entry) =>
          amountInput(entry, displayComponentName(entry.item.name)),
        )}
        {statutory.length === 0 &&
          (breakdown?.statutory ?? []).map((item) => (
            <Line
              key={item.code}
              label={item.name}
              value="Not configured"
              muted
            />
          ))}
        {otherDeductions.length > 0 && (
          <Text style={styles.group}>Other deductions</Text>
        )}
        {otherDeductions.map((entry) =>
          amountInput(entry, displayComponentName(entry.item.name)),
        )}
        <Line
          label="Total deductions"
          value={value((b) => b.deductionsTotal)}
        />
        <View style={styles.divider} />
        <Line
          label="Estimated net salary"
          value={value((b) => b.estimatedNet)}
          strong
        />
        <View style={styles.divider} />
      </View>
    </View>
  );
}

function Line({
  label,
  value,
  tag,
  strong,
  muted,
}: {
  label: string;
  value: string;
  tag?: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <View
      style={styles.line}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={styles.lineLabel}>
        <Text style={[styles.lineText, strong && styles.strong]}>{label}</Text>
        {!!tag && <Text style={styles.tag}>{tag}</Text>}
      </View>
      <Text
        style={[
          styles.lineValue,
          strong && styles.strong,
          muted && styles.muted,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, marginTop: 8 },
  sectionTitle: { color: "#20334f", fontSize: 16, fontWeight: "700" },
  caption: { color: "#71819a", fontSize: 12, lineHeight: 18 },
  input: {
    minHeight: 44,
    borderColor: "#dce5f3",
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#fff",
    color: "#20334f",
    fontSize: 14,
    paddingHorizontal: 11,
  },
  error: { color: "#B94D61", fontSize: 12, lineHeight: 18 },
  hint: { color: "#71819a", fontSize: 11, lineHeight: 16 },
  flat: { gap: 16 },
  card: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e1e8f4",
    backgroundColor: "#f8faff",
  },
  cardTitle: { color: "#20334f", fontSize: 14, fontWeight: "700" },
  group: { color: "#405573", fontSize: 12, fontWeight: "700", marginTop: 4 },
  notice: { color: "#8a6a32", fontSize: 11, lineHeight: 16 },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  lineLabel: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  lineText: { color: "#405573", fontSize: 13 },
  lineValue: {
    color: "#20334f",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    flexShrink: 0,
  },
  tag: {
    color: "#345cf2",
    backgroundColor: "#eaf0ff",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  strong: { color: "#20334f", fontSize: 15, fontWeight: "800" },
  muted: { color: "#8a6a32", fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#e1e8f4" },
});
