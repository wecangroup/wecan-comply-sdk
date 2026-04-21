import type { HttpClientMethods } from '../../http/HttpClient.js';
import type { WorkspaceUuid } from '../../types/index.js';

/**
 * Interface for workspace-specific HTTP client
 */
export interface WorkspaceClient extends HttpClientMethods {}

/**
 * Base interface for feature modules that need access to HTTP client
 */
export interface FeatureContext {
    getWorkspaceClient: (workspaceUuid: WorkspaceUuid) => WorkspaceClient;
}

