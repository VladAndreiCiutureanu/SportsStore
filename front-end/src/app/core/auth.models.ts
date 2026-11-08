// Formele datelor pentru /api/Auth, exact ca DTO-urile din backend (camelCase in JSON).

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  username: string;
  email: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string; // data UTC in format ISO
  userId: string;
  username: string;
  email: string;
}

/** Ce pastram in browser despre utilizatorul logat. Parola NU se pastreaza niciodata. */
export interface Session {
  token: string;
  expiresAt: string;
  userId: string;
  username: string;
  email: string;
  roles: string[];
  /** true = "Tine-ma minte" (localStorage), false = doar pana inchizi browserul (sessionStorage). */
  remember: boolean;
}
