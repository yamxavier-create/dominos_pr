"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGoogleToken = verifyGoogleToken;
const google_auth_library_1 = require("google-auth-library");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const client = new google_auth_library_1.OAuth2Client(GOOGLE_CLIENT_ID);
async function verifyGoogleToken(idToken) {
    const ticket = await client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
        throw new Error('Invalid Google token payload');
    }
    return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture,
    };
}
