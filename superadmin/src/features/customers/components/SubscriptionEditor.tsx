import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormDate, FormError, FormSelect, Note, Sheet, useToast } from '../../../shared/components';
import { useFormError } from '../../../shared/hooks/useMutationForm';
import { usePlans, useUpdateSubscription } from '../../../shared/hooks/queries';
import { savedMessage } from '../../../core/data/source';
import { BILLING_CYCLES, SUBSCRIPTION_STATES, type SubscriptionState } from '../../../core/domain/subscription';
import { subscriptionSchema, type SubscriptionForm } from '../schemas/subscription.schema';
import type { Customer } from '../types';

/** APK "Manage <customer>" sheet (saas-ui.js `subscriptionEditor`). */
export function SubscriptionEditor({ customer, visible, onClose }: { customer: Customer; visible: boolean; onClose: () => void }) {
  const plans = usePlans();
  const save = useUpdateSubscription(customer.id);
  const toast = useToast();
  const formError = useFormError();
  const s = customer.subscription;
  const defaults: SubscriptionForm = {
    planId: s?.planId ?? '',
    cycle: s?.cycle ?? 'Monthly',
    status: (SUBSCRIPTION_STATES as readonly string[]).includes(s?.status ?? '') ? (s!.status as SubscriptionState) : 'Active',
    renewOn: s?.renewOn ?? '',
    trialEndsOn: s?.trialEndsOn ?? '',
  };
  const form = useForm<SubscriptionForm>({ resolver: zodResolver(subscriptionSchema), defaultValues: defaults });

  const renewal = useWatch({ control: form.control, name: 'renewOn' });
  const trialEnd = useWatch({ control: form.control, name: 'trialEndsOn' });

  // Cancel discards edits: reset whenever the sheet opens.
  useEffect(() => {
    if (visible) {
      form.reset(defaults);
      formError.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = form.handleSubmit(async (values) => {
    formError.clear();
    try {
      await save.mutateAsync(values);
      onClose();
      toast(savedMessage('Subscription saved'));
    } catch (error) {
      formError.set(error);
    }
  });

  const planOptions = plans.data?.map((p) => ({ value: p.id, label: p.name })) ?? (s?.planId ? [{ value: s.planId, label: s.planId }] : []);
  return (
    <Sheet visible={visible} title={'Manage ' + customer.name} onClose={onClose}>
      <FormSelect control={form.control} name="planId" label="Plan" required options={planOptions} />
      <FormSelect control={form.control} name="cycle" label="Billing cycle" options={BILLING_CYCLES} />
      <FormSelect control={form.control} name="status" label="Subscription status" options={SUBSCRIPTION_STATES} />
      <FormDate control={form.control} name="renewOn" label="Renewal / due date" minDate={trialEnd || undefined} required />
      <FormDate control={form.control} name="trialEndsOn" label="Trial ends" maxDate={renewal || undefined} required />
      <Note>Expired, suspended and cancelled states block editing while keeping existing records readable. The grace period ends 7 days after the renewal date.</Note>
      <FormError message={formError.message} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button label="Save subscription" onPress={submit} loading={save.isPending} style={{ flex: 2 }} />
      </View>
    </Sheet>
  );
}
