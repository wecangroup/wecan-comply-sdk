import type { WorkspaceUuid, WorkspaceDetails, BusinessType, Relation, NetworkEntry } from '../../types';
import type { FeatureContext } from './BaseFeature';

/**
 * Workspace-related API functions
 */
export class WorkspaceFeature {
    constructor(private context: FeatureContext) {}

    async getWorkspaceDetails(workspaceUuid: WorkspaceUuid): Promise<WorkspaceDetails> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        const details = await workspaceClient.get<WorkspaceDetails>(`/api/workspace/`);
        return {
            uuid: details.uuid,
            url: details.url,
            name: details.name,
            business_type: details.business_type,
            public_key: details.public_key,
        };
    }

    async getBusinessTypes(workspaceUuid: WorkspaceUuid, availableForBusinessType?: string): Promise<BusinessType[]> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        const url = availableForBusinessType 
            ? `/api/business-types/?available_for_business_type=${availableForBusinessType}`
            : '/api/business-types/';

        const businessTypes = await workspaceClient.get<BusinessType[]>(url);
        return businessTypes.map((businessType: BusinessType) => ({
            label: businessType.label,
            value: businessType.value,
        }));
    }

    async getRelations(workspaceUuid: WorkspaceUuid): Promise<Relation[]> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        const apiRelations = await workspaceClient.get<{ results: any[] }>(`/api/relations/?status=active`);
        
        // Map the complex API response objects to simplified Relation objects
        return apiRelations.results.map((apiRelation: any): Relation => ({
            uuid: apiRelation.uuid,
            status: apiRelation.status,
            business_type: apiRelation.workspace_details?.business_type || '',
            name: apiRelation.workspace_details?.name || '',
            public_key: apiRelation.workspace_details?.public_key || '',
            is_virtual: apiRelation.is_virtual,
        }));
    }

    async getNetworkEntries(workspaceUuid: WorkspaceUuid, businessType?: string): Promise<NetworkEntry[]> {
        const workspaceClient = this.context.getWorkspaceClient(workspaceUuid);
        const url = businessType ? `/api/network/?business_type=${businessType}` : '/api/network/';
        const apiNetworkEntities = await workspaceClient.get<{ results: any[] }>(url);

        return apiNetworkEntities.results.map((apiNetworkEntity: any): NetworkEntry => ({
            uuid: apiNetworkEntity.uuid,
            status: apiNetworkEntity.status,
            name: apiNetworkEntity.name,
            is_virtual: apiNetworkEntity.is_virtual,
            business_type: apiNetworkEntity.business_type,
            public_key: apiNetworkEntity.public_key,
            url: apiNetworkEntity.url,
            description: apiNetworkEntity.description,
            street: apiNetworkEntity.street,
            city: apiNetworkEntity.city,
            zip_code: apiNetworkEntity.zip_code,
            country: apiNetworkEntity.country,
            fax: apiNetworkEntity.fax,
            phone: apiNetworkEntity.phone,
            website: apiNetworkEntity.website,
            contact_name: apiNetworkEntity.contact_name,
            contact_email: apiNetworkEntity.contact_email,
        }));
    }
}
