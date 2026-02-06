# Wecan Comply SDK (TypeScript)

TypeScript SDK for the Wecan Comply API, usable from the browser or Node.js (>=18).

## Features

- 🔐 **Authentication**: Access token-based authentication
- 🔑 **Encryption**: OpenPGP encryption/decryption support
- 📦 **Workspace Management**: Get workspace details, business types, relations, and network entries
- 🗄️ **Vault Management**: Manage vaults, placeholders, answers, files, and sharing
- 📋 **External Form Requests**: Create and manage external form requests for public form submissions
- 🔄 **Automatic Retries**: Built-in retry logic with exponential backoff
- 🌐 **Dual Format**: Supports both ESM and CommonJS
- 📝 **Request Logging**: Automatic logging of all workspace API calls

## Install

```bash
npm i wecan-comply-sdk-js
```

## Quick Start

### Authentication

The SDK uses access token authentication. You need to provide an `accessToken` when creating the SDK instance:

```ts
import { WecanComply } from 'wecan-comply-sdk-js';

// With workspace keys (for decryption/encryption operations)
const client = await WecanComply.create({
  accessToken: 'your-access-token-here',
  workspaceKeys: [
    {
      workspaceUuid: 'workspace-uuid-1',
      privateKey: `-----BEGIN PGP PRIVATE KEY BLOCK-----
...
-----END PGP PRIVATE KEY BLOCK-----`
    },
    {
      workspaceUuid: 'workspace-uuid-2',
      privateKey: `-----BEGIN PGP PRIVATE KEY BLOCK-----
...
-----END PGP PRIVATE KEY BLOCK-----`
    }
  ],
  workspaceUrlTemplate: 'https://{workspaceUuid}.workspaces.int.wecancomply.arcanite.ch',
  debug: true // Optional: enable logging of workspace API calls
});
```

**Important Notes**:
- When you provide `workspaceKeys`, the SDK automatically fetches the corresponding public keys from the API and stores both keys for encryption/decryption operations
- The `workspaceUrlTemplate` must include `{workspaceUuid}` as a placeholder, which will be replaced with the actual workspace UUID
- Enable `debug: true` to see all workspace API calls logged to the console (useful for development)

### Workspace Operations

```ts
const workspaceUuid = 'your-workspace-uuid';

// Get workspace details
const details = await client.getWorkspaceDetails(workspaceUuid);

// Get business types
const businessTypes = await client.getBusinessTypes(workspaceUuid);
const specificTypes = await client.getBusinessTypes(workspaceUuid, 'bank');

// Get relations
const relations = await client.getRelations(workspaceUuid);

// Get network entries
const networkEntries = await client.getNetworkEntries(workspaceUuid);
const filteredEntries = await client.getNetworkEntries(workspaceUuid, 'bank');
```

### Vault Operations

```ts
const workspaceUuid = 'your-workspace-uuid';
const vaultId = 'your-vault-uuid';

// Get all vaults
const vaults = await client.getAllVaults(workspaceUuid);

// Get vault placeholders (template structure)
const placeholders = await client.getVaultPlaceholders(workspaceUuid, vaultId);

// Get vault answers (decrypted)
const answers = await client.getVaultAnswers(workspaceUuid, vaultId);

// Download a file from a vault
const blob = await client.downloadVaultFile(workspaceUuid, fileUuid, 'application/pdf');

// Lock/unlock vault
await client.lockVault(workspaceUuid, vaultId);
await client.unlockVault(workspaceUuid, vaultId);

// Save vault answers
await client.saveVaultAnswers(workspaceUuid, vaultId, modifiedAnswers);

// Get push categories
const pushCategories = await client.getPushCategories(workspaceUuid);
const filteredCategories = await client.getPushCategories(workspaceUuid, 'template-type');

// Create a new vault
const newVault = await client.createVault(
  workspaceUuid,
  'My Vault Name',
  'template-type',
  'push-category-uuid',
  ['relation-uuid-1', 'relation-uuid-2']
);

// Share a vault with a relation
await client.shareVault(workspaceUuid, vaultId, 'relation-uuid');
```

### Working with Vault Answers

```ts
const answers = await client.getVaultAnswers(workspaceUuid, vaultId);

for (const answer of answers) {
  for (const contentItem of answer.content) {
    for (const entry of contentItem.entries) {
      if (entry.content_format === 'file') {
        // The entry.content contains file metadata
        // Download the file using downloadVaultFile()
        const blob = await client.downloadVaultFile(
          workspaceUuid,
          entry.content.file_uuid,
          entry.content.file_mimetype
        );
      } else if (entry.content_format === 'inline') {
        // Access decrypted content directly
        console.log('Inline content:', entry.content);
      }
    }
  }
}

// Modify and save answers
const modifiedAnswers = answers.map(answer => ({
  ...answer,
  content: answer.content.map(contentItem => ({
    ...contentItem,
    entries: contentItem.entries.map(entry => {
      if (entry.content_format === 'inline') {
        return {
          ...entry,
          new_content: 'Updated content here' // Only entries with new_content will be updated
        };
      }
      return entry;
    })
  }))
}));

await client.saveVaultAnswers(workspaceUuid, vaultId, modifiedAnswers);
```

### External Form Request Operations

External Form Requests allow you to create public-facing forms that external users can fill out and submit. These forms are based on push templates and can be shared via a public URL.

```ts
const workspaceUuid = 'your-workspace-uuid';

// List external form requests with optional filtering
const requests = await client.listExternalFormRequests(workspaceUuid, {
  status: 'active',
  push_template_uuid: 'template-uuid',
  limit: 10,
  offset: 0,
  ordering: ['-created_at'] // Sort by creation date descending
});

// Create a new external form request
const newRequest = await client.createExternalFormRequest(
  workspaceUuid,
  'push-template-uuid',
  'active' // Optional: 'active' | 'archived' | 'expired'
);

// Get a specific external form request
const request = await client.getExternalFormRequest(workspaceUuid, requestUuid);

// Get form metadata (structure for rendering the form)
// This endpoint is public and doesn't require authentication
const metadata = await client.getExternalFormRequestMetadata(workspaceUuid, requestUuid);
console.log('Form structure:', metadata.push_template);
console.log('Information text:', metadata.information_text);

// Upload a file for the form (public endpoint)
const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
const file = fileInput.files[0];
const fileInfo = await client.uploadExternalFormRequestFile(
  workspaceUuid,
  requestUuid,
  file
);
console.log('Uploaded file UUID:', fileInfo.file_uuid);

// Submit form answers (public endpoint)
await client.submitExternalFormRequest(
  workspaceUuid,
  requestUuid,
  [
    {
      item_placeholder_uuid: 'item-placeholder-uuid',
      content: [
        {
          uuid: 'entry-uuid',
          content_format: 'inline',
          content: 'Answer text here'
        },
        {
          uuid: 'file-entry-uuid',
          content_format: 'file',
          content: fileInfo.file_uuid // Use the UUID from file upload
        }
      ]
    }
  ]
);
```

**Note**: The `uploadExternalFormRequestFile` and `submitExternalFormRequest` endpoints are public and don't require authentication. This allows external users to submit forms without needing API credentials.

## Configuration Options

```ts
interface WorkspaceKeyConfig {
  /** The UUID of the workspace */
  workspaceUuid: string;
  /** The private key for the workspace (PGP format) */
  privateKey: string;
}

interface WecanComplyOptions {
  /** Access token for authentication (required) */
  accessToken: string;
  /** List of workspace private keys to load (optional, needed for encryption/decryption) */
  workspaceKeys?: WorkspaceKeyConfig[];
  /** Template for workspace-specific URLs, e.g., 'https://{workspaceUuid}.workspaces.int.wecancomply.arcanite.ch' */
  workspaceUrlTemplate: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Number of retry attempts (default: 2) */
  retries?: number;
  /** Custom HTTP client implementation */
  http?: HttpClient;
  /** Default headers for all requests */
  defaultHeaders?: HeadersInitLike;
  /** Callback function called when a 401 Unauthorized error occurs */
  onUnauthorized?: (error: Error) => void | Promise<void>;
  /** Enable debug logging for workspace client requests (default: false) */
  debug?: boolean;
}
```

**Authentication Notes**:
- `accessToken` is required for all operations
- When `workspaceKeys` are provided, the SDK automatically fetches the corresponding public keys from the API
- Public keys are stored alongside private keys for encryption/decryption operations
- Without `workspaceKeys`, you can still perform read-only operations, but decryption will not be available

## Error Handling

The SDK provides an `onUnauthorized` callback for handling 401 errors:

```ts
const client = await WecanComply.create({
  accessToken: 'your-access-token-here',
  workspaceUrlTemplate: 'https://{workspaceUuid}.workspaces.int.wecancomply.arcanite.ch',
  onUnauthorized: async (error) => {
    console.error('Unauthorized access:', error);
    // Handle token refresh or re-authentication here
  }
});
```

## Retries

By default, the SDK uses `axios-retry` with exponential backoff:
- **Retries**: Configurable via the `retries` option (default: 2)
- **Retry conditions**: Network errors/timeouts, `408`, `429`, and `5xx` status codes

## Low-level HTTP Access

You can access the workspace-specific HTTP client for custom requests:

```ts
// Get a workspace client (all requests are automatically logged)
const workspaceClient = client.getWorkspaceClient(workspaceUuid);

// GET request
const data = await workspaceClient.get('/api/some/endpoint/');

// POST request
const result = await workspaceClient.post('/api/some/endpoint/', { data: 'value' });

// PUT request
await workspaceClient.put('/api/some/endpoint/', { data: 'value' });

// PATCH request
await workspaceClient.patch('/api/some/endpoint/', { data: 'value' });

// DELETE request
await workspaceClient.delete('/api/some/endpoint/');
```

## Building Locally

```bash
npm install
npm run build
```

## TypeScript Support

This package includes full TypeScript definitions. All types are exported from the main module:

```ts
import type {
  // Configuration
  WecanComplyOptions,
  WorkspaceKeyConfig,
  
  // Identifiers
  WorkspaceUuid,
  VaultUuid,
  ExternalFormRequestUuid,
  
  // Workspace
  WorkspaceDetails,
  BusinessType,
  Relation,
  NetworkEntry,
  
  // Vault
  Vault,
  VaultPlaceholder,
  VaultAnswer,
  PushCategory,
  
  // External Form Request
  ExternalFormRequest,
  ExternalFormRequestStatus,
  ExternalFormRequestMetadata,
  ExternalFormRequestListOptions,
  PaginatedExternalFormRequestList,
  ExternalFormAnswerRequest,
  ExternalFormAnswerEntryRequest,
  ExternalFormFileUploadResponse,
  
  // ... and more
} from 'wecan-comply-sdk-js';
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Wecan Group
