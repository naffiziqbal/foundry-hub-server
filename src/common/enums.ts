export enum UserRole {
  DESIGNER = 'designer',
  CLIENT = 'client',
}

export enum ProjectStatus {
  PLANNING = 'planning',
  IN_PROGRESS = 'in_progress',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum ScheduleType {
  MATERIAL = 'material',
  FURNITURE = 'furniture',
  FIXTURE = 'fixture',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ImportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum NotificationType {
  APPROVAL_REQUEST = 'approval_request',
  APPROVAL_DECISION = 'approval_decision',
  PRODUCT_UPDATE = 'product_update',
  PRODUCT_IMPORTED = 'product_imported',
  COMMENT_ADDED = 'comment_added',
  PROJECT_INVITE = 'project_invite',
}

export enum CommentVisibility {
  INTERNAL = 'internal',
  CLIENT = 'client',
}

/** Procurement lifecycle. Products enter at TO_ORDER once approved. */
export enum OrderStatus {
  NONE = 'none',
  TO_ORDER = 'to_order',
  ORDERED = 'ordered',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  INSTALLED = 'installed',
}

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}
