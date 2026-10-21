import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ToastModal as Modal } from './Toast';
import { AppIcon } from './AppIcon';
import { calendarDateKey as toIso, parseCalendarDate as fromIso, calendarRangeError, isAllowedCalendarDate } from '../shared/validation/date';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  clearable?: boolean;
  hideLabel?: boolean;
  style?: StyleProp<ViewStyle>;
};

function monthStart(year: number, month: number): Date {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month, 1);
  return date;
}

export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  clearable = false,
  hideLabel = false,
  style,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = fromIso(value);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = selected ?? new Date();
    return monthStart(date.getFullYear(), date.getMonth());
  });
  const lastDay = monthStart(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1);
  lastDay.setDate(0);
  const days = lastDay.getDate();
  const firstDay = monthStart(visibleMonth.getFullYear(), visibleMonth.getMonth()).getDay();
  const cells = useMemo(() => Array.from({ length: Math.ceil((firstDay + days) / 7) * 7 }, (_, index) => index - firstDay + 1), [days, firstDay]);
  const minimum = minDate || '0001-01-01';
  const maximum = maxDate || '9999-12-31';
  const rangeError = calendarRangeError(minimum, maximum);
  const dateError = rangeError || (value && !isAllowedCalendarDate(value, minimum, maximum) ? 'Choose a valid date within the allowed range.' : undefined);
  useEffect(() => { setOpen(false); }, [disabled, minimum, maximum]);
  const monthLabel = visibleMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const openCalendar = () => {
    if (disabled || rangeError) return;
    let dateKey = selected ? value : toIso(new Date());
    if (minimum && dateKey < minimum) dateKey = minimum;
    if (maximum && dateKey > maximum) dateKey = maximum;
    const initial = fromIso(dateKey) ?? new Date();
    setVisibleMonth(monthStart(initial.getFullYear(), initial.getMonth()));
    setOpen(true);
  };
  const moveMonth = (amount: number) => setVisibleMonth(current => monthStart(current.getFullYear(), current.getMonth() + amount));
  const previousMonthEnd = monthStart(visibleMonth.getFullYear(), visibleMonth.getMonth());
  previousMonthEnd.setDate(0);
  const previousUnavailable = previousMonthEnd.getFullYear() < 1 || toIso(previousMonthEnd) < minimum;
  const nextMonth = monthStart(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1);
  const nextUnavailable = nextMonth.getFullYear() > 9999 || toIso(nextMonth) > maximum;
  const today = toIso(new Date());
  const todayAvailable = (!minimum || today >= minimum) && (!maximum || today <= maximum);
  const chooseDate = (dateKey: string) => {
    if (disabled || !isAllowedCalendarDate(dateKey, minimum, maximum)) return;
    onChange(dateKey);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? selected.toLocaleDateString('en-GB') : 'No date selected'}. Open calendar`}
        accessibilityState={{ disabled: disabled || !!rangeError }}
        accessibilityHint={dateError || undefined}
        aria-invalid={!!dateError}
        disabled={disabled || !!rangeError}
        onPress={openCalendar}
        style={[styles.field, disabled && { opacity: 0.6 }, style, { minHeight: 44, paddingVertical: 8 }]}
      >
        {!hideLabel && <Text numberOfLines={1} style={styles.label}>{label}</Text>}
        <Text numberOfLines={1} style={styles.value}>
          {selected ? selected.toLocaleDateString('en-GB') : ''}
        </Text>
        <AppIcon name="calendar" size={17} color="#405573" />
      </Pressable>
      {!!dateError && <Text accessibilityRole="alert" style={styles.error}>{dateError}</Text>}
      <Modal transparent visible={open && !disabled && !rangeError} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={styles.modal}><ScrollView keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={styles.title}>{label}</Text>
            <View style={styles.monthRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={previousUnavailable} accessibilityState={{ disabled: previousUnavailable }} onPress={() => moveMonth(-1)} style={[styles.monthButton, previousUnavailable && styles.unavailableDay]}>
                <AppIcon name="chevron-left" size={18} color="#20334f" />
              </Pressable>
              <Text style={styles.monthTitle}>{monthLabel}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={nextUnavailable} accessibilityState={{ disabled: nextUnavailable }} onPress={() => moveMonth(1)} style={[styles.monthButton, nextUnavailable && styles.unavailableDay]}>
                <AppIcon name="chevron-right" size={18} color="#20334f" />
              </Pressable>
            </View>
            <View style={styles.grid}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}
              {cells.map((day, index) => {
                if (day < 1 || day > days) return <View key={index} style={styles.dayCell} />;
                const date = monthStart(visibleMonth.getFullYear(), visibleMonth.getMonth());
                date.setDate(day);
                const dateKey = toIso(date);
                const isSelected = dateKey === value;
                const unavailable = (!!minimum && dateKey < minimum) || (!!maximum && dateKey > maximum);
                return (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    accessibilityState={{ selected: isSelected, disabled: unavailable }}
                    disabled={unavailable}
                    onPress={() => chooseDate(dateKey)}
                    style={[styles.dayCell, isSelected && styles.selectedDay, unavailable && styles.unavailableDay]}
                  >
                    <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.actions}>
              {todayAvailable && <Pressable accessibilityRole="button" accessibilityLabel={`Set ${label.toLowerCase()} to today`} onPress={() => chooseDate(today)} style={styles.actionButton}><Text style={styles.actionText}>Today</Text></Pressable>}
              {clearable && value !== '' && <Pressable accessibilityRole="button" onPress={() => { if (disabled || rangeError) return; onChange(''); setOpen(false); }} style={styles.actionButton}><Text style={styles.actionText}>Clear date</Text></Pressable>}
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.actionButton}><Text style={styles.actionText}>Close</Text></Pressable>
            </View>
          </ScrollView></View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { position: 'absolute', top: -8, left: 8, maxWidth: '90%', paddingHorizontal: 3, backgroundColor: 'transparent', color: '#5f6368', fontSize: 10, lineHeight: 16 },
  error: { color: '#B94D61', fontSize: 12, lineHeight: 18, marginTop: 4 },
  field: { width: '100%', minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ccd6e5', borderRadius: 6, backgroundColor: '#fff' },
  value: { flex: 1, minWidth: 0, color: '#20334f', fontSize: 13, lineHeight: 18 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(21,36,60,0.35)' },
  modal: { width: '100%', maxWidth: 380, maxHeight: '95%', padding: 20, borderRadius: 16, backgroundColor: '#fff' },
  title: { marginBottom: 12, color: '#20334f', fontSize: 16, fontWeight: '700' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  monthButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { flex: 1, textAlign: 'center', color: '#20334f', fontSize: 15, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  weekday: { width: '14.2857%', paddingVertical: 8, textAlign: 'center', color: '#71829c', fontSize: 11 },
  dayCell: { width: '14.2857%', minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  dayText: { color: '#20334f', fontSize: 14 },
  selectedDay: { backgroundColor: '#345cf2' },
  selectedDayText: { color: '#fff', fontWeight: '700' },
  unavailableDay: { opacity: 0.35 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  actionButton: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  actionText: { color: '#345cf2', fontSize: 13, fontWeight: '700' },
});
