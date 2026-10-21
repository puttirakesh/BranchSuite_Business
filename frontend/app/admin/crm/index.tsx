import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { SearchField } from '../../../src/ui/SearchField';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { AppIcon } from "../../../src/ui/AppIcon";

export {
  leadsKey,
  newLeadId,
  normalizeLeadStage,
  readLeads,
  type Lead,
  type LeadForm,
  type LeadActivity,
} from "../../../src/core/leads";
import { readLeads, type Lead } from "../../../src/core/leads";
import { readCrmWorkspace } from "../../../src/core/admin/crm";
import { activitiesApi } from "../../../src/core/admin/api";
import { AdminUnavailablePage } from "../../../src/ui/AdminUnavailablePage";
import { selectAdminBranch, useAdminScope } from "../../../src/core/admin/scope";
import { getEmployees, type Employee } from "../../../src/core/employees";

import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAvailableBranches } from "../../../src/core/admin/available-branches";
import { BranchOptionsStatus } from "../../../src/ui/BranchOptionsStatus";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  FiUsers,
  FiTrendingUp,
  FiBriefcase,
  FiFileText,
  FiList,
  FiHeadphones,
  FiHome,
  FiUserPlus,
  FiCreditCard,
  FiMoreHorizontal,
  FiSearch,
} from "../../../src/ui/FeatherIcons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";
import { adminGrid, adminPageSpacing } from "../../../src/ui/adminResponsive";

const modules = {
  leads: {
    title: "Leads",
    description: "Capture and follow up",
    singular: "lead",
    background: "#e8eeff",
    color: "#345cf2",
  },
  deals: {
    title: "Sales pipeline",
    description: "Move deals forward",
    singular: "deal",
    background: "#eee7ff",
    color: "#7853c8",
  },
  customers: {
    title: "Customers",
    description: "A complete relationship",
    singular: "customer",
    background: "#def6ef",
    color: "#138f80",
  },
  quotes: {
    title: "Quotes",
    description: "Price, preview and approve",
    singular: "quote",
    background: "#e8eeff",
    color: "#345cf2",
  },
  activities: {
    title: "Activities",
    description: "Calls, meetings and tasks",
    singular: "activity",
    background: "#def6ef",
    color: "#138f80",
  },
  support: {
    title: "Support",
    description: "Not available yet",
    singular: "ticket",
    background: "#eee7ff",
    color: "#7853c8",
  },
} as const;
type Module = keyof typeof modules;
type Mode = "hub" | "list" | "detail" | "create";
type RecordCard = {
  id: string;
  leadId: string;
  title: string;
  contact: string;
  branch: string;
  status: string;
  value?: number;
  email: string;
  phone: string;
  notes: string;
  owner: string;
  assignedNames: string[];
  source: string;
  closeDate: string;
};
const pipelineStage = (value: string) =>
  value === "Active" ? "Won" : value === "Inactive" ? "Lost" : value;
const closeDateLabel = (value: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match
    ? new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1]),
      ).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : value || "Not set";
};
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
const shortMoney = (value: number) =>
  value >= 10000000
    ? `₹${(value / 10000000).toFixed(2)} Cr`
    : value >= 100000
      ? `₹${(value / 100000).toFixed(2)} L`
      : money(value);
const webIcons = {
  leads: FiUsers,
  deals: FiTrendingUp,
  customers: FiBriefcase,
  quotes: FiFileText,
  activities: FiList,
  support: FiHeadphones,
  home: FiHome,
  crm: FiTrendingUp,
  people: FiUserPlus,
  payroll: FiCreditCard,
  more: FiMoreHorizontal,
  search: FiSearch,
};

function CrmIcon({
  name,
  color = "#345cf2",
}: {
  name: keyof typeof webIcons;
  color?: string;
}) {
  const Icon = webIcons[name]; return <Icon size={20} color={color} />;
}

function recordsFor(
  leads: Lead[],
  module: Module,
  employees: Employee[] = [],
): RecordCard[] {
  if (module === "support") return [];
  return leads.flatMap((lead) => {
    const savedNames =
      lead.owner && lead.owner !== "Unassigned" ? lead.owner.split(", ") : [];
    const assignedNames =
      lead.assignedEmployeeIds === undefined
        ? savedNames
        : lead.assignedEmployeeIds.map(
            (id, index) =>
              employees.find((employee) => employee.id === id)?.fullName ||
              savedNames[index] ||
              "Unavailable employee",
          );
    const common = {
      leadId: lead.id,
      branch: lead.branch,
      notes: lead.notes,
      owner: assignedNames.join(", ") || "Unassigned",
      assignedNames,
      source: lead.source,
      closeDate: lead.followUpDate,
    };
    if (module === "deals")
      return lead.opportunity
        ? [
            {
              ...common,
              id: lead.opportunity.id,
              title: lead.opportunity.name,
              contact: lead.contactPerson,
              email: lead.email,
              phone: lead.phone,
              value: lead.opportunity.estimatedValue,
              status: pipelineStage(lead.opportunity.stage || lead.stage),
            },
          ]
        : [];
    if (module === "quotes")
      return (lead.opportunity?.quotes || []).map((quote) => ({
        ...common,
        branch: quote.branch || common.branch,
        id: quote.id,
        title: quote.name,
        contact: lead.contactPerson,
        email: lead.email,
        phone: lead.phone,
        value: quote.value,
        status: quote.status || "Draft",
      }));
    if (module === "customers")
      return lead.customer
        ? [
            {
              ...common,
              id: lead.customer.id,
              title: lead.customer.organisation,
              contact: lead.customer.contactPerson,
              email: lead.customer.email,
              phone: lead.customer.phone,
              status: "Customer",
            },
          ]
        : [];
    if (module === "activities")
      return (lead.history || [])
        .filter((entry) => entry.kind === "call" || entry.kind === "activity")
        .map((entry) => ({
          ...common,
          id: entry.id,
          title: entry.kind === "call" ? "Call" : "Activity",
          contact: lead.organisation,
          email: lead.email,
          phone: lead.phone,
          notes: entry.note,
          status: entry.kind === "call" ? "Logged call" : "Logged activity",
        }));
    return [
      {
        ...common,
        id: lead.id,
        title: lead.organisation,
        contact: lead.contactPerson,
        email: lead.email,
        phone: lead.phone,
        value: lead.estimatedValue,
        status: lead.stage,
      },
    ];
  });
}

export function CrmWorkspace({ mode = "hub" }: { mode?: Mode }) {
  const {
    styles,
    contentWidth: constrainedContentWidth,
    fontScale,
    recordGrid,
    workspaceGrid,
  } = useAdminLayout(baseStyles);
  const { desktop, mobile, tablet, width } = useAdminViewport();
  const webPadding = adminPageSpacing(width);
  const contentWidth = desktop
    ? Math.max(0, width - webPadding * 2)
    : constrainedContentWidth;
  const router = useRouter();
  const selection = useAdminScope();
  const params = useLocalSearchParams<{
    module?: string;
    id?: string;
    branch?: string;
  }>();
  const module: Module | null =
    params.module &&
    Object.prototype.hasOwnProperty.call(modules, params.module)
      ? (params.module as Module)
      : null;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [moduleRecords, setModuleRecords] = useState<Partial<Record<Module, RecordCard[]>>>({});
  const [savingActivity, setSavingActivity] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [branch, setBranch] = useState(params.branch || "");
  const [branchPicker, setBranchPicker] = useState(false);
  const { branches: availableBranches, loading: branchesLoading, error: branchesError, refresh: refreshBranches } = useAvailableBranches();
  const [hubGridWidth, setHubGridWidth] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      Promise.all([readCrmWorkspace(), getEmployees().catch(() => [] as Employee[])])
        .then(([workspace, team]) => {
          if (active) {
            setLeads(workspace.leads);
            setModuleRecords(workspace.records);
            setEmployees(team);
          }
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load CRM records.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt, selection?.companyId, selection?.branchId]),
  );
  const branches = useMemo(
    () => [...new Set(availableBranches.map((item) => item.name))].sort(),
    [availableBranches],
  );
  useEffect(() => {
    const sharedBranch = selection
      ? selection.branchId ? availableBranches.find(item => item.id === selection.branchId)?.name ?? "" : ""
      : typeof params.branch === "string" ? params.branch : "";
    setBranch(sharedBranch);
  }, [selection?.branchId, availableBranches, params.branch]);
  useEffect(() => {
    if (!branchesLoading && !branchesError && branch && !branches.includes(branch)) setBranch("");
  }, [branch, branches, branchesLoading, branchesError]);
  const scoped = leads.filter((lead) => !branch || lead.branch === branch);
  const moduleRows = (key: Module) => key === 'leads'
    ? recordsFor(scoped, 'leads', employees)
    : (moduleRecords[key] ?? []).filter(row => !branch || row.branch === branch);
  const rows = module
    ? mode === 'create' ? recordsFor(scoped, 'leads', employees) : moduleRows(module)
    : [];
  const leadsList = module === "leads" && mode === "list";
  const pipelineList = module === "deals" && mode === "list";
  const desktopRows =
    desktop && mode === "list" && (module === "leads" || module === "deals");
  const visible = rows.filter(
    (row) =>
      `${row.title} ${row.contact} ${row.email} ${row.branch} ${row.status} ${row.owner} ${row.source}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (!(leadsList || pipelineList) ||
        stageFilter === "All" ||
        (stageFilter === "Closed"
          ? ["Active", "Inactive", "Won", "Lost", "Closed"].includes(row.status)
          : row.status === stageFilter)),
  );
  const record = rows.find((row) => row.id === params.id);
  const config = module ? modules[module] : null;
  const cardWidth = desktopRows
    ? contentWidth
    : Math.max(
        0,
        (contentWidth - (recordGrid.columns - 1) * 16) / recordGrid.columns,
      );
  const hubCardWidth = desktop
    ? Math.floor(
        adminGrid(hubGridWidth || contentWidth, fontScale, "workspace", 12, desktop ? 'desktop' : tablet ? 'tablet' : mobile ? 'mobile' : 'mobile')
          .cardWidth,
      )
    : workspaceGrid.cardWidth;
  const openDeals = moduleRows('deals').filter(deal => !['Won', 'Lost'].includes(deal.status));
  const pipelineTotal = openDeals.reduce(
    (sum, deal) => sum + (deal.value ?? 0),
    0,
  );
  const pipelineStages = [
    ...new Set([
      "New",
      "Qualified",
      "Proposal",
      "Negotiation",
      ...openDeals.map((deal) => deal.status),
    ]),
  ].map((stage, index) => {
    const deals = openDeals.filter(
      (deal) => deal.status === stage,
    );
    return {
      stage,
      count: deals.length,
      value: deals.reduce(
        (sum, deal) => sum + (deal.value ?? 0),
        0,
      ),
      color: ["#345cf2", "#138f80", "#7853c8", "#e2a348"][index % 4],
    };
  });
  const heading =
    mode === "hub"
      ? "CRM"
      : !config
        ? "CRM module unavailable"
        : mode === "detail"
          ? config.singular[0].toUpperCase() +
            config.singular.slice(1) +
            " details"
          : mode === "create"
            ? `Choose a lead for this ${config.singular}`
            : config.title;
  const back = () =>
    router.push(
      mode === "detail" && module
        ? { pathname: "/admin/crm/[module]", params: { module } }
        : "/admin/crm",
    );
  const openLead = (id: string) =>
    router.push({ pathname: "/admin/crm/lead/[id]", params: { id } });
  const openRecord = (row: RecordCard) =>
    router.push({
      pathname: "/admin/crm/[module]/[id]",
      params: { module: module!, id: row.id, ...(branch ? { branch } : {}) },
    });

  const updateActivity = async (id: string, action: 'complete' | 'cancel') => {
    if (savingActivity) return;
    setSavingActivity(true);
    try { await activitiesApi[action](id); setAttempt(value => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update activity.'); }
    finally { setSavingActivity(false); }
  };

  if (module === 'support') return <AdminUnavailablePage title="CRM support" message="Support tickets are not available yet. Use lead notes and activities to record customer conversations." />;

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={[styles.page, desktop && baseStyles.webPage]}>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            desktop && { paddingHorizontal: webPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <AdminPageHeading title={heading} style={{ marginBottom: 16 }}>{(mode === "hub" ||
                (mode === "list" && config)) && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    pipelineList
                      ? "New opportunity"
                      : leadsList
                        ? "New lead"
                        : undefined
                  }
                  onPress={() =>
                    mode === "hub" || module === "leads" || pipelineList
                      ? router.push({ pathname: '/admin/crm/lead-form', params: branch ? { branch } : {} })
                      : router.push({
                          pathname: "/admin/crm/[module]/create",
                          params: { module: module!, ...(branch ? { branch } : {}) },
                        })
                  }
                  style={[
                    styles.primary,
                    (leadsList || pipelineList) && styles.newLeadButton,
                  ]}
                >
                  <Text style={styles.primaryText}>
                    {leadsList || pipelineList
                      ? "+ New"
                      : mode === "hub" || module === "leads"
                        ? "Add lead"
                        : `Add ${config?.singular}`}
                  </Text>
                </Pressable>
              )}</AdminPageHeading>
          {mode !== "detail" && <BranchOptionsStatus loading={branchesLoading} error={branchesError} empty={!branches.length} onRetry={refreshBranches} />}
          {mode === "hub" && (
            <View style={styles.branchCard}>
              <View style={styles.branchDot} />
              <View style={styles.flex}>
                <Text style={styles.branchTitle}>
                  {branch || "All branches"}
                </Text><Text style={styles.branchCaption}>One branch, every module</Text>
                
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change CRM branch"
                onPress={() => setBranchPicker(true)}
                style={styles.changeBranch}
              >
                <Text style={styles.link}>Change</Text>
              </Pressable>
            </View>
          )}
          {mode !== "detail" && mode !== "hub" && (
            <View style={styles.toolbar}>
              {pipelineList ? (
                <>
                  <SearchField
                      accessibilityLabel="Search opportunities or owners"
                      value={query}
                      onChangeText={setQuery}
                    />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.pipelineFilters}
                  >
                    {[
                      "All",
                      "New",
                      "Qualified",
                      "Proposal",
                      "Negotiation",
                      "Won",
                      "Lost",
                    ].map((value) => (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityLabel={`Filter ${value} opportunities`}
                        accessibilityState={{ selected: stageFilter === value }}
                        onPress={() => setStageFilter(value)}
                        style={[
                          styles.stageFilter,
                          stageFilter === value && styles.stageFilterSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stageFilterText,
                            stageFilter === value && styles.link,
                          ]}
                        >
                          {value}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <>
                  {leadsList ? (
                    <SearchField
                        accessibilityLabel="Search leads"
                        value={query}
                        onChangeText={setQuery}
                      />
                  ) : (
                    <SearchField
                      accessibilityLabel="Search CRM records"
                      value={query}
                      onChangeText={setQuery}
                    />
                  )}
                  {leadsList ? (
                    <View style={styles.stageFilters}>
                      {["All", "New", "Qualified", "Closed"].map((value) => (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityLabel={`Filter ${value} leads`}
                          accessibilityState={{
                            selected: stageFilter === value,
                          }}
                          onPress={() => setStageFilter(value)}
                          style={[
                            styles.stageFilter,
                            stageFilter === value && styles.stageFilterSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stageFilterText,
                              stageFilter === value && styles.link,
                            ]}
                          >
                            {value}
                          </Text>
                        </Pressable>
                      ))}
                      {desktop && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Change leads branch"
                          onPress={() => setBranchPicker(true)}
                          style={styles.stageFilter}
                        >
                          <Text style={styles.stageFilterText}>
                            {branch || "All branches"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.branchFilters}
                    >
                      {["", ...branches].map((value) => (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityLabel={value || "All branches"}
                          accessibilityState={{ selected: branch === value }}
                          onPress={() => { setBranch(value); void selectAdminBranch(availableBranches.find(item => item.name === value)?.id ?? null); }}
                          style={[
                            styles.branchFilter,
                            branch === value && styles.selectedFilter,
                          ]}
                        >
                          <Text style={styles.filterText}>
                            {value || "All branches"}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}
            </View>
          )}
          {loading ? (
            <ActivityIndicator
              accessibilityLabel="Loading CRM records"
              color="#345cf2"
              style={styles.loading}
            />
          ) : error ? (
            <View style={styles.empty}>
              <Text style={styles.error}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAttempt((value) => value + 1)}
                style={styles.secondary}
              >
                <Text style={styles.link}>Retry</Text>
              </Pressable>
            </View>
          ) : mode === "hub" ? (
            <>
              <View
                style={styles.hubGrid}
                onLayout={(event) =>
                  setHubGridWidth(event.nativeEvent.layout.width)
                }
              >
                {(Object.keys(modules) as Module[]).map((key) => {
                  const count = moduleRows(key).length;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${modules[key].title}`}
                      disabled={key === 'support'}
                      accessibilityState={{ disabled: key === 'support' }}
                      onPress={() =>
                        router.push({
                                pathname: "/admin/crm/[module]",
                                params: {
                                  module: key,
                                  ...(branch ? { branch } : {}),
                                },
                              })
                      }
                      style={({ pressed }) => [
                        styles.moduleCard,
                        { width: hubCardWidth },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.moduleBody}>
                        <View style={styles.moduleHeading}>
                          <View
                            style={[
                              styles.moduleIcon,
                              { backgroundColor: modules[key].background },
                            ]}
                          >
                            <CrmIcon name={key} color={modules[key].color} />
                          </View>
                          <View style={styles.countBadge}>
                            <Text style={styles.countLabel}>{key === 'support' ? '—' : count}</Text>
                          </View>
                        </View>
                        <Text style={styles.moduleTitle}>
                          {modules[key].title}
                        </Text><Text style={styles.moduleDescription}>{modules[key].description}</Text>
                        
                      </View>
                      <View style={styles.moduleFooter}>
                        <Text style={styles.footerLink}>{key === 'support' ? 'Not available' : 'Open workspace'}</Text>
                        <AppIcon symbol="›" style={styles.footerChevron} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.pipelineCard}>
                <View style={styles.pipelineHeading}>
                  <Text style={styles.pipelineTitle}>Sales pipeline</Text>
                  <Text style={styles.pipelineTotal}>
                    {shortMoney(pipelineTotal)}
                  </Text>
                </View>
                {pipelineStages.map((stage) => (
                  <View key={stage.stage} style={styles.pipelineStage}>
                    <View style={styles.pipelineHeading}>
                      <Text style={styles.stageLabel}>
                        {stage.stage} {stage.count}{" "}
                        {stage.count === 1 ? "deal" : "deals"}
                      </Text>
                      <Text style={styles.stageValue}>
                        {shortMoney(stage.value)}
                      </Text>
                    </View>
                    <View style={styles.pipelineTrack}>
                      <View
                        style={[
                          styles.pipelineProgress,
                          {
                            backgroundColor: stage.color,
                            width: `${pipelineTotal > 0 ? Math.min(100, (stage.value / pipelineTotal) * 100) : 0}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View pipeline"
                  onPress={() => router.push({ pathname: '/admin/crm/deals-live', params: branch ? { branch } : {} })}
                  style={styles.pipelineLink}
                >
                  <Text style={styles.link}>View pipeline</Text>
                  <AppIcon symbol="›" style={styles.footerChevron} />
                </Pressable>
              </View>
            </>
          ) : !module ? (
            <View style={styles.empty}>
              <Text style={styles.subtitle}>
                This CRM module does not exist.
              </Text>
            </View>
          ) : mode === "detail" ? (
            record ? (
              <View style={[styles.recordCard, styles.detailCard]}>
                <Text style={styles.cardTitle}>{record.title}</Text>
                <Text style={styles.status}>{record.status}</Text>
                <View style={styles.detailGrid}>
                  {[
                    ["Contact", record.contact],
                    ["Branch", record.branch],
                    ["Email", record.email],
                    ["Phone", record.phone],
                    ...(record.value === undefined
                      ? []
                      : [["Estimated value", money(record.value)]]),
                  ].map(([label, value]) => (
                    <View
                      key={label}
                      style={[
                        styles.detail,
                        {
                          width:
                            contentWidth / fontScale >= 600 ? "50%" : "100%",
                        },
                      ]}
                    >
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text selectable style={styles.detailValue}>
                        {value || "—"}
                      </Text>
                    </View>
                  ))}
                </View>
                {record.notes ? (
                  <Text selectable style={styles.subtitle}>
                    {record.notes}
                  </Text>
                ) : null}
                {record.leadId && <Pressable
                  accessibilityRole="button"
                  onPress={() => openLead(record.leadId)}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>Open source lead</Text>
                </Pressable>}
                {module === 'activities' && record.status === 'Pending' && <View style={styles.actions}>
                  <Pressable disabled={savingActivity} onPress={() => void updateActivity(record.id, 'complete')} style={styles.primary}><Text style={styles.primaryText}>Complete activity</Text></Pressable>
                  <Pressable disabled={savingActivity} onPress={() => void updateActivity(record.id, 'cancel')} style={styles.secondary}><Text style={styles.link}>Cancel activity</Text></Pressable>
                </View>}
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.cardTitle}>Record not found</Text>
                <Text style={styles.subtitle}>
                  This record may have been removed.
                </Text>
              </View>
            )
          ) : (
            <>
              <View style={styles.recordHeading}>
                <Text style={styles.resultCount}>
                  {pipelineList
                    ? `${visible.length} ${visible.length === 1 ? "opportunity" : "opportunities"} · ${money(visible.reduce((sum, row) => sum + (row.value || 0), 0))}`
                    : `${visible.length} ${leadsList ? "leads in this scope" : mode === "create" ? "leads" : config?.title.toLowerCase()}`}
                </Text>
                {leadsList && selectedLeads.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear lead selection"
                    onPress={() => setSelectedLeads([])}
                  >
                    <Text style={styles.link}>
                      {selectedLeads.length} selected · Clear
                    </Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.grid}>
                {visible.map((row) =>
                  pipelineList ? (
                    <Pressable
                      key={row.id}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${row.title}`}
                      onPress={() => openRecord(row)}
                      style={({ pressed }) => [
                        styles.dealCard,
                        { width: cardWidth },
                        desktopRows && styles.webDealCard,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.dealIdentity,
                          desktopRows && styles.webDealIdentity,
                        ]}
                      >
                        <View style={styles.flex}>
                          <Text style={styles.dealName}>{row.title}</Text>
                          <Text style={styles.leadCaption}>
                            {row.owner || "Unassigned"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.leadBadge,
                            ["Qualified", "Proposal", "Negotiation"].includes(
                              row.status,
                            ) && styles.qualifiedBadge,
                            row.status === "Won" && styles.activeBadge,
                            row.status === "Lost" && styles.closedBadge,
                          ]}
                        >
                          <Text style={styles.leadBadgeText}>{row.status}</Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.dealFooter,
                          desktopRows && styles.webDealFooter,
                        ]}
                      >
                        <Text style={styles.dealClose}>
                          Close {closeDateLabel(row.closeDate)}
                        </Text>
                        <Text style={styles.dealValue}>
                          {money(row.value || 0)}
                        </Text>
                      </View>
                    </Pressable>
                  ) : leadsList ? (
                    <View
                      key={row.id}
                      style={[
                        styles.leadCard,
                        { width: cardWidth },
                        desktopRows && baseStyles.webLeadRow,
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`View ${row.title}`}
                        onPress={() => openRecord(row)}
                        style={({ pressed }) => [
                          styles.leadCardBody,
                          desktopRows && baseStyles.webLeadBody,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.leadInitial}>
                          <Text style={styles.leadInitialText}>
                            {row.title
                              .trim()
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((word) => word[0])
                              .join("")
                              .toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.flex}>
                          <Text style={styles.leadName}>{row.title}</Text>
                          <Text style={styles.leadCaption}>
                            {[row.contact, row.source]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.leadBadge,
                            row.status === "Qualified"
                              ? styles.qualifiedBadge
                              : ["Active", "Won"].includes(row.status)
                                ? styles.activeBadge
                                : ["Inactive", "Lost", "Closed"].includes(
                                      row.status,
                                    )
                                  ? styles.closedBadge
                                  : null,
                          ]}
                        >
                          <Text style={styles.leadBadgeText}>{row.status}</Text>
                        </View>
                      </Pressable>
                      <View
                        style={[
                          styles.leadCardFooter,
                          desktopRows && baseStyles.webLeadFooter,
                        ]}
                      >
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Select ${row.title}`}
                          accessibilityState={{
                            checked: selectedLeads.includes(row.id),
                          }}
                          onPress={() =>
                            setSelectedLeads((current) =>
                              current.includes(row.id)
                                ? current.filter((id) => id !== row.id)
                                : [...current, row.id],
                            )
                          }
                          style={styles.leadSelectButton}
                        >
                          <View
                            style={[
                              styles.leadCheckbox,
                              selectedLeads.includes(row.id) &&
                                styles.leadCheckboxSelected,
                            ]}
                          >
                            {selectedLeads.includes(row.id) && (
                              <AppIcon symbol="✓" style={styles.leadCheckmark} />
                            )}
                          </View>
                        </Pressable>
                        <View
                          style={styles.leadAssignments}
                          accessibilityLabel={`Assigned to for ${row.title}: ${row.owner}`}
                        >
                          <Text style={styles.assignmentLabel}>
                            Assigned to
                          </Text>
                          <View style={styles.assignmentNames}>
                            {row.assignedNames.length ? (
                              row.assignedNames.map((name, index) => (
                                <View key={index} style={styles.employeeBadge}>
                                  <Text style={styles.employeeName}>
                                    {name}
                                  </Text>
                                </View>
                              ))
                            ) : (
                              <Text style={styles.leadOwner}>Unassigned</Text>
                            )}
                          </View>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${row.title} details`}
                          onPress={() => openRecord(row)}
                          style={styles.leadValueButton}
                        >
                          <Text style={styles.leadValue}>
                            {money(row.value || 0)}
                          </Text>
                          <AppIcon symbol="›" style={styles.footerChevron} />
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      key={row.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${mode === "create" ? "Select" : "View"} ${row.title}`}
                      onPress={() =>
                        mode === "create"
                          ? openLead(row.leadId)
                          : openRecord(row)
                      }
                      style={[
                        styles.recordCard,
                        { width: cardWidth },
                        desktopRows && baseStyles.webRecordRow,
                      ]}
                    >
                      <View
                        style={[
                          styles.recordHeading,
                          desktopRows && baseStyles.webRecordHeading,
                        ]}
                      >
                        <Text style={styles.cardTitle}>{row.title}</Text>
                        <AppIcon symbol="›" style={styles.chevron} />
                      </View>
                      <Text
                        style={[
                          styles.subtitle,
                          desktopRows && baseStyles.webRecordText,
                        ]}
                      >
                        {row.contact}
                      </Text>
                      <Text
                        style={[
                          styles.subtitle,
                          desktopRows && baseStyles.webRecordText,
                        ]}
                      >
                        {row.branch}
                      </Text>
                      <Text
                        style={[
                          styles.status,
                          desktopRows && baseStyles.webRecordStatus,
                        ]}
                      >
                        {row.status}
                      </Text>
                      {row.value !== undefined && (
                        <Text
                          style={[
                            styles.amount,
                            desktopRows && baseStyles.webRecordAmount,
                          ]}
                        >
                          {money(row.value)}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.moduleLink,
                          desktopRows && baseStyles.webRecordLink,
                        ]}
                      >
                        {mode === "create" ? "Open lead" : "View details"}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
              {!visible.length && (
                <View style={styles.empty}>
                  <Text style={styles.cardTitle}>No matching records</Text>
                  <Text style={styles.subtitle}>
                    {rows.length
                      ? "Try another search or branch."
                      : "Saved records will appear here."}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
        {!desktop && <AdminBottomNavigation />}
      </View>
      <Modal
        transparent
        visible={branchPicker}
        animationType="fade"
        onRequestClose={() => setBranchPicker(false)}
      >
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={styles.modal}>
            <View style={styles.pipelineHeading}>
              <Text style={styles.cardTitle}>Choose branch</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close CRM branch picker"
                onPress={() => setBranchPicker(false)}
                style={styles.backButton}
              >
                <AppIcon symbol="×" style={styles.backGlyph} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <BranchOptionsStatus loading={branchesLoading} error={branchesError} empty={!branches.length} onRetry={refreshBranches} />
              {["", ...branches].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${value || "All branches"}`}
                  accessibilityState={{ selected: branch === value }}
                  onPress={() => {
                    setBranch(value);
                    void selectAdminBranch(availableBranches.find(item => item.name === value)?.id ?? null);
                    setBranchPicker(false);
                  }}
                  style={styles.branchOption}
                >
                  <Text style={styles.filterText}>
                    {value || "All branches"}
                  </Text>
                  {branch === value && <AppIcon symbol="✓" style={styles.link} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  pipelineFilters: { flexDirection: "row", gap: 6 },
  dealCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 18,
    backgroundColor: "#fff",
    minWidth: 0,
  },
  dealIdentity: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dealName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#20334f",
  },
  dealFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    marginTop: 16,
    paddingTop: 12,
  },
  dealClose: { fontSize: 10, lineHeight: 17, color: "#71829c", flexShrink: 1 },
  dealValue: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
    color: "#405573",
    flexShrink: 1,
  },
  webDealCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  webDealIdentity: { flex: 1, alignItems: "center" },
  webDealFooter: {
    width: "35%",
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: "#edf1f8",
    marginTop: 0,
    paddingTop: 0,
    paddingLeft: 20,
    minHeight: 44,
  },
  webPage: { maxWidth: "100%", alignSelf: "stretch" },
  webLeadRow: { flexDirection: "row", alignItems: "stretch" },
  webLeadBody: { flex: 1, minWidth: 0, alignItems: "center" },
  webLeadFooter: {
    width: "36%",
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: "#edf1f8",
  },
  webRecordRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  webRecordHeading: { flex: 2, minWidth: 0, alignItems: "center" },
  webRecordText: { flex: 1, minWidth: 0, marginTop: 0 },
  webRecordStatus: { alignSelf: "center", marginTop: 0, maxWidth: "16%" },
  webRecordAmount: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 0,
    flexShrink: 1,
  },
  webRecordLink: { marginTop: 0 },
  newLeadButton: { minHeight: 38, paddingHorizontal: 14, paddingVertical: 10 },
  leadSearch: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  leadSearchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    fontSize: 13,
    color: "#20334f",
    paddingVertical: 10,
  },
  stageFilters: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stageFilter: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  stageFilterSelected: { backgroundColor: "#eaf0ff", borderColor: "#d5dfff" },
  stageFilterText: { fontSize: 11, fontWeight: "600", color: "#405573" },
  leadCard: {
    minWidth: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  leadCardBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 16,
    minHeight: 74,
  },
  leadInitial: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  leadInitialText: { fontSize: 12, fontWeight: "800", color: "#345cf2" },
  leadName: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#20334f",
  },
  leadCaption: { fontSize: 10, lineHeight: 16, color: "#71829c", marginTop: 3 },
  leadBadge: {
    maxWidth: "30%",
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#eaf0ff",
  },
  qualifiedBadge: { backgroundColor: "#eee7ff" },
  activeBadge: { backgroundColor: "#def6ef" },
  closedBadge: { backgroundColor: "#f2edf0" },
  leadBadgeText: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "600",
    color: "#405573",
  },
  leadCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    minHeight: 48,
  },
  leadSelectButton: {
    minHeight: 44,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  leadAssignments: { flex: 1, minWidth: 0, paddingVertical: 10, gap: 5 },
  assignmentLabel: { fontSize: 10, color: "#71829c" },
  assignmentNames: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  employeeBadge: {
    maxWidth: "100%",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#eaf0ff",
  },
  employeeName: {
    fontSize: 11,
    lineHeight: 17,
    color: "#405573",
    flexShrink: 1,
  },
  leadCheckbox: {
    width: 17,
    height: 17,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: "#8e97a8",
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  leadCheckboxSelected: { backgroundColor: "#345cf2", borderColor: "#345cf2" },
  leadCheckmark: { fontSize: 12, color: "#fff" },
  leadOwner: { flexShrink: 1, fontSize: 10, lineHeight: 16, color: "#71829c" },
  leadValueButton: {
    maxWidth: "55%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  leadValue: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
    color: "#345cf2",
  },
  safe: { flex: 1, backgroundColor: "#f6f8fd" },
  page: { flex: 1, width: "100%", maxWidth: 1280, alignSelf: "center" },
  flex: { flex: 1, minWidth: 0 },
  scroll: { flex: 1, minHeight: 0 },
  content: { padding: 16, paddingTop: 22, paddingBottom: 32, gap: 14 },
  heading: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 10,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: "#71829c",
  },
  title: { minWidth: 0, flexShrink: 1, fontSize: 20, lineHeight: 26, fontWeight: "700", color: "#20334f", marginTop: 0 },
  subtitle: { fontSize: 11, lineHeight: 16, color: "#71829c", marginTop: 3 },
  hubSubtitle: { fontSize: 11, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primary: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#345cf2",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  secondary: {
    minHeight: 44,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dce5f3",
    alignItems: "center",
    justifyContent: "center",
  },
  link: { fontSize: 13, color: "#345cf2", fontWeight: "600" },
  toolbar: { gap: 12 },
  searchInput: {
    width: "100%",
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#dce5f3",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    color: "#20334f",
    fontSize: 14,
  },
  branchFilters: { gap: 8 },
  branchFilter: {
    minHeight: 44,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dce5f3",
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  selectedFilter: { backgroundColor: "#eaf0ff" },
  filterText: { fontSize: 12, color: "#405573" },
  grid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 16 },
  hubGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  moduleCard: {
    borderRadius: 18,
    minHeight: 158,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  moduleBody: { flex: 1, padding: 14, minHeight: 122 },
  moduleHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  moduleIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: "#f3f6fd",
    alignItems: "center",
  },
  countLabel: { fontSize: 10, fontWeight: "700", color: "#607591" },
  moduleTitle: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#20334f",
    marginTop: 14,
  },
  moduleDescription: {
    fontSize: 10,
    lineHeight: 17,
    color: "#71829c",
    marginTop: 5,
  },
  moduleFooter: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    backgroundColor: "#fcfdff",
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
  },
  footerLink: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "600",
    color: "#345cf2",
  },
  footerChevron: { fontSize: 20, color: "#345cf2" },
  pressed: { opacity: 0.75 },
  cardTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    color: "#20334f",
    flexShrink: 1,
  },
  count: { fontSize: 32, fontWeight: "800", color: "#20334f", marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#20334f" },
  recordCard: {
    minWidth: 0,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
  },
  recordHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  chevron: { fontSize: 22, color: "#71829c" },
  status: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#eaf0ff",
    fontSize: 12,
    color: "#405573",
    marginTop: 12,
  },
  amount: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    color: "#20334f",
    marginTop: 12,
  },
  moduleLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#345cf2",
    marginTop: 18,
  },
  resultCount: { fontSize: 12, color: "#71829c" },
  loading: { padding: 32 },
  empty: {
    padding: 24,
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4eaf5",
  },
  error: { color: "#b94d61", fontSize: 13, lineHeight: 20 },
  detailCard: { width: "100%", gap: 18 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap" },
  detail: { paddingRight: 16, marginBottom: 20, minWidth: 0 },
  detailLabel: { fontSize: 12, color: "#71829c", marginBottom: 6 },
  detailValue: { fontSize: 14, lineHeight: 22, color: "#20334f" },
  header: {
    padding: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4eaf5",
  },
  mobileHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  companyName: { fontSize: 13, fontWeight: "800", color: "#20334f" },
  headerCaption: { fontSize: 9, lineHeight: 14, color: "#8192ad" },
  headerSearch: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#f5f7fc",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 12, fontWeight: "700", color: "#345cf2" },
  headerFilters: { flexDirection: "row", gap: 8, marginTop: 14 },
  headerFilter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#e4eaf7",
    backgroundColor: "#f7f9ff",
  },
  headerBranch: { flex: 1, minWidth: 0, fontSize: 10, color: "#405573" },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backGlyph: { fontSize: 16, color: "#000" },
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    borderRadius: 17,
  },
  branchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#39b8a7",
  },
  branchTitle: { fontSize: 12, fontWeight: "700", color: "#20334f" },
  branchCaption: {
    fontSize: 9,
    lineHeight: 15,
    color: "#71829c",
    marginTop: 3,
  },
  changeBranch: {
    minHeight: 44,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  pipelineCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
  },
  pipelineHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pipelineTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#20334f",
  },
  pipelineTotal: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#20334f",
  },
  pipelineStage: { marginTop: 16 },
  stageLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 17,
    color: "#405573",
  },
  stageValue: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#20334f",
  },
  pipelineTrack: {
    height: 6,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#e9eef8",
    marginTop: 7,
  },
  pipelineProgress: { height: "100%", borderRadius: 4 },
  pipelineLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    marginTop: 14,
  },
  overlay: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "rgba(21,43,60,0.25)",
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    alignSelf: "center",
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  branchOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 48,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1f8",
  },
  navigation: {
    flexDirection: "row",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e4eaf5",
    backgroundColor: "#fff",
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navIcon: {
    width: 44,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  navSelected: { backgroundColor: "#edf1ff" },
  navLabel: { fontSize: 9, color: "#71829c" },
  navSelectedText: { color: "#345cf2", fontWeight: "700" },
  peopleIcon: { width: 18, height: 18 },
  personHead: {
    position: "absolute",
    left: 3,
    top: 1,
    width: 6,
    height: 6,
    borderWidth: 1,
    borderRadius: 3,
  },
  personBody: {
    position: "absolute",
    left: 0,
    top: 9,
    width: 12,
    height: 7,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  secondHead: {
    position: "absolute",
    right: 1,
    top: 1,
    width: 5,
    height: 6,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  secondBody: {
    position: "absolute",
    right: 0,
    top: 9,
    width: 4,
    height: 7,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderTopRightRadius: 4,
  },
  documentIcon: {
    width: 14,
    height: 18,
    borderWidth: 1,
    borderRadius: 2,
    paddingTop: 4,
    alignItems: "center",
    gap: 3,
  },
  documentLine: { width: 8, height: 1, borderRadius: 1 },
  listIcon: { gap: 4 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  listCheck: {
    width: 4,
    height: 3,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: "-45deg" }],
  },
  headphoneIcon: {
    width: 16,
    height: 14,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  headphoneLeft: {
    position: "absolute",
    left: -1,
    top: 7,
    width: 4,
    height: 7,
    borderWidth: 1,
    borderRadius: 1,
  },
  headphoneRight: {
    position: "absolute",
    right: -1,
    top: 7,
    width: 4,
    height: 7,
    borderWidth: 1,
    borderRadius: 1,
  },
  nativeIcon: { fontSize: 21, lineHeight: 25 },
});

export default function Page() {
  return <CrmWorkspace />;
}
