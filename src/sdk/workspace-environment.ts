export type ComplyEnvironment = 'dev' | 'int' | 'prod';

export const WORKSPACE_URL_TEMPLATES: Record<ComplyEnvironment, string> = {
    dev: 'https://{workspaceUuid}.workspaces.dev.wecancomply.arcanite.ch',
    int: 'https://{workspaceUuid}.workspaces.int.wecancomply.arcanite.ch',
    prod: 'https://{workspaceUuid}.workspaces.wecancomply.arcanite.ch',
};

export interface WorkspaceUrlOptions {
    workspaceUrlTemplate?: string;
    environment?: ComplyEnvironment;
}

export function resolveWorkspaceUrlTemplate(options: WorkspaceUrlOptions): string {
    const hasTemplate = Boolean(options.workspaceUrlTemplate);
    const hasEnvironment = Boolean(options.environment);

    if (hasTemplate && hasEnvironment) {
        throw new Error(
            'Cannot set both "workspaceUrlTemplate" and "environment". Use "environment" ("dev", "int", or "prod") or provide "workspaceUrlTemplate" alone.'
        );
    }
    if (hasTemplate) {
        return options.workspaceUrlTemplate!;
    }
    if (!options.environment) {
        throw new Error(
            'Missing workspace URL configuration: set "environment" to "dev", "int", or "prod", or provide "workspaceUrlTemplate".'
        );
    }
    const template = WORKSPACE_URL_TEMPLATES[options.environment];
    if (!template) {
        throw new Error(
            `Invalid "environment" value "${options.environment}". Expected one of: dev, int, prod.`
        );
    }
    return template;
}
