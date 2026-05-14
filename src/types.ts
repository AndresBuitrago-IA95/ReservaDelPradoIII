export enum EntrepreneurshipStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface Entrepreneurship {
  id: string;
  name: string;
  description: string;
  whatsapp: string;
  images: string[];
  category: string;
  status: EntrepreneurshipStatus;
  residentName: string;
  unitNumber: string;
  createdAt: any;
  updatedAt: any;
}

export interface AppConfig {
  gateWhatsapp: string;
  adminWhatsapp: string;
  adminEmail?: string;
  adminHours?: string;
  paymentLinks: { label: string; url: string; }[];
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}
