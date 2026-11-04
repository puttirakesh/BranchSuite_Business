import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormDate, FormError, FormSelect, FormText, Note, Sheet, useToast } from '../../../shared/components';
import { useFormError } from '../../../shared/hooks/useMutationForm';
import { useOffers, useSaveCampaign } from '../../../shared/hooks/queries';
import { savedMessage } from '../../../core/data/source';
import { campaignSchema, type CampaignForm } from '../schemas/offer.schema';
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, type Campaign } from '../types';

/** APK "Create campaign" / "Edit campaign" sheet (saas-ui.js `campaignEditor`). */
export function CampaignEditor({ campaign, visible, onClose }: { campaign: Campaign | null; visible: boolean; onClose: () => void }) {
  const offers = useOffers();
  const save = useSaveCampaign();
  const toast = useToast();
  const formError = useFormError();
  const defaults: CampaignForm = campaign
    ? { name: campaign.name, channel: campaign.channel, offerCode: campaign.offerCode, status: campaign.status, notes: campaign.notes, startsOn: campaign.startsOn ?? '', endsOn: campaign.endsOn ?? '' }
    : { name: '', channel: 'Website', offerCode: '', status: 'Draft', notes: '', startsOn: '', endsOn: '' };
  const form = useForm<CampaignForm>({ resolver: zodResolver(campaignSchema), defaultValues: defaults });

  const startsOn = useWatch({ control: form.control, name: 'startsOn' });
  const endsOn = useWatch({ control: form.control, name: 'endsOn' });
  useEffect(() => {
    if (visible) {
      form.reset(defaults);
      formError.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, campaign?.id]);

  const submit = form.handleSubmit(async (values) => {
    formError.clear();
    try {
      await save.mutateAsync({ id: campaign?.id ?? null, values });
      onClose();
      toast(savedMessage('Campaign saved'));
    } catch (error) {
      formError.set(error);
    }
  });

  const codes = [{ value: '', label: 'No offer' }, ...(offers.data ?? []).map((o) => ({ value: o.code, label: o.code }))];
  return (
    <Sheet visible={visible} title={campaign ? 'Edit campaign' : 'Create campaign'} onClose={onClose}>
      <FormText control={form.control} name="name" label="Campaign name" required />
      <FormSelect control={form.control} name="channel" label="Channel" options={CAMPAIGN_CHANNELS} />
      <FormSelect control={form.control} name="offerCode" label="Offer code" options={codes} />
      <FormSelect control={form.control} name="status" label="Status" options={CAMPAIGN_STATUSES} />
      <FormDate control={form.control} name="startsOn" label="Campaign starts" maxDate={endsOn || undefined} />
      <FormDate control={form.control} name="endsOn" label="Campaign ends" minDate={startsOn || undefined} />
      <FormText control={form.control} name="notes" label="Audience / campaign notes" multiline />
      <Note>A campaign record for subscription acquisition. Saving it does not send emails or publish advertisements.</Note>
      <FormError message={formError.message} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button label="Save campaign" onPress={submit} loading={save.isPending} style={{ flex: 2 }} />
      </View>
    </Sheet>
  );
}
