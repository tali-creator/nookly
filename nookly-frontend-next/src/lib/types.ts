export interface User {
  id: string;
  email: string;
  role: "BUSINESS_OWNER" | "ADMIN" | "CUSTOMER";
  name?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface BusinessHours {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  durationMin?: number | null;
}

export interface Photo {
  id: string;
  url: string;
  order: number;
}

export interface NearbyBusiness {
  id: string;
  name: string;
  category: { id: string; name: string } | null;
  description: string | null;
  address: string | null;
  coverUrl: string | null;
  distanceKm: string | number;
  isFeatured: boolean;
  price: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  lat: number | null;
  lng: number | null;
  timezone: string | null;
  hours: BusinessHours[];
  owner?: { name?: string | null; isVerified?: boolean } | null;
  whatsappNumber?: string | null;
  phone?: string | null;
}

export interface BusinessDetail {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  isFeatured: boolean;
  category: Category | null;
  hours: BusinessHours[];
  serviceItems: ServiceItem[];
  photos: Photo[];
  owner?: { id: string; displayName?: string | null; kycStatus?: string };
  price?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
}

export interface NearbyResponse {
  data: NearbyBusiness[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface LoginResponse {
  user: User;
  token: string;
}

/* Owner's own business row as returned by GET /businesses/mine. */
export interface MyBusiness {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  moderationNote?: string | null;
  isFeatured?: boolean;
  category: Category | null;
  serviceItems: ServiceItem[];
  photos: Photo[];
}

export type MessageSender = "CUSTOMER" | "OWNER";

export interface OwnerConversation {
  id: string;
  businessId: string;
  businessName: string;
  businessStatus?: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  messageCount: number;
  unread: number;
  lastMessage: { senderType: MessageSender; text: string; createdAt: string } | null;
}

export interface ConversationMessage {
  id: string;
  text: string;
  senderType: MessageSender;
  createdAt: string;
}

export interface KycSubmission {
  status: "PENDING" | "VERIFIED" | "REJECTED";
  ninMasked: string;
  proofOfAddressType: string;
  submittedAt: string;
  rejectionReason?: string | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: { businessId?: string } & Record<string, unknown>;
}

export interface ProfileBusiness {
  id: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  moderationNote?: string | null;
  isFeatured?: boolean;
}

export interface ProfileData {
  displayName?: string | null;
  email: string;
  role: string;
  avatarUrl?: string | null;
  createdAt?: string;
  kycStatus?: "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED";
  bio?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  preferredContactMethod?: "PHONE" | "WHATSAPP" | "EMAIL" | null;
  socialHandles?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
  };
  businesses?: ProfileBusiness[];
}

/* GET /admin/businesses — moderation queue row (admin.controller REVIEW_INCLUDE). */
export interface AdminBusiness {
  id: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  isFeatured: boolean;
  moderationNote?: string | null;
  category: { id: string; name: string } | null;
  owner?: { id: string; email: string } | null;
}

export interface AdminBusinessListResponse {
  data: AdminBusiness[];
  total: number;
  page: number;
  limit: number;
}

/* GET /admin/kyc — moderation queue row. */
export interface AdminKycQueueItem {
  id: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  ninMasked: string;
  submittedAt: string;
  reviewedAt?: string | null;
  owner: { id: string; email: string; displayName?: string | null };
}

export interface AdminKycListResponse {
  data: AdminKycQueueItem[];
  total: number;
  page: number;
  limit: number;
}

/* GET /admin/kyc/:userId — full submission detail (NIN stays masked). */
export interface AdminKycSubmissionDetail {
  status: "PENDING" | "VERIFIED" | "REJECTED";
  ninMasked?: string;
  proofOfAddressType?: string | null;
  submittedAt?: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  user?: { id: string; email: string; displayName?: string | null; kycStatus?: string };
}

/* GET /admin/users — directory row. */
export interface AdminUserRow {
  id: string;
  email: string;
  role: "BUSINESS_OWNER" | "ADMIN";
  displayName?: string | null;
  phone?: string | null;
  kycStatus: "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED";
  createdAt: string;
  businessCount: number;
}

export interface AdminUserListResponse {
  data: AdminUserRow[];
  total: number;
}

/* GET /admin/users/:id */
export interface AdminUserDetail extends AdminUserRow {
  deletedAt?: string | null;
  businesses: { id: string; name: string; status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" }[];
}
