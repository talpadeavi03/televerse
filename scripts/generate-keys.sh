#!/usr/bin/env bash
# Generate a new AES-256-GCM encryption key for session encryption
echo "SESSION_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")"
echo "INTERNAL_SECRET=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")"
