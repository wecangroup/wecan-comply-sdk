import type {
    WorkspaceUuid,
    VaultUuid,
    Vault,
    VaultAnswer,
    VaultAnswerContent,
    VaultAnswerContentEntry,
    PushCategory,
    VaultPlaceholder
} from '../../types';
import type { FeatureContext } from './BaseFeature';
import { getPublicKey } from '../../services/key-store';
import { prepareInlineContent, prepareFileContent, uploadVaultFile } from './vault-content';
import { getAnswerContents, processMissingShareableAnswerContent, validate, shareContent } from './vault-sharing';
import { createVaultWithForms } from './vault-creation';
// @ts-ignore
import { decryptForMyWorkspace, unpadData } from '../../services/encryption.js';

/**
 * Map raw API answer contents to decrypted VaultAnswer[] (shared by getVaultAnswers and getPushFormAnswerContents)
 */
async function decryptAnswerContents(
    workspaceUuid: WorkspaceUuid,
    rawResults: any[]
): Promise<VaultAnswer[]> {
    return Promise.all(
        rawResults.map(async (answer: any): Promise<VaultAnswer> => {
            const contentList = Array.isArray(answer.content) ? answer.content : [answer.content];
            const content: VaultAnswerContent[] = await Promise.all(
                contentList.map(async (item: any): Promise<VaultAnswerContent> => {
                    const entries: VaultAnswerContentEntry[] = await Promise.all(
                        (item.entries || []).map(async (entry: any): Promise<VaultAnswerContentEntry> => {
                            let contentDecrypted: string | undefined;

                            if (entry.content_format === 'inline' && entry.content) {
                                try {
                                    const decrypted = await decryptForMyWorkspace(workspaceUuid, entry.content, 'text');
                                    contentDecrypted = entry.content_is_padded ? unpadData(decrypted) : decrypted;
                                } catch (error) {
                                    console.error(`Failed to decrypt entry ${entry.uuid}:`, error);
                                    contentDecrypted = undefined;
                                }
                            }

                            return {
                                uuid: entry.uuid,
                                content_format: entry.content_format,
                                content_hash: entry.content_hash,
                                content_is_padded: entry.content_is_padded,
                                content: contentDecrypted ?? (entry.content_format === 'file' ? entry.content : ''),
                            };
                        })
                    );
                    return { uuid: item.uuid, entries };
                })
            );
            return {
                uuid: answer.uuid,
                source_uuid: answer.source_uuid,
                answer_pool_uuid: answer.answer_pool_uuid,
                item_uuid: answer.item_uuid,
                version: answer.version,
                content,
                min_expiration_date: answer.min_expiration_date,
            };
        })
    );
}

/**
 * Vault-related API functions
 */
export class VaultFeature {
    constructor(private context: FeatureContext) { }

    async getAllVaults(workspaceUuid: WorkspaceUuid): Promise<Vault[]> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        const response = await workspaceClient.get<{ results: any[] }>('/api/forms/answer-pools/?storage_type=block');
        return response.results.map((vault: any) => ({
            uuid: vault.uuid,
            name: vault.name,
            template_type: vault.template_type,
            status: vault.status,
            last_updated: vault.last_updated,
        }));
    }

    async getVaultPlaceholders(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid): Promise<VaultPlaceholder[]> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        return await workspaceClient.get<VaultPlaceholder[]>(`/api/templates/item-placeholders/?in_answer_pool_uuid=${vaultId}`);
    }

    async getVaultAnswers(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid): Promise<VaultAnswer[]> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        const response = await workspaceClient.get<{ results: any[] }>(
            `/api/forms/answers/contents/?answer_pool_uuid=${vaultId}&is_latest=true`
        );
        return decryptAnswerContents(workspaceUuid, response.results);
    }

    /**
     * Get answer contents for a push form by its UUID (decrypted)
     * @param workspaceUuid - The UUID of the workspace
     * @param pushFormUuid - The UUID of the push form
     * @returns Answer contents (results and count), with inline content decrypted
     */
    async getPushFormAnswerContents(
        workspaceUuid: WorkspaceUuid,
        pushFormUuid: string
    ): Promise<{ results: VaultAnswer[]; count: number }> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        const response = await getAnswerContents(workspaceClient, { in_push_form_uuid: pushFormUuid });
        const results = await decryptAnswerContents(workspaceUuid, response.results);
        return { results, count: response.count };
    }

    async lockVault(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid): Promise<void> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        await workspaceClient.post(`/api/forms/answer-pools/${vaultId}/actions/lock/`);
    }

    async unlockVault(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid): Promise<void> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        await workspaceClient.post(`/api/forms/answer-pools/${vaultId}/actions/unlock/`);
    }

    async saveVaultAnswers(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid, answers: VaultAnswer[]): Promise<void> {
        // Lock the vault before making changes
        await this.lockVault(workspaceUuid, vaultId);

        try {
            const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);

            // Get workspace public key for encryption
            const workspacePublicKey = getPublicKey(workspaceUuid);
            if (!workspacePublicKey) {
                throw new Error(`Workspace public key not found for workspace ${workspaceUuid}`);
            }

            // Process each answer and send it individually
            for (const answer of answers) {
                // Process content items and entries
                const content = await Promise.all(
                    answer.content.map(async (contentItem) => {
                        const entries = await Promise.all(
                            contentItem.entries.map(async (entry) => {
                                // Only process inline entries with decrypted content
                                if (entry.content_format === 'inline' && entry.new_content) {
                                    return await prepareInlineContent(entry, workspacePublicKey);
                                } else if (entry.content_format === 'file' && entry.new_content) {
                                    return await prepareFileContent(entry, workspaceUuid, workspaceClient);
                                }

                                // For non-inline entries or entries without decrypted content, return as-is
                                return {
                                    uuid: entry.uuid,
                                    content_format: entry.content_format,
                                    content_is_padded: entry.content_is_padded,
                                    content_hash: entry.content_hash,
                                    content: entry.content,
                                };
                            })
                        );

                        return {
                            uuid: contentItem.uuid,
                            entries,
                        };
                    })
                );

                // Build the answer object in the format expected by the API
                const answerPayload = {
                    source_uuid: answer.source_uuid,
                    content,
                };

                // Save the answer individually
                await workspaceClient.post('/api/forms/answers/contents/', answerPayload);
            }
        } finally {
            // Always unlock the vault, even if an error occurred
            await this.unlockVault(workspaceUuid, vaultId);
        }
    }

    async downloadVaultFile(workspaceUuid: WorkspaceUuid, fileUuid: string, fileMimetype: string): Promise<Blob> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        const encryptedFileContent = await workspaceClient.get<string>(`/api/forms/answers/contents/files/${fileUuid}`);
        try {
            const data = await decryptForMyWorkspace(workspaceUuid, encryptedFileContent, 'binary');
            return new Blob([data], { type: fileMimetype });
        } catch (error) {
            console.error(`Failed to decrypt file ${fileUuid}:`, error);
            throw error;
        }
    }

    async getPushCategories(workspaceUuid: WorkspaceUuid, templateType?: string): Promise<PushCategory[]> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        const pushCategories = await workspaceClient.get<PushCategory[]>(
            `/api/templates/directory-templates/push-categories/?${templateType ? `template_type=${templateType}` : ''}`);

        return pushCategories.map((category: PushCategory) => ({
            uuid: category.uuid,
            label: category.label,
            push_template_uuids: category.push_template_uuids,
        }));
    }

    async createVault(workspaceUuid: WorkspaceUuid, name: string, templateType: string, pushCategoryUuid: string, relationUuids: string[]): Promise<Vault> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);

        // Get push templates
        const pushCategories = await this.getPushCategories(workspaceUuid, templateType);
        const pushCategory = pushCategories.find((category: any) => category.uuid === pushCategoryUuid);
        if (!pushCategory) {
            throw new Error(`Push category ${pushCategoryUuid} not found`);
        }

        return await createVaultWithForms(
            workspaceClient,
            name,
            templateType,
            pushCategory,
            relationUuids
        );
    }

    async shareVault(workspaceUuid: WorkspaceUuid, vaultId: VaultUuid, relationUuid: string): Promise<void> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        const answerPool = await workspaceClient.get<any>(`/api/forms/answer-pools/${vaultId}`);

        const pushForm = answerPool.push_forms.find((pushForm: any) =>
            pushForm.relation_push_forms.some((relationPushForm: any) =>
                relationPushForm.relation?.uuid === relationUuid
            )
        );

        if (!pushForm) {
            throw new Error(`Push form not found for relation ${relationUuid}`);
        }

        const relationPushForm = pushForm.relation_push_forms.find((relationPushForm: any) =>
            relationPushForm.relation?.uuid === relationUuid
        );

        console.log('pushForm:', pushForm);
        console.log('relationPushForm:', relationPushForm);

        if (relationPushForm.has_missing_shareable_answer_content) {
            await processMissingShareableAnswerContent(
                pushForm.uuid,
                workspaceUuid,
                workspaceClient,
                (uuid, fileUuid, mimetype) => this.downloadVaultFile(uuid, fileUuid, mimetype),
                uploadVaultFile
            );
        }

        const appliedWorkflowUuid = pushForm.applied_workflow?.uuid;
        if (!appliedWorkflowUuid) {
            throw new Error('Applied workflow not found');
        }
        
        await validate(workspaceClient, appliedWorkflowUuid);
        await shareContent(workspaceClient, relationPushForm.uuid);
    }
}
