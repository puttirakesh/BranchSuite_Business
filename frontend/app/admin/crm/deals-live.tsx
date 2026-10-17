import { useDesktopStyles } from "../../../src/ui/useDesktopStyles";
import { AppIcon } from "../../../src/ui/AppIcon";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import {
  dealsApi,
  type DealDto,
  type DealStage,
  type DealOwner,
  type DealStageHistoryItem,
} from "../../../src/core/admin/deals.api";
import { customersApi, type CustomerDto } from "../../../src/core/admin/api";
import {
  getAdminScope, useAdminScope,
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
  const styles = useDesktopStyles(baseStyles);

  const router = useRouter();
  const selection = useAdminScope();
  const params = useLocalSearchParams<{ branch?: string; id?: string; create?: string }>();
  const [companyId, setCompanyId] = useState("");
  const [availableBranches, setAvailableBranches] = useState<
    { id: string; name: string }[]
  >([]);
  const [branchId, setBranchId] = useState("");
  const [deals, setDeals] = useState<DealDto[]>([]);
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
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

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
            permitted.find(b => b.name === params.branch || b.id === params.branch)?.id ?? scope.branchId ?? undefined;
          const [data, customerRows, eligibleOwners] = await Promise.all([
            dealsApi.list(scope.companyId, chosen),
            customersApi.list(scope.companyId),
            dealsApi.owners(scope.companyId, chosen),
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
          setOwners(eligibleOwners);
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
    if (!companyId || !branchId || !title.trim()) {
      setError("Enter a title and select an authorized branch.");
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
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change deal stage");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.push('/admin/crm')}>
        <Text style={styles.link}><AppIcon symbol="←" size={16} /> Back to CRM</Text>
      </Pressable>
      <Text style={styles.heading}>Sales pipeline · Synced deals</Text>
      <Text style={styles.muted}>
        Track opportunities, assign owners, and move deals through your sales process.
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          <View style={styles.toolbar}>
            <Pressable
              style={styles.button}
              onPress={() => setCreating(!creating)}
            >
              <Text style={styles.buttonText}>
                {creating ? "Cancel" : "+ New deal"}
              </Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={refresh}>
              <Text>Refresh</Text>
            </Pressable>
          </View>
          {creating && (
            <View style={styles.card}>
              <Text style={styles.subheading}>Create opportunity</Text>
              <Text style={styles.muted}>Branch</Text>
              {availableBranches.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => setBranchId(b.id)}
                  style={styles.choice}
                >
                  <Text>
                    <AppIcon symbol={branchId === b.id ? "◉" : "○"} size={16} /> {b.name}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Deal title (required)"
                style={styles.input}
              />
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount (INR)"
                keyboardType="decimal-pad"
                style={styles.input}
              />
              <Text style={styles.muted}>
                Link customer (optional when creating, required before Won)
              </Text>
              <Pressable
                style={styles.choice}
                onPress={() => setCustomerId("")}
              >
                <Text><AppIcon symbol={customerId === "" ? "◉" : "○"} size={16} /> No customer linked</Text>
              </Pressable>
              {customers
                .filter(
                  (c) =>
                    c.companyId === companyId &&
                    (!c.branchId || c.branchId === branchId),
                )
                .map((c) => (
                  <Pressable
                    key={c.id}
                    style={styles.choice}
                    onPress={() => setCustomerId(c.id)}
                  >
                    <Text>
                      <AppIcon symbol={customerId === c.id ? "◉" : "○"} size={16} /> {c.name}
                      {c.email ? ` · ${c.email}` : ""}
                    </Text>
                  </Pressable>
                ))}
              <Text style={styles.muted}>Assign salesperson / deal owner</Text>
              {owners.map((u) => (
                <Pressable
                  key={u.id}
                  style={styles.choice}
                  onPress={() => setNewOwnerId(u.id)}
                >
                  <Text>
                    <AppIcon symbol={newOwnerId === u.id ? "◉" : "○"} size={16} /> {u.name} ({u.email})
                  </Text>
                </Pressable>
              ))}
              <TextInput
                value={leadId}
                onChangeText={setLeadId}
                placeholder="Existing lead UUID (optional)"
                autoCapitalize="none"
                style={styles.input}
              />
              <Pressable disabled={busy} style={styles.button} onPress={create}>
                <Text style={styles.buttonText}>
                  {busy ? "Saving..." : "Save deal"}
                </Text>
              </Pressable>
            </View>
          )}
          <View style={styles.card}>
            <Text style={styles.subheading}>Filter sales pipeline</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search deal title or customer"
              style={styles.input}
            />
            <Text style={styles.muted}>Stage</Text>
            <View style={styles.filterRow}>
              {(["ALL", ...stages] as string[]).map((stage) => (
                <Pressable
                  key={stage}
                  style={[styles.chip, stageFilter === stage && styles.chipOn]}
                  onPress={() => setStageFilter(stage)}
                >
                  <Text
                    style={
                      stageFilter === stage
                        ? styles.chipTextOn
                        : styles.chipText
                    }
                  >
                    {stage}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.muted}>Owner</Text>
            <View style={styles.filterRow}>
              <Pressable
                style={[styles.chip, ownerFilter === "ALL" && styles.chipOn]}
                onPress={() => setOwnerFilter("ALL")}
              >
                <Text
                  style={
                    ownerFilter === "ALL" ? styles.chipTextOn : styles.chipText
                  }
                >
                  All owners
                </Text>
              </Pressable>
              {owners.map((u) => (
                <Pressable
                  key={u.id}
                  style={[styles.chip, ownerFilter === u.id && styles.chipOn]}
                  onPress={() => setOwnerFilter(u.id)}
                >
                  <Text
                    style={
                      ownerFilter === u.id ? styles.chipTextOn : styles.chipText
                    }
                  >
                    {u.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.muted}>Branch</Text>
            <View style={styles.filterRow}>
              <Pressable
                style={[styles.chip, branchFilter === "ALL" && styles.chipOn]}
                onPress={() => setBranchFilter("ALL")}
              >
                <Text
                  style={
                    branchFilter === "ALL" ? styles.chipTextOn : styles.chipText
                  }
                >
                  All loaded
                </Text>
              </Pressable>
              {availableBranches.map((b) => (
                <Pressable
                  key={b.id}
                  style={[styles.chip, branchFilter === b.id && styles.chipOn]}
                  onPress={() => setBranchFilter(b.id)}
                >
                  <Text
                    style={
                      branchFilter === b.id
                        ? styles.chipTextOn
                        : styles.chipText
                    }
                  >
                    {b.name}
                  </Text>
                </Pressable>
              ))}
            </View>
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
                    (deal.ownerId || "Unassigned")}
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
                        <TextInput
                          value={editTitle}
                          onChangeText={setEditTitle}
                          placeholder="Deal title"
                          style={styles.input}
                        />
                        <TextInput
                          value={editAmount}
                          onChangeText={setEditAmount}
                          keyboardType="decimal-pad"
                          placeholder="Deal amount (INR)"
                          style={styles.input}
                        />
                        <Text style={styles.muted}>Linked customer</Text>
                        <Pressable
                          style={styles.choice}
                          onPress={() => setEditCustomerId("")}
                        >
                          <Text><AppIcon symbol={!editCustomerId ? "◉" : "○"} size={16} /> No customer</Text>
                        </Pressable>
                        {customers
                          .filter(
                            (c) =>
                              c.companyId === deal.companyId &&
                              (!c.branchId || c.branchId === deal.branchId),
                          )
                          .map((c) => (
                            <Pressable
                              key={c.id}
                              style={styles.choice}
                              onPress={() => setEditCustomerId(c.id)}
                            >
                              <Text>
                                <AppIcon symbol={editCustomerId === c.id ? "◉" : "○"} size={16} /> {c.name}
                                {c.email ? ` · ${c.email}` : ""}
                              </Text>
                            </Pressable>
                          ))}
                        <Text style={styles.muted}>
                          Assigned salesperson / deal owner
                        </Text>
                        {owners.map((u) => (
                          <Pressable
                            key={u.id}
                            style={styles.choice}
                            onPress={() => setEditOwnerId(u.id)}
                          >
                            <Text>
                              <AppIcon symbol={editOwnerId === u.id ? "◉" : "○"} size={16} /> {u.name} (
                              {u.email})
                            </Text>
                          </Pressable>
                        ))}
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
                        No transitions recorded yet. Events before Phase 6C are
                        not backfilled.
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
                    <TextInput
                      value={lossReason}
                      onChangeText={setLossReason}
                      placeholder="Loss reason (required to mark Lost)"
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
    gap: 10,
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
    gap: 9,
    padding: 12,
    backgroundColor: "#F6F8FC",
    borderRadius: 9,
  },
  link: { color: "#2457D6", fontWeight: "600" },
});
