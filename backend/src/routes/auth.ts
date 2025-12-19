import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAuthUrl, getTokensFromCode, getUserInfo } from '../services/google-oauth';
import { storeGoogleTokens, getValidGoogleTokens } from '../services/token-manager';
import { generateToken, requireAuth } from '../middleware/auth';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();

// Initiate Google OAuth flow
router.get('/google', (req: Request, res: Response) => {
  const authUrl = getAuthUrl();
  res.redirect(authUrl);
});

// Google OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error) {
    console.error('OAuth error:', error);
    return res.redirect(`${config.FRONTEND_URL}/login?error=oauth_denied`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`${config.FRONTEND_URL}/login?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);
    
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Get user info from Google
    const userInfo = await getUserInfo(tokens.access_token);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name,
        },
      });
      console.log('Created new user:', user.email);
    }

    // Store Google tokens
    await storeGoogleTokens(
      user.id,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date
    );

    // Generate JWT for session
    const jwtToken = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Set cookie and redirect
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with token (for localStorage backup)
    res.redirect(`${config.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

// Get current user
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        googleAccessToken: true,
        hubspotAccessToken: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check token validity
    const googleTokens = await getValidGoogleTokens(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      connections: {
        google: {
          connected: !!user.googleAccessToken,
          needsReauth: googleTokens?.needsReauth ?? false,
        },
        hubspot: {
          connected: !!user.hubspotAccessToken,
          needsReauth: false,
        },
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ success: true });
});

// Refresh Google tokens manually
router.post('/google/refresh', requireAuth, async (req: Request, res: Response) => {
  try {
    const tokens = await getValidGoogleTokens(req.user!.id);
    
    if (!tokens) {
      return res.status(400).json({ error: 'No Google tokens found', needsReauth: true });
    }

    if (tokens.needsReauth) {
      return res.status(400).json({ error: 'Token refresh failed', needsReauth: true });
    }

    res.json({ success: true, message: 'Tokens refreshed' });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh tokens' });
  }
});

export default router;

