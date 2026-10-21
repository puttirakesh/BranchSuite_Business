import React, { forwardRef, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { acceptsInput, inputLimit, keyboardInputKind, validateInput, type InputValidation } from '../shared/validation/input';
import { colors } from '../shared/theme/colors';

const readFontScale = () => Dimensions.get('window').fontScale;
const subscribeFontScale = (notify: () => void) => {
  const subscription = Dimensions.addEventListener('change', notify);
  return () => subscription.remove();
};

export type FloatingTextInput = TextInput;

export type FloatingTextInputProps = Omit<TextInputProps, 'placeholder' | 'placeholderTextColor'> & {
  label?: string;
  invalid?: boolean;
  trailingAccessory?: React.ReactNode;
  validation?: InputValidation;
};

/** Shared manual-entry control. Layout styles stay on the field; text styles stay on the input. */
export const FloatingTextInput = forwardRef<TextInput, FloatingTextInputProps>(function FloatingTextInput({
  label, accessibilityLabel, value, defaultValue, style, onFocus, onBlur, onChangeText,
  editable = true, multiline, invalid = false, trailingAccessory, validation, ...props
}, forwardedRef) {
  const native = Platform.OS !== 'web';
  // Keyboard height changes must not re-render every field on the screen.
  const fontScale = useSyncExternalStore(subscribeFontScale, readFontScale, readFontScale);
  const inputRef = useRef<TextInput | null>(null);
  const setInputRef = useCallback((node: TextInput | null) => {
    inputRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);
  const [fieldHeight, setFieldHeight] = useState(0);
  const [labelWidth, setLabelWidth] = useState(0);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [entryError, setEntryError] = useState<string>();
  const [localValue, setLocalValue] = useState(defaultValue ?? '');
  const text = value ?? localValue;
  useEffect(() => { setEntryError(undefined); }, [text]);
  const floating = focused || text.length > 0;
  const caption = label || accessibilityLabel || 'Value';
  const kind = validation?.kind ?? (props.secureTextEntry || props.autoComplete === 'new-password' ? 'password' : keyboardInputKind(props.keyboardType));
  const rule: InputValidation = { kind, ...validation, maxLength: validation?.maxLength ?? (kind === 'phone' ? Math.min(props.maxLength ?? 10, 10) : props.maxLength) };
  const message = entryError || (touched ? validateInput(text, rule, caption.replace(/\s*\*$/, '')) : undefined);
  const hasError = invalid || !!message;
  const progress = useRef(new Animated.Value(floating ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: floating ? 1 : 0, duration: 140, useNativeDriver: native, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [floating, native, progress]);

  const flat = StyleSheet.flatten(style) ?? {};
  const { color, fontSize, fontFamily, fontWeight, fontStyle, letterSpacing, textAlign, textTransform, lineHeight, textDecorationLine, ...layout } = flat;
  const fieldStyle: ViewStyle = { ...layout } as ViewStyle;
  // Padding belongs to the editable area so labels never collide with entered text.
  for (const key of ['padding', 'paddingTop', 'paddingBottom', 'paddingVertical', 'paddingLeft', 'paddingRight', 'paddingHorizontal'] as const) delete fieldStyle[key];
  const textStyle: TextStyle = { color: color ?? '#20334f', fontSize: 13, fontFamily, fontWeight: fontWeight ?? '400', fontStyle, letterSpacing, textAlign, textTransform, lineHeight: 18, textDecorationLine };
  // Native font metrics include Android padding by default. Reserve real space
  // for scaled text and position the label against the measured field instead.
  const scale = props.allowFontScaling === false ? 1 : props.maxFontSizeMultiplier && props.maxFontSizeMultiplier > 0 ? Math.min(fontScale, props.maxFontSizeMultiplier) : fontScale;
  const nativeFontSize = 14;
  const nativeLineHeight = 20;
  const requestedHeight = Number(flat.minHeight) || Number(flat.height) || 0;
  const minHeight = Math.max(multiline ? Math.max(88, requestedHeight - 16) : 44, native ? Math.ceil(nativeLineHeight * scale) + 20 : 0);
  delete fieldStyle.height;
  const labelHeight = 18 * scale;
  const labelTop = multiline ? 11 : ((fieldHeight || minHeight) - labelHeight) / 2 - 1;
  const outlineColor = hasError ? colors.danger : focused ? colors.primary : flat.borderColor ?? '#ccd6e5';
  const outlineWidth = native || focused || hasError ? 1 : Number(flat.borderWidth ?? 1);
  const notchEnd = 8 + (floating ? Math.ceil(labelWidth * (native ? 0.75 : 1)) : 0);

  return <><View onLayout={native ? event => setFieldHeight(event.nativeEvent.layout.height) : undefined}
    onTouchEnd={native ? event => { if (editable && event.target === event.currentTarget) inputRef.current?.focus(); } : undefined}
    style={[s.field, fieldStyle, { borderRadius: 4, minHeight }, focused && !hasError && s.focused,
      native && { borderWidth: 1, overflow: 'visible' }, hasError && s.invalid, !editable && s.disabled, { borderTopColor: 'transparent' }]}>
    {/* Split the top edge rather than painting a rectangle behind the label. */}
    <View pointerEvents="none" accessible={false} style={[s.topLeft, { width: 8, borderColor: outlineColor, borderTopWidth: outlineWidth, borderLeftWidth: outlineWidth }]} />
    <View pointerEvents="none" accessible={false} style={[s.topRight, { left: notchEnd, borderColor: outlineColor, borderTopWidth: outlineWidth, borderRightWidth: outlineWidth }]} />
    <Animated.Text pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      onLayout={event => setLabelWidth(Math.ceil(event.nativeEvent.layout.width))}
      allowFontScaling={props.allowFontScaling} maxFontSizeMultiplier={props.maxFontSizeMultiplier}
      style={[s.label, native && { top: labelTop, lineHeight: 18, includeFontPadding: false, zIndex: 2, transformOrigin: 'left center' }, {
      color: hasError ? colors.danger : focused ? colors.primary : '#5f6368',
      backgroundColor: 'transparent',
      fontSize: native ? 14 : progress.interpolate({ inputRange: [0, 1], outputRange: [13, 10] }),
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, native ? -labelTop - labelHeight / 2 - 1 : -22] }) },
        ...(native ? [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }) }] : []),
      ],
      maxWidth: trailingAccessory ? '74%' : '92%',
    }]} numberOfLines={1}>{caption}</Animated.Text>
    <TextInput {...props} ref={setInputRef} underlineColorAndroid="transparent"
      maxLength={inputLimit(rule)} aria-invalid={hasError} accessibilityHint={message || props.accessibilityHint}
      accessibilityLabel={accessibilityLabel || caption} value={text} editable={editable} multiline={multiline}
      onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); setTouched(true); onBlur?.(event); }}
      onChangeText={next => {
        if (!editable) return;
        if (!acceptsInput(next, rule, !!multiline)) {
          setEntryError(kind === 'phone' || kind === 'integer' ? 'Use digits only.' : kind === 'decimal' ? `Use digits and up to ${rule.fractionDigits ?? 2} decimal places.` : `Use ${inputLimit(rule)} characters or fewer, without unsupported control characters.`);
          return;
        }
        setEntryError(undefined); setLocalValue(next); onChangeText?.(next);
      }}
      style={[s.input, textStyle, native && { flex: 0, flexGrow: 0, flexBasis: 'auto', flexShrink: 0, minHeight: minHeight - 2,
        fontSize: nativeFontSize, lineHeight: nativeLineHeight, includeFontPadding: false,
        paddingTop: 10, paddingBottom: 10, textAlignVertical: 'center' },
        multiline && { textAlignVertical: 'top' }, { paddingRight: trailingAccessory ? 72 : typeof flat.paddingRight === 'number' ? flat.paddingRight : 10 },
        Platform.OS === 'web' ? { outlineWidth: 0, boxShadow: 'none' } as TextStyle : undefined]} />
    {trailingAccessory && <View style={s.accessory}>{trailingAccessory}</View>}
  </View>{!!message && !invalid && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.validationError}>{message}</Text>}</>;
});

const s = StyleSheet.create({
  field: { position: 'relative', minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: '#dadce0', borderRadius: 4, backgroundColor: '#fff' },
  focused: { borderColor: colors.primary, borderWidth: 1 }, invalid: { borderColor: colors.danger }, disabled: { opacity: 0.6 },
  topLeft: { position: 'absolute', top: -1, left: -1, height: 5, borderTopLeftRadius: 4 },
  topRight: { position: 'absolute', top: -1, right: -1, height: 5, borderTopRightRadius: 4 },
  label: { position: 'absolute', alignSelf: 'flex-start', maxWidth: '90%', left: 8, top: 13, paddingHorizontal: 3, lineHeight: 18, zIndex: 1 },
  input: { flex: 1, width: '100%', minWidth: 0, minHeight: 42, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10 },
  accessory: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  validationError: { color: '#B94D61', fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 4 },
});
