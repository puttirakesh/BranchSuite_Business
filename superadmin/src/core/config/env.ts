
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl?.trim()) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not configured',
  );
}

export const env = {
  apiUrl: apiUrl.trim().replace(/\/+$/, ''),
};
