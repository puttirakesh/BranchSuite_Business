import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { colors, radius } from '../../theme/tokens';
import { Icon } from './Icon';

/** APK `.field`: label above, 50px input, error message below. */
export function FieldShell({ label, required, error, children, hint }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      {children}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

export function TextField({ label, required, error, hint, multiline, style, ...input }: TextInputProps & { label: string; required?: boolean; error?: string; hint?: string }) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      <TextInput
        {...input}
        multiline={multiline}
        accessibilityLabel={label}
        placeholderTextColor={colors.faint}
        style={[styles.input, multiline ? styles.area : null, error ? styles.invalid : null, style]}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </FieldShell>
  );
}

export interface Option {
  value: string;
  label: string;
}
const toOptions = (options: readonly (string | Option)[]): Option[] =>
  options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

/** Native-friendly select: an inline list that opens under the field. */
export function SelectField({ label, value, onChange, options, error, required, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly (string | Option)[]; error?: string; required?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const list = toOptions(options);
  const current = list.find((o) => o.value === value);
  return (
    <FieldShell label={label} required={required} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label + ': ' + (current?.label ?? 'not selected')}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        style={[styles.input, styles.select, error ? styles.invalid : null, disabled ? { opacity: 0.6 } : null]}
      >
        <Text style={styles.selectText} numberOfLines={1}>{current?.label ?? 'Choose…'}</Text>
        <Icon name="down" size={16} color={colors.subtle} />
      </Pressable>
      {open ? (
        <View style={styles.menu} accessibilityRole="menu">
          {list.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: o.value === value }}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={({ pressed }) => [styles.option, o.value === value ? styles.optionOn : null, pressed ? { backgroundColor: '#F4F1FC' } : null]}
            >
              <Text style={[styles.optionText, o.value === value ? { color: colors.primary, fontWeight: '700' } : null]}>{o.label}</Text>
              {o.value === value ? <Icon name="check" size={15} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </FieldShell>
  );
}

/** APK `.grant-check` / `.flow-checkbox`. */
export function CheckboxField({ label, value, onChange, description }: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} style={styles.check}>
      <View style={[styles.box, value ? styles.boxOn : null]}>{value ? <Icon name="check" size={14} color="#fff" strokeWidth={2.6} /> : null}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

type Base<T extends FieldValues> = { control: Control<T>; name: Path<T>; label: string; required?: boolean };

export function FormText<T extends FieldValues>({ control, name, label, required, ...input }: Base<T> & Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> & { hint?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...input}
          label={label}
          required={required}
          value={field.value == null ? '' : String(field.value)}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

export function FormDate<T extends FieldValues>(props: Base<T>) {
  return <FormText {...props} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" autoCapitalize="none" maxLength={10} hint="Format: YYYY-MM-DD" />;
}

export function FormSelect<T extends FieldValues>({ control, name, label, required, options }: Base<T> & { options: readonly (string | Option)[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SelectField label={label} required={required} value={String(field.value ?? '')} onChange={field.onChange} options={options} error={fieldState.error?.message} />
      )}
    />
  );
}

export function FormCheckbox<T extends FieldValues>({ control, name, label, description }: Base<T> & { description?: string }) {
  return (
    <Controller control={control} name={name} render={({ field }) => <CheckboxField label={label} description={description} value={!!field.value} onChange={field.onChange} />} />
  );
}

/** Form-level error banner (APK `.form-error`). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={[styles.error, styles.formError]} accessibilityRole="alert">{message}</Text>;
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.label, marginBottom: 7, letterSpacing: 0.05 },
  input: { minHeight: 50, backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.fieldBorder, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  area: { minHeight: 96 },
  invalid: { borderColor: colors.error },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  selectText: { fontSize: 16, color: colors.ink, flex: 1 },
  menu: { marginTop: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  option: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionOn: { backgroundColor: '#F7F4FD' },
  optionText: { fontSize: 15, color: colors.ink },
  hint: { fontSize: 11, color: colors.subtle, marginTop: 5 },
  error: { fontSize: 12, color: colors.error, marginTop: 6 },
  formError: { marginTop: 0, marginBottom: 12, fontWeight: '600' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, marginBottom: 8 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#B9C3D3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { fontSize: 14, color: colors.ink, fontWeight: '600' },
});
