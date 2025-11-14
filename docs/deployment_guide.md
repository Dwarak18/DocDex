# DocDex Deployment Guide

## Overview
DocDex is a Zoho Cliq extension that provides AI-powered document indexing and search capabilities for WorkDrive and Mail attachments using Zoho Catalyst as the backend.

## Prerequisites

### Zoho Services Required
- Zoho Catalyst account and project
- Zoho Cliq developer access
- Zoho WorkDrive and Mail (for document sources)
- Zia Skills API access (for AI summaries)

### Development Environment
- Node.js 18+ 
- Catalyst CLI (`npm install -g catalyst-cli`)
- Git
- Code editor (VS Code recommended)

## Step 1: Setup Zoho OAuth Application

1. **Go to Zoho Developer Console**
   - Navigate to https://api-console.zoho.com
   - Sign in with your Zoho account

2. **Create OAuth Application**
   - Click "Add Client ID"
   - Choose "Self Client" type
   - Set Client Name: "DocDex"
   - Set Homepage URL: Your domain or localhost
   - Set Authorized redirect URIs: `{{CATALYST_APP_URL}}/oauthCallback`

3. **Configure Scopes**
   - Add required scopes:
     - `ZohoWorkDrive.files.READ`
     - `ZohoWorkDrive.folders.READ`
     - `ZohoMail.messages.READ`
     - `ZohoMail.attachments.READ`

4. **Note Credentials**
   - Save `Client ID` and `Client Secret`
   - These will be stored in Catalyst Secrets

## Step 2: Setup Catalyst Project

### Create New Catalyst Project
```bash
# Install Catalyst CLI
npm install -g catalyst-cli

# Login to Catalyst
catalyst auth login

# Create new project
catalyst init DocDex --type=nodejs

# Navigate to project
cd DocDex
```

### Configure Catalyst Functions
```bash
# Add functions
catalyst add functions startOAuth
catalyst add functions oauthCallback
catalyst add functions indexWorkdrive
catalyst add functions searchDocs
catalyst add functions summarizeDocument
catalyst add functions fetchFileProxy

# Add Catalyst bot webhook function
catalyst add functions botWebhook
```

### Setup DataStore Tables
```bash
# Add datastore component
catalyst add datastore

# Create required tables (will be created automatically on first deploy)
```

**Required Tables:**
- `user_tokens` - Store OAuth tokens securely
- `oauth_states` - Temporary OAuth state storage  
- `authorized_users` - Track authorized users
- `documents` - Document metadata
- `document_summaries` - AI-generated summaries

### Configure Secrets
```bash
# Add secrets for sensitive data
catalyst add secrets

# Set the following secrets:
catalyst secrets set ZOHO_CLIENT_ID "your_oauth_client_id"
catalyst secrets set ZOHO_CLIENT_SECRET "your_oauth_client_secret"
catalyst secrets set ZOHO_REDIRECT_URI "{{CATALYST_APP_URL}}/oauthCallback"
catalyst secrets set ZIA_API_KEY "your_zia_api_key"
catalyst secrets set TOKEN_ENCRYPTION_KEY "generate_random_32_char_key"
```

## Step 3: Deploy Catalyst Functions

### Copy Function Files
Copy all files from the `catalyst/functions/` directory to your Catalyst project's `functions/` directory.

### Update package.json
Replace your `functions/package.json` with the provided one that includes required dependencies.

### Deploy to Catalyst
```bash
# Deploy all functions
catalyst deploy

# Note the deployed function URLs
catalyst list functions
```

## Step 4: Create Cliq Extension

### Prepare Extension Files
1. Copy `cliq-extension/` folder contents
2. Update `manifest.json` placeholders:
   - Replace `{{CATALYST_APP_URL}}` with your Catalyst base URL
   - Update webhook URLs to point to your deployed functions

### Create Extension Package
```bash
# Navigate to cliq-extension directory
cd cliq-extension/

# Create extension package (zip file)
zip -r docdex-extension.zip . -x "*.DS_Store" "*/.*"
```

### Upload to Cliq Developer Console

1. **Go to Cliq Developer Console**
   - Navigate to https://cliq.zoho.com/developer
   - Sign in with your Zoho account

2. **Create New Extension**
   - Click "Create Extension"
   - Choose "Upload Extension"
   - Upload your `docdex-extension.zip`

3. **Configure Extension**
   - Fill in required details
   - Set webhook URLs to your Catalyst functions
   - Configure bot commands and widget settings

4. **Test Extension**
   - Install extension in your Cliq organization
   - Test bot commands and widget functionality

## Step 5: Configure Auto-Indexing

### Option 1: Catalyst CRON Functions
```bash
# Create scheduled function for auto-indexing
catalyst add functions autoIndex --trigger=cron --schedule="0 */6 * * *"
```

### Option 2: Deluge Workflow (Recommended)
Use the provided `deluge/auto_indexing.deluge` script:

1. Go to Zoho Creator or Deluge standalone
2. Create new workflow
3. Set trigger: Time-based (every 6 hours)
4. Add the Deluge script
5. Configure to call your indexWorkdrive function

## Step 6: Security Configuration

### Enable HTTPS
- Ensure all Catalyst functions use HTTPS
- Configure proper CORS headers
- Validate all incoming requests

### Token Security
- Use Catalyst Secrets for all sensitive data
- Implement token rotation
- Encrypt stored tokens
- Validate OAuth states

### Rate Limiting
```javascript
// Implement rate limiting in functions
const rateLimiter = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each user to 100 requests per windowMs
};
```

## Step 7: Testing

### Test OAuth Flow
1. Trigger `/doc-auth` command in Cliq
2. Complete OAuth authorization
3. Verify tokens are stored securely
4. Test token refresh mechanism

### Test Document Indexing
1. Trigger manual indexing
2. Verify documents appear in DataStore
3. Test both WorkDrive and Mail sources
4. Monitor indexing logs

### Test Search and Summarization
1. Use `/doc search <query>` command
2. Test widget search functionality
3. Generate document summaries
4. Verify Zia integration

### Performance Testing
- Test with large document sets
- Monitor function execution times
- Test concurrent user access
- Validate rate limiting

## Configuration Reference

### Environment Variables / Secrets
```
ZOHO_CLIENT_ID=your_oauth_client_id
ZOHO_CLIENT_SECRET=your_oauth_client_secret  
ZOHO_REDIRECT_URI=https://your-catalyst-app.com/oauthCallback
ZIA_API_KEY=your_zia_api_key
TOKEN_ENCRYPTION_KEY=random_32_character_key
```

### DataStore Schema

**user_tokens table:**
```
- user_id (TEXT)
- org_id (TEXT) 
- access_token (ENCRYPTED TEXT)
- refresh_token (ENCRYPTED TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**documents table:**
```
- file_id (TEXT, PRIMARY)
- user_id (TEXT)
- org_id (TEXT)
- name (TEXT)
- mime_type (TEXT)
- size (BIGINT)
- source_type (TEXT)
- created_at (TIMESTAMP)
- modified_at (TIMESTAMP)
- indexed_at (TIMESTAMP)
- download_url (TEXT)
- status (TEXT)
```

### Bot Commands
- `/doc search <query>` - Search documents
- `/doc-auth` - Start OAuth authorization
- `/doc-status` - Check authorization status  
- `/doc-summary <filename>` - Get document summary

## Troubleshooting

### Common Issues

1. **OAuth Authorization Fails**
   - Verify client ID and secret in Catalyst Secrets
   - Check redirect URI matches OAuth app configuration
   - Ensure proper scopes are requested

2. **Indexing Not Working**
   - Check user has valid OAuth tokens
   - Verify WorkDrive/Mail API permissions
   - Monitor function execution logs
   - Check rate limiting issues

3. **Search Returns No Results**  
   - Verify documents are indexed (check DataStore)
   - Test search query sanitization
   - Check user permissions and org context

4. **Zia Summarization Fails**
   - Verify Zia API key is correct
   - Check file size limits (< 50MB)
   - Ensure supported file formats
   - Monitor Zia API rate limits

### Monitoring and Logs
```bash
# View function logs
catalyst logs startOAuth
catalyst logs indexWorkdrive
catalyst logs searchDocs

# Monitor DataStore
catalyst datastore query "SELECT COUNT(*) FROM documents"
```

### Performance Optimization
- Implement caching for frequent queries
- Use database indexing for search fields
- Optimize file download streaming
- Implement pagination for large result sets

## Security Checklist

- [ ] All secrets stored in Catalyst Secrets vault
- [ ] OAuth tokens encrypted at rest
- [ ] Request validation implemented
- [ ] Rate limiting configured
- [ ] HTTPS enforced for all endpoints
- [ ] User context validation
- [ ] File access permissions checked
- [ ] Input sanitization implemented
- [ ] Error messages don't leak sensitive info

## Production Deployment

### Final Steps
1. Test all functionality in staging environment
2. Run security audit
3. Configure monitoring and alerting
4. Create backup procedures for DataStore
5. Document operational procedures
6. Train users on extension features
7. Deploy to production Cliq organization

### Monitoring Setup
- Monitor function execution metrics
- Set up alerts for failed operations
- Track user adoption metrics
- Monitor API rate limits
- Regular security audits

## Support

### Documentation
- Catalyst documentation: https://catalyst.zoho.com/docs
- Cliq extensions guide: https://cliq.zoho.com/developer/docs
- Zoho OAuth documentation: https://www.zoho.com/developer/help/api/

### Getting Help
- Zoho Developer Community Forums
- Catalyst Support Portal
- Submit support tickets for critical issues

---

**Note:** Replace all `{{PLACEHOLDER}}` values with your actual configuration before deployment.