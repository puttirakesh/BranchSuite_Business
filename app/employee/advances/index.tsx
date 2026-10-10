import { Text, View } from 'react-native';
import { dayKey, displayDate, money } from '../../../src/features/employee/data';
import { Button, Badge, Field } from '../../../src/features/employee/components';
import { s } from '../../../src/features/employee/styles';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';

export default function AdvancesScreen() {
  const { advanceAmount, setAdvanceAmount, advanceReason, setAdvanceReason, advanceError, setAdvanceError, records, setRecords, loaded, setMessage } = useEmployeeWorkspace();
  return (
    <View style={s.column}>
      <View style={[s.card, { gap: 12 }]}>
        <Text style={s.sectionTitle}>Request an advance</Text>
        <Text style={s.small}>Sample requests are saved on this device for tracking.</Text>
        <Field label="Amount (INR)" value={advanceAmount} onChange={setAdvanceAmount} placeholder="Enter amount" />
        <Field label="Reason" value={advanceReason} onChange={setAdvanceReason} multiline placeholder="What is the advance for?" />
        {!!advanceError && <Text accessibilityRole="alert" style={s.error}>{advanceError}</Text>}
        <Button label="Request advance" disabled={!loaded} onPress={() => {
          const amount = Number(advanceAmount.trim());
          if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(advanceAmount.trim()) || !advanceReason.trim()) {
            setAdvanceError("Enter a positive amount with up to two decimal places and a reason.");
            return;
          }
          setRecords((current) => ({ ...current, advances: [
            { id: `${Date.now()}`, amount, reason: advanceReason.trim(), date: dayKey(), status: "Pending" },
            ...(current.advances ?? []),
          ] }));
          setAdvanceAmount(""); setAdvanceReason(""); setAdvanceError("");
          setMessage("Sample advance request saved.");
        }} />
      </View>
      <Text style={s.sectionTitle}>Request history</Text>
      {(records.advances ?? []).map((advance) => (
        <View key={advance.id} style={[s.card, { gap: 8 }]}>
          <View style={s.between}><Text style={s.cardTitle}>{money(advance.amount)}</Text><Badge label={advance.status} /></View>
          <Text style={s.body}>{advance.reason}</Text>
          <Text style={s.small}>{displayDate(advance.date)}</Text>
        </View>
      ))}
      {!records.advances?.length && <Text style={s.small}>No salary advance requests yet.</Text>}
    </View>

  );
}
