import express from 'express';
import jwt from 'jsonwebtoken';

export const authRouter = express.Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

authRouter.get('/github/login', (req, res) => {
    const redirectUri = `${APP_URL}/api/auth/github/callback`;
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user`;
    res.redirect(githubAuthUrl);
});

authRouter.get('/github/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
        return res.status(400).send('No code provided');
    }

    try {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code
            })
        });

        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
            return res.status(400).send(`Error: ${tokenData.error_description}`);
        }

        const accessToken = tokenData.access_token;

        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'lego-pool'
            }
        });
        const userData = await userResponse.json();

        // Create JWT
        const jwtToken = jwt.sign({
            id: userData.id,
            login: userData.login,
            avatar_url: userData.avatar_url
        }, JWT_SECRET, { expiresIn: '7d' });

        // Set cookie and redirect back to app
        res.cookie('token', jwtToken, { 
            httpOnly: false, // We need to read it from JS to know if logged in
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 
        });

        res.redirect('/');
    } catch (err: any) {
        console.error('OAuth Error:', err);
        res.status(500).send('Authentication failed');
    }
});

authRouter.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});
