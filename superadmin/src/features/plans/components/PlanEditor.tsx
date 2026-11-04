import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormCheckbox, FormError, FormText, Grid, Note, Sheet, useToast } from '../../../shared/components';
import { useFormError } from '../../../shared/hooks/useMutationForm';
import { useSavePlan } from '../../../shared/hooks/queries';
import { savedMessage } from '../../../core/data/source';
import { planSchema, type PlanForm, type PlanValues } from '../schemas/plan.schema';
import { featureLabel, PLAN_FEATURES, type Plan } from '../types';

const blank: PlanForm = {
  name: '', monthly: 0, annual: 0, employees: 1, branches: 1, companies: 1, users: 1, trialDays: 14, description: '',
  crm: true, people: true, payroll: true, reports: true, enabled: true,
};

const fromPlan = (p: Plan): PlanForm => ({
  name: p.name, monthly: p.monthly, annual: p.annual, ...p.limits, trialDays: p.trialDays, description: p.description, ...p.features, enabled: p.enabled,
});

/** APK "Edit <plan>" sheet (saas-ui.js `planEditor`), also used for the inferred "New plan" flow. */
export function PlanEditor({ plan, visible, onClose }: { plan: Plan | null; visible: boolean; onClose: () => void }) {
  const save = useSavePlan();
  const toast = useToast();
  const formError = useFormError();
  const form = useForm<PlanForm, unknown, PlanValues>({ resolver: zodResolver(planSchema), defaultValues: plan ? fromPlan(plan) : blank });

  useEffect(() => {
    if (visible) {
      form.reset(plan ? fromPlan(plan) : blank);
      formError.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, plan?.id]);

  const submit = form.handleSubmit(async (values) => {
    formError.clear();
    try {
      await save.mutateAsync({ id: plan?.id ?? null, values });
      onClose();
      toast(savedMessage(plan ? 'Plan saved' : 'Plan created'));
    } catch (error) {
      formError.set(error);
    }
  });

  const c = form.control;
  return (
    <Sheet visible={visible} title={plan ? 'Edit ' + plan.name : 'New plan'} onClose={onClose}>
      <FormText control={c} name="name" label="Plan name" required />
      <Grid columns={{ base: 1, medium: 2 }} gap={12}>
        <FormText control={c} name="monthly" label="Monthly price (INR)" required keyboardType="number-pad" />
        <FormText control={c} name="annual" label="Annual price (INR)" required keyboardType="number-pad" />
        <FormText control={c} name="employees" label="Employee limit" required keyboardType="number-pad" />
        <FormText control={c} name="branches" label="Branch limit" required keyboardType="number-pad" />
        <FormText control={c} name="companies" label="Company limit" required keyboardType="number-pad" />
        <FormText control={c} name="users" label="Staff-user limit" required keyboardType="number-pad" />
        <FormText control={c} name="trialDays" label="Trial days" required keyboardType="number-pad" />
      </Grid>
      <FormText control={c} name="description" label="Short description" multiline />
      <View style={{ marginBottom: 8 }}>
        {PLAN_FEATURES.map((f) => <FormCheckbox key={f} control={c} name={f} label={featureLabel[f]} />)}
        <FormCheckbox control={c} name="enabled" label="Available for new subscriptions" />
      </View>
      <Note>Changes apply to subscribers on this plan. Limits below current usage cannot be saved.</Note>
      <FormError message={formError.message} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button label={plan ? 'Save plan' : 'Create plan'} onPress={submit} loading={save.isPending} style={{ flex: 2 }} />
      </View>
    </Sheet>
  );
}
