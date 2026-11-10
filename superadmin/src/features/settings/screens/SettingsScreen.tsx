import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useForm, useFormState } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, ErrorState, FormCheckbox, FormError, FormText, LoadingList, Note, PageHeader, Screen, useToast } from '../../../shared/components';
import { useFormError } from '../../../shared/hooks/useMutationForm';
import { useSaveSettings, useSettings } from '../../../shared/hooks/queries';
import { useBreakpoint } from '../../../shared/hooks/useBreakpoint';
import { savedMessage } from '../../../core/data/source';
import { settingsSchema, type SettingsForm } from '../schemas/settings.schema';

/** APK `platform-settings`: brand, support email and trial signup control. */
export function SettingsScreen() {
  const settings = useSettings();
  const save = useSaveSettings();
  const toast = useToast();
  const formError = useFormError();
  const { medium } = useBreakpoint();
  const form = useForm<SettingsForm>({ resolver: zodResolver(settingsSchema), defaultValues: { brand: '', supportEmail: '', trialEnabled: true, supportPhone: '', announcement: '', supportPortalUrl: '', displayAnnouncement: false } });
  const { isDirty } = useFormState({ control: form.control });

  const loaded = settings.data;
  useEffect(() => {
    if (loaded) form.reset({ brand: loaded.brand, supportEmail: loaded.supportEmail, trialEnabled: loaded.trialEnabled ?? true, supportPhone: loaded.supportPhone ?? '', announcement: loaded.announcement ?? '', supportPortalUrl: loaded.supportPortalUrl ?? '', displayAnnouncement: loaded.displayAnnouncement ?? false });
  }, [loaded, form]);

  const submit = form.handleSubmit(async (values) => {
    formError.clear();
    try {
      await save.mutateAsync(values);
      form.reset(values);
      toast(savedMessage('Platform settings saved'));
    } catch (error) {
      formError.set(error);
    }
  });

  return (
    <Screen onRefresh={settings.refetch}>
      <PageHeader title="Platform settings" subtitle="Brand and customer onboarding controls." />
      {settings.isPending ? <LoadingList rows={1} height={320} /> : settings.error ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <Card style={{ maxWidth: medium ? 620 : undefined }}>
          <FormText control={form.control} name="brand" label="Platform brand" required />
          <FormText control={form.control} name="supportEmail" label="Support email" required keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <FormText control={form.control} name="supportPhone" label="Support phone" keyboardType="phone-pad" />
          <FormText control={form.control} name="supportPortalUrl" label="Support portal URL" autoCapitalize="none" keyboardType="url" />
          <FormText control={form.control} name="announcement" label="Platform announcement" multiline />
          <FormCheckbox control={form.control} name="displayAnnouncement" label="Display announcement" />
          {loaded?.trialEnabled != null ? (
            <FormCheckbox control={form.control} name="trialEnabled" label="Enable trial signup" description="When off, new businesses can request a demo but cannot start a trial." />
          ) : (
            <Note>Trial signup preferences are not available in connected mode yet.</Note>
          )}
          <Note>Payment gateway and email provider status are managed by the backend and are not configured from this screen.</Note>
          <FormError message={formError.message} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              label="Reset"
              variant="secondary"
              disabled={!isDirty}
              style={{ flex: 1 }}
              onPress={() => {
                formError.clear();
                if (loaded) form.reset({ brand: loaded.brand, supportEmail: loaded.supportEmail, trialEnabled: loaded.trialEnabled ?? true, supportPhone: loaded.supportPhone ?? '', announcement: loaded.announcement ?? '', supportPortalUrl: loaded.supportPortalUrl ?? '', displayAnnouncement: loaded.displayAnnouncement ?? false });
              }}
            />
            <Button label="Save platform settings" style={{ flex: 2 }} loading={save.isPending} disabled={!isDirty} onPress={submit} />
          </View>
        </Card>
      )}
    </Screen>
  );
}
