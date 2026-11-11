import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../shared/theme/colors";
import type { BillingPayment } from "./billing.api";
import { formatDate, formatRupees, paymentStatusLabel } from "./format";

/** Payment & renewal history (owner view). */
export function PaymentHistory({ payments }: { payments: BillingPayment[] }) {
  if (!payments.length) {
    return <Text style={styles.empty}>No payments yet.</Text>;
  }
  return (
    <View style={styles.list} accessibilityLabel="Payment history">
      {payments.map((payment) => (
        <View key={payment.id} style={styles.row}>
          <View style={styles.main}>
            <Text style={styles.amount}>{formatRupees(payment.amountPaise)}</Text>
            <Text style={styles.meta}>{formatDate(payment.capturedAt ?? payment.createdAt)}{payment.method ? ` · ${payment.method}` : ""}</Text>
            {payment.failureDescription && payment.status !== "CAPTURED" ? (
              <Text style={styles.failure}>{payment.failureDescription}</Text>
            ) : null}
          </View>
          <Text style={[styles.status, payment.status === "CAPTURED" ? styles.ok : payment.status === "FAILED" || payment.status === "REJECTED" ? styles.bad : null]}>
            {paymentStatusLabel(payment.status)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  empty: { fontSize: 14, color: colors.muted },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  main: { flexShrink: 1, gap: 2 },
  amount: { fontSize: 15, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  failure: { fontSize: 12, color: colors.danger },
  status: { fontSize: 13, fontWeight: "700", color: colors.muted },
  ok: { color: colors.success },
  bad: { color: colors.danger },
});
