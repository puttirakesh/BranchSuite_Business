import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "react-native";
import { useSession } from "../store/session";
import { getRecord } from "../services/business";
import { Button, Card, styles } from "./ui";

export function RecordLink({
  kind,
  id,
}: {
  kind: "contacts" | "customers";
  id: string;
}) {
  const { scope, can } = useSession();
  const query = useQuery({
    queryKey: ["crm", scope, kind, "record", id],
    queryFn: ({ signal }) => getRecord(scope!, kind, id, signal),
    enabled: !!scope && can(`${kind}:read`),
  });
  return (
    <Card>
      <Text style={styles.label}>
        {kind === "contacts" ? "Primary contact" : "Customer"}
      </Text>
      {!can(`${kind}:read`) ? (
        <Text style={styles.muted}>
          A record is linked. Your membership does not permit viewing it.
        </Text>
      ) : query.isPending ? (
        <Text style={styles.muted}>Loading linked record…</Text>
      ) : query.isError ? (
        <Button
          title="Retry linked record"
          variant="secondary"
          onPress={() => {
            void query.refetch();
          }}
        />
      ) : (
        <Button
          title={query.data.name}
          variant="secondary"
          onPress={() => router.push(`/crm/${kind}/${encodeURIComponent(id)}`)}
        />
      )}
    </Card>
  );
}
