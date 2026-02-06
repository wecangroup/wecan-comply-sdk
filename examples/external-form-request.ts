/**
 * Example: External Form Request API
 *
 * Run from repo root: npx tsx examples/external-form-request.ts
 * (Uses source code; no need to build first.)
 *
 * Required env: ACCESS_TOKEN, WORKSPACE_UUID, WORKSPACE_URL_TEMPLATE
 * Optional: PUSH_TEMPLATE_UUID, SUBMIT_ANSWERS=1, DEBUG=1
 * For decryption (e.g. getPushFormAnswerContents): WORKSPACE_PRIVATE_KEY or WORKSPACE_PRIVATE_KEY_PATH
 */
import fs from 'fs';
import { WecanComply } from '../src/index.js';

/** First item UUID from metadata (push_template.template_placeholder.items[0].item.uuid) */
function getFirstItemUuid(metadata: Record<string, unknown>): string | undefined {
  const pt = metadata?.push_template as Record<string, unknown> | undefined;
  const items = (pt?.template_placeholder as Record<string, unknown>)?.items as Array<{ item?: { uuid?: string } }> | undefined;
  return items?.[0]?.item?.uuid;
}

/** First entry UUID of the first item (for content[].uuid) */
function getFirstEntryUuid(metadata: Record<string, unknown>): string | undefined {
  const pt = metadata?.push_template as Record<string, unknown> | undefined;
  const items = (pt?.template_placeholder as Record<string, unknown>)?.items as Array<{ item?: { entries?: Array<{ uuid?: string }> } }> | undefined;
  return items?.[0]?.item?.entries?.[0]?.uuid;
}

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const WORKSPACE_UUID = process.env.WORKSPACE_UUID;
const WORKSPACE_URL_TEMPLATE = process.env.WORKSPACE_URL_TEMPLATE;
const PUSH_TEMPLATE_UUID = process.env.PUSH_TEMPLATE_UUID;
const WORKSPACE_PRIVATE_KEY = process.env.WORKSPACE_PRIVATE_KEY;
const WORKSPACE_PRIVATE_KEY_PATH = process.env.WORKSPACE_PRIVATE_KEY_PATH;

function getWorkspacePrivateKey(): string | undefined {
  if (WORKSPACE_PRIVATE_KEY) return WORKSPACE_PRIVATE_KEY.trim();
  if (WORKSPACE_PRIVATE_KEY_PATH) {
    const path = WORKSPACE_PRIVATE_KEY_PATH.trim();
    if (fs.existsSync(path)) return fs.readFileSync(path, 'utf8');
    console.warn(`WORKSPACE_PRIVATE_KEY_PATH not found: ${path}`);
  }
  return undefined;
}

async function main() {
  if (!ACCESS_TOKEN || !WORKSPACE_UUID || !WORKSPACE_URL_TEMPLATE) {
    console.error(
      'Missing required env: ACCESS_TOKEN, WORKSPACE_UUID, WORKSPACE_URL_TEMPLATE'
    );
    process.exit(1);
  }

  const privateKey = getWorkspacePrivateKey();
  const workspaceKeys = privateKey && WORKSPACE_UUID
    ? [{ workspaceUuid: WORKSPACE_UUID, privateKey }]
    : undefined;
  if (!workspaceKeys) {
    console.warn(
      'No WORKSPACE_PRIVATE_KEY or WORKSPACE_PRIVATE_KEY_PATH: getPushFormAnswerContents will not decrypt inline content.'
    );
  }

  const sdk = await WecanComply.create({
    accessToken: ACCESS_TOKEN,
    workspaceUrlTemplate: WORKSPACE_URL_TEMPLATE,
    workspaceKeys,
    debug: process.env.DEBUG === '1',
  });

  const workspaceUuid = WORKSPACE_UUID;

  // --- 1. List external form requests ---
  console.log('\n--- List external form requests ---');
  const list = await sdk.listExternalFormRequests(workspaceUuid, {
    status: 'active',
    limit: 5,
    ordering: ['-created_at'],
  });
  console.log(`Total: ${list.count}, showing up to ${list.results.length}`);
  for (const req of list.results) {
    console.log(
      `  - ${req.uuid} | status=${req.status} | submissions=${req.submission_count} | url=${req.url}`
    );
  }

  let requestUuid: string | undefined;

  // --- 2. Create a new external form request (if PUSH_TEMPLATE_UUID is set) ---
  if (PUSH_TEMPLATE_UUID) {
    console.log('\n--- Create external form request ---');
    const created = await sdk.createExternalFormRequest(
      workspaceUuid,
      PUSH_TEMPLATE_UUID,
      'active',
      'Information text'
    );
    requestUuid = created.uuid;
    console.log(
      `Created: ${created.uuid} | url=${created.url} | status=${created.status}`
    );
  } else if (list.results.length > 0) {
    requestUuid = list.results[0].uuid;
    console.log(
      `\nNo PUSH_TEMPLATE_UUID set; using first listed request: ${requestUuid}`
    );
  }

  if (!requestUuid) {
    console.log(
      '\nNo request UUID available (create one with PUSH_TEMPLATE_UUID or ensure there are existing requests). Skipping metadata and submit.'
    );
    return;
  }

  // ------------------------------------------------------------------------------------------------
  // These steps (3 and 4) simulate the form submission process from the client side (browser).
  // ------------------------------------------------------------------------------------------------
  // --- 3. Get metadata (form structure for rendering) ---
  console.log('\n--- Get external form request metadata ---');
  const metadata = await sdk.getExternalFormRequestMetadata(
    workspaceUuid,
    requestUuid
  );
  console.log('Workspace:', metadata.workspace?.name ?? metadata.workspace?.uuid);
  console.log('Push template:', metadata.push_template?.label ?? metadata.push_template?.uuid);
  console.log('Status:', metadata.status);
  if (metadata.information_text) {
    console.log('Information text:', metadata.information_text);
  }
  
  // --- 4. Submit answers (use first item/entry from metadata) ---
  const shouldSubmit = process.env.SUBMIT_ANSWERS === '1';
  const meta = metadata as unknown as Record<string, unknown>;
  const firstItemUuid = getFirstItemUuid(meta);
  const firstEntryUuid = getFirstEntryUuid(meta);
  if (shouldSubmit && metadata.push_template && firstItemUuid && firstEntryUuid) {
    console.log('\n--- Submit answers (example) ---');
    const answers = [
      {
        item_placeholder_uuid: firstItemUuid,
        content: [
          {
            uuid: firstEntryUuid,
            content_format: 'inline',
            content: 'Example inline answer',
          },
        ],
      },
    ];
    await sdk.submitExternalFormRequest(workspaceUuid, requestUuid, answers);
    console.log('Submitted answers (example payload).');
  } else if (!shouldSubmit) {
    console.log(
      '\nTo submit example answers, set SUBMIT_ANSWERS=1 (and ensure placeholder/entry UUIDs match your template).'
    );
  }
  // ------------------------------------------------------------------------------------------------

  // --- 5. Get external form request (retrieve full details after submit) ---
  console.log('\n--- Get external form request ---');
  const request = await sdk.getExternalFormRequest(workspaceUuid, requestUuid);
  console.log(
    `Request: ${request.uuid} | status: ${request.status} | submissions: ${request.submission_count} | url: ${request.url}`
  );
  console.log('Push forms:', JSON.stringify(request.push_forms, null, 2));

  // --- 6. Get answers of the first push form ---
  const firstPushForm = request.push_forms?.[0];
  if (firstPushForm) {
    console.log('\n--- Get answers (first push form) ---');
    const answersResponse = await sdk.getPushFormAnswerContents(workspaceUuid, firstPushForm.uuid);
    console.log(`Count: ${answersResponse.count}`);
    const answersWithEntries = answersResponse.results.filter(
      (r: { content?: Array<{ entries?: unknown[] }> }) =>
        r.content?.some((c) => Array.isArray(c.entries) && c.entries.length > 0)
    );
    if (answersWithEntries.length > 0) {
      console.log('Answers:', JSON.stringify(answersWithEntries, null, 2));
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
