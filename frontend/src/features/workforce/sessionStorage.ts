import * as SecureStore from 'expo-secure-store';

export const readSession = (key: string) => SecureStore.getItemAsync(key);
export const writeSession = (key: string, value: string) => SecureStore.setItemAsync(key, value);
export const deleteSession = (key: string) => SecureStore.deleteItemAsync(key);
