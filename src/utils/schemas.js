import { z } from 'zod';

const SANITIZE_REGEX = /[<>{}]/g;
const LEVELS = ['ND1', 'ND2', 'HND1', 'HND2'];

const stripTags = (v) => (typeof v === 'string' ? v.replace(SANITIZE_REGEX, '').trim() : v);

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Required').max(255).transform(stripTags),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const electionSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200).transform(stripTags),
  description: z.string().max(2000).transform(stripTags).optional().default(''),
  academicSession: z.string().min(1, 'Academic session is required').max(50).transform(stripTags),
  startDate: z.string().optional().default(''),
  endDate: z.string().optional().default(''),
  durationHours: z.coerce.number().int().min(1).max(720).default(24),
});

export const positionSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(100).transform(stripTags),
  description: z.string().max(500).transform(stripTags).optional().default(''),
  displayOrder: z.coerce.number().int().min(1).default(1),
});

export const candidateSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(100).transform(stripTags),
  level: z.enum(LEVELS, { errorMap: () => ({ message: 'Select a valid level' }) }),
  manifesto: z.string().min(20, 'Manifesto must be at least 20 characters').max(2000).transform(stripTags),
  positionId: z.string().min(1, 'Position is required'),
});

export const studentSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(100).transform(stripTags),
  matricNumber: z.string().min(1, 'Matric number is required').max(30)
    .regex(/^[a-zA-Z0-9/-]+$/, 'Invalid matric number format')
    .transform(v => v.trim()),
  level: z.enum(LEVELS, { errorMap: () => ({ message: 'Select a valid level' }) }),
});

export const studentRegistrationStep1Schema = z.object({
  level: z.enum(LEVELS, { errorMap: () => ({ message: 'Select your level' }) }),
  matricNumber: z.string().min(1, 'Matric number is required').max(30)
    .regex(/^[a-zA-Z0-9/-]+$/, 'Invalid format')
    .transform(v => v.trim()),
});

export const studentRegistrationStep2Schema = z.object({
  email: z.string().email('Enter a valid email address').max(255)
    .transform(v => v.trim().toLowerCase()),
  nameCompletion: z.string().min(1, 'Complete your name for verification'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const adminAddSchema = z.object({
  email: z.string().email('Enter a valid email').max(255)
    .transform(v => v.trim().toLowerCase()),
});

export const bulkCsvSchema = z.string().min(1, 'Paste CSV data').max(50000);
