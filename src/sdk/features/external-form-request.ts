import type {
    WorkspaceUuid,
    ExternalFormRequestUuid,
    ExternalFormRequest,
    ExternalFormRequestStatus,
    ExternalFormAnswerRequest,
    ExternalFormFileUploadResponse,
    ExternalFormRequestMetadata,
    PaginatedExternalFormRequestList,
    ExternalFormRequestListOptions
} from '../../types';
import type { FeatureContext } from './BaseFeature';

/**
 * External Form Request-related API functions
 */
export class ExternalFormRequestFeature {
    constructor(private context: FeatureContext) {}

    /**
     * List external form requests
     * @param workspaceUuid - The UUID of the workspace
     * @param options - Optional query parameters for filtering and pagination
     * @returns Paginated list of external form requests
     */
    async listExternalFormRequests(
        workspaceUuid: WorkspaceUuid,
        options?: ExternalFormRequestListOptions
    ): Promise<PaginatedExternalFormRequestList> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        
        const queryParams: string[] = [];
        if (options?.limit !== undefined) {
            queryParams.push(`limit=${encodeURIComponent(options.limit)}`);
        }
        if (options?.offset !== undefined) {
            queryParams.push(`offset=${encodeURIComponent(options.offset)}`);
        }
        if (options?.push_template_uuid) {
            queryParams.push(`push_template_uuid=${encodeURIComponent(options.push_template_uuid)}`);
        }
        if (options?.status) {
            queryParams.push(`status=${encodeURIComponent(options.status)}`);
        }
        if (options?.ordering && options.ordering.length > 0) {
            queryParams.push(`o=${encodeURIComponent(options.ordering.join(','))}`);
        }

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        return await workspaceClient.get<PaginatedExternalFormRequestList>(
            `/api/forms/external-form-requests/${queryString}`
        );
    }

    /**
     * Create a new external form request
     * @param workspaceUuid - The UUID of the workspace
     * @param pushTemplateUuid - The UUID of the push template
     * @param status - Optional status for the external form request
     * @param informationText - Optional text displayed to the user when filling the form
     * @returns The created external form request
     */
    async createExternalFormRequest(
        workspaceUuid: WorkspaceUuid,
        pushTemplateUuid: string,
        status?: ExternalFormRequestStatus,
        informationText?: string | null
    ): Promise<ExternalFormRequest> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        return await workspaceClient.post<ExternalFormRequest>(
            '/api/forms/external-form-requests/',
            {
                push_template_uuid: pushTemplateUuid,
                ...(status && { status }),
                ...(informationText !== undefined && informationText !== null && { information_text: informationText }),
            }
        );
    }

    /**
     * Retrieve a specific external form request
     * @param workspaceUuid - The UUID of the workspace
     * @param uuid - The UUID of the external form request
     * @returns The external form request
     */
    async getExternalFormRequest(
        workspaceUuid: WorkspaceUuid,
        uuid: ExternalFormRequestUuid
    ): Promise<ExternalFormRequest> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        return await workspaceClient.get<ExternalFormRequest>(
            `/api/forms/external-form-requests/${uuid}/`
        );
    }

    /**
     * Get external form request metadata (form structure for rendering)
     * This is a public endpoint that doesn't require authentication
     * @param workspaceUuid - The UUID of the workspace
     * @param uuid - The UUID of the external form request
     * @returns The external form request metadata
     */
    async getExternalFormRequestMetadata(
        workspaceUuid: WorkspaceUuid,
        uuid: ExternalFormRequestUuid
    ): Promise<ExternalFormRequestMetadata> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        return await workspaceClient.get<ExternalFormRequestMetadata>(
            `/api/forms/external-form-requests/public/${uuid}/metadata/`
        );
    }

    /**
     * Upload a file for an external form request
     * This is a public endpoint that doesn't require authentication
     * @param workspaceUuid - The UUID of the workspace
     * @param uuid - The UUID of the external form request
     * @param file - The file to upload (as FormData or File)
     * @returns The uploaded file information
     */
    async uploadExternalFormRequestFile(
        workspaceUuid: WorkspaceUuid,
        uuid: ExternalFormRequestUuid,
        file: File | FormData
    ): Promise<ExternalFormFileUploadResponse> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        
        let formData: FormData;
        if (file instanceof FormData) {
            formData = file;
        } else {
            formData = new FormData();
            formData.append('file', file);
        }

        return await workspaceClient.post<ExternalFormFileUploadResponse>(
            `/api/forms/external-form-requests/public/${uuid}/actions/upload-file/`,
            formData
        );
    }

    /**
     * Submit external form request answers
     * This is a public endpoint that doesn't require authentication
     * @param workspaceUuid - The UUID of the workspace
     * @param uuid - The UUID of the external form request
     * @param answers - Array of answers to submit
     */
    async submitExternalFormRequest(
        workspaceUuid: WorkspaceUuid,
        uuid: ExternalFormRequestUuid,
        answers: ExternalFormAnswerRequest[]
    ): Promise<void> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        await workspaceClient.post(
            `/api/forms/external-form-requests/public/${uuid}/actions/submit/`,
            { answers }
        );
    }
}
