import { HttpClientLike as HttpClient, HttpMethod, HeadersInitLike } from '../http/HttpClient';
import axios from 'axios';
import type { AxiosError } from 'axios';
import { createAxiosHttpClient } from '../http/axiosAdapter';
import axiosRetry from 'axios-retry';
import type { 
    WorkspaceUuid, 
    WorkspaceDetails, 
    WorkspacePrivateKey,
    BusinessType,
    PushCategory,
    Relation,
    NetworkEntry,
    VaultUuid,
    VaultAnswer,
    Vault,
    VaultPlaceholder } from '../types';
import { setWorkspaceKeys } from '../services/key-store';
import { WorkspaceFeature } from './features/workspace';
import { VaultFeature } from './features/vault';
import type { FeatureContext, WorkspaceClient } from './features/BaseFeature';

/**
 * Configuration for workspace keys (public and private)
 */
export interface WorkspaceKeyConfig {
    /** The UUID of the workspace */
    workspaceUuid: WorkspaceUuid;
    /** The private key for the workspace (PGP format) */
    privateKey: WorkspacePrivateKey;
}

/**
 * Options for creating a WecanComply SDK instance
 */
export interface WecanComplyOptions {
    /** Access token for authentication */
    accessToken: string;
    /** List of workspace private keys to load */
    workspaceKeys?: WorkspaceKeyConfig[];
    /** Request timeout in milliseconds (default: 30000) */
    timeoutMs?: number;
    /** Number of retries for failed requests (default: 2) */
    retries?: number;
    /** Custom HTTP client implementation */
    http?: HttpClient;
    /** Default headers for all requests */
    defaultHeaders?: HeadersInitLike;
    /** Callback function called when a 401 Unauthorized error occurs */
    onUnauthorized?: (error: Error) => void | Promise<void>;
    /** Template for workspace URLs, e.g., 'https://{workspaceUuid}.int.wecancomply.ch' */
    workspaceUrlTemplate: string;
    /** Enable debug logging for workspace client requests (default: false) */
    debug?: boolean;
}

function joinUrl(baseUrl: string, path: string): string {
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
}

/**
 * Main SDK class for interacting with the Wecan Comply API
 * 
 * @example
 * ```typescript
 * const sdk = await WecanComply.create({
 *   accessToken: 'your-access-token',
 *   workspaceUrlTemplate: 'https://{workspaceUuid}.int.wecancomply.ch',
 *   workspaceKeys: [{
 *     workspaceUuid: 'workspace-uuid',
 *     privateKey: '-----BEGIN PGP PRIVATE KEY BLOCK-----...'
 *   }]
 * });
 * 
 * const vaults = await sdk.getAllVaults('workspace-uuid');
 * ```
 */
export class WecanComply {
    private readonly http: HttpClient;
    private readonly accessToken: string;
    private readonly timeoutMs: number;
    private readonly retries: number;
    private readonly defaultHeaders: HeadersInitLike;
    private readonly workspaceUrlTemplate: string;
    private readonly onUnauthorized?: (error: Error) => void | Promise<void>;
    private readonly debug: boolean;
    
    // Feature modules
    public readonly workspace: WorkspaceFeature;
    public readonly vault: VaultFeature;

    private constructor(options: WecanComplyOptions) {
        this.accessToken = options.accessToken;
        this.timeoutMs = options.timeoutMs ?? 30_000;
        this.retries = options.retries ?? 2;
        this.workspaceUrlTemplate = options.workspaceUrlTemplate;
        this.debug = options.debug ?? false;
        
        if (options.http) {
            this.http = options.http;
        } else {
            const axiosInstance = axios.create();
            axiosRetry(axiosInstance, {
                retries: this.retries,
                retryDelay: axiosRetry.exponentialDelay,
                retryCondition: (error: AxiosError) => {
                    const status = error.response?.status;
                    if (!status) return true; // network/timeouts
                    return status === 408 || status === 429 || (status >= 500 && status < 600);
                },
            });
            this.http = createAxiosHttpClient(axiosInstance);
        }
        this.defaultHeaders = options.defaultHeaders ?? { 'content-type': 'application/json' };
        this.onUnauthorized = options.onUnauthorized;

        // Initialize feature modules
        const featureContext: FeatureContext = {
            getWorkspaceClient: (workspaceUuid: WorkspaceUuid) => this.getWorkspaceClient(workspaceUuid),
        };
        
        this.workspace = new WorkspaceFeature(featureContext);
        this.vault = new VaultFeature(featureContext);
    }

    /**
     * Factory method that creates a configured WecanComply SDK instance
     * 
     * @param options - Configuration options for the SDK instance
     * @returns A configured WecanComply instance
     * 
     * @example
     * ```typescript
     * const sdk = await WecanComply.create({
     *   accessToken: 'your-access-token',
     *   workspaceUrlTemplate: 'https://{workspaceUuid}.int.wecancomply.ch',
     *   workspaceKeys: [{
     *     workspaceUuid: 'workspace-uuid',
     *     privateKey: '-----BEGIN PGP PRIVATE KEY BLOCK-----...'
     *   }],
     *   debug: true // Enable logging of workspace API calls
     * });
     * ```
     */
    static async create(options: WecanComplyOptions): Promise<WecanComply> {
        const retries = options.retries ?? 2;

        const axiosInstance = axios.create();
        axiosRetry(axiosInstance, {
            retries,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (error: AxiosError) => {
                const status = error.response?.status;
                if (!status) return true;
                return status === 408 || status === 429 || (status >= 500 && status < 600);
            },
        });

        // Build instance using the axios instance (with retries)
        const instance = new WecanComply({
            ...options,
            http: createAxiosHttpClient(axiosInstance),
        });

        // Load workspace keys if provided
        if (options.workspaceKeys && options.workspaceKeys.length > 0) {
            await instance.loadWorkspaceKeys(options.workspaceKeys);
        }

        return instance;
    }

    private buildHeaders(extra?: HeadersInitLike): HeadersInitLike {
        const headers: HeadersInitLike = { ...this.defaultHeaders, ...extra };
        headers['authorization'] = `API-Key ${this.accessToken}`;
        return headers;
    }

    private async send<T>(method: HttpMethod, path: string, baseUrl: string, body?: unknown, headers?: HeadersInitLike): Promise<T> {
        const url = joinUrl(baseUrl, path);
        try {
            const response = await this.http.request<T>({
                method,
                url,
                body,
                headers: this.buildHeaders(headers),
                timeoutMs: this.timeoutMs,
            });
            return response.data;
        } catch (err: any) {
            const status: number | undefined = err?.status ?? err?.response?.status;
            // On 401, call onUnauthorized callback if provided
            if (status === 401 && this.onUnauthorized) {
                await this.onUnauthorized(new Error('Unauthorized'));
            }
            throw err;
        }
    }

    /**
     * Load workspace keys from provided configuration and fetch public keys from API
     * @private
     */
    private async loadWorkspaceKeys(workspaceKeys: WorkspaceKeyConfig[]): Promise<void> {
        for (const { workspaceUuid, privateKey } of workspaceKeys) {
            try {
                // Fetch workspace public key from API
                const workspaceDetails = await this.getWorkspaceDetails(workspaceUuid);
                
                if (!workspaceDetails?.public_key) {
                    throw new Error(`Failed to get workspace public key for workspace ${workspaceUuid}`);
                }

                // Store both public and private keys
                setWorkspaceKeys(workspaceUuid, {
                    public: workspaceDetails.public_key,
                    private: privateKey,
                });
            } catch (error) {
                console.error(`Failed to load keys for workspace ${workspaceUuid}:`, error);
                throw error;
            }
        }
    }

    /**
     * Get a workspace-specific HTTP client for making API calls to workspace endpoints
     * @param workspaceUuid - The UUID of the workspace
     * @returns A workspace client (with optional debug logging if enabled)
     */
    getWorkspaceClient(workspaceUuid: WorkspaceUuid): WorkspaceClient {
        const normalizedUuid = workspaceUuid.includes('-') ? workspaceUuid.replace(/-/g, '') : workspaceUuid;
        const workspaceBaseUrl = this.workspaceUrlTemplate.replace('{workspaceUuid}', normalizedUuid);
        
        const logRequest = (method: string, path: string, body?: unknown) => {
            if (!this.debug) {
                return;
            }
            const fullUrl = joinUrl(workspaceBaseUrl, path);
            const logData: any = {
                method,
                url: fullUrl,
                workspaceUuid: normalizedUuid,
            };
            if (body !== undefined) {
                // For FormData, just indicate it's a form
                if (body instanceof FormData) {
                    logData.body = '[FormData]';
                } else {
                    logData.body = body;
                }
            }
            console.log('[WorkspaceClient]', JSON.stringify(logData, null, 2));
        };
        
        return {
            get: <T = unknown>(path: string, headers?: HeadersInitLike) => {
                logRequest('GET', path);
                return this.send<T>('GET', path, workspaceBaseUrl, undefined, headers);
            },
            post: <T = unknown>(path: string, body?: unknown, headers?: HeadersInitLike) => {
                logRequest('POST', path, body);
                return this.send<T>('POST', path, workspaceBaseUrl, body, headers);
            },
            put: <T = unknown>(path: string, body?: unknown, headers?: HeadersInitLike) => {
                logRequest('PUT', path, body);
                return this.send<T>('PUT', path, workspaceBaseUrl, body, headers);
            },
            patch: <T = unknown>(path: string, body?: unknown, headers?: HeadersInitLike) => {
                logRequest('PATCH', path, body);
                return this.send<T>('PATCH', path, workspaceBaseUrl, body, headers);
            },
            delete: <T = unknown>(path: string, headers?: HeadersInitLike) => {
                logRequest('DELETE', path);
                return this.send<T>('DELETE', path, workspaceBaseUrl, undefined, headers);
            },
        };
    }

    /**
     * Get workspace details including public key
     * @param workspaceUuid - The UUID of the workspace
     * @returns Workspace details including UUID, URL, name, business type, and public key
     */
    async getWorkspaceDetails(workspaceUuid: WorkspaceUuid): Promise<WorkspaceDetails> {
        return this.workspace.getWorkspaceDetails(workspaceUuid);
    }

    /**
     * Get available business types for a workspace
     * @param workspaceUuid - The UUID of the workspace
     * @param availableForBusinessType - Optional filter for business types available for a specific business type
     * @returns List of available business types
     */
    async getBusinessTypes(workspaceUuid: WorkspaceUuid, availableForBusinessType?: string): Promise<BusinessType[]> {
        return this.workspace.getBusinessTypes(workspaceUuid, availableForBusinessType);
    }

    /**
     * Get active relations for a workspace
     * @param workspaceUuid - The UUID of the workspace
     * @returns List of active relations with their details
     */
    async getRelations(workspaceUuid: WorkspaceUuid): Promise<Relation[]> {
        return this.workspace.getRelations(workspaceUuid);
    }

    /**
     * Get network entries for a workspace
     * @param workspaceUuid - The UUID of the workspace
     * @param businessType - Optional filter by business type
     * @returns List of network entries
     */
    async getNetworkEntries(workspaceUuid: WorkspaceUuid, businessType?: string): Promise<NetworkEntry[]> {
        return this.workspace.getNetworkEntries(workspaceUuid, businessType);
    }

    /**
     * Get all vaults (answer pools) for a workspace
     * @param workspaceUuid - The UUID of the workspace
     * @returns List of vaults with their basic information
     */
    async getAllVaults(workspaceUuid: WorkspaceUuid): Promise<Vault[]> {
        return this.vault.getAllVaults(workspaceUuid);
    }

    /**
     * Get vault placeholders (template structure) for a specific vault
     * @param workspaceUuid - The UUID of the workspace
     * @param vaultId - The UUID of the vault
     * @returns List of vault placeholders defining the structure of the vault
     */
    async getVaultPlaceholders(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid): Promise<VaultPlaceholder[]> {
        return this.vault.getVaultPlaceholders(workspaceUuid, vaultId);
    }

    /**
     * Get vault answers (decrypted content) for a specific vault
     * @param workspaceUuid - The UUID of the workspace
     * @param vaultId - The UUID of the vault
     * @returns List of vault answers with decrypted inline content
     */
    async getVaultAnswers(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid): Promise<VaultAnswer[]> {
        return this.vault.getVaultAnswers(workspaceUuid, vaultId);
    }

    /**
     * Download and decrypt a file from a vault
     * @param workspaceUuid - The UUID of the workspace
     * @param fileUuid - The UUID of the file to download
     * @param fileMimetype - The MIME type of the file
     * @returns Decrypted file content as a Blob
     */
    async downloadVaultFile(workspaceUuid: WorkspaceUuid, fileUuid: string, fileMimetype: string): Promise<Blob> {
        return this.vault.downloadVaultFile(workspaceUuid, fileUuid, fileMimetype);
    }

    /**
     * Lock a vault to prevent concurrent modifications
     * @param workspaceUuid - The UUID of the workspace
     * @param vaultId - The UUID of the vault to lock
     */
    async lockVault(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid): Promise<void> {
        return this.vault.lockVault(workspaceUuid, vaultId);
    }

    /**
     * Unlock a vault to allow modifications
     * @param workspaceUuid - The UUID of the workspace
     * @param vaultId - The UUID of the vault to unlock
     */
    async unlockVault(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid): Promise<void> {
        return this.vault.unlockVault(workspaceUuid, vaultId);
    }

    /**
     * Save vault answers (encrypts and saves modified answers)
     * @param workspaceUuid - The UUID of the workspace
     * @param vaultId - The UUID of the vault
     * @param answers - List of vault answers to save (only entries with new_content will be updated)
     */
    async saveVaultAnswers(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid, answers: any): Promise<void> {
        return this.vault.saveVaultAnswers(workspaceUuid, vaultId, answers);
    }

    /**
     * Get push categories for a workspace
     * @param workspaceUuid - The UUID of the workspace
     * @param templateType - Optional filter by template type
     * @returns List of push categories with their template UUIDs
     */
    async getPushCategories(workspaceUuid: WorkspaceUuid, templateType?: string): Promise<PushCategory[]> {
        return this.vault.getPushCategories(workspaceUuid, templateType);
    }

    /**
     * Create a new vault with push forms and relations
     * @param workspaceUuid - The UUID of the workspace
     * @param name - Name of the vault
     * @param templateType - Type of template to use
     * @param pushCategoryUuid - UUID of the push category
     * @param relationUuids - List of relation UUIDs to associate with the vault
     * @returns The created vault
     */
    async createVault(workspaceUuid: WorkspaceUuid, name: string, templateType: string, pushCategoryUuid: string, relationUuids: string[]): Promise<Vault> {
        return this.vault.createVault(workspaceUuid, name, templateType, pushCategoryUuid, relationUuids);
    }

    /**
     * Share a vault with a relation (processes missing shareable answer content)
     * @param workspaceUuid - The UUID of the workspace
     * @param vaultId - The UUID of the vault to share
     * @param relationUuid - The UUID of the relation to share with
     */
    async shareVault(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid, relationUuid: string): Promise<void> {
        return this.vault.shareVault(workspaceUuid, vaultId, relationUuid);
    }
}