# 🚀 DocDex Cliq Extension Deployment Guide

## 📋 Prerequisites
- Zoho Cliq account with admin/developer privileges
- DocDex Catalyst app running at: `https://docdex-60058081001.development.catalystserverless.in`
- Access to Zoho Developer Console

## 🎯 Quick Deployment Steps

### Option 1: Manual Upload (Recommended)

#### Step 1: Download Extension Package
The extension is ready in: `/workspaces/DocDex/cliq-extension/docdex-extension.zip`

#### Step 2: Upload to Cliq
1. **Go to Zoho Cliq** → https://cliq.zoho.com
2. **Navigate to Extensions**:
   - Click your profile picture → Administrator Panel
   - Go to "Extensions" → "Manage Extensions" 
   - Click "Upload Extension"
3. **Upload ZIP file**: Select `docdex-extension.zip`
4. **Configure Extension**:
   - Review permissions
   - Set webhook URLs (auto-configured)
   - Enable for organization

#### Step 3: Test Installation
1. Go to any chat in Cliq
2. Type: `@DocDex Bot help`
3. Or use: `/docdex help`

### Option 2: Developer Console (Advanced)

#### Step 1: Create New Extension
1. Go to https://accounts.zoho.com/developerconsole
2. Create new "Cliq Extension"
3. Upload the extension files manually

#### Step 2: Configure OAuth
1. **Client ID**: Use your existing Zoho OAuth app
2. **Redirect URI**: `https://cliq.zoho.com/api/v2/extensionsdk/oauth`
3. **Scopes**: 
   - `ZohoWorkDrive.files.READ`
   - `ZohoWorkDrive.folders.READ`
   - `ZohoMail.messages.READ`

#### Step 3: Deploy
1. Review and test in sandbox
2. Publish to organization
3. Enable for users

## 🤖 Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/docdex help` | Show help menu | `/docdex help` |
| `/docdex setup` | Connect WorkDrive | `/docdex setup` |
| `/docdex search <query>` | Search documents | `/docdex search meeting notes` |
| `/docdex summarize <id>` | Summarize document | `/docdex summarize 123456` |

## 🔧 Configuration

### Webhook URLs (Pre-configured):
- **Main Function**: `https://docdex-60058081001.development.catalystserverless.in/server/docdex_io/execute`
- **Search**: Add `?path=searchDocs` 
- **Summarize**: Add `?path=summarizeDocument`
- **OAuth**: Add `?path=startOAuth`

### Environment Setup (Catalyst):
Your DocDex functions need these secrets in Catalyst console:
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET` 
- `ZOHO_REDIRECT_URI`
- `OPENAI_API_KEY`

## 🧪 Testing

### Test Commands:
```bash
# In any Cliq chat:
@DocDex Bot help
/docdex search project
/docdex setup
```

### Expected Results:
- ✅ Help menu displays
- ✅ Search returns "No documents found" (until OAuth setup)
- ✅ Setup provides OAuth link

### Test API Directly:
```bash
curl "https://docdex-60058081001.development.catalystserverless.in/server/docdex_io/execute"
```

## 🚨 Troubleshooting

### Bot Not Responding:
1. Check extension is enabled in Cliq Admin
2. Verify webhook URL in manifest.json
3. Test Catalyst function directly

### Search Not Working:
1. Complete OAuth setup first (`/docdex setup`)
2. Check WorkDrive permissions
3. Verify user has indexed documents

### Extension Won't Install:
1. Check manifest.json syntax
2. Verify file permissions
3. Try re-uploading ZIP

## 📞 Support

### Debug Steps:
1. **Check Catalyst logs**: Monitor function execution
2. **Test API endpoints**: Verify core functionality
3. **Review OAuth flow**: Ensure proper authorization
4. **Cliq Extension logs**: Check Developer Console

### Get Help:
- GitHub Issues: https://github.com/Dwarak18/DocDex/issues
- Test function: `npm test` (in extension directory)

---

## ✅ Ready to Deploy!

Your DocDex Cliq extension package (`docdex-extension.zip`) is ready for deployment. It will integrate seamlessly with your deployed Catalyst application and provide AI-powered document management directly in Zoho Cliq!

### Next Steps:
1. Upload `docdex-extension.zip` to Cliq
2. Enable extension for your organization  
3. Test with `/docdex help` in any chat
4. Set up OAuth with `/docdex setup`
5. Start searching documents with `/docdex search`