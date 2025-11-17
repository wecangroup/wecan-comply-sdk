import type { WorkspaceUuid, VaultUuid, Vault, PushCategory } from '../../types';
import type { WorkspaceClient } from './BaseFeature';

/**
 * Get instanciable forms for push templates
 */
export async function getInstanciableForms(
    workspaceClient: WorkspaceClient,
    pushTemplateUuids: string[],
    relationUuids: string[]
): Promise<any[]> {
    const allInstanciableForms: any[] = await workspaceClient.post<any[]>(
        `/api/templates/push-templates/actions/get-instantiable-forms/`,
        {
            push_template_uuids: pushTemplateUuids,
            relation_uuids: relationUuids,
        }
    );

    return allInstanciableForms.filter((form: any) =>
        form.relations.some((relation: any) =>
            relationUuids.length === 0 || relationUuids.includes(relation.uuid)
        )
    );
}

/**
 * Register push forms and relation push forms for a vault
 */
export async function registerPushForms(
    workspaceClient: WorkspaceClient,
    instanciableForms: any[],
    answerPoolUuid: string,
    relationUuids: string[]
): Promise<void> {
    for (const form of instanciableForms.filter((form: any) => !form.missing_specific_relations)) {
        const pushForm = await workspaceClient.post<{ uuid: string }>(
            `/api/forms/push-forms/actions/register/`,
            {
                push_template_uuid: form.push_template.uuid,
                answer_pool_uuid: answerPoolUuid,
            }
        );

        for (const relationUuid of relationUuids) {
            await workspaceClient.post(`/api/forms/relation-push-forms/actions/register/`, {
                push_form_uuid: pushForm.uuid,
                relation_uuid: relationUuid,
            });
        }
    }
}

/**
 * Create a new vault with push forms
 */
export async function createVaultWithForms(
    workspaceClient: WorkspaceClient,
    name: string,
    templateType: string,
    pushCategory: PushCategory,
    relationUuids: string[]
): Promise<Vault> {
    const pushTemplateUuids: string[] = pushCategory.push_template_uuids;

    // Get instanciable forms
    const instanciableForms = await getInstanciableForms(
        workspaceClient,
        pushTemplateUuids,
        relationUuids
    );

    if (instanciableForms.length === 0) {
        throw new Error(
            `No instanciable forms found for push category ${pushCategory.uuid} and relations ${relationUuids.join(', ')}`
        );
    }

    try {
        // Create answer pool
        const answerPool = await workspaceClient.post<Vault>(`/api/forms/answer-pools/`, {
            name: name,
            template_type: templateType,
            storage_type: 'block',
        });

        const answerPoolUuid = answerPool.uuid;

        // Register instanciable forms
        await registerPushForms(workspaceClient, instanciableForms, answerPoolUuid, relationUuids);

        return answerPool;
    } catch (error: any) {
        const errorMessage = error?.message || error?.response?.data?.message || 'Unknown error occurred';
        const errorDetails = error?.response?.data ? JSON.stringify(error.response.data) : '';
        throw new Error(
            `Failed to create vault "${name}": ${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}`
        );
    }
}

