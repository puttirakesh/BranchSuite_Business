import { formSpacing } from '../../../src/shared/theme/formSpacing';
import { toast } from '../../../src/ui/toast-store';
import { useToastState } from '../../../src/ui/useToastState';
import { SelectField } from '../../../src/ui/SelectField';
import { SearchField } from '../../../src/ui/SearchField';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { AppIcon } from "../../../src/ui/AppIcon";
import { AdminPageHeading } from "../../../src/ui/AdminPageHeading";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import {
  dealsApi,
  type DealDto,
  type DealStage,
  type DealOwner,
  type DealStageHistoryItem,
} from "../../../src/core/admin/deals.api";
import { customersApi, leadsApi, type LeadDto, type CustomerDto } from "../../../src/core/admin/api";
import {
  getAdminScope, selectAdminBranch, useAdminScope,
} from "../../../src/core/admin/scope";
import { getAvailableBranches } from "../../../src/core/admin/available-branches";


const stages: DealStage[] = [
  "DISCOVERY",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];
const nextStage: Partial<Record<DealStage, DealStage>> = {
  DISCOVERY: "QUALIFIED",
  QUALIFIED: "PROPOSAL",
  PROPOSAL: "NEGOTIATION",
  NEGOTIATION: "WON",
};
const amountPattern = /^(0|[1-9]\d{0,15})(\.\d{1,2})?$/;

export default function SyncedDealsPage() {
  const { styles } = useAdminLayout(baseStyles);

  const router = useRouter();
  const selection = useAdminScope();
  const params = useLocalSearchParams<{ branch?: string; id?: string; create?: string }>();
  const [companyId, setCompanyId] = useState("");
  const [availableBranches, setAvailableBranches] = useState<
    { id: string; name: string }[]
  >([]);
  const [branchId, setBranchId] = useState("");
  const [deals, setDeals] = useState<DealDto[]>([]);
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [owners, setOwners] = useState<DealOwner[]>([]);
  const [editOwnerId, setEditOwnerId] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<DealStageHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [creating, setCreating] = useState(params.create === '1');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useToastState("", 'error');
  const [reloadKey, setReloadKey] = useState(0);

  React.useEffect(() => {
    if (selection) setBranchFilter(selection.branchId ?? "ALL");
  }, [selection?.companyId, selection?.branchId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      setDeals([]); setCustomers([]); setOwners([]); setCompanyId(''); setAvailableBranches([]); setBranchId(''); setEditingId(null);
      Promise.all([getAdminScope(), getAvailableBranches()])
        .then(async ([scope, branches]) => {
          const permitted = branches.filter(
            (b) =>
              b.status === "ACTIVE" &&
              b.companyId === scope.companyId &&
              (["BUSINESS_OWNER", "BUSINESS_ADMIN"].includes(scope.role) ||
                scope.branches.some((g) => g.id === b.id)),
          );
          const chosen =
            scope.branchId ?? undefined;
          const [data, customerRows, eligibleOwners, leadRows] = await Promise.all([
            dealsApi.list(scope.companyId, chosen),
            customersApi.list(scope.companyId),
            dealsApi.owners(scope.companyId, chosen),
            leadsApi.list(scope.companyId),
          ]);
          if (!active) return;
          setCompanyId(scope.companyId);
          setAvailableBranches(
            permitted.map((b) => ({ id: b.id, name: b.name })),
          );
          setBranchId(
            chosen ?? (permitted.length === 1 ? permitted[0].id : ""),
          );
          setDeals(data);
          setCustomers(customerRows);
          setOwners(eligibleOwners); setLeads(leadRows);
          setBranchFilter(chosen ?? "ALL");
          if (params.id && !data.some(deal => deal.id === params.id)) throw new Error('This deal is unavailable in the selected workspace or branch.');
        })
        .catch((e) => {
          if (active)
            setError(e instanceof Error ? e.message : "Could not load deals");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [selection?.companyId, selection?.branchId, params.branch, params.id, reloadKey]),
  );

  const refresh = () => setReloadKey((n) => n + 1);
  const visibleDeals = deals.filter((d) => {
    const q = search.trim().toLowerCase();
    return (
      (!q ||
        d.title.toLowerCase().includes(q) ||
        (customers.find((c) => c.id === d.customerId)?.name ?? "")
          .toLowerCase()
          .includes(q)) &&
      (!params.id || d.id === params.id) &&
      (stageFilter === "ALL" || d.stage === stageFilter) &&
      (ownerFilter === "ALL" || d.ownerId === ownerFilter) &&
      (branchFilter === "ALL" || d.branchId === branchFilter)
    );
  });
  const toggleHistory = async (id: string) => {
    if (historyId === id) {
      setHistoryId(null);
      return;
    }
    setHistoryId(id);
    setHistory([]);
    setHistoryLoading(true);
    setError("");
    try {
      setHistory(await dealsApi.history(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load stage history");
    } finally {
      setHistoryLoading(false);
    }
  };
  const create = async () => {
    if (busy) return;
    const selectedCustomer = customers.find(customer => customer.id === customerId);
    if (!companyId || !availableBranches.some(branch => branch.id === branchId) || !title.trim()) {
      setError("Enter a title and select an authorized branch.");
      return;
    }
    if (customerId && (!selectedCustomer || selectedCustomer.companyId !== companyId || (selectedCustomer.branchId && selectedCustomer.branchId !== branchId))) {
      setError("Select a customer available to this company and branch.");
      return;
    }
    if (newOwnerId && !owners.some(owner => owner.id === newOwnerId)) {
      setError("Select an authorized salesperson.");
      return;
    }
    if (leadId && !leads.some(lead => lead.id === leadId && (!lead.branchId || lead.branchId === branchId))) {
      setError('Choose a lead available to the selected branch.');
      return;
    }
    if (amount.trim() && !amountPattern.test(amount.trim())) {
      setError(
        "Amount must be a non-negative number with at most two decimals.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await dealsApi.create({
        companyId,
        branchId,
        title: title.trim(),
        ...(amount.trim() ? { amount: amount.trim() } : {}),
        ...(customerId.trim() ? { customerId: customerId.trim() } : {}),
        ...(leadId.trim() ? { leadId: leadId.trim() } : {}),
        currency: "INR",
        ...(newOwnerId ? { ownerId: newOwnerId } : {}),
      });
      setTitle("");
      setAmount("");
      setCustomerId("");
      setLeadId("");
      setNewOwnerId("");
      setCreating(false);
      toast.success('Deal created successfully.');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create deal");
    } finally {
      setBusy(false);
    }
  };
  const beginEdit = (deal: DealDto) => {
    setEditingId(deal.id);
    setEditTitle(deal.title);
    setEditAmount(deal.amount == null ? "" : String(deal.amount));
    setEditCustomerId(deal.customerId ?? "");
    setEditOwnerId(deal.ownerId ?? "");
    setError("");
  };

  const saveEdit = async (deal: DealDto) => {
    if (busy) return;
    if (!editTitle.trim()) {
      setError("Deal title is required.");
      return;
    }
    if (editAmount.trim() && !amountPattern.test(editAmount.trim())) {
      setError("Amount must be non-negative with no more than two decimals.");
      return;
    }
    const selectedCustomer = customers.find((c) => c.id === editCustomerId);
    if (
      editCustomerId &&
      (!selectedCustomer ||
        selectedCustomer.companyId !== deal.companyId ||
        (selectedCustomer.branchId &&
          selectedCustomer.branchId !== deal.branchId))
    ) {
      setError(
        "Select a customer authorized for this deal company and branch.",
      );
      return;
    }
    if (editOwnerId && !owners.some(owner => owner.id === editOwnerId)) {
      setError("Select an authorized salesperson.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await dealsApi.update(deal.id, {
        title: editTitle.trim(),
        amount: editAmount.trim() || null,
        customerId: editCustomerId || null,
        ...(editOwnerId ? { ownerId: editOwnerId } : {}),
      });
      setEditingId(null);
      toast.success('Deal updated successfully.');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update deal");
    } finally {
      setBusy(false);
    }
  };

  const move = async (deal: DealDto, stage: DealStage) => {
    if (busy) return;
    if (stage === "LOST" && !lossReason.trim()) {
      setError("Enter a loss reason before marking a deal Lost.");
      return;
    }
    if (stage === "WON" && (!deal.customerId || deal.amount === null)) {
      setError(
        "Winning a deal requires a linked customer and amount. Edit the deal details first.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await dealsApi.transition(
        deal.id,
        stage,
        stage === "LOST" ? lossReason.trim() : undefined,
      );
      setLossReason("");
      toast.success('Deal stage updated.');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change deal stage");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <AdminPageHeading title="Sales pipeline" onBack={() => router.replace('/admin/crm')}><Pressable style={styles.button} onPress={() => setCreating(!creating)}><Text style={styles.buttonText}>{creating ? "Cancel" : "+ New deal"}</Text></Pressable></AdminPageHeading>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          <View style={styles.toolbar}>
            <Pressable style={styles.secondary} onPress={refresh}>
              <Text>Refresh</Text>
            </Pressable>
          </View>
          {creating && (
            <View style={styles.card}>
              <Text style={styles.subheading}>Create opportunity</Text>
              <SelectField label="Opportunity branch" value={branchId} options={availableBranches.map(branch => ({ value: branch.id, label: branch.name }))} onChange={value => { setBranchId(value); setCustomerId(''); setLeadId(''); }} disabled={busy} />
              <TextInput validation={{ required: true, maxLength: 200 }}
                value={title}
                onChangeText={setTitle}
                label="Deal title (required)"
                style={styles.input}
              />
              <TextInput validation={{ required: true, min: 0, wholeDigits: 16 }}
                value={amount}
                onChangeText={setAmount}
                label="Amount (INR)"
                keyboardType="decimal-pad"
                style={styles.input}
              />
              <SelectField label="Customer (optional)" value={customerId} options={[{ value: '', label: 'No customer linked' }, ...customers.filter(customer => customer.companyId === companyId && (!customer.branchId || customer.branchId === branchId)).map(customer => ({ value: customer.id, label: customer.name }))]} onChange={setCustomerId} disabled={busy} />
              <SelectField label="Salesperson" value={newOwnerId} options={[{ value: '', label: 'Unassigned' }, ...owners.map(owner => ({ value: owner.id, label: owner.name + ' (' + owner.email + ')' }))]} onChange={setNewOwnerId} disabled={busy} />
              <SelectField label="Linked lead (optional)" value={leadId} options={[{ value: '', label: 'No linked lead' }, ...leads.filter(lead => !lead.branchId || lead.branchId === branchId).map(lead => ({ value: lead.id, label: lead.name }))]} onChange={setLeadId} disabled={busy} />
              <Pressable accessibilityRole="button" accessibilityLabel="Save deal" disabled={busy} style={styles.button} onPress={create}>
                <Text style={styles.buttonText}>
                  {busy ? "Saving..." : "Save deal"}
                </Text>
              </Pressable>
            </View>
          )}
          <View style={styles.card}>
            <Text style={styles.subheading}>Filter sales pipeline</Text>
            <SearchField accessibilityLabel="Search deals"
              value={search}
              onChangeText={setSearch}
            />
            <SelectField label="Filter by stage" value={stageFilter} options={[{ value: 'ALL', label: 'All stages' }, ...stages.map(stage => ({ value: stage, label: stage.charAt(0) + stage.slice(1).toLowerCase() }))]} onChange={setStageFilter} />
            <SelectField label="Filter by owner" value={ownerFilter} options={[{ value: 'ALL', label: 'All owners' }, ...owners.map(owner => ({ value: owner.id, label: owner.name }))]} onChange={setOwnerFilter} />
            <SelectField label="Filter by branch" value={branchFilter} options={[{ value: 'ALL', label: 'All branches' }, ...availableBranches.map(branch => ({ value: branch.id, label: branch.name }))]} onChange={value => { setBranchFilter(value); void selectAdminBranch(value === 'ALL' ? null : value); }} />
            <Text style={styles.muted}>
              Showing {visibleDeals.length} of {deals.length} loaded deals
            </Text>
          </View>
          {visibleDeals.length === 0 ? (
            <Text style={styles.muted}>
              No matching deals. Add a deal or adjust your filters.
            </Text>
          ) : (
            visibleDeals.map((deal) => (
              <View key={deal.id} style={styles.card}>
                <Text style={styles.subheading}>{deal.title}</Text>
                <Text>
                  {deal.stage} ·{" "}
                  {deal.amount == null
                    ? "Amount not set"
                    : `${deal.currency} ${deal.amount}`}
                </Text>
                <Text style={styles.muted}>
                  Branch:{" "}
                  {availableBranches.find((b) => b.id === deal.branchId)
                    ?.name ?? "Company-wide"}
                </Text>
                <Text style={styles.muted}>
                  Owner:{" "}
                  {owners.find((u) => u.id === deal.ownerId)?.name ??
                    (deal.ownerId ? "Unavailable salesperson" : "Unassigned")}
                </Text>
                <Text style={styles.muted}>
                  Customer:{" "}
                  {customers.find((c) => c.id === deal.customerId)?.name ??
                    (deal.customerId ? "Linked customer" : "Not linked")}
                </Text>
                {deal.stage !== "WON" && deal.stage !== "LOST" && (
                  <>
                    <Pressable
                      style={styles.secondary}
                      disabled={busy}
                      onPress={() =>
                        editingId === deal.id
                          ? setEditingId(null)
                          : beginEdit(deal)
                      }
                    >
                      <Text>
                        {editingId === deal.id
                          ? "Cancel edit"
                          : "Edit deal details"}
                      </Text>
                    </Pressable>
                    {editingId === deal.id && (
                      <View style={styles.editArea}>
                        <Text style={styles.subheading}>Edit opportunity</Text>
                        <TextInput validation={{ required: true, maxLength: 200 }}
                          value={editTitle}
                          onChangeText={setEditTitle}
                          label="Deal title"
                          style={styles.input}
                        />
                        <TextInput validation={{ required: true, min: 0, wholeDigits: 16 }}
                          value={editAmount}
                          onChangeText={setEditAmount}
                          keyboardType="decimal-pad"
                          label="Deal amount (INR)"
                          style={styles.input}
                        />
                        <SelectField label="Linked customer" value={editCustomerId} options={[{ value: '', label: 'No customer linked' }, ...customers.filter(customer => customer.companyId === deal.companyId && (!customer.branchId || customer.branchId === deal.branchId)).map(customer => ({ value: customer.id, label: customer.name }))]} onChange={setEditCustomerId} disabled={busy} />
                        <SelectField label="Assigned salesperson" value={editOwnerId} options={[{ value: '', label: 'Unassigned' }, ...owners.map(owner => ({ value: owner.id, label: owner.name }))]} onChange={setEditOwnerId} disabled={busy} />
                        <Pressable
                          style={styles.button}
                          disabled={busy}
                          onPress={() => saveEdit(deal)}
                        >
                          <Text style={styles.buttonText}>
                            {busy ? "Saving..." : "Save deal changes"}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
                <Pressable
                  style={styles.secondary}
                  onPress={() => toggleHistory(deal.id)}
                >
                  <Text>
                    {historyId === deal.id
                      ? "Hide stage history"
                      : "View stage history"}
                  </Text>
                </Pressable>
                {historyId === deal.id && (
                  <View style={styles.editArea}>
                    <Text style={styles.subheading}>Stage history</Text>
                    {historyLoading ? (
                      <ActivityIndicator />
                    ) : history.length === 0 ? (
                      <Text style={styles.muted}>
                        No stage changes recorded yet.
                      </Text>
                    ) : (
                      history.map((item) => (
                        <View key={item.id} style={styles.historyLine}>
                          <Text>
                            {item.fromStage} → {item.toStage}
                          </Text>
                          <Text style={styles.muted}>
                            {new Date(item.createdAt).toLocaleString()} ·{" "}
                            {owners.find((u) => u.id === item.changedById)
                              ?.name ?? "Authorized user"}
                          </Text>
                          {!!item.reason && (
                            <Text style={styles.muted}>
                              Reason: {item.reason}
                            </Text>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                )}
                {nextStage[deal.stage] && (
                  <Pressable
                    disabled={busy}
                    style={styles.secondary}
                    onPress={() => move(deal, nextStage[deal.stage]!)}
                  >
                    <Text>Move to {nextStage[deal.stage]}</Text>
                  </Pressable>
                )}
                {deal.stage !== "WON" && deal.stage !== "LOST" && (
                  <>
                    <TextInput validation={{ required: true, maxLength: 1000 }}
                      value={lossReason}
                      onChangeText={setLossReason}
                      label="Loss reason (required to mark Lost)"
                      style={styles.input}
                    />
                    <Pressable
                      disabled={busy}
                      style={styles.secondary}
                      onPress={() => move(deal, "LOST")}
                    >
                      <Text>Mark Lost</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}
const baseStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F8FC" },
  content: {
    padding: 20,
    paddingBottom: 56,
    gap: 12,
    maxWidth: 840,
    width: "100%",
    alignSelf: "center",
  },
  heading: { fontSize: 24, fontWeight: "700", color: "#182A43" },
  subheading: { fontSize: 17, fontWeight: "700", color: "#182A43" },
  muted: { color: "#52637A", fontSize: 13 },
  error: {
    color: "#A61B1B",
    padding: 12,
    backgroundColor: "#FFF1F2",
    borderRadius: 8,
  },
  toolbar: { flexDirection: "row", gap: 12 },
  button: {
    backgroundColor: "#2457D6",
    padding: 13,
    borderRadius: 9,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  secondary: {
    padding: 11,
    borderColor: "#CBD5E1",
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: formSpacing.field,
    borderColor: "#DCE4EF",
    borderWidth: 1,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    color: "#182A43",
  },
  choice: { paddingVertical: 8 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 8,
  },
  chipOn: { backgroundColor: "#2457D6", borderColor: "#2457D6" },
  chipText: { color: "#182A43", fontSize: 12 },
  chipTextOn: { color: "white", fontSize: 12 },
  historyLine: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#DCE4EF",
  },
  editArea: {
    gap: formSpacing.field,
    padding: 12,
    backgroundColor: "#F6F8FC",
    borderRadius: 9,
  },
  link: { color: "#2457D6", fontWeight: "600" },
});
