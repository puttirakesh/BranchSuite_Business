import { TextInput, type ScrollView } from 'react-native';

/** Recheck focus after the native window has resized for the keyboard. */
export function scrollFocusedInputIntoView(scroll: ScrollView | null) {
  const input = TextInput.State.currentlyFocusedInput();
  if (input) scroll?.scrollResponderScrollNativeHandleToKeyboard(input, 24, true);
}
