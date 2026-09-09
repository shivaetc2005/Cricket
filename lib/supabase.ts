import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const ExpoSecureStoreAdapter = {
    getItem: (key: string) => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') {
                return Promise.resolve(localStorage.getItem(key));
            }
            return Promise.resolve(null);
        }
        return SecureStore.getItemAsync(key);
    },
    setItem: (key: string, value: string) => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') {
                localStorage.setItem(key, value);
            }
            return Promise.resolve();
        }
        return SecureStore.setItemAsync(key, value);
    },
    removeItem: (key: string) => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') {
                localStorage.removeItem(key);
            }
            return Promise.resolve();
        }
        return SecureStore.deleteItemAsync(key);
    },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey || !supabaseAnonKey.startsWith('eyJ')) {
    console.warn(
        '⚠️ [Supabase Warning]: EXPO_PUBLIC_SUPABASE_ANON_KEY in .env does not appear to be a valid Supabase JWT key. ' +
        'Please copy your "anon public" key from your Supabase Dashboard (Settings -> API) to resolve AuthRetryableFetchError.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

