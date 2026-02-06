# Examples

This folder contains runnable examples for the Wecan Comply SDK.

## Prerequisites

- Node.js >= 18
- From the repo root: `npm install` (and `npx tsx` will use the project’s dev dependency)

## External Form Request

Demonstrates the External Form Request API: list, create, get metadata, and submit answers. The example imports the SDK from source, so **no build is required** when running from the repo.

### Run

From the **repository root**:

```bash
ACCESS_TOKEN=your-token \
WORKSPACE_UUID=your-workspace-uuid \
WORKSPACE_URL_TEMPLATE='https://{workspaceUuid}.workspaces.int.wecancomply.arcanite.ch' \
npx tsx examples/external-form-request.ts
```

Or use the npm script:

```bash
ACCESS_TOKEN=... WORKSPACE_UUID=... WORKSPACE_URL_TEMPLATE='...' npm run example:external-form-request
```

### Optional environment variables

| Variable | Description |
|----------|-------------|
| `ACCESS_TOKEN` | API access token (required) |
| `WORKSPACE_UUID` | Workspace UUID (required) |
| `WORKSPACE_URL_TEMPLATE` | URL template, e.g. `https://{workspaceUuid}.workspaces.int.wecancomply.arcanite.ch` (required) |
| `PUSH_TEMPLATE_UUID` | Push template UUID; if set, a new external form request is created |
| `SUBMIT_ANSWERS` | Set to `1` to submit example answers (adapt UUIDs to your template) |
| `DEBUG` | Set to `1` to log workspace API requests |
| `WORKSPACE_PRIVATE_KEY` | PGP private key of the workspace (for decrypting answers in step 6) |
| `WORKSPACE_PRIVATE_KEY_PATH` | Path to a file containing the workspace PGP private key (alternative to `WORKSPACE_PRIVATE_KEY`) |

### Example: list and create

```bash
ACCESS_TOKEN=xxx WORKSPACE_UUID=yyy WORKSPACE_URL_TEMPLATE='https://{workspaceUuid}.workspaces.int.wecancomply.arcanite.ch' \
PUSH_TEMPLATE_UUID=your-push-template-uuid \
npx tsx examples/external-form-request.ts
```

### Example: with decryption (step 6 – get push form answers)

To decrypt inline content when calling `getPushFormAnswerContents`, pass the workspace PGP private key:

```bash
ACCESS_TOKEN=xxx WORKSPACE_UUID=yyy WORKSPACE_URL_TEMPLATE='...' \
WORKSPACE_PRIVATE_KEY_PATH=./workspace-private-key.asc \
npx tsx examples/external-form-request.ts
```

Or set the key inline (e.g. from a secret manager):

```bash
export WORKSPACE_PRIVATE_KEY="$(cat workspace-private-key.asc)"
# then run the example with ACCESS_TOKEN, WORKSPACE_UUID, WORKSPACE_URL_TEMPLATE
```
