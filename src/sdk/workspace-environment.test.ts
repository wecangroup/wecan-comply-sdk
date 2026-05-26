import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    WORKSPACE_URL_TEMPLATES,
    resolveWorkspaceUrlTemplate,
    type ComplyEnvironment,
} from './workspace-environment.js';

describe('resolveWorkspaceUrlTemplate', () => {
    const environments: ComplyEnvironment[] = ['dev', 'int', 'prod'];

    for (const environment of environments) {
        it(`resolves environment "${environment}" to the predefined template`, () => {
            const template = resolveWorkspaceUrlTemplate({ environment });
            assert.equal(template, WORKSPACE_URL_TEMPLATES[environment]);
        });
    }

    it('uses a custom workspaceUrlTemplate when provided alone', () => {
        const custom = 'https://{workspaceUuid}.custom.example.com';
        assert.equal(
            resolveWorkspaceUrlTemplate({ workspaceUrlTemplate: custom }),
            custom
        );
    });

    it('throws when both workspaceUrlTemplate and environment are set', () => {
        assert.throws(
            () =>
                resolveWorkspaceUrlTemplate({
                    workspaceUrlTemplate: 'https://{workspaceUuid}.custom.example.com',
                    environment: 'int',
                }),
            {
                message:
                    'Cannot set both "workspaceUrlTemplate" and "environment". Use "environment" ("dev", "int", or "prod") or provide "workspaceUrlTemplate" alone.',
            }
        );
    });

    it('throws when neither workspaceUrlTemplate nor environment is set', () => {
        assert.throws(() => resolveWorkspaceUrlTemplate({}), {
            message:
                'Missing workspace URL configuration: set "environment" to "dev", "int", or "prod", or provide "workspaceUrlTemplate".',
        });
    });

    it('throws for an invalid environment value at runtime', () => {
        assert.throws(
            () =>
                resolveWorkspaceUrlTemplate({
                    environment: 'staging' as ComplyEnvironment,
                }),
            {
                message:
                    'Invalid "environment" value "staging". Expected one of: dev, int, prod.',
            }
        );
    });

    it('treats empty workspaceUrlTemplate as missing and requires environment', () => {
        assert.throws(
            () => resolveWorkspaceUrlTemplate({ workspaceUrlTemplate: '' }),
            {
                message:
                    'Missing workspace URL configuration: set "environment" to "dev", "int", or "prod", or provide "workspaceUrlTemplate".',
            }
        );
    });
});
