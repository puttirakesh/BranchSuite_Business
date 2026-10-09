export declare class SignupDto {
    businessName: string;
    ownerName: string;
    email: string;
    phone: string;
    password: string;
    planId: 'starter' | 'growth' | 'scale';
    billingCycle: 'monthly' | 'annual';
}
