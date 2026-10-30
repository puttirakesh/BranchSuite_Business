// The APK has a local demo session, not a server-issued bearer token.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY } from '../config/constants';
import type { StorageSnapshot } from '../../shared/types/common.types';
export async function readStorage(): Promise<StorageSnapshot> { const raw = await AsyncStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
export async function writeStorage(snapshot: StorageSnapshot) { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); }
