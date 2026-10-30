import AppInput from './AppInput';
export default function SearchBar({ value, onChangeText, placeholder = 'Search' }: { value: string; onChangeText: (value: string) => void; placeholder?: string }) { return <AppInput label={placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder} accessibilityRole="search" autoCapitalize="none" />; }
