import { PrismaClient, User } from '@prisma/client';
import { refreshAccessToken, isTokenExpired } from './google-oauth';

const prisma = new PrismaClient();

interface TokenResult {
  accessToken: string;
  refreshToken: string;
  needsReauth: boolean;
}

// Get valid Google tokens for a user, refreshing if needed
export async function getValidGoogleTokens(userId: string): Promise<TokenResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!user?.googleAccessToken || !user?.googleRefreshToken) {
    return null;
  }

  // Check if token is expired
  if (isTokenExpired(user.googleTokenExpiry)) {
    try {
      // Refresh the token
      const newTokens = await refreshAccessToken(user.googleRefreshToken);
      
      // Update in database
      await prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: newTokens.accessToken,
          googleTokenExpiry: newTokens.expiryDate,
        },
      });

      return {
        accessToken: newTokens.accessToken,
        refreshToken: user.googleRefreshToken,
        needsReauth: false,
      };
    } catch (error) {
      console.error('Failed to refresh Google token:', error);
      // Token refresh failed - user needs to re-authenticate
      return {
        accessToken: user.googleAccessToken,
        refreshToken: user.googleRefreshToken,
        needsReauth: true,
      };
    }
  }

  return {
    accessToken: user.googleAccessToken,
    refreshToken: user.googleRefreshToken,
    needsReauth: false,
  };
}

// Store Google tokens for a user
export async function storeGoogleTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null | undefined,
  expiryDate: number | null | undefined
) {
  const updateData: Partial<User> = {
    googleAccessToken: accessToken,
  };

  // Only update refresh token if provided (Google only sends it on first auth)
  if (refreshToken) {
    updateData.googleRefreshToken = refreshToken;
  }

  if (expiryDate) {
    updateData.googleTokenExpiry = new Date(expiryDate);
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

// Clear Google tokens (for logout or revocation)
export async function clearGoogleTokens(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
    },
  });
}

