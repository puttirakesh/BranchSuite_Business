import { useLocalSearchParams } from "expo-router";
import { entityKinds, type EntityKind } from "../types";
import { StateView } from "../components/ui";
import CrmScreen from "./CrmScreen";
import RecordScreen from "./RecordScreen";

export default function CrmRoute({
  mode,
}: {
  mode: "list" | "new" | "detail" | "edit";
}) {
  const { kind, id } = useLocalSearchParams<{ kind: string; id?: string }>();
  if (
    !(entityKinds as readonly string[]).includes(kind) ||
    ((mode === "detail" || mode === "edit") && !id)
  )
    return <StateView title="Page not found" />;
  const entity = kind as EntityKind;
  return mode === "list" ? (
    <CrmScreen key={kind} kind={entity} />
  ) : (
    <RecordScreen
      key={`${kind}:${id}:${mode}`}
      kind={entity}
      id={mode === "new" ? undefined : id}
      edit={mode === "edit"}
    />
  );
}
