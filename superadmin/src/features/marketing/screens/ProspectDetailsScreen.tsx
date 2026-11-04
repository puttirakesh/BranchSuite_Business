import React, { useEffect } from 'react';
import { Linking, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, DetailList, ErrorState, FormDate, FormError, FormSelect, FormText, Note, PageHeader, Screen, Skeleton, useToast } from '../../../shared/components';
import { useFormError } from '../../../shared/hooks/useMutationForm';
import { useProspect, useUpdateFollowUp } from '../../../shared/hooks/queries';
import { savedMessage } from '../../../core/data/source';
import { followUpSchema, type FollowUpForm } from '../schemas/follow-up.schema';
import { PROSPECT_STAGES, type Prospect } from '../types';

/** APK `platform-lead/<id>`: contact details and follow-up editor. */
export function ProspectDetailsScreen({ id }: { id: string }) {
  const prospect = useProspect(id);
  if (prospect.isPending) return <Screen><Skeleton height={60} style={{ marginBottom: 20 }} /><Skeleton height={160} style={{ marginBottom: 16 }} /><Skeleton height={300} /></Screen>;
  if (prospect.error || !prospect.data)
    return <Screen><PageHeader title="Prospect" back="/marketing" /><ErrorState error={prospect.error} onRetry={() => void prospect.refetch()} /></Screen>;
  return <ProspectBody prospect={prospect.data} />;
}

function ProspectBody({ prospect: l }: { prospect: Prospect }) {
  const save = useUpdateFollowUp(l.id);
  const toast = useToast();
  const formError = useFormError();
  const defaults: FollowUpForm = { status: l.status, followup: l.followup, notes: l.notes };
  const form = useForm<FollowUpForm>({ resolver: zodResolver(followUpSchema), defaultValues: defaults });
  useEffect(() => form.reset(defaults), [l.status, l.followup, l.notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = form.handleSubmit(async (values) => {
    formError.clear();
    try {
      await save.mutateAsync(values);
      toast(savedMessage('Prospect stage and follow-up saved'));
    } catch (error) {
      formError.set(error);
    }
  });

  return (
    <Screen>
      <PageHeader title={l.business} subtitle={l.industry + ' · ' + l.employees + ' employees'} back="/marketing" />
      <Card style={{ marginBottom: 16 }}>
        <DetailList rows={[['Contact', l.contact], ['Email', l.email], ['Phone', l.phone || '—'], ['Source', l.source]]} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Button label="Email" variant="secondary" small icon="mail" style={{ flex: 1 }} onPress={() => void Linking.openURL('mailto:' + l.email)} />
          {l.phone ? <Button label="Call" variant="secondary" small icon="phone" style={{ flex: 1 }} onPress={() => void Linking.openURL('tel:' + l.phone)} /> : null}
        </View>
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <FormSelect control={form.control} name="status" label="Stage" options={PROSPECT_STAGES} />
        <FormDate control={form.control} name="followup" label="Next follow-up" required />
        <FormText control={form.control} name="notes" label="Notes / requirements" multiline />
        <FormError message={formError.message} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Discard changes" variant="secondary" style={{ flex: 1 }} onPress={() => { form.reset(defaults); formError.clear(); }} />
          <Button label="Save follow-up" style={{ flex: 1 }} loading={save.isPending} onPress={submit} />
        </View>
      </Card>
      {l.convertedCustomerName ? <Note tone="success">This enquiry converted to customer {l.convertedCustomerName}.</Note> : null}
    </Screen>
  );
}
