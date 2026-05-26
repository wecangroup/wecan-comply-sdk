import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WecanComply, type WecanComplyOptions } from './WecanComply.js';
import type { HttpClientLike, HttpRequest, HttpResponse } from '../http/HttpClient.js';
import { WORKSPACE_URL_TEMPLATES } from './workspace-environment.js';

function createMockHttp(): HttpClientLike & { lastRequest?: HttpRequest } {
    const client: HttpClientLike & { lastRequest?: HttpRequest } = {
        async request<T>(req: HttpRequest): Promise<HttpResponse<T>> {
            client.lastRequest = req;
            return {
                status: 200,
                headers: {},
                data: {} as T,
                raw: new Response(),
            };
        },
    };
    return client;
}

describe('WecanComply environment option', () => {
    it('builds workspace URLs from environment without network calls', async () => {
        const http = createMockHttp();
        const sdk = await WecanComply.create({
            accessToken: 'test-token',
            environment: 'int',
            http,
        });

        const workspaceUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const client = sdk.getWorkspaceClient(workspaceUuid);
        await client.get('/api/ping/');

        assert.ok(http.lastRequest);
        assert.equal(
            http.lastRequest.url,
            'https://a1b2c3d4e5f67890abcdef1234567890.workspaces.int.wecancomply.arcanite.ch/api/ping/'
        );
        assert.equal(
            http.lastRequest.headers?.authorization,
            'API-Key test-token'
        );
    });

    it('supports dev and prod environments', async () => {
        for (const environment of ['dev', 'prod'] as const) {
            const http = createMockHttp();
            const sdk = await WecanComply.create({
                accessToken: 'token',
                environment,
                http,
            });
            await sdk.getWorkspaceClient('deadbeef').get('/');

            const expectedBase = WORKSPACE_URL_TEMPLATES[environment].replace(
                '{workspaceUuid}',
                'deadbeef'
            );
            assert.equal(http.lastRequest?.url, `${expectedBase}/`);
        }
    });

    it('still supports workspaceUrlTemplate alone (legacy)', async () => {
        const http = createMockHttp();
        const customTemplate = 'https://{workspaceUuid}.legacy.example';
        const sdk = await WecanComply.create({
            accessToken: 'token',
            workspaceUrlTemplate: customTemplate,
            http,
        });
        await sdk.getWorkspaceClient('abc').get('/v1/');

        assert.equal(http.lastRequest?.url, 'https://abc.legacy.example/v1/');
    });

    it('rejects create() when both environment and workspaceUrlTemplate are set', async () => {
        await assert.rejects(
            () =>
                WecanComply.create({
                    accessToken: 'token',
                    environment: 'int',
                    workspaceUrlTemplate: 'https://{workspaceUuid}.custom.example',
                } as unknown as WecanComplyOptions),
            {
                message:
                    'Cannot set both "workspaceUrlTemplate" and "environment". Use "environment" ("dev", "int", or "prod") or provide "workspaceUrlTemplate" alone.',
            }
        );
    });

    it('rejects create() when workspace URL configuration is missing', async () => {
        await assert.rejects(
            () =>
                WecanComply.create({
                    accessToken: 'token',
                } as unknown as WecanComplyOptions),
            {
                message:
                    'Missing workspace URL configuration: set "environment" to "dev", "int", or "prod", or provide "workspaceUrlTemplate".',
            }
        );
    });
});
