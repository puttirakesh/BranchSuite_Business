import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    signup(dto: SignupDto): Promise<{
        message: string;
        user: {
            id: string;
            name: string;
            email: string;
        };
        business: {
            tenantId: string;
            companyId: string;
            branchId: string;
            name: string;
        };
        subscription: {
            planId: "starter" | "growth" | "scale";
            billingCycle: "monthly" | "annual";
            status: string;
        };
        nextStep: string;
    }>;
    login(dto: LoginDto): Promise<{
        message: string;
        accessToken: string;
        session: {
            user: {
                id: string;
                name: string;
                email: string;
            };
            memberships: {
                id: string;
                tenantId: string;
                companyId: string;
                companyName: string;
                role: string;
                permissions: string[];
                branches: {
                    id: string;
                    name: string;
                }[];
            }[];
        };
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    me(authorization?: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
        };
        memberships: {
            id: string;
            tenantId: string;
            companyId: string;
            companyName: string;
            role: string;
            permissions: string[];
            branches: {
                id: string;
                name: string;
            }[];
        }[];
    }>;
    logout(): {
        message: string;
    };
    testDashboardAccess(): {
        message: string;
        permission: string;
    };
    testCrmCreate(): {
        message: string;
        permission: string;
    };
    testBusinessScope(req: {
        businessScope: {
            tenantId: string;
            companyId: string;
            branchId: string;
        };
    }): {
        message: string;
        scope: {
            tenantId: string;
            companyId: string;
            branchId: string;
        };
    };
}
