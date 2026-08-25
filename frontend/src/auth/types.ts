export interface Company {

    id: string;

    name: string;

    slug: string;

    status: string;

    primaryColor: string | null;
        logoUrl: string | null;

}

export interface Role {

    id: string;

    name: string;

    isSuperAdmin: boolean;

    isCompanyAdmin: boolean;

}

export interface User {

    id: string;

    email: string;

    firstName: string;

    lastName: string;

    phone: string | null;

    companyId: string | null;

    company: Company | null;

    role: Role;

    permissions: string[];

    status: string;

    mustChangePassword: boolean;

    lastLoginAt: string | null;

}

export interface LoginSession {

    user: User;

    accessToken: string;

    refreshToken: string;

}

export interface LoginResponse {

    success: boolean;

    message: string;

    data: {

        message: string;

        data: LoginSession;

    };

}

export interface MeResponse {

    success: boolean;

    message: string;

    data: {

        message: string;

        data: User;

    };

}