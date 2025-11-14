# 💻 DocDex Local Development Guide

This guide will help you set up DocDex for local development and testing.

## 🛠️ Local Development Setup

### Prerequisites

1. **Node.js 18+**
   ```bash
   # Check your version
   node --version
   npm --version
   ```

2. **Catalyst CLI**
   ```bash
   # Install globally (requires sudo on macOS)
   sudo npm install -g zcatalyst-cli
   
   # Verify installation
   catalyst --version
   ```

3. **Zoho Account Setup**
   - Zoho Catalyst account (free tier available)
   - Zoho Cliq developer access
   - OAuth app credentials (for testing)

### 🚀 Quick Local Setup

1. **Navigate to your project directory**
   ```bash
   cd /Users/sampreetapalanisamy/Documents/DocDex
   ```

2. **Initialize Catalyst project locally**
   ```bash
   # Initialize a new Catalyst project for local development
   catalyst init docdex-local --type=nodejs
   
   # Navigate to the new project
   cd docdex-local
   ```

3. **Copy function files**
   ```bash
   # Copy all function files to your local Catalyst project
   cp ../catalyst/functions/* functions/
   cp ../catalyst/package.json .
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Set up local environment variables**
   ```bash
   # Create a .env file for local development
   cat > .env << EOF
   NODE_ENV=development
   ZOHO_CLIENT_ID=your_test_client_id
   ZOHO_CLIENT_SECRET=your_test_client_secret
   ZOHO_REDIRECT_URI=http://localhost:3000/oauthCallback
   ZIA_API_KEY=your_zia_api_key
   TOKEN_ENCRYPTION_KEY=local_development_key_32_chars
   EOF
   ```

6. **Start local development server**
   ```bash
   # Start the Catalyst local server
   catalyst serve
   ```

   This will start your functions locally at:
   - Base URL: `http://localhost:3000`
   - Function endpoints: `http://localhost:3000/server/docdex_function/{functionName}`

### 🧪 Testing Functions Locally

#### 1. Test Health Check
```bash
curl http://localhost:3000/server/docdex_function/health
```

#### 2. Test OAuth Start (without real OAuth)
```bash
curl -X POST http://localhost:3000/server/docdex_function/startOAuth \
  -H "Content-Type: application/json" \
  -H "X-Cliq-User-ID: test_user_123" \
  -H "X-Cliq-Org-ID: test_org_456" \
  -d '{
    "user": {"id": "test_user_123"},
    "org": {"id": "test_org_456"}
  }'
```

#### 3. Test Search (with mock data)
```bash
curl -X POST http://localhost:3000/server/docdex_function/searchDocs \
  -H "Content-Type: application/json" \
  -H "X-Cliq-User-ID: test_user_123" \
  -H "X-Cliq-Org-ID: test_org_456" \
  -d '{
    "query": "test document",
    "limit": 10
  }'
```

### 🎨 Widget Local Development

1. **Serve the widget locally**
   ```bash
   # Navigate to widget directory
   cd ../cliq-extension/web
   
   # Simple HTTP server (Python 3)
   python3 -m http.server 8080
   
   # Or use Node.js http-server
   npx http-server -p 8080 --cors
   ```

2. **Access widget at**: `http://localhost:8080/index.html`

3. **Update widget.js for local testing**
   Edit the `config.baseUrl` in `widget.js`:
   ```javascript
   this.config = {
       baseUrl: 'http://localhost:3000/server/docdex_function',
       apiVersion: 'v1'
   };
   ```

### 🔧 Development Workflow

#### Hot Reload Development
```bash
# Watch for changes and auto-restart
catalyst serve --watch

# Or manually restart when you make changes
catalyst serve
```

#### Database Development
```bash
# Use local DataStore (SQLite for development)
catalyst datastore init

# Create test tables
catalyst datastore create table user_tokens
catalyst datastore create table documents
catalyst datastore create table document_summaries
catalyst datastore create table authorized_users
catalyst datastore create table oauth_states
```

#### Mock Data Setup
Create a script to populate test data:

```bash
cat > scripts/setup-mock-data.js << 'EOF'
const catalyst = require('zcatalyst-sdk-node');

async function setupMockData() {
    // Initialize Catalyst (you'll need to adapt this for local)
    console.log('Setting up mock data...');
    
    // Mock documents
    const mockDocs = [
        {
            file_id: 'mock_doc_1',
            user_id: 'test_user_123',
            org_id: 'test_org_456',
            name: 'Quarterly Report Q3 2024.pdf',
            mime_type: 'application/pdf',
            size: 1024000,
            source_type: 'workdrive',
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            indexed_at: new Date().toISOString(),
            status: 'indexed'
        },
        {
            file_id: 'mock_doc_2', 
            user_id: 'test_user_123',
            org_id: 'test_org_456',
            name: 'Project Timeline.docx',
            mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            size: 512000,
            source_type: 'mail',
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            indexed_at: new Date().toISOString(),
            status: 'processed',
            message_subject: 'Updated Project Timeline',
            message_from: 'manager@company.com'
        }
    ];
    
    console.log('Mock documents created:', mockDocs.length);
    // You would insert these into your local database here
}

setupMockData().catch(console.error);
EOF

node scripts/setup-mock-data.js
```

### 🐛 Debugging Tips

#### 1. Enable Debug Logging
```bash
# Set debug environment
export DEBUG=catalyst:*
catalyst serve
```

#### 2. Use Local Database Browser
```bash
# If using SQLite locally
sqlite3 .catalyst/datastore.db
.tables
.schema documents
SELECT * FROM documents LIMIT 5;
```

#### 3. Test with Postman
Import the provided Postman collection and update the base URL to `http://localhost:3000`

#### 4. Browser DevTools
- Open widget in browser at `localhost:8080`
- Use browser DevTools for debugging JavaScript
- Check Network tab for API calls

### 🔄 Sync with Production

#### Deploy from Local
```bash
# Deploy your local changes
catalyst deploy

# Deploy specific function
catalyst deploy function startOAuth
```

#### Pull from Production
```bash
# Pull latest from production
catalyst pull

# Pull specific components
catalyst pull functions
catalyst pull datastore
```

### 📝 Development Scripts

Create helpful development scripts:

```bash
# Create package.json for development scripts
cat > package.json << 'EOF'
{
  "name": "docdex-local-dev",
  "version": "1.0.0",
  "scripts": {
    "dev": "catalyst serve --watch",
    "test": "node test/run-tests.js",
    "widget": "cd cliq-extension/web && python3 -m http.server 8080",
    "mock-data": "node scripts/setup-mock-data.js",
    "deploy": "catalyst deploy",
    "logs": "catalyst logs --follow"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "http-server": "^14.1.1"
  }
}
EOF
```

Now you can use:
```bash
npm run dev       # Start development server with watch
npm run widget    # Serve widget locally
npm run test      # Run tests
npm run deploy    # Deploy to production
```

### ⚠️ Important Notes

1. **OAuth Limitations**: Full OAuth flow requires production URLs. For local testing, you can mock the authentication responses.

2. **Zia API**: Zia API calls will work locally if you have valid API keys.

3. **File Access**: WorkDrive/Mail file access requires valid OAuth tokens from production.

4. **CORS**: Widget testing locally may require CORS configuration.

5. **Database**: Local development uses a separate database from production.

### 🎯 Development Checklist

- [ ] Catalyst CLI installed and authenticated
- [ ] Local environment variables configured
- [ ] Functions running on `localhost:3000`
- [ ] Widget served on `localhost:8080`
- [ ] Mock data populated for testing
- [ ] Postman collection configured for local URLs
- [ ] Debug logging enabled
- [ ] Development scripts ready

You're now ready for local DocDex development! The setup allows you to test all functionality locally before deploying to production.