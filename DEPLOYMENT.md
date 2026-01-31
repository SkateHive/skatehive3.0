# Skatehive 3.0 - Production Deployment Guide

## Prerequisites

- Node.js 18+ or 20+
- pnpm package manager
- PostgreSQL database (Supabase recommended)
- Domain with SSL certificate
- Email account with SMTP access (for transactional emails)

## Environment Variables

### Required Variables

Copy `.env.example` to `.env.local` and configure the following:

#### 1. Hive Blockchain
```bash
HIVE_POSTING_KEY=              # Posting key for app's service account
HIVE_ACCOUNT_CREATOR=          # Account name for creating new Hive accounts
HIVE_ACTIVE_KEY=               # Active key for account creation
DEFAULT_HIVE_POSTING_ACCOUNT=  # Default account for lite user posts
DEFAULT_HIVE_POSTING_KEY=      # Posting key for default account
```

#### 2. Database (Supabase)
```bash
NEXT_PUBLIC_SUPABASE_URL=      # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLIC_KEY= # Anon/public key
SUPABASE_SERVICE_ROLE_KEY=     # Service role key (server-side only)
DATABASE_URL=                  # PostgreSQL connection string
```

#### 3. Authentication & Security
```bash
JWT_SECRET=                    # Generate: openssl rand -base64 64
VIP_PEPPER=                    # Generate: openssl rand -hex 32
USERBASE_KEY_ENCRYPTION_SECRET= # Generate: uuidgen | tr '[:upper:]' '[:lower:]'
```

#### 4. Email (SMTP)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=                    # Your email address
EMAIL_PASS=                    # App password (for Gmail)
EMAIL_RECOVERYACC=             # Recovery email address
```

#### 5. Web3/Blockchain
```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID= # From https://cloud.walletconnect.com
NEXT_PUBLIC_ALCHEMY_KEY=              # From https://alchemy.com
NEXT_PUBLIC_ONCHAINKIT_API_KEY=       # From Coinbase
NEXT_PUBLIC_ZORA_API_KEY=             # From Zora
```

#### 6. File Storage (Pinata/IPFS)
```bash
PINATA_JWT=                    # From https://pinata.cloud
NEXT_PUBLIC_IPFS_GATEWAY=      # Your IPFS gateway domain
```

#### 7. Farcaster Integration
```bash
NEYNAR_API_KEY=                # From https://neynar.com
```

#### 8. Application Configuration
```bash
NEXT_PUBLIC_BASE_URL=          # Your production URL (https://skatehive.app)
NEXT_PUBLIC_THEME=skatehive
NEXT_PUBLIC_ADMIN_USERS=       # Comma-separated admin usernames
```

### Optional Variables
```bash
GIPHY_API_KEY=                 # For GIF selector feature
SIGNER_URL=                    # For VIP signup flow
SIGNER_TOKEN=                  # For VIP signup authentication
```

## Database Setup

### 1. Run Migrations

Ensure all database tables are created:
- `userbase_users`
- `userbase_sessions`
- `userbase_identities`
- `userbase_hive_keys`
- `userbase_soft_posts`
- `userbase_soft_votes`
- `userbase_sponsorships`

### 2. Set Up Row Level Security (RLS)

Enable RLS on all tables and configure appropriate policies in Supabase.

### 3. Database Indexes

Ensure indexes are created for:
- Session lookups (`userbase_sessions.refresh_token_hash`)
- User lookups (`userbase_users.email`, `userbase_users.handle`)
- Identity lookups (`userbase_identities.user_id`, `userbase_identities.provider_user_id`)
- Soft posts/votes (`userbase_soft_posts.user_id`, `userbase_soft_votes.user_id`)

## Build & Deployment

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Type Check
```bash
pnpm type-check
```

### 3. Build for Production
```bash
pnpm build
```

### 4. Start Production Server
```bash
pnpm start
```

## Deployment Platforms

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Set build command: `pnpm build`
4. Set start command: `pnpm start`
5. Deploy

### Self-Hosted

1. Set up a server with Node.js 18+
2. Clone repository
3. Copy `.env.local` with production values
4. Run build: `pnpm build`
5. Use PM2 or similar process manager:
   ```bash
   pm2 start pnpm --name "skatehive" -- start
   ```
6. Set up nginx reverse proxy with SSL

## Post-Deployment Checklist

### Security
- [ ] All environment variables are set correctly
- [ ] No secrets are committed to git
- [ ] Database has proper RLS policies
- [ ] HTTPS is enabled with valid SSL certificate
- [ ] CORS policies are configured correctly

### Functionality
- [ ] User registration works (email, Farcaster, wallet)
- [ ] Lite accounts can post comments and create snaps
- [ ] Sponsored accounts can post with their own username
- [ ] Voting works for all account types
- [ ] Image/video uploads work correctly
- [ ] Email delivery works (registration, key backups)
- [ ] Profile merging works correctly

### Performance
- [ ] Static pages are generated correctly
- [ ] Images are optimized and cached
- [ ] API routes respond quickly (<500ms for most requests)
- [ ] Database queries are optimized with indexes

### Monitoring
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Monitor API endpoint response times
- [ ] Track user registration and engagement metrics
- [ ] Set up database performance monitoring
- [ ] Configure uptime monitoring

## Cron Jobs

Set up the following cron jobs:

### 1. Process Pending Sponsorships
```bash
# Run every 5 minutes
*/5 * * * * curl https://your-domain.com/api/userbase/sponsorships/process
```

### 2. Retry Failed Soft Posts/Votes
```bash
# Run hourly
0 * * * * curl -X POST https://your-domain.com/api/userbase/soft-posts/retry
0 * * * * curl -X POST https://your-domain.com/api/userbase/soft-votes/retry
```

## Rollback Procedure

If you need to rollback to a previous version:

### Vercel
1. Go to Deployments tab
2. Find the previous successful deployment
3. Click "Promote to Production"

### Self-Hosted
1. Stop the current process: `pm2 stop skatehive`
2. Checkout previous version: `git checkout <previous-commit>`
3. Rebuild: `pnpm build`
4. Restart: `pm2 restart skatehive`

## Monitoring & Alerts

### Key Metrics to Monitor

1. **User Activity**
   - New registrations per day
   - Active users per day
   - Posts/comments created per day
   - Sponsorship conversion rate

2. **System Health**
   - API response times (p50, p95, p99)
   - Error rates per endpoint
   - Database connection pool usage
   - Memory/CPU usage

3. **Business Metrics**
   - Lite account → sponsored account conversion rate
   - Email delivery success rate
   - Hive account creation success rate
   - IPFS upload success rate

### Recommended Tools

- **Error Tracking**: Sentry
- **Performance**: Vercel Analytics or New Relic
- **Uptime**: UptimeRobot or Pingdom
- **Logs**: Logtail or Papertrail
- **Database**: Supabase built-in monitoring

## Troubleshooting

### Build Fails

1. Clear cache: `rm -rf .next`
2. Reinstall dependencies: `rm -rf node_modules && pnpm install`
3. Check TypeScript errors: `pnpm type-check`

### Database Connection Issues

1. Verify `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. Check Supabase project status
3. Verify network connectivity and firewall rules

### Email Not Sending

1. Verify SMTP credentials
2. Check Gmail security settings (enable "Less secure app access" or use App Password)
3. Test SMTP connection manually

### Hive Operations Failing

1. Verify posting keys are correct
2. Check Hive node connectivity
3. Ensure sufficient Resource Credits (RC) on posting accounts

## Security Best Practices

1. **Never commit secrets** - Use `.env.local` and keep it out of git
2. **Rotate keys regularly** - Especially JWT_SECRET and encryption keys
3. **Use HTTPS** - Always encrypt traffic in production
4. **Monitor for suspicious activity** - Set up alerts for unusual patterns
5. **Keep dependencies updated** - Run `pnpm audit` regularly
6. **Enable rate limiting** - Protect API endpoints from abuse
7. **Backup database** - Regular automated backups of PostgreSQL

## Support

For issues or questions:
- GitHub Issues: https://github.com/skatehive/skatehive3.0/issues
- Discord: [Your Discord Link]
- Email: [Your Support Email]
