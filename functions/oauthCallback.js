const utils = require('./utilities');

/**
 * OAuth callback handler - exchanges code for tokens
 */
module.exports = async (req, res) => {
    try {
        // Initialize Catalyst
        await utils.initCatalyst(req);
        
        const { code, state, error } = req.query;
        
        // Check for OAuth errors
        if (error) {
            console.error('OAuth error:', error);
            return res.status(400).json(utils.generateResponse(400, null, 
                `OAuth authorization failed: ${error}`));
        }
        
        if (!code || !state) {
            return res.status(400).json(utils.generateResponse(400, null, 
                'Missing authorization code or state parameter'));
        }
        
        // Validate state parameter
        const stateTable = utils.datastore.table('oauth_states');
        const stateRecords = await stateTable.getRecords({
            where: [`state='${state}'`]
        });
        
        if (stateRecords.length === 0) {
            return res.status(400).json(utils.generateResponse(400, null, 
                'Invalid or expired state parameter'));
        }
        
        const stateRecord = stateRecords[0];
        const now = new Date();
        const expiresAt = new Date(stateRecord.expires_at);
        
        if (now > expiresAt) {
            // Clean up expired state
            await stateTable.deleteRecord(stateRecord.ROWID);
            return res.status(400).json(utils.generateResponse(400, null, 
                'OAuth state has expired. Please try again.'));
        }
        
        const userId = stateRecord.user_id;
        const orgId = stateRecord.org_id;
        
        // Exchange authorization code for tokens
        const clientId = await utils.getSecret('ZOHO_CLIENT_ID');
        const clientSecret = await utils.getSecret('ZOHO_CLIENT_SECRET');
        const redirectUri = await utils.getSecret('ZOHO_REDIRECT_URI');
        
        const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code: code
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenResponse.ok || tokenData.error) {
            console.error('Token exchange failed:', tokenData);
            return res.status(400).json(utils.generateResponse(400, null, 
                `Token exchange failed: ${tokenData.error || 'Unknown error'}`));
        }
        
        // Store tokens securely
        await utils.storeUserTokens(
            userId, 
            orgId, 
            tokenData.access_token, 
            tokenData.refresh_token
        );
        
        // Clean up used state
        await stateTable.deleteRecord(stateRecord.ROWID);
        
        // Store user authorization status
        const userTable = utils.datastore.table('authorized_users');
        const existingUsers = await userTable.getRecords({
            where: [`user_id='${userId}' AND org_id='${orgId}'`]
        });
        
        const userRecord = {
            user_id: userId,
            org_id: orgId,
            authorized_at: new Date().toISOString(),
            scopes: tokenData.scope || 'WorkDrive.files.READ,WorkDrive.folders.READ,Mail.messages.READ,Mail.attachments.READ',
            status: 'active'
        };
        
        if (existingUsers.length > 0) {
            await userTable.updateRecord(existingUsers[0].ROWID, userRecord);
        } else {
            await userTable.insertRecord(userRecord);
        }
        
        console.log(`OAuth completed successfully for user ${userId} in org ${orgId}`);
        
        // Trigger initial indexing (async)
        try {
            const indexFunction = req.app.function('indexWorkdrive');
            await indexFunction.execute({
                user_id: userId,
                org_id: orgId
            });
        } catch (indexError) {
            console.warn('Initial indexing failed:', indexError);
            // Don't fail the OAuth process if indexing fails
        }
        
        // Redirect to success page or send success response
        const successHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>DocDex - Authorization Successful</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
                    .message { color: #6c757d; font-size: 16px; }
                    .btn { background: #007bff; color: white; padding: 10px 20px; 
                           border: none; border-radius: 5px; text-decoration: none; 
                           display: inline-block; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="success">✓ Authorization Successful!</div>
                <div class="message">
                    DocDex now has access to your WorkDrive and Mail.<br>
                    You can close this window and return to Cliq.
                </div>
                <script>
                    // Try to close the window after 3 seconds
                    setTimeout(() => {
                        if (window.opener) {
                            window.close();
                        }
                    }, 3000);
                </script>
            </body>
            </html>
        `;
        
        res.status(200).send(successHtml);
        
    } catch (error) {
        console.error('oauthCallback error:', error);
        res.status(500).json(utils.generateResponse(500, null, error.message));
    }
};