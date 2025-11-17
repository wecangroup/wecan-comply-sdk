import type { VaultAnswerContentEntry, WorkspaceUuid } from '../../types';
import type { WorkspaceClient } from './BaseFeature';
// @ts-ignore
import { hashData, encryptForKeys, padData } from '../../services/encryption.js';
import { getPublicKey } from '../../services/key-store';

/**
 * Prepare inline content for API submission by padding, hashing, and encrypting
 */
export async function prepareInlineContent(
    entry: VaultAnswerContentEntry,
    workspacePublicKey: string
): Promise<{
    uuid: string;
    content_format: 'inline';
    content_is_padded: boolean;
    content_hash: string;
    content: string;
}> {
    // Pad data
    const contentToEncrypt = padData(entry.new_content!);
    // Hash data on decrypted content
    const contentHash = await hashData(contentToEncrypt);
    // Encrypt data
    const encryptedResult = await encryptForKeys([workspacePublicKey], contentToEncrypt, 'text');

    // Return entry in the format expected by the API
    return {
        uuid: entry.uuid,
        content_format: 'inline' as const,
        content_is_padded: true,
        content_hash: contentHash,
        content: encryptedResult,
    };
}

/**
 * Prepare file content for API submission by encrypting, uploading, and hashing
 */
export async function prepareFileContent(
    entry: VaultAnswerContentEntry,
    workspaceUuid: WorkspaceUuid,
    workspaceClient: WorkspaceClient
): Promise<{
    uuid: string;
    content_format: 'file';
    content_hash: string;
    content: {
        file_uuid: string;
        file_name: string;
        file_mimetype: string;
    };
}> {
    const fileContent = entry.new_content as File;
    const binary = new Uint8Array(await fileContent.arrayBuffer());
    const encryptedContent = await encryptForKeys([getPublicKey(workspaceUuid)], binary, 'binary');
    const encryptedFile = new Blob([encryptedContent]);

    const formData = new FormData();
    formData.append('file', encryptedFile);
    const { uuid: fileUuid } = await uploadVaultFile(workspaceClient, formData);

    return {
        uuid: entry.uuid,
        content_hash: await hashData(binary),
        content_format: 'file' as const,
        content: {
            file_uuid: fileUuid,
            file_name: fileContent.name,
            file_mimetype: fileContent.type,
        }
    };
}

/**
 * Upload a file to the vault
 */
export async function uploadVaultFile(workspaceClient: WorkspaceClient, formData: FormData): Promise<{ uuid: string }> {
    const response = await workspaceClient.post(`/api/forms/answers/contents/actions/upload-file/`, formData);
    const fileUuid = (response as { uuid: string }).uuid;
    return { uuid: fileUuid };
}

