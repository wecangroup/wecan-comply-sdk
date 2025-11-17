import type { WorkspaceUuid } from '../../types';
import type { WorkspaceClient } from './BaseFeature';
// @ts-ignore
import { decryptForMyWorkspace, encryptForKeys } from '../../services/encryption.js';

/**
 * Get answer contents from API with query parameters
 */
export async function getAnswerContents(
    workspaceClient: WorkspaceClient,
    params: Record<string, any> = {}
): Promise<{ results: any[]; count: number }> {
    const queryString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');

    const answerContentsResponse = await workspaceClient.get<{ results: any[]; count: number }>(
        `/api/forms/answers/contents/?${queryString}`
    );
    
    if (answerContentsResponse.results.length) {
        for (const item of answerContentsResponse.results) {
            if (!Array.isArray(item.content)) {
                item.content = [item.content];
            }
        }
    }

    return answerContentsResponse;
}

/**
 * Create payload for sharing answer content with relations
 */
export async function createShareablePayload(
    workspaceClient: WorkspaceClient,
    workspaceUuid: WorkspaceUuid,
    answerContent: any,
    downloadVaultFile: (workspaceUuid: WorkspaceUuid, fileUuid: string, fileMimetype: string) => Promise<Blob>,
    uploadVaultFile: (workspaceClient: WorkspaceClient, formData: FormData) => Promise<{ uuid: string }>
): Promise<any> {
    const shareableRelations = await workspaceClient.get<{ results: any[] }>(`/api/relations/?available_for_sharing=true`);

    const shareableRelationsUuids = new Set(
        shareableRelations.results.map((r: any) => r.uuid),
    );
    // Filter out null/undefined public keys and ensure they exist
    const shareableRelationsPublicKeys = shareableRelations.results
        .map((r: any) => r.workspace_details?.public_key)
        .filter((key: string | null | undefined): key is string => !!key && typeof key === 'string');

    if (shareableRelationsPublicKeys.length === 0) {
        throw new Error('No valid public keys found for shareable relations');
    }

    const shareableAnswerValues = [];
    for (const answerValue of answerContent.content) {
        const shareableEntryValues = [];
        for (const entryValue of answerValue.entries) {
            const {
                uuid,
                content_format,
                expiration_date,
                content,
                content_is_padded,
            } = entryValue;

            let decryptedContent;
            let shareableContent;
            if (content_format === 'file') {
                // During the migration of content for files, certain content where set to null
                // to still indicate that something existed. With the new implementation,
                // empty content == no value as entryValue.
                if (content === undefined) {
                    continue;
                }

                const blob = await downloadVaultFile(
                    workspaceUuid,
                    content.file_uuid,
                    content.file_mimetype,
                );

                const binary = new Uint8Array(await blob.arrayBuffer());
                decryptedContent = binary;
                const reencryptedContent = await encryptForKeys(
                    shareableRelationsPublicKeys,
                    binary,
                    'binary',
                );

                const formData = new FormData();
                formData.append(
                    'file',
                    new File([reencryptedContent], content.file_name, {
                        type: content.file_mimetype,
                    }),
                );

                const { uuid: fileUuid } = await uploadVaultFile(
                    workspaceClient,
                    formData,
                );

                shareableContent = {
                    file_uuid: fileUuid,
                    file_name: content.file_name,
                    file_mimetype: content.file_mimetype,
                };
            } else {
                console.log('content:', content);
                decryptedContent = await decryptForMyWorkspace(
                    workspaceUuid,
                    content,
                );

                console.log('decryptedContent:', decryptedContent);

                shareableContent = await encryptForKeys(
                    shareableRelationsPublicKeys,
                    decryptedContent,
                );
            }

            shareableEntryValues.push({
                uuid,
                content_format,
                expiration_date,
                content_is_padded,
                content: shareableContent,
            });
        }

        shareableAnswerValues.push({
            uuid: answerValue.uuid,
            entries: shareableEntryValues,
        });
    }

    return {
        relation_uuids: [...shareableRelationsUuids],
        content: shareableAnswerValues,
    };
}

/**
 * Update shareable answer content
 */
export async function updateShareableAnswerContent(
    workspaceClient: WorkspaceClient,
    answerContentUuid: string,
    payload: any
): Promise<any> {
    const response = await workspaceClient.post(
        `/api/forms/answers/contents/${answerContentUuid}/actions/update-shareable-answer-content/`,
        payload
    );
    return response;
}

/**
 * Process missing shareable answer content
 */
export async function processMissingShareableAnswerContent(
    pushFormUuid: string,
    workspaceUuid: WorkspaceUuid,
    workspaceClient: WorkspaceClient,
    downloadVaultFile: (workspaceUuid: WorkspaceUuid, fileUuid: string, fileMimetype: string) => Promise<Blob>,
    uploadVaultFile: (workspaceClient: WorkspaceClient, formData: FormData) => Promise<{ uuid: string }>
): Promise<void> {
    const params = {
        in_push_form_uuid: pushFormUuid,
        answer_pool_status: 'active',
        has_missing_shareable: true,
        is_latest: true,
        limit: 10
    };

    let data = await getAnswerContents(workspaceClient, params);

    const toProcessCount = data.count;
    let processedCount = 0;

    if (!toProcessCount) {
        return;
    }

    while (data.count > 0 && processedCount <= toProcessCount) {
        await Promise.all(
            data.results.map(async answerContent => {
                const payload = await createShareablePayload(
                    workspaceClient,
                    workspaceUuid,
                    answerContent,
                    downloadVaultFile,
                    uploadVaultFile
                );

                await updateShareableAnswerContent(
                    workspaceClient,
                    answerContent.uuid,
                    payload,
                );

                processedCount++;
            }),
        );

        data = await getAnswerContents(workspaceClient, params);
    }
}

export async function validate(workspaceClient: WorkspaceClient, appliedWorkflowUuid: string): Promise<any> {
    const response = await workspaceClient.post(
        `/api/applied-workflows/${appliedWorkflowUuid}/actions/validate/`,
    );
    return response;
}

export async function shareContent(workspaceClient: WorkspaceClient, relationPushFormUuid: string): Promise<any> {
    const payload = {
        comment_enc: undefined
    };

    return await workspaceClient.post(
        `/api/forms/relation-push-forms/${relationPushFormUuid}/communications/share-content/`,
        payload
    );
}