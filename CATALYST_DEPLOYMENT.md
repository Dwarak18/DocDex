# 🚀 DocDex Catalyst Deployment Guide

## Prerequisites

- ✅ Catalyst CLI installed (`catalyst --version`)
- ✅ Node.js 18+ 
- ✅ Valid Zoho Catalyst account
- ✅ OpenAI API key (for production)

## Step 1: Authenticate with Catalyst

```bash
catalyst login
```

This will:
- Open a browser window
- Authenticate your Zoho account
- Create a session token

## Step 2: Initialize/Link Catalyst Project

If this is your first deployment:
```bash
catalyst init
```

If you have an existing Catalyst project:
```bash
# List your projects
catalyst projects

# Link to existing project
catalyst link
```

## Step 3: Set Environment Secrets

Set your secrets in Catalyst (do NOT commit these to .env):

```bash
# OAuth Configuration
catalyst secrets set ZOHO_CLIENT_ID "your_client_id"
catalyst secrets set ZOHO_CLIENT_SECRET "your_client_secret"
catalyst secrets set ZOHO_REDIRECT_URI "https://your-app.catalyst.zoho.com/oauthCallback"

# OpenAI Configuration
catalyst secrets set OPENAI_API_KEY "your_openai_api_key"
catalyst secrets set OPENAI_MODEL "gpt-4-turbo"

# Security
catalyst secrets set TOKEN_ENCRYPTION_KEY "random_32_character_key"
```

## Step 4: Deploy to Catalyst

```bash
# Deploy your functions
catalyst deploy

# Or use npm script
npm run deploy
```

## Step 5: Verify Deployment

```bash
# View deployment logs
catalyst logs -f

# Test deployed functions
curl https://your-app.catalyst.zoho.com/server/docdex_function/health
```

## 📊 Project Structure for Catalyst

```
DocDex/
├── catalyst/
│   ├── functions/           ← Your serverless functions
│   │   ├── startOAuth.js
│   │   ├── oauthCallback.js
│   │   ├── searchDocs.js
│   │   ├── summarizeDocument.js
│   │   └── utilities.js
│   ├── package.json
│   └── README.md
├── cliq-extension/         ← Cliq bot/widget
├── .catalystrc             ← Catalyst config (auto-generated)
└── .env                    ← Local config (NOT for production)
```

## 🔑 Key Configuration

### API Endpoints (Catalyst)
- `GET /server/docdex_function/health` - Health check
- `POST /server/docdex_function/startOAuth` - Initiate OAuth
- `GET /server/docdex_function/oauthCallback` - OAuth callback
- `POST /server/docdex_function/searchDocs` - Search documents
- `POST /server/docdex_function/summarizeDocument` - Summarize with OpenAI

### Environment Variables Required

| Variable | Purpose | Example |
|----------|---------|---------|
| `ZOHO_CLIENT_ID` | OAuth client ID | `1000.xxxxx` |
| `ZOHO_CLIENT_SECRET` | OAuth secret | `xxxxx` |
| `ZOHO_REDIRECT_URI` | OAuth callback | `https://app.catalyst.zoho.com/oauthCallback` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-xxxxx` |
| `OPENAI_MODEL` | OpenAI model | `gpt-4-turbo` |
| `TOKEN_ENCRYPTION_KEY` | Encryption key (32 chars) | `xxxxx` |

## 🗄️ DataStore Setup

Catalyst will automatically create these tables when functions run:

```
Tables:
- user_tokens      (OAuth tokens)
- documents        (File metadata)
- document_summaries (AI summaries)
- authorized_users (User permissions)
- oauth_states     (Temporary OAuth states)
```

## ✅ Deployment Checklist

- [ ] Catalyst CLI installed and authenticated (`catalyst login`)
- [ ] Project linked to Catalyst (`catalyst init` or `catalyst link`)
- [ ] All secrets set in Catalyst (`catalyst secrets set ...`)
- [ ] Functions code updated with OpenAI integration
- [ ] .env file has placeholders (NOT real secrets)
- [ ] Dependencies installed (`npm install`)
- [ ] Ready to deploy (`catalyst deploy`)

## 🆘 Troubleshooting

### Login Issues
```bash
# Clear previous login
rm ~/.zcatalyst/config.json

# Re-login
catalyst login
```

### Deployment Fails
```bash
# Check dependencies
npm install

# Verify Node version
node --version  # Should be 18+

# Check project config
cat .catalystrc

# View detailed logs
catalyst deploy --verbose
```

### Function Errors
```bash
# View logs in real-time
catalyst logs -f

# Test locally first
node server-simple.js
```

## 📖 Additional Resources

- [Catalyst Documentation](https://catalyst.zoho.com/docs)
- [Catalyst CLI Reference](https://catalyst.zoho.com/docs/cli)
- [DataStore Guide](https://catalyst.zoho.com/docs/datastore)
- [Secrets Management](https://catalyst.zoho.com/docs/secrets)

---

**Ready to deploy?** Start with: `catalyst login`
