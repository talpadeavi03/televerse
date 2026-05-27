#!/usr/bin/env bash
# Generate a new AES-256-GCM encryption key for session encryption
echo "SESSION_ENCRYPTION_KEY=$(node -e "require('crypto').randomBytes(32).toString('hex') |> console.log")"
echo "JWT_SECRET=$(node -e "require('crypto').randomBytes(32).toString('base64url') |> console.log")"
echo "INTERNAL_SECRET=$(node -e "require('crypto').randomBytes(24).toString('base64url') |> console.log")"
