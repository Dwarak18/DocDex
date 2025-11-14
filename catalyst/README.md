# DocDex - AI-Powered Document Indexing for Zoho Cliq

DocDex is a comprehensive Zoho Cliq extension that provides intelligent document indexing and search capabilities for WorkDrive files and email attachments. Built with Zoho Catalyst backend and powered by Zia AI for document summarization and entity extraction.

## 🚀 Features

### Core Functionality
- **OAuth Integration**: Secure authorization for WorkDrive and Mail access
- **Document Indexing**: Automated background indexing of files and attachments
- **AI-Powered Search**: Natural language search with relevance ranking
- **Document Summarization**: Zia-powered content summaries and entity extraction
- **File Proxy**: Secure file downloads with permission validation
- **Multi-Source Support**: WorkDrive files and email attachments

### User Interface
- **Cliq Widget**: Interactive sidebar widget for document exploration
- **Bot Commands**: Conversational interface via Cliq bot
- **Search Filters**: Filter by source, file type, date, and more
- **Real-time Updates**: Live search with instant results

### Security Features
- **Token Encryption**: All OAuth tokens encrypted at rest
- **Access Validation**: User context verification for all operations
- **Rate Limiting**: Built-in protection against API abuse
- **Secure Proxy**: File downloads through authenticated proxy
- **Permission Checks**: Granular file access validation

## 🏗️ Architecture

### Components
- **Catalyst Functions**: Backend API functions for all operations
- **Cliq Extension**: Widget and bot interface components
- **DataStore**: Secure storage for documents and user data
- **OAuth Flow**: Standard Zoho OAuth 2.0 implementation
- **Zia Integration**: AI processing for summaries and entities

### Technology Stack
- **Backend**: Node.js with Catalyst SDK
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Database**: Catalyst DataStore (MySQL-compatible)
- **AI**: Zoho Zia Skills API
- **Security**: Catalyst Secrets vault

## 📋 Prerequisites

### Required Zoho Services
- Zoho Catalyst account and project
- Zoho Cliq developer access
- Zoho WorkDrive and Mail accounts
- Zia Skills API access

### Development Tools
- Node.js 18+
- Catalyst CLI
- Git
- Code editor

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/Dwarak18/DocDex.git
cd DocDex
```

### 2. Deploy Catalyst Backend
```bash
# Install Catalyst CLI
npm install -g catalyst-cli

# Login and create project
catalyst auth login
catalyst init DocDex

# Copy function files and deploy
cp catalyst/functions/* your-catalyst-project/functions/
catalyst deploy
```

### 3. Configure Secrets
```bash
catalyst secrets set ZOHO_CLIENT_ID "your_oauth_client_id"
catalyst secrets set ZOHO_CLIENT_SECRET "your_oauth_client_secret"
catalyst secrets set ZOHO_REDIRECT_URI "your_catalyst_url/oauthCallback"
catalyst secrets set ZIA_API_KEY "your_zia_api_key"
catalyst secrets set TOKEN_ENCRYPTION_KEY "random_32_character_key"
```

### 4. Install Cliq Extension
```bash
cd cliq-extension
zip -r docdex-extension.zip .
# Upload to Cliq Developer Console
```

### 5. Test Installation
- Use `/doc-auth` to authorize access
- Try `/doc search test` to search documents
- Open the widget to explore files

## 📖 API Documentation

### Authentication Functions
- `startOAuth` - Initiate OAuth flow
- `oauthCallback` - Handle OAuth callback
- `getUserTokens` - Retrieve stored tokens

### Document Functions  
- `indexWorkdrive` - Index user documents
- `searchDocs` - Search with filters
- `fetchFileProxy` - Secure file download
- `summarizeDocument` - Generate AI summaries

### Bot Commands
- `/doc search <query>` - Search documents
- `/doc-auth` - Start authorization
- `/doc-status` - Check status
- `/doc-summary <filename>` - Get summary

## 🔒 Security

### Data Protection
- All tokens encrypted using AES-256
- Secrets stored in Catalyst vault
- User context validation on every request
- No client-side storage of sensitive data

### Access Control
- OAuth scope-based permissions
- File access validation per user
- Organization-level isolation
- Rate limiting and abuse protection

### Best Practices
- Regular token rotation
- Audit logging for all operations
- Input sanitization and validation
- HTTPS enforcement

## 📊 Monitoring

### Key Metrics
- Document indexing success rate
- Search response times
- User adoption metrics
- API rate limit usage

### Logging
- Function execution logs
- Error tracking and alerts
- Performance monitoring
- Security audit trails

## 🔧 Configuration

### Environment Variables
```
ZOHO_CLIENT_ID=your_oauth_client_id
ZOHO_CLIENT_SECRET=your_oauth_client_secret
ZOHO_REDIRECT_URI=your_callback_url
ZIA_API_KEY=your_zia_api_key
TOKEN_ENCRYPTION_KEY=encryption_key
```

### DataStore Schema
- `user_tokens` - Encrypted OAuth tokens
- `documents` - File metadata and search index
- `document_summaries` - AI-generated summaries
- `oauth_states` - Temporary OAuth states
- `authorized_users` - User authorization status

## 🧪 Testing

### Postman Collection
Use the provided Postman collection to test all API endpoints:
```bash
# Import collection
tests/postman_collection.json

# Set environment variables
CATALYST_BASE_URL=your_catalyst_url
CLIQ_USER_ID=test_user_id
CLIQ_ORG_ID=test_org_id
```

### Test Scenarios
- OAuth flow completion
- Document indexing
- Search functionality
- File downloads
- Bot commands
- Error handling

## 📈 Performance

### Optimization Features
- Asynchronous document processing
- Database query optimization
- Caching for frequent searches
- Pagination for large result sets
- Background indexing jobs

### Scaling Considerations
- Horizontal scaling via Catalyst
- Database indexing strategies
- CDN for static assets
- Load balancing for high traffic

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Run local development server
catalyst serve

# Watch for changes
catalyst watch
```

### Code Structure
```
docdex/
├─ catalyst/              # Backend functions
│  ├─ functions/         # Catalyst function implementations
│  └─ package.json      # Dependencies
├─ cliq-extension/       # Frontend extension
│  ├─ manifest.json     # Extension configuration
│  └─ web/             # Widget and bot files
├─ docs/               # Documentation
└─ tests/              # Test collections
```

### Contributing Guidelines
1. Follow coding standards and linting rules
2. Write comprehensive tests
3. Update documentation
4. Security review for all changes
5. Performance impact assessment

## 📚 Resources

### Documentation
- [Catalyst Documentation](https://catalyst.zoho.com/docs)
- [Cliq Extensions Guide](https://cliq.zoho.com/developer/docs)
- [Zoho OAuth Guide](https://www.zoho.com/developer/help/api/)
- [Zia Skills API](https://zia.zoho.com/help/api/)

### Support
- GitHub Issues for bug reports
- Developer community forums
- Zoho support for platform issues

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## 📧 Support

For support and questions:
- Create an issue in this repository
- Contact the development team
- Check the documentation and FAQ

---

**DocDex** - Making document discovery intelligent and effortless in Zoho Cliq.