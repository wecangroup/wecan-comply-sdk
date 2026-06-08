import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    createVaultWithPushTemplates,
    registerPushFormsFromTemplates,
} from './vault-creation.js';
import type { WorkspaceClient } from './BaseFeature.js';

function createMockWorkspaceClient(handlers: {
    post?: <T = unknown>(path: string, body?: unknown) => Promise<T>;
}): WorkspaceClient {
    return {
        get: async () => {
            throw new Error('GET not expected');
        },
        post: async <T = unknown>(path: string, body?: unknown) => {
            if (handlers.post) {
                return handlers.post<T>(path, body);
            }
            throw new Error(`Unexpected POST ${path}`);
        },
        put: async () => {
            throw new Error('PUT not expected');
        },
        patch: async () => {
            throw new Error('PATCH not expected');
        },
        delete: async () => {
            throw new Error('DELETE not expected');
        },
    };
}

describe('registerPushFormsFromTemplates', () => {
    it('registers push forms without relations', async () => {
        const calls: Array<{ path: string; body?: unknown }> = [];

        const workspaceClient = createMockWorkspaceClient({
            post: async <T>(path: string, body?: unknown) => {
                calls.push({ path, body });
                if (path === '/api/forms/push-forms/actions/register/') {
                    return { uuid: 'push-form-uuid' } as T;
                }
                return {} as T;
            },
        });

        await registerPushFormsFromTemplates(
            workspaceClient,
            ['template-uuid-1', 'template-uuid-2'],
            'answer-pool-uuid'
        );

        assert.equal(calls.length, 2);
        assert.deepEqual(calls[0], {
            path: '/api/forms/push-forms/actions/register/',
            body: {
                push_template_uuid: 'template-uuid-1',
                answer_pool_uuid: 'answer-pool-uuid',
            },
        });
        assert.deepEqual(calls[1], {
            path: '/api/forms/push-forms/actions/register/',
            body: {
                push_template_uuid: 'template-uuid-2',
                answer_pool_uuid: 'answer-pool-uuid',
            },
        });
    });

    it('registers relation push forms when relations are provided', async () => {
        const calls: Array<{ path: string; body?: unknown }> = [];

        const workspaceClient = createMockWorkspaceClient({
            post: async <T>(path: string, body?: unknown) => {
                calls.push({ path, body });
                if (path === '/api/forms/push-forms/actions/register/') {
                    return { uuid: 'push-form-uuid' } as T;
                }
                return {} as T;
            },
        });

        await registerPushFormsFromTemplates(
            workspaceClient,
            ['template-uuid'],
            'answer-pool-uuid',
            ['relation-uuid']
        );

        assert.equal(calls.length, 2);
        assert.deepEqual(calls[1], {
            path: '/api/forms/relation-push-forms/actions/register/',
            body: {
                push_form_uuid: 'push-form-uuid',
                relation_uuid: 'relation-uuid',
            },
        });
    });
});

describe('createVaultWithPushTemplates', () => {
    it('creates an answer pool and registers push forms', async () => {
        const calls: Array<{ path: string; body?: unknown }> = [];

        const workspaceClient = createMockWorkspaceClient({
            post: async <T>(path: string, body?: unknown) => {
                calls.push({ path, body });
                if (path === '/api/forms/answer-pools/') {
                    return {
                        uuid: 'vault-uuid',
                        name: 'My Vault',
                        status: 'active',
                        template_type: 'kyc',
                        last_updated: new Date(),
                    } as T;
                }
                if (path === '/api/forms/push-forms/actions/register/') {
                    return { uuid: 'push-form-uuid' } as T;
                }
                return {} as T;
            },
        });

        const vault = await createVaultWithPushTemplates(
            workspaceClient,
            'My Vault',
            'kyc',
            ['template-uuid']
        );

        assert.equal(vault.uuid, 'vault-uuid');
        assert.equal(calls.length, 2);
        assert.deepEqual(calls[0].body, {
            name: 'My Vault',
            template_type: 'kyc',
            storage_type: 'block',
        });
    });

    it('throws when no push template UUIDs are provided', async () => {
        const workspaceClient = createMockWorkspaceClient({});

        await assert.rejects(
            () => createVaultWithPushTemplates(workspaceClient, 'My Vault', 'kyc', []),
            { message: 'At least one push template UUID is required' }
        );
    });
});
