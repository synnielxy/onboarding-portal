import mongoose, { Document } from "mongoose";

export interface IOnboardingApplication extends Document {
    userId: mongoose.Types.ObjectId;
    status: "pending" | "approved" | "rejected";
    rejectionFeedback?: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    preferredName?: string;
    profilePicture?: string;
    address: {
        addressOne: string;
        addressTwo?: string;
        city: string;
        state: string;
        zipCode: string;
    };
    cellPhone: string;
    workPhone?: string;
    email: string;
    ssn: string;
    dateOfBirth: Date;
    gender: "male" | "female" | "prefer_not_to_say";


    citizenshipStatus: {
        isPermanentResident: boolean;
        type: "green_card" | "citizen" | "work_authorization";
        workAuthorizationType?: "H1-B" | "H4" | "L2" | "F1" | "other";
        workAuthorizationOther?: string;
        startDate?: Date,
        expirationDate?: Date;
    };

    reference?: {
        firstName: string;
        lastName: string;
        middleName?: string;
        phone: string;
        email: string;
        relationship: string;
    };
    
    emergencyContacts?: Array<{
        firstName: string;
        lastName: string;
        middleName?: string;
        phone: string;
        email: string;
        relationship: string;
    }>;

    documents: [{
        type: 'driver_license' | "work_authorization" | "opt_receipt" | 'other';
        fileName: string;
        fileUrl: string;
        uploadDate: Date;
    }];
    createdAt: Date;
    updatedAt: Date;
}