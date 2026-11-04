import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormCheckbox, FormDate, FormError, FormText, Grid, Note, Sheet, useToast } from '../../../shared/components';
import { useFormError } from '../../../shared/hooks/useMutationForm';
import { useSaveOffer } from '../../../shared/hooks/queries';
import { savedMessage } from '../../../core/data/source';
import { env } from '../../../core/config/env';
import { addDays, today } from '../../../core/domain/dates';
import { offerSchema, type OfferForm, type OfferValues } from '../schemas/offer.schema';
import type { Offer } from '../types';

/** APK "New offer" / "Edit offer" sheet (saas-ui.js `offerEditor`). */
export function OfferEditor({ offer, visible, onClose }: { offer: Offer | null; visible: boolean; onClose: () => void }) {
  const save = useSaveOffer();
  const toast = useToast();
  const formError = useFormError();
  const schema = useMemo(() => offerSchema(offer?.used ?? 0), [offer?.used]);
  const defaults: OfferForm = offer
    ? { code: offer.code, percent: offer.discount, maxUses: offer.maxUses ?? 100, expiresOn: offer.expiresOn, enabled: offer.enabled }
    : { code: '', percent: 10, maxUses: 100, expiresOn: addDays(today(), 60), enabled: true };
  const form = useForm<OfferForm, unknown, OfferValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (visible) {
      form.reset(defaults);
      formError.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, offer?.id]);

  const submit = form.handleSubmit(async (values) => {
    formError.clear();
    try {
      await save.mutateAsync({ id: offer?.id ?? null, values });
      onClose();
      toast(savedMessage('Offer saved'));
    } catch (error) {
      formError.set(error);
    }
  });

  const fixed = offer?.discountType === 'FIXED';
  // The backend cannot change a code or discount after creation (UpdateMarketingOfferDto).
  const locked = !!offer && env.dataMode === 'api';
  return (
    <Sheet visible={visible} title={offer ? 'Edit offer' : 'New offer'} onClose={onClose}>
      <FormText control={form.control} name="code" label="Offer code" required autoCapitalize="characters" editable={!locked} />
      <Grid columns={{ base: 1, medium: 2 }} gap={12}>
        <FormText control={form.control} name="percent" label={fixed ? 'Discount amount' : 'Discount %'} required keyboardType="number-pad" editable={!locked} />
        <FormText control={form.control} name="maxUses" label="Maximum completed uses" required keyboardType="number-pad" editable={!locked} />
      </Grid>
      <FormDate control={form.control} name="expiresOn" label="Expires on" required />
      <FormCheckbox control={form.control} name="enabled" label="Offer enabled" />
      <Note>Offer codes apply at checkout. Redemptions count only after a successful payment.</Note>
      <FormError message={formError.message} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button label="Save offer" onPress={submit} loading={save.isPending} style={{ flex: 2 }} />
      </View>
    </Sheet>
  );
}
