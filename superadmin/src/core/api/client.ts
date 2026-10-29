
import axios from 'axios';

import { env } from '../config/env';

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Authentication is managed centrally.
// We will attach the authenticated Admin token
// through the AuthContext in the next step.
