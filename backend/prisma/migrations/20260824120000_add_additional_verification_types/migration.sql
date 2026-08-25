-- Add optional verification types used by the BGV case workflow.
ALTER TYPE "VerificationType" ADD VALUE IF NOT EXISTS 'CIBIL';
ALTER TYPE "VerificationType" ADD VALUE IF NOT EXISTS 'TWENTY_SIX_AS';
ALTER TYPE "VerificationType" ADD VALUE IF NOT EXISTS 'POLICE';
