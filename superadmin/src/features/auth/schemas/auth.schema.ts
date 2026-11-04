import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address') });
export type ForgotForm = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({
    code: z.string().trim().min(4, 'Enter the code from your email'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include a letter')
      .regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
export type ResetForm = z.infer<typeof resetSchema>;
