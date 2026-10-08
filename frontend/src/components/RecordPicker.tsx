import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useSession } from "../store/session";
import { getRecord, getRecords } from "../services/business";
import { errorMessage } from "../services/api";
import { Button, Field, Sheet, StateView, styles } from "./ui";
import { inputLimits, validateSearch } from "../utils/validation";

export function RecordPicker({
  kind,
  value,
  onChange,
  disabled,
  error,
}: {
  kind: "contacts" | "customers";
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const { scope, can } = useSession();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const searchValidation = validateSearch(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const selected = useQuery({
    queryKey: ["crm", scope, kind, "record", value],
    queryFn: ({ signal }) => getRecord(scope!, kind, value, signal),
    enabled: !!scope && !!value && can(`${kind}:read`),
  });
  const query = useInfiniteQuery({
    queryKey: ["crm", scope, kind, "picker", debounced],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getRecords(scope!, kind, debounced, "", pageParam, signal),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: open && !!scope && can(`${kind}:read`) && !searchValidation.error,
  });
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>
        {kind === "contacts" ? "Primary contact" : "Customer"}
      </Text>
      <Button
        title={
          value
            ? (selected.data?.name ?? "Linked record")
            : `Choose ${kind === "contacts" ? "contact" : "customer"}`
        }
        variant="secondary"
        disabled={disabled || !can(`${kind}:read`)}
        onPress={() => setOpen(true)}
      />
      {!!value && (
        <Button
          title="Remove link"
          disabled={disabled}
          variant="secondary"
          onPress={() => onChange("")}
        />
      )}
      {!can(`${kind}:read`) && (
        <Text style={styles.muted}>
          Your membership does not allow browsing {kind}.
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Sheet
        visible={open}
        title={`Choose ${kind === "contacts" ? "a contact" : "a customer"}`}
        onClose={() => setOpen(false)}
      >
        <Field
          label="Search"
          value={search}
          onChangeText={setSearch}
          maxLength={inputLimits.search}
          error={searchValidation.error}
        />
        {searchValidation.error ? (
          <StateView
            title="Check your search"
            message={searchValidation.error}
          />
        ) : query.isPending ? (
          <StateView loading title="Loading…" />
        ) : query.isError ? (
          <StateView
            title="Unable to load records"
            message={errorMessage(query.error)}
            action="Retry"
            onAction={() => {
              void query.refetch();
            }}
          />
        ) : (
          query.data?.pages
            .flatMap((page) => page.items)
            .map((record) => (
              <Button
                key={record.id}
                title={record.name}
                variant="secondary"
                onPress={() => {
                  onChange(record.id);
                  setOpen(false);
                }}
              />
            ))
        )}
        {query.data?.pages.every((page) => !page.items.length) && (
          <Text style={styles.muted}>No matching records in this branch.</Text>
        )}
        {query.hasNextPage && (
          <Button
            title="Load more"
            disabled={!!searchValidation.error}
            busy={query.isFetchingNextPage}
            onPress={() => {
              void query.fetchNextPage();
            }}
            variant="secondary"
          />
        )}
      </Sheet>
    </View>
  );
}
