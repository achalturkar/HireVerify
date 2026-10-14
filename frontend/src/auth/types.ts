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
    isClientUser: boolean;

}

export interface User {

    id: string;

    email: string;

    firstName: string;

    lastName: string;

    phone: string | null;

    companyId: string | null;
    clientId: string | null;
    client: {
        id: string;
        name: string;
        logoUrl: string | null;
        clientCode?: string;
        website?: string | null;
        industry?: string | null;
        contactName?: string | null;
        contactEmail?: string | null;
        contactPhone?: string | null;
        addressLine1?: string | null;
        addressLine2?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
        postalCode?: string | null;
    } | null;

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
    impersonation?: {
        sessionId: string;
        companyId: string;
        expiresAt: string;
        actorName: string;
    };

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