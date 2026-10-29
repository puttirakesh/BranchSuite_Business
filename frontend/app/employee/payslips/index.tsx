import { PayslipPreview } from '../../../src/features/employee/PayslipPreview';
import { type EmployeePayslip, formatMoney, periodLabel, paymentStatusLabel, normalizePayslips } from '../../../src/features/employee/payslips';
import { savePayslipPdf } from '../../../src/features/employee/payslip-pdf';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { useAuth } from '../../../src/core/auth/AuthProvider';
import { type Identity } from '../../../src/features/employee/payslip-pdf-content';
import { useToastState } from '../../../src/ui/useToastState';
import { RefreshButton } from '../../../src/features/employee/components';
import { apiErrorMessage } from '../../../src/core/admin/http';
import { AppIcon } from "../../../src/ui/AppIcon";
import { Dropdown } from "../../../src/ui/Dropdown";
import { ToastModal as Modal } from "../../../src/ui/Toast";

import React, { useCallback, useRef, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useFocusEffect, usePathname, useRouter } from "expo-router";

import { api } from "../../../src/core/api/client";
import { useEmployeeStyles } from "../../../src/features/employee/styles";

export default function PayslipsScreen() {
  const s = useEmployeeStyles();
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const identityFor = (record: EmployeePayslip): Identity => record.identity ?? { name: session?.user.name ?? 'Employee', employeeId: '', company: '', legacy: true };
  const [payslips, setPayslips] =
    useState<EmployeePayslip[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState("", 'error');
  const [downloadError, setDownloadError] = useToastState("", "error");
  const [downloadNotice, setDownloadNotice] = useToastState("", "success");
  const downloadInProgress = useRef(false);
  const [refresh, setRefresh] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [viewingPayslip, setViewingPayslip] = useState<EmployeePayslip | null>(null);
  const [downloadingId, setDownloadingId] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadPayslips() {
        setLoading(true);
        setError("");
        setDownloadError("");

        try {
          const response = await api.get<unknown>(
            "/payroll/my-payslips",
          );

          const records = normalizePayslips(response.data);

          if (active) {
            setPayslips(records);
            setViewingPayslip(current => records.find(record => record.id === current?.id) ?? null);
            setSelectedPeriod(current => records.some(record => record.id === current)
              ? current
              : records[0] ? records[0].id : "");
          }
        } catch (reason) {
          if (active) {
            setError(apiErrorMessage(reason, "Unable to retrieve your payslips."));
            setPayslips([]);
            setViewingPayslip(null);
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

  const selectedPayslip = payslips.find(record => record.id === selectedPeriod) ?? null;
  const downloadPayslip = async (payslip: EmployeePayslip) => {
    if (downloadInProgress.current) return;
    downloadInProgress.current = true;
    setDownloadingId(payslip.id);
    setDownloadError("");
    setDownloadNotice("");
    try {
      const result = await savePayslipPdf(payslip, identityFor(payslip));
      if (result === 'saved') setDownloadNotice('Payslip saved to your selected folder.');
    } catch (reason) {
      setDownloadError(apiErrorMessage(reason, 'Unable to download this payslip.'));
    } finally {
      downloadInProgress.current = false;
      setDownloadingId('');
    }
  };
  const monthFirstId = (record: EmployeePayslip) => payslips.find(item => item.year === record.year && item.month === record.month)?.id ?? record.id;
  const monthOptions = payslips.filter(record => monthFirstId(record) === record.id).map(record => ({ value: record.id, label: periodLabel(record.month, record.year) }));

  return (
    <>
      <AdminPageHeading title="My Payroll" onBack={() => router.replace(pathname.startsWith('/admin') ? '/admin/more' : '/employee/dashboard')}><RefreshButton label="Refresh payslips" loading={loading} onPress={() => setRefresh(value => value + 1)} /></AdminPageHeading>
      <View style={[s.column, { gap: 16 }]}>
      <Text style={[s.small, { marginBottom: 2 }]}>Your salary history and payment details</Text>

      {!!downloadError && <Text accessibilityRole="alert" style={s.error}>{downloadError}</Text>}
      {!!downloadNotice && <Text accessibilityLiveRegion="polite" style={s.small}>{downloadNotice}</Text>}
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
        <View style={[s.card, { gap: 12, padding: 22, alignItems: "flex-start" }]}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "#EAF4F1", alignItems: "center", justifyContent: "center" }}>
            <AppIcon name="file-text" size={22} color="#11786D" />
          </View>
          <Text style={s.cardTitle}>No payslips available yet</Text>
          <Text style={s.small}>Published salary records will appear here. Check back after your payroll is approved.</Text>
        </View>
      ) : (
        <>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={[s.card, { flex: 1, minWidth: 0, gap: 3, paddingVertical: 9, paddingHorizontal: 11, backgroundColor: "#F2F8F6", borderColor: "#D9EAE3" }]}>
            <Text style={s.small}>Latest take-home</Text>
            <Text style={{ color: "#116C61", fontSize: 17, lineHeight: 22, fontWeight: "800" }} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(payslips[0].netAmount, payslips[0].currency)}</Text>
            <Text style={[s.small, { fontSize: 11 }]} numberOfLines={1}>{periodLabel(payslips[0].month, payslips[0].year)}</Text>
          </View>
          <View style={[s.card, { width: 86, gap: 2, paddingVertical: 9, paddingHorizontal: 10, justifyContent: "center" }]}>
            <Text style={s.small}>Payslips</Text>
            <Text style={{ color: "#17263F", fontSize: 21, lineHeight: 25, fontWeight: "800" }}>{payslips.length}</Text>
            <Text style={[s.small, { fontSize: 11 }]}>available</Text>
          </View>
        </View>
        <Text style={[s.sectionTitle, { marginTop: 2 }]}>Salary history</Text>
        <Dropdown label="Payroll month" value={selectedPayslip ? monthFirstId(selectedPayslip) : ""} options={monthOptions} placeholder="Select a month" onChange={setSelectedPeriod} />
        {selectedPayslip && payslips.filter(record => record.year === selectedPayslip.year && record.month === selectedPayslip.month).length > 1 && <View style={{ gap: 8 }}>
          <Text style={s.small}>Choose a payslip for this month</Text>
          {payslips.filter(record => record.year === selectedPayslip.year && record.month === selectedPayslip.month).map(record => <Pressable key={record.id} accessibilityRole="button" accessibilityState={{ selected: record.id === selectedPeriod }} onPress={() => setSelectedPeriod(record.id)} style={[s.card, { padding: 12, borderColor: record.id === selectedPeriod ? '#11786D' : '#D7E0EA' }]}><Text style={s.body}>{record.identity?.company || 'Company'}{record.identity?.branch ? ' - ' + record.identity.branch : ''} - {formatMoney(record.netAmount, record.currency)}</Text></Pressable>)}
        </View>}
        {selectedPayslip ? <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }]}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={s.small}>{selectedPayslip.identity?.company || "Net take-home pay"}</Text>
            <Text style={{ color: '#17263F', fontSize: 20, lineHeight: 26, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(selectedPayslip.netAmount, selectedPayslip.currency)}</Text>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: selectedPayslip.paid ? '#E6F4EF' : '#FFF3D9', borderRadius: 18, paddingHorizontal: 9, paddingVertical: 5 }}>
              <AppIcon name={selectedPayslip.paid ? 'check-circle' : 'clock'} size={13} color={selectedPayslip.paid ? '#11786D' : '#9A6815'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: selectedPayslip.paid ? '#11786D' : '#9A6815' }}>{selectedPayslip.paid ? 'Paid' : 'Approved'}</Text>
            </View>
            <Text style={s.small}>{paymentStatusLabel(selectedPayslip)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="View payslip details" onPress={() => setViewingPayslip(selectedPayslip)} style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA' }}><AppIcon name="eye" size={19} color="#405573" /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Download payslip PDF" disabled={!!downloadingId} onPress={() => void downloadPayslip(selectedPayslip)} style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF4F1', opacity: downloadingId ? 0.55 : 1 }}><AppIcon name={downloadingId === selectedPayslip.id ? 'clock' : 'download'} size={19} color="#11786D" /></Pressable>
        </View> : <View style={[s.card, { padding: 16 }]}><Text style={s.small}>No payslip was published for this month.</Text></View>}
        </>
      )}
    </View>
    <Modal transparent visible={!!viewingPayslip} animationType="slide" onRequestClose={() => setViewingPayslip(null)}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#17263F66' }}>
        {viewingPayslip && <View accessibilityViewIsModal style={[s.card, { width: '100%', maxWidth: 760, maxHeight: '90%', padding: 16, gap: 14 }]}>
          <View style={s.between}><View style={{ flex: 1, gap: 3 }}><Text accessibilityRole="header" style={s.cardTitle}>Payslip details</Text><Text style={s.small}>{periodLabel(viewingPayslip.month, viewingPayslip.year)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close payslip details" onPress={() => setViewingPayslip(null)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="x" size={20} /></Pressable></View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            <PayslipPreview payslip={viewingPayslip} identity={identityFor(viewingPayslip)} />
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="Download payslip" disabled={!!downloadingId} accessibilityState={{ disabled: !!downloadingId, busy: !!downloadingId }} onPress={() => void downloadPayslip(viewingPayslip)} style={[s.button, { flexDirection: 'row', gap: 8 }]}><AppIcon name="download" size={17} color="white" /><Text style={s.buttonText}>{downloadingId ? "Preparing PDF..." : "Download payslip"}</Text></Pressable>
        </View>}
      </View>
    </Modal>
    </>
  );
}
