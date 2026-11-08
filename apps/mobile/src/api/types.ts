export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  timezone: string | null;
  emailVerifiedAt: string | null;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = TokenPair & { user: User };

export type MessageResponse = { message: string };

/** Shape of every API error body. `message` may be a list of validation messages. */
export type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
};
