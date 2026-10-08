import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSession } from "../store/session";
import { saveRecord } from "../services/business";
import { errorMessage } from "../services/api";
import type { CrmRecord, EntityKind, RecordInput } from "../types";
import {
  crmConfig,
  initialDraft,
  quoteTotals,
  validateDraft,
  type ItemDraft,
} from "../utils/crm";
import {
  Badge,
  Button,
  Card,
  ErrorNotice,
  Field,
  humanize,
  money,
  styles,
} from "./ui";
import { RecordPicker } from "./RecordPicker";
import { inputLimits } from "../utils/validation";

export function RecordForm({
  kind,
  record,
}: {
  kind: EntityKind;
  record?: CrmRecord;
}) {
  const { scope, can } = useSession();
  const client = useQueryClient();
  const [draft, setDraft] = useState(() => initialDraft(kind, record));
  const [items, setItems] = useState<ItemDraft[]>(
    () =>
      record?.items?.map((item) => ({
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })) ?? [{ description: "", quantity: "1", unitPrice: "" }],
  );
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const validation = validateDraft(kind, draft, items);
  const errors = Object.fromEntries(
    Object.entries(validation.errors).filter(
      ([key]) => submitted || touched[key],
    ),
  );
  const mutation = useMutation({
    mutationFn: (input: RecordInput) =>
      saveRecord(scope!, kind, input, record?.id),
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: ["crm", scope] });
      void client.invalidateQueries({ queryKey: ["dashboard", scope] });
      router.replace(`/crm/${kind}/${encodeURIComponent(saved.id)}`);
    },
  });
  const allowed = !!scope && can(`${kind}:${record ? "update" : "create"}`);
  const busy = mutation.isPending;
  const totals =
    kind === "quotes" &&
    !Object.keys(validation.errors).some(
      (key) =>
        key === "currency" || key === "taxRate" || key.startsWith("items"),
    )
      ? quoteTotals(
          items.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
          Number(draft.taxRate),
        )
      : null;
  function touch(key: string) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }
  function update(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    mutation.reset();
  }
  function submit() {
    if (!allowed || busy) return;
    setSubmitted(true);
    if (validation.input) mutation.mutate(validation.input);
  }
  const lengths: Record<string, number> = {
    name: inputLimits.name,
    email: inputLimits.email,
    phone: inputLimits.phone,
    organization: inputLimits.organization,
    source: inputLimits.source,
    notes: inputLimits.notes,
    currency: 3,
    amount: 32,
    taxRate: 32,
    expectedCloseDate: 10,
    validUntil: 10,
  };
  const field = (
    key: string,
    label: string,
    extra: Parameters<typeof Field>[0] = { label },
  ) => (
    <Field
      key={key}
      maxLength={lengths[key]}
      {...extra}
      label={label}
      value={draft[key]}
      onChangeText={(value) =>
        update(key, key === "currency" ? value.toUpperCase() : value)
      }
      onBlur={() => touch(key)}
      error={errors[key]}
      editable={!busy}
    />
  );
  return (
    <View style={{ gap: 20 }}>
      {mutation.isError && (
        <ErrorNotice message={errorMessage(mutation.error)} />
      )}
      {submitted && !validation.input && (
        <ErrorNotice message="Please correct the highlighted fields before saving." />
      )}
      <Card>
        <Text style={styles.heading}>Basic details</Text>
        {field("name", kind === "quotes" ? "Quote title *" : "Name *")}
        {["leads", "contacts", "customers"].includes(kind) && (
          <>
            {field("organization", "Organization")}
            {field("email", "Email address", {
              label: "",
              keyboardType: "email-address",
              autoCapitalize: "none",
            })}
            {field("phone", "Phone number", {
              label: "",
              keyboardType: "phone-pad",
            })}
          </>
        )}
        {kind === "leads" &&
          field("source", "Lead source", {
            label: "",
            placeholder: "Website, referral, event…",
          })}
        {kind === "customers" && (
          <RecordPicker
            kind="contacts"
            value={draft.contactId}
            onChange={(id) => {
              update("contactId", id);
              touch("contactId");
            }}
            disabled={busy}
            error={errors.contactId}
          />
        )}
        {(kind === "deals" || kind === "quotes") && (
          <>
            <RecordPicker
              kind="customers"
              value={draft.customerId}
              onChange={(id) => update("customerId", id)}
              disabled={busy}
              error={errors.customerId}
            />
            {field("currency", "Currency *", {
              label: "",
              autoCapitalize: "characters",
              maxLength: 3,
            })}
            {kind === "deals" ? (
              <>
                {field("amount", "Deal value *", {
                  label: "",
                  keyboardType: "decimal-pad",
                })}
                {field("expectedCloseDate", "Expected close date", {
                  label: "",
                  placeholder: "YYYY-MM-DD",
                })}
              </>
            ) : (
              field("validUntil", "Valid until", {
                label: "",
                placeholder: "YYYY-MM-DD",
              })
            )}
          </>
        )}
      </Card>
      {kind === "quotes" && (
        <Card>
          <Text style={styles.heading}>Line items</Text>
          {errors.items && <ErrorNotice message={errors.items} />}
          {items.map((item, index) => (
            <View
              key={index}
              style={{
                gap: 10,
                borderBottomWidth: 1,
                borderBottomColor: "#DCE4EF",
                paddingBottom: 16,
              }}
            >
              <Text style={styles.label}>Item {index + 1}</Text>
              {(["description", "quantity", "unitPrice"] as const).map(
                (key) => (
                  <Field
                    key={key}
                    label={
                      key === "unitPrice"
                        ? "Unit price *"
                        : `${humanize(key)} *`
                    }
                    value={item[key]}
                    keyboardType={
                      key === "description" ? "default" : "decimal-pad"
                    }
                    editable={!busy}
                    maxLength={
                      key === "description" ? inputLimits.description : 32
                    }
                    error={errors[`items.${index}.${key}`]}
                    onBlur={() => touch(`items.${index}.${key}`)}
                    onChangeText={(value) => {
                      setItems((prev) =>
                        prev.map((line, i) =>
                          i === index ? { ...line, [key]: value } : line,
                        ),
                      );
                      mutation.reset();
                    }}
                  />
                ),
              )}
              <Button
                title="Remove item"
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  setItems((prev) => prev.filter((_, i) => i !== index));
                  setTouched((prev) =>
                    Object.fromEntries(
                      Object.entries(prev).filter(
                        ([key]) => !key.startsWith("items."),
                      ),
                    ),
                  );
                  mutation.reset();
                }}
              />
            </View>
          ))}
          <Button
            title="+ Add line item"
            variant="secondary"
            disabled={busy || items.length >= inputLimits.items}
            onPress={() => {
              setItems((prev) => [
                ...prev,
                { description: "", quantity: "1", unitPrice: "" },
              ]);
              mutation.reset();
            }}
          />
          {field("taxRate", "Tax (%)", {
            label: "",
            keyboardType: "decimal-pad",
          })}
          {totals ? (
            <>
              <Text style={styles.muted}>
                Subtotal: {money(totals.subtotal, draft.currency)}
              </Text>
              <Text style={styles.muted}>
                Tax: {money(totals.tax, draft.currency)}
              </Text>
              <Text style={styles.heading}>
                Estimated total: {money(totals.total, draft.currency)}
              </Text>
            </>
          ) : (
            <Text style={styles.muted}>
              Enter valid line items and tax to see the estimate.
            </Text>
          )}
          <Text style={styles.muted}>
            The server calculates and confirms the final quote total.
          </Text>
        </Card>
      )}
      <Card>
        <Text style={styles.heading}>Status</Text>
        <Badge value={draft.status} />
        <View style={styles.wrap}>
          {crmConfig[kind].statuses.map((status) => (
            <Button
              key={status}
              title={`${humanize(status)}${draft.status === status ? " ✓" : ""}`}
              variant="secondary"
              disabled={busy}
              onPress={() => update("status", status)}
            />
          ))}
        </View>
        {errors.status && <Text style={styles.error}>{errors.status}</Text>}
        {field("notes", "Notes", {
          label: "",
          multiline: true,
          maxLength: 4000,
        })}
      </Card>
      <Button
        title={record ? "Save changes" : `Create ${crmConfig[kind].singular}`}
        busy={busy}
        disabled={!allowed}
        onPressIn={() => {
          if (!validation.input) setSubmitted(true);
        }}
        onPress={submit}
      />
      <Button
        title="Cancel"
        variant="secondary"
        disabled={busy}
        onPress={() =>
          record
            ? router.replace(`/crm/${kind}/${encodeURIComponent(record.id)}`)
            : router.replace(`/crm/${kind}`)
        }
      />
    </View>
  );
}
