export type WorkspaceUuid = string;
export type VaultUuid = string;

export type UserPrivateKey = string;
export type UserPublicKey = string;

export type WorkspacePrivateKey = string;
export type WorkspacePublicKey = string;

export interface UserWorkspace {
    workspace_uuid: WorkspaceUuid;
    has_key: boolean;
}

export interface CurrentUser {
    uuid: string;
    account: {
        uuid: string;
    };
    email: string;
    nickname: string;
    workspaces: UserWorkspace[];
    is_account_admin: boolean;
    is_external: boolean;
    has_seen_onboarding: boolean;
    public_key: UserPublicKey;
    private_key_enc: string;
}

export interface WorkspaceDetails {
    uuid: WorkspaceUuid;
    url: string;
    name: string;
    business_type: string;
    public_key: WorkspacePublicKey;
}

export interface BusinessType {
    label: string;
    value: string;
}

export interface Vault {
    uuid: VaultUuid;
    name: string;
    status: string;
    template_type: string;
    last_updated: Date;
}

export interface BusinessTypeWorkflow {
    business_type: string;
    workflow_uuid: string | null;
}

export interface VaultPlaceholderContent {
    uuid: string;
    label: string;
    details?: string;
}

export interface VaultPlaceholderCategory {
    uuid: string;
    order: number;
    label: string;
}

export interface VaultPlaceholderEntryContent {
    uuid: string;
    label: string;
}

export interface VaultPlaceholderEntry {
    uuid: string;
    order: number;
    content: VaultPlaceholderEntryContent;
    metadata: Record<string, any>;
    field_type: string;
    is_expiration_date_allowed: boolean;
    linked_files: any[];
}

export interface VaultPlaceholderCategorizationCategory {
    label: string;
    order: number;
}

export interface VaultPlaceholderCategorization {
    category: VaultPlaceholderCategorizationCategory;
    order: number;
}

export interface VaultPlaceholderItemDetail {
    uuid: string;
    is_multi_answers: boolean;
    categorization: VaultPlaceholderCategorization;
    content: VaultPlaceholderContent;
    entries: VaultPlaceholderEntry[];
}

export interface VaultPlaceholderItem {
    uuid: string;
    category_uuid: string;
    order: number;
    item: VaultPlaceholderItemDetail;
}

export interface VaultPlaceholder {
    uuid: string;
    pull_business_types: BusinessTypeWorkflow[];
    push_business_types: BusinessTypeWorkflow[];
    name_template: string;
    content: VaultPlaceholderContent;
    categories: VaultPlaceholderCategory[];
    items: VaultPlaceholderItem[];
    sync_status: string;
    last_synced: string;
    created_at: string;
    updated_at: string;
    template_type: string;
}

export interface VaultAnswer {
    uuid: string;
    source_uuid: string;
    answer_pool_uuid: string;
    item_uuid: string;
    version: number;
    content: VaultAnswerContent[];
    min_expiration_date: Date;
}

export interface VaultAnswerContent {
    uuid: string;
    entries: VaultAnswerContentEntry[];
}

export interface VaultAnswerContentEntry {
    uuid: string;
    content_format: 'inline' | 'file';
    content_hash: string;
    content_is_padded: boolean;
    content: string | EntryContentFile;
    new_content?: string | File;
    // content_decrypted?: string;
}

export interface EntryContentFile {
    file_uuid: string;
    file_name: string;
    file_mimetype: string;
}

export interface Relation {
    uuid: string;
    status: string;
    business_type: string;
    name: string;
    is_virtual: boolean;
    public_key: string;
}

export interface NetworkEntry {
    uuid: string;
    status: string;
    name: string;
    is_virtual: boolean;
    business_type: string;
    public_key: string;
    url: string;
    description: string;
    street: string;
    city: string;
    zip_code: string;
    country: string;
    fax: string;
    phone: string;
    website: string;
    contact_name: string;
    contact_email: string;
}

export interface PushCategory {
    uuid: string;
    label: string;
    push_template_uuids: string[];
}

export type ExternalFormRequestUuid = string;

export type ExternalFormRequestStatus = 'active' | 'archived' | 'expired';

export interface PushTemplate {
    uuid: string;
    label?: string;
    [key: string]: any;
}

export interface NestedPushForm {
    uuid: string;
    [key: string]: any;
}

export interface ExternalFormRequest {
    uuid: ExternalFormRequestUuid;
    push_template: PushTemplate;
    submission_count: number;
    status: ExternalFormRequestStatus;
    url: string;
    push_forms: NestedPushForm[];
    created_at: string;
    updated_at: string;
}

export interface ExternalFormAnswerEntryRequest {
    uuid: string;
    content_format: string;
    content: any;
}

export interface ExternalFormAnswerRequest {
    item_placeholder_uuid: string;
    content: ExternalFormAnswerEntryRequest[];
}

export interface ExternalFormFileUploadResponse {
    file_uuid: string;
    file_name: string;
    file_size: number;
    file_mimetype: string;
}

export interface WorkspaceMetadata {
    uuid: string;
    name: string;
    [key: string]: any;
}

export interface PushTemplateMetadata {
    uuid: string;
    label: string;
    [key: string]: any;
}

export interface ExternalFormRequestMetadata {
    workspace?: WorkspaceMetadata;
    push_template: PushTemplateMetadata;
    status?: string;
    information_text?: string | null;
}

export interface ExternalFormRequestListOptions {
    limit?: number;
    offset?: number;
    push_template_uuid?: string;
    status?: ExternalFormRequestStatus;
    ordering?: string[];
}

export interface PaginatedExternalFormRequestList {
    count: number;
    next?: string | null;
    previous?: string | null;
    results: ExternalFormRequest[];
}