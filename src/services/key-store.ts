import type { WorkspacePrivateKey, WorkspacePublicKey, WorkspaceUuid } from '../types';
import { normalizePgpPrivateKey } from '../utils/pgp-key';

export interface WorkspaceKeys {
    public?: WorkspacePublicKey;
    private?: WorkspacePrivateKey;
}

const workspacesKeys: Record<WorkspaceUuid, WorkspaceKeys> = Object.create(null);

export function setWorkspaceKeys(workspaceUuid: WorkspaceUuid, keys: WorkspaceKeys): void {
    if (!workspaceUuid) throw new Error('workspaceUuid is required');
    const privateKey = keys.private != null ? normalizePgpPrivateKey(keys.private) : workspacesKeys[workspaceUuid]?.private;
    workspacesKeys[workspaceUuid] = {
        public: keys.public ?? workspacesKeys[workspaceUuid]?.public,
        private: privateKey,
    };
}

export function setWorkspacePublicKey(workspaceUuid: WorkspaceUuid, publicKey: WorkspacePublicKey): void {
    if (!workspaceUuid) throw new Error('workspaceUuid is required');
    workspacesKeys[workspaceUuid] = workspacesKeys[workspaceUuid] || {};
    workspacesKeys[workspaceUuid].public = publicKey;
}

export function setWorkspacePrivateKey(workspaceUuid: WorkspaceUuid, privateKey: WorkspacePrivateKey): void {
    if (!workspaceUuid) throw new Error('workspaceUuid is required');
    workspacesKeys[workspaceUuid] = workspacesKeys[workspaceUuid] || {};
    workspacesKeys[workspaceUuid].private = normalizePgpPrivateKey(privateKey);
}

export function getWorkspaceKeys(workspaceUuid: WorkspaceUuid): WorkspaceKeys {
    return workspacesKeys[workspaceUuid] || {};
}

export function getPublicKey(workspaceUuid: WorkspaceUuid): WorkspacePublicKey | undefined {
    return getWorkspaceKeys(workspaceUuid).public;
}

export function getPrivateKey(workspaceUuid: WorkspaceUuid): WorkspacePrivateKey | undefined {
    return getWorkspaceKeys(workspaceUuid).private;
}

export function clearWorkspaceKeys(workspaceUuid: WorkspaceUuid): void {
    delete workspacesKeys[workspaceUuid];
}

export function clearAllWorkspaceKeys(): void {
    for (const k of Object.keys(workspacesKeys)) delete workspacesKeys[k];
}


