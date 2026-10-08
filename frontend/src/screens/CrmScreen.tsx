import { useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSession } from "../store/session";
import { getRecords } from "../services/business";
import { errorMessage } from "../services/api";
import { crmConfig } from "../utils/crm";
import type { EntityKind } from "../types";
import {
  Badge,
  Button,
  Card,
  ErrorNotice,
  Field,
  StateView,
  humanize,
  money,
  styles,
} from "../components/ui";
import { inputLimits, validateSearch } from "../utils/validation";

export default function CrmScreen({ kind }: { kind: EntityKind }) {
  const { scope, can } = useSession();
  const config = crmConfig[kind];
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const searchValidation = validateSearch(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useInfiniteQuery({
    queryKey: ["crm", scope, kind, "list", debounced, status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getRecords(scope!, kind, debounced, status, pageParam, signal),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!scope && can(`${kind}:read`) && !searchValidation.error,
  });
  if (!scope)
    return (
      <StateView
        title="Choose a branch"
        message="A branch assignment is required to access CRM."
      />
    );
  if (!can(`${kind}:read`))
    return (
      <StateView
        title="Access unavailable"
        message={`Your membership does not include access to ${kind}.`}
      />
    );
  const records = query.data?.pages.flatMap((page) => page.items) ?? [];
  const unique = [
    ...new Map(records.map((record) => [record.id, record])).values(),
  ];
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
      contentContainerStyle={styles.content}
    >
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.muted}>{config.description}</Text>
        </View>
        {can(`${kind}:create`) && (
          <Button
            title={`+ New ${config.singular}`}
            onPress={() => router.push(`/crm/${kind}/new`)}
          />
        )}
      </View>
      <Field
        label={`Search ${kind}`}
        placeholder="Search by name…"
        value={search}
        onChangeText={setSearch}
        maxLength={inputLimits.search}
        error={searchValidation.error}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        <Button
          title={`All${!status ? " ✓" : ""}`}
          variant="secondary"
          onPress={() => setStatus("")}
        />
        {config.statuses.map((value) => (
          <Button
            key={value}
            title={`${humanize(value)}${status === value ? " ✓" : ""}`}
            variant="secondary"
            onPress={() => setStatus(value)}
          />
        ))}
      </ScrollView>
      {searchValidation.error ? (
        <StateView title="Check your search" message={searchValidation.error} />
      ) : query.isPending ? (
        <StateView loading title={`Loading ${kind}…`} />
      ) : query.isError && !query.data ? (
        <StateView
          title={`Unable to load ${kind}`}
          message={errorMessage(query.error)}
          action="Try again"
          onAction={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          {query.isError && <ErrorNotice message={errorMessage(query.error)} />}
          {!unique.length && (
            <StateView
              title={
                search || status ? "No matching records" : `No ${kind} yet`
              }
              message={
                search || status
                  ? "Try another search or status filter."
                  : `Create your first ${config.singular} to get started.`
              }
              action={search || status ? "Clear filters" : undefined}
              onAction={() => {
                setSearch("");
                setStatus("");
              }}
            />
          )}
          <View style={styles.wrap}>
            {unique.map((record) => (
              <Pressable
                key={record.id}
                accessibilityRole="link"
                accessibilityLabel={`Open ${record.name}`}
                onPress={() =>
                  router.push(`/crm/${kind}/${encodeURIComponent(record.id)}`)
                }
                style={{ flexGrow: 1, flexBasis: 300 }}
              >
                <Card>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heading}>{record.name}</Text>
                      {record.organization && (
                        <Text style={styles.muted}>{record.organization}</Text>
                      )}
                    </View>
                    <Badge value={record.status} />
                  </View>
                  {kind === "deals" || kind === "quotes" ? (
                    <Text style={styles.title}>
                      {money(
                        kind === "quotes"
                          ? (record.total ?? 0)
                          : (record.amount ?? 0),
                        record.currency,
                      )}
                    </Text>
                  ) : (
                    <Text style={styles.muted}>
                      {record.email ||
                        record.phone ||
                        "No contact details added"}
                    </Text>
                  )}
                  <Text style={styles.muted}>
                    {kind === "deals" && record.expectedCloseDate
                      ? `Expected close · ${record.expectedCloseDate.slice(0, 10)}`
                      : kind === "quotes" && record.validUntil
                        ? `Valid until · ${record.validUntil.slice(0, 10)}`
                        : `Added ${new Date(record.createdAt).toLocaleDateString()}`}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
          {query.hasNextPage && (
            <Button
              title="Load more"
              variant="secondary"
              busy={query.isFetchingNextPage}
              onPress={() => {
                void query.fetchNextPage();
              }}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}
