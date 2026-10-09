import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly logger;
    private readonly resetTokenLifetimeMs;
    private readonly resetRequestCooldownMs;
    constructor(prisma: PrismaService, jwtService: JwtService);
    private readonly userInclude;
    private getActiveUser;
    private makeSession;
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
    private hashResetToken;
    private createMailTransporter;
    private sendPasswordResetEmail;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
}
